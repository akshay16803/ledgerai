from fastapi import FastAPI, HTTPException, Request, Response, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import uuid
import httpx
import asyncio
import json
import base64
import re
import csv
import io
import warnings
import logging
import secrets
import hashlib
import pdfplumber
from urllib.parse import urlencode, quote
from email.utils import parsedate_to_datetime

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from openai import OpenAI
import resend

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spentyai")

app = FastAPI(title="SpentyAI API")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "spentyai")

# Validate critical environment variables
if not MONGO_URL:
    raise RuntimeError("MONGO_URL environment variable is required")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
MICROSOFT_CLIENT_ID = os.environ.get("MICROSOFT_CLIENT_ID")
MICROSOFT_TENANT_ID = os.environ.get("MICROSOFT_TENANT_ID")
MICROSOFT_CLIENT_SECRET = os.environ.get("MICROSOFT_CLIENT_SECRET")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

MS_AUTHORITY = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}"
MS_AUTH_URL = f"{MS_AUTHORITY}/oauth2/v2.0/authorize"
MS_TOKEN_URL = f"{MS_AUTHORITY}/oauth2/v2.0/token"
MS_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
MS_SCOPES = "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access"

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# CORS origins from environment variable, defaults to allow all for flexibility
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
if CORS_ORIGINS == "*":
    ALLOWED_ORIGINS = ["*"]
else:
    ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ─── Pydantic Models ───────────────────────────────────────────────

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    email_verified: bool = False

class AccountCreate(BaseModel):
    name: str
    account_type: str  # asset, liability, income, expense, equity
    sub_type: Optional[str] = None  # bank, cash, credit_card, loan, etc.
    opening_balance: float = 0.0
    currency: str = "INR"
    description: Optional[str] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    sub_type: Optional[str] = None
    description: Optional[str] = None
    currency: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    category_type: str  # income or expense
    parent_id: Optional[str] = None  # null means top-level, set to parent category_id for subcategory

class CategoryUpdate(BaseModel):
    name: Optional[str] = None

class TransactionCreate(BaseModel):
    transaction_type: str  # income, expense, transfer
    amount: float
    date: str  # ISO date string
    account_id: str  # primary account
    to_account_id: Optional[str] = None  # for transfers
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    description: Optional[str] = None
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None  # monthly, weekly, yearly
    source: str = "manual"  # manual, email, sms
    status: str = "approved"  # approved, pending_review, rejected

class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    date: Optional[str] = None
    account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    description: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[str] = None

class FeatureRequestCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = None

class SmsMessage(BaseModel):
    sender: str  # phone number or sender name
    body: str
    timestamp: str  # ISO datetime string
    phone_number: Optional[str] = None  # device phone number

class SmsUpload(BaseModel):
    messages: List[SmsMessage]


# ─── Auth Helpers ───────────────────────────────────────────────────

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]}, {"_id": 0}
    )
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc


# ─── Auth Routes ────────────────────────────────────────────────────

FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
BACKEND_URL = os.environ.get("BACKEND_URL", "")

GOOGLE_AUTH_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


def _get_frontend_url(request: Request) -> str:
    """Resolve frontend base URL for post-auth redirects."""
    if FRONTEND_URL:
        return FRONTEND_URL.rstrip("/")
    scheme = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("host", "")
    return f"{scheme}://{host}"


def _get_backend_url(request: Request) -> str:
    """Resolve backend's own public URL for OAuth callbacks."""
    if BACKEND_URL:
        return BACKEND_URL.rstrip("/")
    scheme = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("host", "")
    return f"{scheme}://{host}"


def _get_google_auth_callback_uri(request: Request) -> str:
    """Build the Google OAuth callback URI pointing to the backend."""
    base = _get_backend_url(request)
    return f"{base}/api/auth/google/callback"


@app.get("/api/auth/google")
async def google_login(request: Request):
    """Initiate Google OAuth 2.0 login flow."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    callback_uri = _get_google_auth_callback_uri(request)
    state = secrets.token_urlsafe(32)

    await db.auth_oauth_states.insert_one({
        "state": state,
        "redirect_uri": callback_uri,
        "frontend_url": _get_frontend_url(request),
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": callback_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_AUTH_SCOPES),
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(google_auth_url)


@app.get("/api/auth/google/callback")
async def google_callback(request: Request, response: Response, code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth 2.0 callback, create session, redirect to frontend."""
    # Resolve frontend URL early for error redirects
    frontend_url = _get_frontend_url(request)

    if error:
        logger.error(f"Google OAuth error: {error}")
        return RedirectResponse(f"{frontend_url}/login?error={error}")

    if not code or not state:
        return RedirectResponse(f"{frontend_url}/login?error=missing_params")

    # Validate state
    state_doc = await db.auth_oauth_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        return RedirectResponse(f"{frontend_url}/login?error=invalid_state")

    await db.auth_oauth_states.delete_one({"state": state})

    if state_doc.get("expires_at"):
        expires_at = state_doc["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return RedirectResponse(f"{frontend_url}/login?error=state_expired")

    # Use frontend_url from the state doc (captured at initiation time)
    frontend_url = state_doc.get("frontend_url", frontend_url)
    callback_uri = state_doc.get("redirect_uri", _get_google_auth_callback_uri(request))

    # Exchange authorization code for tokens
    try:
        async with httpx.AsyncClient() as http_client:
            token_resp = await http_client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": callback_uri,
                    "grant_type": "authorization_code",
                },
            )
        if token_resp.status_code != 200:
            logger.error(f"Google token exchange failed: {token_resp.text}")
            return RedirectResponse(f"{frontend_url}/login?error=token_exchange_failed")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")

        # Fetch user info from Google
        async with httpx.AsyncClient() as http_client:
            userinfo_resp = await http_client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if userinfo_resp.status_code != 200:
            logger.error(f"Google userinfo fetch failed: {userinfo_resp.text}")
            return RedirectResponse(f"{frontend_url}/login?error=userinfo_failed")

        userinfo = userinfo_resp.json()
    except Exception as e:
        logger.error(f"Google OAuth exchange error: {e}")
        return RedirectResponse(f"{frontend_url}/login?error=oauth_error")

    email = userinfo.get("email", "")
    name = userinfo.get("name", "")
    picture = userinfo.get("picture", "")

    if not email:
        return RedirectResponse(f"{frontend_url}/login?error=no_email")

    # Create or update user
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        verification_token = secrets.token_urlsafe(32)
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "email_verified": False,
            "verification_token": verification_token,
            "created_at": datetime.now(timezone.utc),
        })
        await seed_default_data(user_id)
        asyncio.create_task(send_verification_email(email, name, verification_token, frontend_url))

    # Create session
    session_token = secrets.token_urlsafe(48)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })

    # Build redirect response with session cookie
    redirect_resp = RedirectResponse(f"{frontend_url}/dashboard", status_code=302)
    redirect_resp.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600,
    )
    return redirect_resp


@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"message": "Logged out"}


# ─── Default Data Seeding ───────────────────────────────────────────

async def seed_default_data(user_id: str):
    default_accounts = [
        {"name": "Cash", "account_type": "asset", "sub_type": "cash", "opening_balance": 0, "currency": "INR"},
        {"name": "Bank Account", "account_type": "asset", "sub_type": "bank", "opening_balance": 0, "currency": "INR"},
        {"name": "Credit Card", "account_type": "liability", "sub_type": "credit_card", "opening_balance": 0, "currency": "INR"},
    ]
    for acc in default_accounts:
        acc["account_id"] = f"acc_{uuid.uuid4().hex[:12]}"
        acc["user_id"] = user_id
        acc["balance"] = acc["opening_balance"]
        acc["description"] = ""
        acc["created_at"] = datetime.now(timezone.utc)
    await db.accounts.insert_many(default_accounts)

    income_categories = [
        ("Salary", ["Full-time", "Part-time", "Freelance"]),
        ("Business Income", ["Sales", "Services", "Consulting"]),
        ("Investment Income", ["Dividends", "Interest", "Capital Gains"]),
        ("Rental Income", []),
        ("Other Income", []),
    ]
    expense_categories = [
        ("Food & Dining", ["Groceries", "Restaurants", "Coffee & Tea"]),
        ("Transportation", ["Fuel", "Public Transit", "Cab/Taxi", "Maintenance"]),
        ("Housing", ["Rent", "Mortgage", "Utilities", "Repairs"]),
        ("Shopping", ["Clothing", "Electronics", "Home & Garden"]),
        ("Healthcare", ["Doctor", "Pharmacy", "Insurance"]),
        ("Entertainment", ["Movies", "Subscriptions", "Sports"]),
        ("Education", ["Tuition", "Books", "Courses"]),
        ("Bills & Utilities", ["Electricity", "Water", "Internet", "Phone"]),
        ("Personal Care", ["Grooming", "Fitness"]),
        ("Other Expenses", []),
    ]

    for cat_name, subcats in income_categories:
        cat_id = f"cat_{uuid.uuid4().hex[:12]}"
        await db.categories.insert_one({
            "category_id": cat_id,
            "user_id": user_id,
            "name": cat_name,
            "category_type": "income",
            "parent_id": None,
            "created_at": datetime.now(timezone.utc),
        })
        for sub_name in subcats:
            await db.categories.insert_one({
                "category_id": f"cat_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "name": sub_name,
                "category_type": "income",
                "parent_id": cat_id,
                "created_at": datetime.now(timezone.utc),
            })

    for cat_name, subcats in expense_categories:
        cat_id = f"cat_{uuid.uuid4().hex[:12]}"
        await db.categories.insert_one({
            "category_id": cat_id,
            "user_id": user_id,
            "name": cat_name,
            "category_type": "expense",
            "parent_id": None,
            "created_at": datetime.now(timezone.utc),
        })
        for sub_name in subcats:
            await db.categories.insert_one({
                "category_id": f"cat_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "name": sub_name,
                "category_type": "expense",
                "parent_id": cat_id,
                "created_at": datetime.now(timezone.utc),
            })


# ─── Email Templates & Verification ────────────────────────────────

def build_verification_email_html(name: str, verify_url: str) -> str:
    first_name = name.split()[0] if name else "there"
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">SpentyAI</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:1px;text-transform:uppercase;">Autonomous Accounting</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;font-weight:600;">Hey {first_name}, one tiny thing...</h2>
    <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
      We need to make sure you're a real human and not a rogue spreadsheet trying to infiltrate our system.
      Click the button below to verify your email and prove you have opposable thumbs.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="{verify_url}" style="display:inline-block;background:#1a1a2e;color:#ffffff;padding:14px 36px;border-radius:4px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.3px;">
        Verify My Email
      </a>
    </td></tr></table>
    <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5;">
      If you didn't sign up for SpentyAI, feel free to ignore this. We won't take it personally.
      <br>(Okay, maybe a little.)
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0 20px;">
    <p style="margin:0;color:#d4d4d8;font-size:11px;text-align:center;">
      Can't click the button? Copy this link:<br>
      <span style="color:#71717a;word-break:break-all;">{verify_url}</span>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def build_welcome_email_html(name: str) -> str:
    first_name = name.split()[0] if name else "friend"
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">SpentyAI</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:1px;text-transform:uppercase;">Autonomous Accounting</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:22px;font-weight:600;">Welcome aboard, {first_name}!</h2>
    <p style="margin:0 0 20px;color:#52525b;font-size:15px;line-height:1.7;">
      Your email is verified and your account is officially alive. Congrats &mdash; you've just hired
      the most tireless accountant on the planet. No coffee breaks, no passive-aggressive emails about expense reports.
    </p>
    <p style="margin:0 0 8px;color:#1a1a2e;font-size:15px;font-weight:600;">Here's what you can do now:</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
      <tr><td style="padding:10px 0;color:#52525b;font-size:14px;line-height:1.5;border-bottom:1px solid #f4f4f5;">
        <strong style="color:#1a1a2e;">Connect your email</strong> &mdash; We'll read your transaction emails so you don't have to. Gmail &amp; Outlook supported.
      </td></tr>
      <tr><td style="padding:10px 0;color:#52525b;font-size:14px;line-height:1.5;border-bottom:1px solid #f4f4f5;">
        <strong style="color:#1a1a2e;">Upload SMS messages</strong> &mdash; Got banking alerts on your phone? Dump them in, we'll sort them out.
      </td></tr>
      <tr><td style="padding:10px 0;color:#52525b;font-size:14px;line-height:1.5;border-bottom:1px solid #f4f4f5;">
        <strong style="color:#1a1a2e;">Check your dashboard</strong> &mdash; Real-time overview of where your money's going (spoiler: probably coffee).
      </td></tr>
      <tr><td style="padding:10px 0;color:#52525b;font-size:14px;line-height:1.5;">
        <strong style="color:#1a1a2e;">Cash flow projections</strong> &mdash; See 24 months into your financial future. Crystal ball not included.
      </td></tr>
    </table>
    <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
      If anything feels confusing, that's okay. We confused ourselves building this.
      Hit the Feature Requests page to tell us what you need.
    </p>
    <p style="margin:0;color:#1a1a2e;font-size:15px;font-weight:500;">
      Happy number-crunching,<br>
      <span style="color:#71717a;font-weight:400;">The SpentyAI Team</span>
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0 16px;">
    <p style="margin:0;color:#d4d4d8;font-size:11px;text-align:center;">
      You're receiving this because you signed up on SpentyAI. We promise not to spam you.
      <br>We're too busy automating accounting to write newsletters.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


async def send_verification_email(email: str, name: str, verification_token: str, frontend_url: str):
    """Send verification email via Resend (non-blocking)."""
    if not RESEND_API_KEY or not SENDER_EMAIL:
        logger.warning("Resend not configured, skipping verification email")
        return
    verify_url = f"{frontend_url}/verify-email?token={verification_token}"
    html = build_verification_email_html(name, verify_url)
    params = {
        "from": f"SpentyAI <{SENDER_EMAIL}>",
        "to": [email],
        "subject": "Verify your email — we promise it's painless",
        "html": html,
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Verification email sent to {email}: {result}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {e}")


async def send_welcome_email(email: str, name: str):
    """Send welcome email via Resend (non-blocking)."""
    if not RESEND_API_KEY or not SENDER_EMAIL:
        logger.warning("Resend not configured, skipping welcome email")
        return
    html = build_welcome_email_html(name)
    params = {
        "from": f"SpentyAI <{SENDER_EMAIL}>",
        "to": [email],
        "subject": "Welcome to SpentyAI — your new favourite accountant",
        "html": html,
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Welcome email sent to {email}: {result}")
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {e}")


@app.get("/api/auth/verify-email")
async def verify_email(token: str):
    """Verify a user's email using the token from the verification link."""
    user = await db.users.find_one({"verification_token": token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    if user.get("email_verified"):
        return {"message": "Email already verified", "already_verified": True}
    await db.users.update_one(
        {"verification_token": token},
        {"$set": {"email_verified": True, "verified_at": datetime.now(timezone.utc)},
         "$unset": {"verification_token": ""}}
    )
    # Send welcome email after successful verification
    asyncio.create_task(send_welcome_email(user["email"], user.get("name", "")))
    return {"message": "Email verified successfully", "already_verified": False}


@app.post("/api/auth/resend-verification")
async def resend_verification(request: Request, user: dict = Depends(get_current_user)):
    """Resend the verification email for the current user."""
    if user.get("email_verified"):
        return {"message": "Email already verified"}
    new_token = secrets.token_urlsafe(32)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"verification_token": new_token}}
    )
    origin = request.headers.get("origin", "")
    asyncio.create_task(send_verification_email(user["email"], user.get("name", ""), new_token, origin))
    return {"message": "Verification email sent"}


# ─── Accounts Routes ───────────────────────────────────────────────

@app.get("/api/accounts")
async def list_accounts(user: dict = Depends(get_current_user)):
    accounts = await db.accounts.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(1000)
    return accounts


@app.post("/api/accounts")
async def create_account(data: AccountCreate, user: dict = Depends(get_current_user)):
    account = {
        "account_id": f"acc_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.name,
        "account_type": data.account_type,
        "sub_type": data.sub_type or "",
        "opening_balance": data.opening_balance,
        "balance": data.opening_balance,
        "currency": data.currency,
        "description": data.description or "",
        "created_at": datetime.now(timezone.utc),
    }
    await db.accounts.insert_one(account)
    del account["_id"]
    return account


@app.put("/api/accounts/{account_id}")
async def update_account(account_id: str, data: AccountUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.accounts.update_one(
        {"account_id": account_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    account = await db.accounts.find_one(
        {"account_id": account_id}, {"_id": 0}
    )
    return account


@app.delete("/api/accounts/{account_id}")
async def delete_account(account_id: str, user: dict = Depends(get_current_user)):
    tx_count = await db.transactions.count_documents(
        {"user_id": user["user_id"], "$or": [{"account_id": account_id}, {"to_account_id": account_id}]}
    )
    if tx_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete account with existing transactions")
    result = await db.accounts.delete_one(
        {"account_id": account_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account deleted"}


# ─── Categories Routes ──────────────────────────────────────────────

@app.get("/api/categories")
async def list_categories(user: dict = Depends(get_current_user), category_type: Optional[str] = None):
    query = {"user_id": user["user_id"]}
    if category_type:
        query["category_type"] = category_type
    cats = await db.categories.find(query, {"_id": 0}).to_list(1000)
    return cats


@app.post("/api/categories")
async def create_category(data: CategoryCreate, user: dict = Depends(get_current_user)):
    cat = {
        "category_id": f"cat_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.name,
        "category_type": data.category_type,
        "parent_id": data.parent_id,
        "created_at": datetime.now(timezone.utc),
    }
    await db.categories.insert_one(cat)
    del cat["_id"]
    return cat


@app.put("/api/categories/{category_id}")
async def update_category(category_id: str, data: CategoryUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.categories.update_one(
        {"category_id": category_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    cat = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    return cat


@app.delete("/api/categories/{category_id}")
async def delete_category(category_id: str, user: dict = Depends(get_current_user)):
    sub_count = await db.categories.count_documents(
        {"parent_id": category_id, "user_id": user["user_id"]}
    )
    if sub_count > 0:
        raise HTTPException(status_code=400, detail="Delete subcategories first")
    result = await db.categories.delete_one(
        {"category_id": category_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


# ─── Transactions Routes ────────────────────────────────────────────

@app.get("/api/transactions")
async def list_transactions(
    user: dict = Depends(get_current_user),
    transaction_type: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    account_id: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    query = {"user_id": user["user_id"]}
    if transaction_type:
        query["transaction_type"] = transaction_type
    if status:
        query["status"] = status
    if account_id:
        query["$or"] = [{"account_id": account_id}, {"to_account_id": account_id}]
    if from_date:
        query.setdefault("date", {})["$gte"] = from_date
    if to_date:
        query.setdefault("date", {})["$lte"] = to_date

    txns = await db.transactions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    return {"transactions": txns, "total": total}


@app.post("/api/transactions")
async def create_transaction(data: TransactionCreate, user: dict = Depends(get_current_user)):
    if data.transaction_type in ["income", "expense"] and not data.category_id:
        raise HTTPException(status_code=400, detail="Category is required for income/expense")
    if data.transaction_type == "transfer" and not data.to_account_id:
        raise HTTPException(status_code=400, detail="Destination account required for transfer")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    account = await db.accounts.find_one(
        {"account_id": data.account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "transaction_type": data.transaction_type,
        "amount": data.amount,
        "date": data.date,
        "account_id": data.account_id,
        "to_account_id": data.to_account_id,
        "category_id": data.category_id,
        "subcategory_id": data.subcategory_id,
        "description": data.description or "",
        "is_recurring": data.is_recurring,
        "recurring_frequency": data.recurring_frequency,
        "source": data.source,
        "status": data.status,
        "created_at": datetime.now(timezone.utc),
    }
    await db.transactions.insert_one(txn)
    del txn["_id"]

    if data.status == "approved":
        await apply_transaction_to_balances(user["user_id"], txn)

    return txn


async def apply_transaction_to_balances(user_id: str, txn: dict):
    t_type = txn["transaction_type"]
    amount = txn["amount"]

    if t_type == "income":
        await db.accounts.update_one(
            {"account_id": txn["account_id"], "user_id": user_id},
            {"$inc": {"balance": amount}}
        )
    elif t_type == "expense":
        await db.accounts.update_one(
            {"account_id": txn["account_id"], "user_id": user_id},
            {"$inc": {"balance": -amount}}
        )
    elif t_type == "transfer":
        await db.accounts.update_one(
            {"account_id": txn["account_id"], "user_id": user_id},
            {"$inc": {"balance": -amount}}
        )
        if txn.get("to_account_id"):
            await db.accounts.update_one(
                {"account_id": txn["to_account_id"], "user_id": user_id},
                {"$inc": {"balance": amount}}
            )


async def reverse_transaction_balances(user_id: str, txn: dict):
    t_type = txn["transaction_type"]
    amount = txn["amount"]

    if t_type == "income":
        await db.accounts.update_one(
            {"account_id": txn["account_id"], "user_id": user_id},
            {"$inc": {"balance": -amount}}
        )
    elif t_type == "expense":
        await db.accounts.update_one(
            {"account_id": txn["account_id"], "user_id": user_id},
            {"$inc": {"balance": amount}}
        )
    elif t_type == "transfer":
        await db.accounts.update_one(
            {"account_id": txn["account_id"], "user_id": user_id},
            {"$inc": {"balance": amount}}
        )
        if txn.get("to_account_id"):
            await db.accounts.update_one(
                {"account_id": txn["to_account_id"], "user_id": user_id},
                {"$inc": {"balance": -amount}}
            )


@app.put("/api/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, data: TransactionUpdate, user: dict = Depends(get_current_user)):
    existing = await db.transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if existing["status"] == "approved":
        await reverse_transaction_balances(user["user_id"], existing)

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.transactions.update_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )

    updated = await db.transactions.find_one(
        {"transaction_id": transaction_id}, {"_id": 0}
    )
    if updated["status"] == "approved":
        await apply_transaction_to_balances(user["user_id"], updated)

    return updated


@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    existing = await db.transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if existing["status"] == "approved":
        await reverse_transaction_balances(user["user_id"], existing)

    await db.transactions.delete_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]}
    )
    return {"message": "Transaction deleted"}


@app.post("/api/transactions/{transaction_id}/approve")
async def approve_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    existing = await db.transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if existing["status"] == "approved":
        raise HTTPException(status_code=400, detail="Already approved")

    await db.transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}}
    )
    await apply_transaction_to_balances(user["user_id"], existing)
    updated = await db.transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    return updated


@app.post("/api/transactions/{transaction_id}/reject")
async def reject_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    existing = await db.transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if existing["status"] == "approved":
        await reverse_transaction_balances(user["user_id"], existing)

    await db.transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Transaction rejected"}


# ─── Recurring & Cash Flow Routes ────────────────────────────────────

@app.get("/api/recurring/list")
async def list_recurring(user: dict = Depends(get_current_user)):
    txns = await db.transactions.find(
        {"user_id": user["user_id"], "is_recurring": True, "status": "approved"},
        {"_id": 0}
    ).sort("date", -1).to_list(200)
    return {"transactions": txns, "total": len(txns)}


@app.post("/api/transactions/{transaction_id}/toggle-recurring")
async def toggle_recurring(transaction_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    is_recurring = body.get("is_recurring", False)
    recurring_frequency = body.get("recurring_frequency")  # monthly, weekly, yearly, quarterly

    existing = await db.transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update = {"is_recurring": is_recurring}
    if is_recurring and recurring_frequency:
        update["recurring_frequency"] = recurring_frequency
    elif not is_recurring:
        update["recurring_frequency"] = None

    await db.transactions.update_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]},
        {"$set": update}
    )
    updated = await db.transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    return updated


FREQ_MULTIPLIERS = {
    "weekly": 4.33,
    "biweekly": 2.17,
    "monthly": 1.0,
    "quarterly": 1.0 / 3.0,
    "yearly": 1.0 / 12.0,
}


def _compute_recurring_summary(recurring_txns: list) -> tuple:
    """Compute recurring items, monthly income, and monthly expense from recurring transactions."""
    monthly_income = 0.0
    monthly_expense = 0.0
    items = []

    for txn in recurring_txns:
        freq = txn.get("recurring_frequency", "monthly")
        monthly_amount = txn["amount"] * FREQ_MULTIPLIERS.get(freq, 1.0)
        items.append({
            "transaction_id": txn["transaction_id"],
            "description": txn.get("description", ""),
            "transaction_type": txn["transaction_type"],
            "amount": txn["amount"],
            "frequency": freq,
            "monthly_amount": round(monthly_amount, 2),
            "category_id": txn.get("category_id"),
            "account_id": txn.get("account_id"),
        })
        if txn["transaction_type"] == "income":
            monthly_income += monthly_amount
        elif txn["transaction_type"] == "expense":
            monthly_expense += monthly_amount

    return items, monthly_income, monthly_expense


@app.get("/api/cashflow/projection")
async def cashflow_projection(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]

    recurring_txns = await db.transactions.find(
        {"user_id": user_id, "is_recurring": True, "status": "approved"},
        {"_id": 0}
    ).to_list(500)

    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    current_balance = sum(
        a["balance"] if a["account_type"] == "asset" else -a["balance"]
        for a in accounts
    )

    recurring_items, monthly_recurring_income, monthly_recurring_expense = _compute_recurring_summary(recurring_txns)
    monthly_net = monthly_recurring_income - monthly_recurring_expense

    now = datetime.now(timezone.utc)
    running_balance = current_balance
    months = []
    for i in range(24):
        month_date = now + timedelta(days=30 * (i + 1))
        running_balance += monthly_net
        months.append({
            "month": i + 1,
            "label": month_date.strftime("%b %Y"),
            "projected_income": round(monthly_recurring_income, 2),
            "projected_expense": round(monthly_recurring_expense, 2),
            "net": round(monthly_net, 2),
            "running_balance": round(running_balance, 2),
        })

    return {
        "current_balance": round(current_balance, 2),
        "monthly_recurring_income": round(monthly_recurring_income, 2),
        "monthly_recurring_expense": round(monthly_recurring_expense, 2),
        "monthly_net": round(monthly_net, 2),
        "recurring_items": recurring_items,
        "projection": months,
    }


# ─── Dashboard Routes ───────────────────────────────────────────────

@app.get("/api/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)

    total_assets = sum(a["balance"] for a in accounts if a["account_type"] == "asset")
    total_liabilities = sum(a["balance"] for a in accounts if a["account_type"] == "liability")
    net_worth = total_assets - total_liabilities

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    month_end = now.strftime("%Y-%m-%d")

    income_this_month = 0
    expense_this_month = 0
    txns = await db.transactions.find(
        {"user_id": user_id, "status": "approved", "date": {"$gte": month_start, "$lte": month_end}},
        {"_id": 0}
    ).to_list(5000)

    for t in txns:
        if t["transaction_type"] == "income":
            income_this_month += t["amount"]
        elif t["transaction_type"] == "expense":
            expense_this_month += t["amount"]

    pending_review = await db.transactions.count_documents(
        {"user_id": user_id, "status": "pending_review"}
    )

    recent_txns = await db.transactions.find(
        {"user_id": user_id, "status": "approved"}, {"_id": 0}
    ).sort("date", -1).limit(10).to_list(10)

    return {
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "net_worth": net_worth,
        "income_this_month": income_this_month,
        "expense_this_month": expense_this_month,
        "savings_this_month": income_this_month - expense_this_month,
        "pending_review": pending_review,
        "accounts": accounts,
        "recent_transactions": recent_txns,
    }


# ─── Reports Routes ─────────────────────────────────────────────────

@app.get("/api/reports/summary")
async def reports_summary(
    start_date: str = None, end_date: str = None,
    user: dict = Depends(get_current_user),
):
    user_id = user["user_id"]
    query = {"user_id": user_id, "status": "approved"}
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date

    txns = await db.transactions.find(query, {"_id": 0}).to_list(5000)

    total_income = sum(t["amount"] for t in txns if t["transaction_type"] == "income")
    total_expense = sum(t["amount"] for t in txns if t["transaction_type"] == "expense")
    total_transfers = sum(t["amount"] for t in txns if t["transaction_type"] == "transfer")

    return {
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "total_transfers": round(total_transfers, 2),
        "net": round(total_income - total_expense, 2),
        "transaction_count": len(txns),
        "start_date": start_date,
        "end_date": end_date,
    }


@app.get("/api/reports/by-period")
async def reports_by_period(
    start_date: str = None, end_date: str = None,
    user: dict = Depends(get_current_user),
):
    user_id = user["user_id"]
    query = {"user_id": user_id, "status": "approved"}
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date

    txns = await db.transactions.find(query, {"_id": 0}).to_list(5000)

    monthly = {}
    for t in txns:
        month_key = t["date"][:7] if t.get("date") and len(t["date"]) >= 7 else "unknown"
        if month_key not in monthly:
            monthly[month_key] = {"month": month_key, "income": 0, "expense": 0, "transfer": 0, "count": 0}
        if t["transaction_type"] == "income":
            monthly[month_key]["income"] += t["amount"]
        elif t["transaction_type"] == "expense":
            monthly[month_key]["expense"] += t["amount"]
        elif t["transaction_type"] == "transfer":
            monthly[month_key]["transfer"] += t["amount"]
        monthly[month_key]["count"] += 1

    periods = sorted(monthly.values(), key=lambda x: x["month"])
    for p in periods:
        p["income"] = round(p["income"], 2)
        p["expense"] = round(p["expense"], 2)
        p["transfer"] = round(p["transfer"], 2)
        p["net"] = round(p["income"] - p["expense"], 2)

    return {"periods": periods}


def _aggregate_by_category(txns: list, cat_map: dict) -> list:
    """Aggregate transactions into category/subcategory breakdown."""
    by_cat = {}
    for t in txns:
        cat_id = t.get("category_id") or "uncategorized"
        cat_name = cat_map.get(cat_id, {}).get("name", "Uncategorized")
        if cat_id not in by_cat:
            by_cat[cat_id] = {
                "category_id": cat_id, "category_name": cat_name,
                "income": 0, "expense": 0, "total": 0, "count": 0,
                "subcategories": {},
            }

        amt = t["amount"]
        bucket = by_cat[cat_id]
        if t["transaction_type"] == "income":
            bucket["income"] += amt
        elif t["transaction_type"] == "expense":
            bucket["expense"] += amt
        bucket["total"] += amt
        bucket["count"] += 1

        sub_id = t.get("subcategory_id")
        if sub_id:
            sub_name = cat_map.get(sub_id, {}).get("name", sub_id)
            if sub_id not in bucket["subcategories"]:
                bucket["subcategories"][sub_id] = {
                    "subcategory_id": sub_id, "subcategory_name": sub_name,
                    "income": 0, "expense": 0, "total": 0, "count": 0,
                }
            sub = bucket["subcategories"][sub_id]
            if t["transaction_type"] == "income":
                sub["income"] += amt
            elif t["transaction_type"] == "expense":
                sub["expense"] += amt
            sub["total"] += amt
            sub["count"] += 1

    result = []
    for cat in sorted(by_cat.values(), key=lambda x: x["total"], reverse=True):
        cat["income"] = round(cat["income"], 2)
        cat["expense"] = round(cat["expense"], 2)
        cat["total"] = round(cat["total"], 2)
        cat["subcategories"] = sorted(cat["subcategories"].values(), key=lambda x: x["total"], reverse=True)
        for s in cat["subcategories"]:
            s["income"] = round(s["income"], 2)
            s["expense"] = round(s["expense"], 2)
            s["total"] = round(s["total"], 2)
        result.append(cat)
    return result


@app.get("/api/reports/by-category")
async def reports_by_category(
    start_date: str = None, end_date: str = None, transaction_type: str = None,
    user: dict = Depends(get_current_user),
):
    user_id = user["user_id"]
    query = {"user_id": user_id, "status": "approved"}
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if transaction_type:
        query["transaction_type"] = transaction_type

    txns = await db.transactions.find(query, {"_id": 0}).to_list(5000)
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    cat_map = {c["category_id"]: c for c in categories}

    return {"categories": _aggregate_by_category(txns, cat_map)}


# ─── Feature Requests Routes ────────────────────────────────────────

@app.get("/api/feature-requests")
async def list_feature_requests(user: dict = Depends(get_current_user)):
    reqs = await db.feature_requests.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return reqs


@app.post("/api/feature-requests")
async def create_feature_request(data: FeatureRequestCreate, user: dict = Depends(get_current_user)):
    req = {
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "title": data.title,
        "description": data.description,
        "category": data.category or "general",
        "status": "submitted",
        "created_at": datetime.now(timezone.utc),
    }
    await db.feature_requests.insert_one(req)
    del req["_id"]
    return req


# ─── Statement Upload & Reconciliation Routes ───────────────────────

UPLOAD_DIR = "/app/uploads/statements"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.post("/api/statements/upload")
async def upload_statement(
    file: UploadFile = File(...),
    account_id: str = Form(...),
    statement_type: str = Form("bank"),  # bank or credit_card
    user: dict = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("csv", "pdf"):
        raise HTTPException(status_code=400, detail="Only CSV and PDF files are supported")

    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    statement_id = f"stmt_{uuid.uuid4().hex[:12]}"
    file_path = os.path.join(UPLOAD_DIR, f"{statement_id}.{ext}")
    with open(file_path, "wb") as f:
        f.write(content)

    stmt_doc = {
        "statement_id": statement_id,
        "user_id": user["user_id"],
        "account_id": account_id,
        "account_name": account.get("name", ""),
        "statement_type": statement_type,
        "filename": file.filename,
        "file_ext": ext,
        "file_path": file_path,
        "file_size": len(content),
        "status": "parsing",
        "parsed_entries": [],
        "reconciliation": None,
        "uploaded_at": datetime.now(timezone.utc),
    }
    await db.statements.insert_one(stmt_doc)
    del stmt_doc["_id"]

    asyncio.create_task(parse_statement_background(statement_id, user["user_id"]))

    return {
        "statement_id": statement_id,
        "message": "Statement uploaded, parsing in progress",
        "filename": file.filename,
    }


@app.get("/api/statements/list")
async def list_statements(user: dict = Depends(get_current_user)):
    stmts = await db.statements.find(
        {"user_id": user["user_id"]}, {"_id": 0, "file_path": 0}
    ).sort("uploaded_at", -1).to_list(50)
    return {"statements": stmts}


@app.get("/api/statements/{statement_id}")
async def get_statement(statement_id: str, user: dict = Depends(get_current_user)):
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]},
        {"_id": 0, "file_path": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return stmt


@app.post("/api/statements/{statement_id}/reconcile")
async def reconcile_statement(statement_id: str, user: dict = Depends(get_current_user)):
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    if stmt["status"] == "parsing":
        raise HTTPException(status_code=400, detail="Statement still being parsed")
    if not stmt.get("parsed_entries"):
        raise HTTPException(status_code=400, detail="No entries found in statement")

    parsed = stmt["parsed_entries"]
    account_id = stmt["account_id"]
    user_id = user["user_id"]

    dates = [e["date"] for e in parsed if e.get("date")]
    if not dates:
        raise HTTPException(status_code=400, detail="No valid dates in statement")

    min_date = min(dates)
    max_date = max(dates)

    ledger_txns = await db.transactions.find(
        {
            "user_id": user_id,
            "status": "approved",
            "$or": [{"account_id": account_id}, {"to_account_id": account_id}],
            "date": {"$gte": min_date, "$lte": max_date},
        },
        {"_id": 0}
    ).to_list(5000)

    results = reconcile_entries(parsed, ledger_txns, account_id)

    await db.statements.update_one(
        {"statement_id": statement_id},
        {"$set": {
            "reconciliation": results,
            "status": "reconciled",
            "reconciled_at": datetime.now(timezone.utc),
        }}
    )

    return results


@app.post("/api/statements/{statement_id}/add-missing")
async def add_missing_entries(
    statement_id: str, request: Request, user: dict = Depends(get_current_user)
):
    body = await request.json()
    entry_indices = body.get("entry_indices", [])

    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    recon = stmt.get("reconciliation")
    if not recon:
        raise HTTPException(status_code=400, detail="Statement not reconciled yet")

    missing = recon.get("missing_from_ledger", [])
    account_id = stmt["account_id"]

    added = 0
    for idx in entry_indices:
        if idx < 0 or idx >= len(missing):
            continue
        entry = missing[idx]

        txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "transaction_type": entry.get("transaction_type", "expense"),
            "amount": abs(entry.get("amount", 0)),
            "date": entry.get("date", ""),
            "account_id": account_id,
            "category_id": entry.get("category_id"),
            "description": entry.get("description", ""),
            "source": "statement",
            "source_statement_id": statement_id,
            "status": "pending_review",
            "created_at": datetime.now(timezone.utc),
        }
        await db.transactions.insert_one(txn)
        del txn["_id"]
        added += 1

    return {"message": f"Added {added} entries for review", "added": added}


@app.delete("/api/statements/{statement_id}")
async def delete_statement(statement_id: str, user: dict = Depends(get_current_user)):
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    file_path = stmt.get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    await db.statements.delete_one({"statement_id": statement_id})
    return {"message": "Statement deleted"}


# ─── Statement Parsing Helpers ───────────────────────────────────────

async def parse_statement_background(statement_id: str, user_id: str):
    try:
        stmt = await db.statements.find_one({"statement_id": statement_id}, {"_id": 0})
        if not stmt:
            return

        file_path = stmt["file_path"]
        ext = stmt["file_ext"]

        if ext == "csv":
            entries = parse_csv_statement(file_path)
        elif ext == "pdf":
            entries = await parse_pdf_statement(file_path)
        else:
            entries = []

        if not entries and ext == "pdf":
            pdf_text = extract_pdf_text(file_path)
            if pdf_text:
                entries = await parse_statement_text_with_ai(pdf_text, stmt.get("statement_type", "bank"))

        await db.statements.update_one(
            {"statement_id": statement_id},
            {"$set": {
                "parsed_entries": entries,
                "status": "parsed" if entries else "parse_failed",
                "entry_count": len(entries),
                "parsed_at": datetime.now(timezone.utc),
            }}
        )
        logger.info(f"Parsed {len(entries)} entries from statement {statement_id}")

    except Exception as e:
        logger.error(f"Statement parsing failed for {statement_id}: {e}")
        await db.statements.update_one(
            {"statement_id": statement_id},
            {"$set": {"status": "parse_failed", "parse_error": str(e)}}
        )


def _detect_csv_columns(headers_lower: dict) -> dict:
    """Detect column roles from CSV headers."""
    return {
        "date": [k for k in headers_lower if any(w in k for w in ["date", "txn", "transaction", "value", "posting"])],
        "amount": [k for k in headers_lower if any(w in k for w in ["amount", "debit", "credit", "withdrawal", "deposit"])],
        "desc": [k for k in headers_lower if any(w in k for w in ["description", "narration", "particular", "detail", "remark", "memo", "payee"])],
        "balance": [k for k in headers_lower if any(w in k for w in ["balance", "closing", "running"])],
        "has_separate_dr_cr": (
            any("debit" in k or "withdrawal" in k for k in headers_lower)
            and any("credit" in k or "deposit" in k for k in headers_lower)
        ),
    }


def _parse_csv_row_amount(row_lower: dict, amount_keys: list, has_separate_dr_cr: bool) -> tuple:
    """Parse amount and transaction type from a CSV row. Returns (amount, txn_type) or (0, None)."""
    if has_separate_dr_cr:
        debit_val = 0.0
        credit_val = 0.0
        for ak in amount_keys:
            val = parse_amount(row_lower.get(ak, ""))
            if "debit" in ak or "withdrawal" in ak:
                debit_val = val
            elif "credit" in ak or "deposit" in ak:
                credit_val = val
        if credit_val > 0:
            return credit_val, "income"
        elif debit_val > 0:
            return debit_val, "expense"
        return 0.0, None
    else:
        for ak in amount_keys:
            val = parse_amount(row_lower.get(ak, ""))
            if val != 0:
                return abs(val), "income" if val > 0 else "expense"
        return 0.0, None


def parse_csv_statement(file_path: str) -> list:
    entries = []
    with open(file_path, "r", encoding="utf-8-sig") as f:
        content = f.read()

    lines = content.strip().split("\n")
    if len(lines) < 2:
        return entries

    reader = csv.DictReader(io.StringIO(content))
    headers_lower = {h.lower().strip(): h for h in (reader.fieldnames or [])}
    cols = _detect_csv_columns(headers_lower)

    for row in reader:
        row_lower = {k.lower().strip(): v.strip() if isinstance(v, str) else v for k, v in row.items()}

        date_val = ""
        for dk in cols["date"]:
            if row_lower.get(dk):
                date_val = normalize_date(row_lower[dk])
                if date_val:
                    break
        if not date_val:
            continue

        description = ""
        for dek in cols["desc"]:
            if row_lower.get(dek):
                description = row_lower[dek]
                break

        amount, txn_type = _parse_csv_row_amount(row_lower, cols["amount"], cols["has_separate_dr_cr"])
        if amount == 0:
            continue

        balance = 0.0
        for bk in cols["balance"]:
            balance = parse_amount(row_lower.get(bk, ""))
            if balance != 0:
                break

        entries.append({
            "date": date_val,
            "description": description,
            "amount": round(amount, 2),
            "transaction_type": txn_type,
            "balance": round(balance, 2) if balance else None,
            "raw": {k: v for k, v in row.items() if v},
        })

    return entries


def extract_pdf_text(file_path: str) -> str:
    text_parts = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages[:20]:
                tables = page.extract_tables()
                if tables:
                    text_parts.extend(
                        " | ".join(str(c or "") for c in row)
                        for table in tables for row in table if row
                    )
                    continue
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
    return "\n".join(text_parts)


async def parse_pdf_statement(file_path: str) -> list:
    text = extract_pdf_text(file_path)
    if not text or len(text.strip()) < 50:
        return []
    return await parse_statement_text_with_ai(text, "bank")


async def parse_statement_text_with_ai(text: str, statement_type: str) -> list:
    if not openai_client:
        logger.error("OpenAI not configured for statement parsing")
        return []

    truncated = text[:8000]

    prompt = f"""Parse this {statement_type} statement text and extract all transactions.

STATEMENT TEXT:
{truncated}

Extract each transaction as a JSON object with these fields:
- date: "YYYY-MM-DD" format
- description: transaction description/narration
- amount: positive number (absolute value)
- transaction_type: "income" for credits/deposits, "expense" for debits/withdrawals
- balance: closing balance after this transaction (if available), else null

Return ONLY a valid JSON array of transactions. No markdown, no explanation.
Example: [{{"date":"2026-01-15","description":"ATM Withdrawal","amount":5000,"transaction_type":"expense","balance":45000}}]

If no transactions found, return empty array: []"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You parse bank and credit card statements into structured transaction data. Return only valid JSON arrays."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=4000,
        )
        content = response.choices[0].message.content
        entries = _parse_ai_json_response(content)
        if not isinstance(entries, list):
            return []

        cleaned = []
        for e in entries:
            if e.get("date") and e.get("amount"):
                cleaned.append({
                    "date": e["date"],
                    "description": e.get("description", ""),
                    "amount": round(abs(float(e["amount"])), 2),
                    "transaction_type": e.get("transaction_type", "expense"),
                    "balance": round(float(e["balance"]), 2) if e.get("balance") is not None else None,
                })
        return cleaned

    except Exception as e:
        logger.error(f"AI statement parsing failed: {e}")
        return []


def normalize_date(date_str: str) -> str:
    if not date_str:
        return ""
    date_str = date_str.strip()

    formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
        "%d-%b-%Y", "%d %b %Y", "%d-%B-%Y", "%d %B %Y",
        "%Y/%m/%d", "%d.%m.%Y", "%m-%d-%Y",
        "%d-%m-%y", "%d/%m/%y", "%m/%d/%y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.year < 100:
                dt = dt.replace(year=dt.year + 2000)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def parse_amount(val: str) -> float:
    if not val or not isinstance(val, str):
        return 0.0
    val = val.strip()
    if not val:
        return 0.0
    negative = val.startswith("-") or val.startswith("(")
    val = re.sub(r'[^\d.]', '', val)
    try:
        result = float(val)
        return -result if negative else result
    except (ValueError, TypeError):
        return 0.0


def _score_date_match(entry_date: str, ledger_date: str) -> int:
    """Score date similarity between a statement entry and ledger transaction."""
    if ledger_date == entry_date:
        return 40
    try:
        d1 = datetime.strptime(entry_date, "%Y-%m-%d")
        d2 = datetime.strptime(ledger_date, "%Y-%m-%d")
        diff = abs((d1 - d2).days)
        if diff <= 1:
            return 30
        if diff <= 3:
            return 15
    except (ValueError, TypeError):
        pass
    return 0


def _score_amount_match(entry_amt: float, ledger_amt: float) -> int:
    """Score amount similarity."""
    if abs(entry_amt - ledger_amt) < 0.01:
        return 40
    if abs(entry_amt - ledger_amt) / max(entry_amt, ledger_amt, 1) < 0.02:
        return 25
    return 0


def _score_description_match(entry_desc: str, ledger_desc: str) -> int:
    """Score description similarity using word overlap."""
    if not entry_desc or not ledger_desc:
        return 0
    entry_words = set(re.split(r'[\s\-_./,]+', entry_desc.lower()))
    ledger_words = set(re.split(r'[\s\-_./,]+', ledger_desc.lower()))
    significant = {w for w in (entry_words & ledger_words) if len(w) >= 3}
    return min(20, len(significant) * 5) if significant else 0


def _find_best_match(entry: dict, candidates: list) -> tuple:
    """Find the best matching ledger transaction for a statement entry. Returns (match, score)."""
    best_match = None
    best_score = 0
    for ltxn in candidates:
        score = (
            _score_date_match(entry["date"], ltxn["date"])
            + _score_amount_match(entry["amount"], ltxn["amount"])
            + _score_description_match(entry.get("description", ""), ltxn.get("description", ""))
        )
        if score > best_score and score >= 50:
            best_score = score
            best_match = ltxn
    return best_match, best_score


def reconcile_entries(parsed: list, ledger_txns: list, account_id: str) -> dict:
    matched = []
    missing_from_ledger = []
    conflicts = []
    ledger_unmatched = list(ledger_txns)

    for entry in parsed:
        best_match, best_score = _find_best_match(entry, ledger_unmatched)

        if best_match:
            amt_match = abs(entry["amount"] - best_match["amount"]) < 0.01
            result_entry = {
                "statement_entry": entry,
                "ledger_transaction": best_match,
                "match_score": best_score,
            }
            if amt_match:
                matched.append(result_entry)
            else:
                result_entry["amount_difference"] = round(entry["amount"] - best_match["amount"], 2)
                conflicts.append(result_entry)
            ledger_unmatched.remove(best_match)
        else:
            missing_from_ledger.append(entry)

    missing_from_statement = [
        {
            "transaction_id": ltxn["transaction_id"],
            "date": ltxn["date"],
            "description": ltxn.get("description", ""),
            "amount": ltxn["amount"],
            "transaction_type": ltxn["transaction_type"],
        }
        for ltxn in ledger_unmatched
    ]

    return {
        "summary": {
            "total_statement_entries": len(parsed),
            "matched": len(matched),
            "missing_from_ledger": len(missing_from_ledger),
            "missing_from_statement": len(missing_from_statement),
            "conflicts": len(conflicts),
        },
        "matched": matched,
        "missing_from_ledger": missing_from_ledger,
        "missing_from_statement": missing_from_statement,
        "conflicts": conflicts,
    }


# ─── Gmail OAuth Routes ──────────────────────────────────────────────

def get_gmail_redirect_uri(request: Request):
    """Get Gmail OAuth redirect URI dynamically from request headers."""
    base = _get_backend_url(request)
    return f"{base}/api/gmail/callback"


def get_gmail_flow(redirect_uri: str):
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GMAIL_SCOPES,
        redirect_uri=redirect_uri,
    )


@app.get("/api/gmail/connect")
async def gmail_connect(request: Request, user: dict = Depends(get_current_user)):
    redirect_uri = get_gmail_redirect_uri(request)
    flow = get_gmail_flow(redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )
    # Store code_verifier for PKCE (required by newer google-auth-oauthlib)
    code_verifier = flow.code_verifier
    await db.gmail_oauth_states.insert_one({
        "state": state,
        "user_id": user["user_id"],
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })
    return {"auth_url": auth_url}


@app.get("/api/gmail/callback")
async def gmail_callback(request: Request, code: str = None, state: str = None, error: str = None):
    frontend = _get_frontend_url(request)

    if error:
        logger.error(f"Gmail OAuth error: {error}")
        return RedirectResponse(f"{frontend}/?gmail_error={error}")

    if not code or not state:
        return RedirectResponse(f"{frontend}/?gmail_error=missing_params")

    state_doc = await db.gmail_oauth_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        return RedirectResponse(f"{frontend}/?gmail_error=invalid_state")

    expires_at = state_doc["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        return RedirectResponse(f"{frontend}/?gmail_error=state_expired")

    await db.gmail_oauth_states.delete_one({"state": state})
    user_id = state_doc["user_id"]
    redirect_uri = state_doc["redirect_uri"]

    try:
        flow = get_gmail_flow(redirect_uri)
        # Restore PKCE code_verifier from the stored state
        flow.code_verifier = state_doc.get("code_verifier")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            flow.fetch_token(code=code)
        creds = flow.credentials

        gmail_service = build("gmail", "v1", credentials=creds)
        profile = gmail_service.users().getProfile(userId="me").execute()
        gmail_email = profile.get("emailAddress", "")

        token_data = {
            "user_id": user_id,
            "gmail_email": gmail_email,
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=3600),
            "connected": True,
            "connected_at": datetime.now(timezone.utc),
        }

        await db.gmail_tokens.update_one(
            {"user_id": user_id, "gmail_email": gmail_email},
            {"$set": token_data},
            upsert=True,
        )

        return RedirectResponse(f"{frontend}/email-sync?gmail=connected")

    except Exception as e:
        logger.error(f"Gmail OAuth token exchange failed: {e}")
        return RedirectResponse(f"{frontend}/?gmail_error=token_exchange_failed")


@app.get("/api/gmail/status")
async def gmail_status(user: dict = Depends(get_current_user)):
    tokens = await db.gmail_tokens.find(
        {"user_id": user["user_id"], "connected": True}, {"_id": 0}
    ).to_list(10)

    accounts = []
    for t in tokens:
        sync_config = await db.email_sync_config.find_one(
            {"user_id": user["user_id"], "gmail_email": t["gmail_email"]}, {"_id": 0}
        )
        stats = await get_email_sync_stats(user["user_id"], t["gmail_email"])
        accounts.append({
            "gmail_email": t["gmail_email"],
            "connected": True,
            "connected_at": t.get("connected_at", "").isoformat() if isinstance(t.get("connected_at"), datetime) else str(t.get("connected_at", "")),
            "sync_from_date": sync_config.get("sync_from_date") if sync_config else None,
            "syncing": sync_config.get("syncing", False) if sync_config else False,
            "stats": stats,
        })
    return {"accounts": accounts}


@app.post("/api/gmail/disconnect")
async def gmail_disconnect(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    gmail_email = body.get("gmail_email")
    if not gmail_email:
        raise HTTPException(status_code=400, detail="gmail_email required")
    await db.gmail_tokens.update_one(
        {"user_id": user["user_id"], "gmail_email": gmail_email},
        {"$set": {"connected": False}}
    )
    return {"message": "Gmail disconnected"}


# ─── Outlook OAuth Routes ─────────────────────────────────────────────

def get_outlook_redirect_uri(request: Request):
    """Get Outlook OAuth redirect URI dynamically from request headers."""
    base = _get_backend_url(request)
    return f"{base}/api/outlook/callback"


@app.get("/api/outlook/connect")
async def outlook_connect(request: Request, user: dict = Depends(get_current_user)):
    redirect_uri = get_outlook_redirect_uri(request)
    state = secrets.token_urlsafe(32)

    await db.outlook_oauth_states.insert_one({
        "state": state,
        "user_id": user["user_id"],
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })

    params = {
        "client_id": MICROSOFT_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": MS_SCOPES,
        "state": state,
        "response_mode": "query",
    }
    auth_url = f"{MS_AUTH_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


async def _exchange_outlook_token(code: str, redirect_uri: str) -> dict:
    """Exchange authorization code for access token. Returns token dict or None."""
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": MICROSOFT_CLIENT_ID,
        "client_secret": MICROSOFT_CLIENT_SECRET,
        "scope": MS_SCOPES,
    }
    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.post(
            MS_TOKEN_URL, data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if resp.status_code != 200:
            logger.error(f"Outlook token exchange failed: {resp.text}")
            return None
        return resp.json()


async def _fetch_outlook_profile(access_token: str) -> dict:
    """Fetch user profile from Microsoft Graph. Returns profile dict or None."""
    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.get(
            f"{MS_GRAPH_BASE}/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code != 200:
            logger.error(f"Failed to fetch Outlook profile: {resp.text}")
            return None
        return resp.json()


@app.get("/api/outlook/callback")
async def outlook_callback(request: Request, code: str = None, state: str = None, error: str = None):
    frontend = _get_frontend_url(request)

    if error:
        logger.error(f"Outlook OAuth error: {error}")
        return RedirectResponse(f"{frontend}/?outlook_error={error}")

    if not code or not state:
        return RedirectResponse(f"{frontend}/?outlook_error=missing_params")

    state_doc = await db.outlook_oauth_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        return RedirectResponse(f"{frontend}/?outlook_error=invalid_state")

    expires_at = state_doc["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        return RedirectResponse(f"{frontend}/?outlook_error=state_expired")

    await db.outlook_oauth_states.delete_one({"state": state})
    user_id = state_doc["user_id"]

    try:
        tokens = await _exchange_outlook_token(code, state_doc["redirect_uri"])
        if not tokens:
            return RedirectResponse(f"{frontend}/?outlook_error=token_exchange_failed")

        profile = await _fetch_outlook_profile(tokens["access_token"])
        if not profile:
            return RedirectResponse(f"{frontend}/?outlook_error=profile_fetch_failed")

        outlook_email = profile.get("mail") or profile.get("userPrincipalName", "")
        await db.outlook_tokens.update_one(
            {"user_id": user_id, "outlook_email": outlook_email},
            {"$set": {
                "user_id": user_id, "outlook_email": outlook_email,
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "expires_at": datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600)),
                "connected": True, "connected_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        return RedirectResponse(f"{frontend}/email-sync?outlook=connected")

    except Exception as e:
        logger.error(f"Outlook OAuth callback failed: {e}")
        return RedirectResponse(f"{frontend}/?outlook_error=token_exchange_failed")


@app.get("/api/outlook/status")
async def outlook_status(user: dict = Depends(get_current_user)):
    tokens = await db.outlook_tokens.find(
        {"user_id": user["user_id"], "connected": True}, {"_id": 0}
    ).to_list(10)

    accounts = []
    for t in tokens:
        sync_config = await db.outlook_sync_config.find_one(
            {"user_id": user["user_id"], "outlook_email": t["outlook_email"]}, {"_id": 0}
        )
        stats = await get_outlook_sync_stats(user["user_id"], t["outlook_email"])
        accounts.append({
            "outlook_email": t["outlook_email"],
            "connected": True,
            "connected_at": t.get("connected_at", "").isoformat() if isinstance(t.get("connected_at"), datetime) else str(t.get("connected_at", "")),
            "sync_from_date": sync_config.get("sync_from_date") if sync_config else None,
            "syncing": sync_config.get("syncing", False) if sync_config else False,
            "stats": stats,
        })
    return {"accounts": accounts}


@app.post("/api/outlook/disconnect")
async def outlook_disconnect(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    outlook_email = body.get("outlook_email")
    if not outlook_email:
        raise HTTPException(status_code=400, detail="outlook_email required")
    await db.outlook_tokens.update_one(
        {"user_id": user["user_id"], "outlook_email": outlook_email},
        {"$set": {"connected": False}}
    )
    return {"message": "Outlook disconnected"}


# ─── Outlook Email Sync Routes ──────────────────────────────────────

@app.post("/api/outlook/start-sync")
async def start_outlook_sync(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    outlook_email = body.get("outlook_email")
    sync_from_date = body.get("sync_from_date")

    if not outlook_email or not sync_from_date:
        raise HTTPException(status_code=400, detail="outlook_email and sync_from_date required")

    token_doc = await db.outlook_tokens.find_one(
        {"user_id": user["user_id"], "outlook_email": outlook_email, "connected": True}, {"_id": 0}
    )
    if not token_doc:
        raise HTTPException(status_code=400, detail="Outlook not connected")

    await db.outlook_sync_config.update_one(
        {"user_id": user["user_id"], "outlook_email": outlook_email},
        {"$set": {
            "user_id": user["user_id"],
            "outlook_email": outlook_email,
            "sync_from_date": sync_from_date,
            "syncing": True,
            "started_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    asyncio.create_task(sync_outlook_emails_background(user["user_id"], outlook_email, sync_from_date))
    return {"message": "Outlook email sync started", "outlook_email": outlook_email}


@app.post("/api/outlook/retry-pending")
async def retry_outlook_pending(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    outlook_email = body.get("outlook_email", "")

    query = {"user_id": user["user_id"], "ai_status": {"$in": ["pending", "failed"]}, "source_provider": "outlook"}
    if outlook_email:
        query["outlook_email"] = outlook_email

    pending_count = await db.synced_emails.count_documents(query)
    if pending_count == 0:
        return {"message": "No pending Outlook emails to process", "count": 0}

    asyncio.create_task(process_outlook_pending_emails(user["user_id"], outlook_email))
    return {"message": f"Processing {pending_count} pending Outlook emails", "count": pending_count}


# ─── Outlook Sync Helpers ────────────────────────────────────────────

async def get_outlook_sync_stats(user_id: str, outlook_email: str = None):
    query = {"user_id": user_id, "source_provider": "outlook"}
    if outlook_email:
        query["outlook_email"] = outlook_email

    total_synced = await db.synced_emails.count_documents(query)
    processed = await db.synced_emails.count_documents({**query, "ai_status": "processed"})
    pending = await db.synced_emails.count_documents({**query, "ai_status": "pending"})
    failed = await db.synced_emails.count_documents({**query, "ai_status": "failed"})
    no_transaction = await db.synced_emails.count_documents({**query, "ai_status": "no_transaction"})

    transactions_created = await db.transactions.count_documents(
        {"user_id": user_id, "source": "email", "source_provider": "outlook"}
    )
    pending_review = await db.transactions.count_documents(
        {"user_id": user_id, "source": "email", "source_provider": "outlook", "status": "pending_review"}
    )

    return {
        "total_synced": total_synced,
        "processed_by_ai": processed,
        "no_transaction": no_transaction,
        "ai_pending": pending,
        "ai_failed": failed,
        "transactions_created": transactions_created,
        "pending_review": pending_review,
    }


async def get_outlook_access_token(user_id: str, outlook_email: str):
    """Get valid access token, refreshing if needed."""
    token_doc = await db.outlook_tokens.find_one(
        {"user_id": user_id, "outlook_email": outlook_email, "connected": True}, {"_id": 0}
    )
    if not token_doc:
        return None

    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc)

    if datetime.now(timezone.utc) >= expires_at - timedelta(minutes=5):
        refresh_token = token_doc.get("refresh_token")
        if not refresh_token:
            logger.error(f"No refresh token for Outlook {outlook_email}")
            return None

        try:
            async with httpx.AsyncClient(timeout=30.0) as http:
                resp = await http.post(
                    MS_TOKEN_URL,
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": refresh_token,
                        "client_id": MICROSOFT_CLIENT_ID,
                        "client_secret": MICROSOFT_CLIENT_SECRET,
                        "scope": MS_SCOPES,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if resp.status_code != 200:
                    logger.error(f"Outlook token refresh failed: {resp.text}")
                    return None
                new_tokens = resp.json()

            await db.outlook_tokens.update_one(
                {"user_id": user_id, "outlook_email": outlook_email},
                {"$set": {
                    "access_token": new_tokens["access_token"],
                    "refresh_token": new_tokens.get("refresh_token", refresh_token),
                    "expires_at": datetime.now(timezone.utc) + timedelta(seconds=new_tokens.get("expires_in", 3600)),
                }}
            )
            return new_tokens["access_token"]
        except Exception as e:
            logger.error(f"Failed to refresh Outlook token for {outlook_email}: {e}")
            return None

    return token_doc["access_token"]


async def _store_outlook_email(user_id: str, outlook_email: str, msg: dict) -> bool:
    """Store a single Outlook email. Returns True if stored (not duplicate)."""
    msg_id = msg["id"]
    existing = await db.synced_emails.find_one(
        {"user_id": user_id, "outlook_email": outlook_email, "message_id": msg_id}
    )
    if existing:
        return False

    from_info = msg.get("from", {}).get("emailAddress", {})
    body_content = msg.get("body", {}).get("content", "")
    body_text = re.sub(r'<[^>]+>', ' ', body_content)
    body_text = re.sub(r'\s+', ' ', body_text).strip()

    email_doc = {
        "email_id": f"em_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "outlook_email": outlook_email,
        "source_provider": "outlook",
        "message_id": msg_id,
        "subject": msg.get("subject", ""),
        "from_email": from_info.get("address", ""),
        "date": msg.get("receivedDateTime", ""),
        "snippet": msg.get("bodyPreview", ""),
        "body_text": body_text[:5000] if body_text else msg.get("bodyPreview", ""),
        "ai_status": "pending",
        "ai_result": None,
        "synced_at": datetime.now(timezone.utc),
    }
    await db.synced_emails.insert_one(email_doc)
    return True


async def sync_outlook_emails_background(user_id: str, outlook_email: str, sync_from_date: str):
    try:
        access_token = await get_outlook_access_token(user_id, outlook_email)
        if not access_token:
            logger.error(f"No valid Outlook credentials for {user_id}/{outlook_email}")
            return

        headers = {"Authorization": f"Bearer {access_token}"}
        filter_query = f"receivedDateTime ge {sync_from_date}T00:00:00Z"
        total_fetched = 0
        next_link = None

        async with httpx.AsyncClient(timeout=60.0) as http:
            while True:
                if next_link:
                    resp = await http.get(next_link, headers=headers)
                else:
                    resp = await http.get(
                        f"{MS_GRAPH_BASE}/me/messages",
                        headers=headers,
                        params={
                            "$filter": filter_query,
                            "$select": "id,subject,from,receivedDateTime,bodyPreview,body,isRead",
                            "$top": 50,
                            "$orderby": "receivedDateTime DESC",
                        },
                    )

                if resp.status_code != 200:
                    logger.error(f"Outlook messages fetch failed: {resp.text}")
                    break

                messages = resp.json().get("value", [])
                if not messages:
                    break

                for msg in messages:
                    if await _store_outlook_email(user_id, outlook_email, msg):
                        total_fetched += 1

                next_link = resp.json().get("@odata.nextLink")
                if not next_link:
                    break

        logger.info(f"Synced {total_fetched} Outlook emails for {user_id}/{outlook_email}")

        await db.outlook_sync_config.update_one(
            {"user_id": user_id, "outlook_email": outlook_email},
            {"$set": {"syncing": False, "last_sync_at": datetime.now(timezone.utc), "last_sync_count": total_fetched}}
        )

        await process_outlook_pending_emails(user_id, outlook_email)

    except Exception as e:
        logger.error(f"Outlook email sync failed for {user_id}/{outlook_email}: {e}")
        await db.outlook_sync_config.update_one(
            {"user_id": user_id, "outlook_email": outlook_email},
            {"$set": {"syncing": False, "sync_error": str(e)}}
        )


async def _create_transaction_from_ai_result(
    user_id: str, email_doc: dict, result: dict, accounts: list, source_provider: str
) -> bool:
    """Create a pending_review transaction from AI analysis. Returns True if created (not duplicate)."""
    duplicate = await check_cross_source_duplicate(
        user_id,
        amount=result.get("amount", 0),
        date_str=result.get("date", ""),
        description=result.get("description", ""),
        payee=result.get("payee", ""),
    )
    if duplicate:
        await db.synced_emails.update_one(
            {"email_id": email_doc["email_id"]},
            {"$set": {"ai_status": "processed", "ai_result": {**result, "duplicate": True}}}
        )
        return False

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "transaction_type": result.get("transaction_type", "expense"),
        "amount": result.get("amount", 0),
        "date": result.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "account_id": result.get("account_id", accounts[0]["account_id"] if accounts else ""),
        "to_account_id": result.get("to_account_id"),
        "category_id": result.get("category_id"),
        "subcategory_id": result.get("subcategory_id"),
        "description": result.get("description", ""),
        "is_recurring": result.get("is_recurring", False),
        "recurring_frequency": result.get("recurring_frequency"),
        "source": "email",
        "source_provider": source_provider,
        "source_email_id": email_doc["email_id"],
        "status": "pending_review",
        "created_at": datetime.now(timezone.utc),
    }
    await db.transactions.insert_one(txn)
    del txn["_id"]

    await db.synced_emails.update_one(
        {"email_id": email_doc["email_id"]},
        {"$set": {"ai_status": "processed", "ai_result": result}}
    )
    return True


async def _get_category_info_for_ai(user_id: str) -> list:
    """Fetch all categories and format them for AI analysis (optimized, no N+1 queries)."""
    all_categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    
    parent_categories = [c for c in all_categories if c.get("parent_id") is None]
    subcats_by_parent = {}
    for c in all_categories:
        if c.get("parent_id"):
            subcats_by_parent.setdefault(c["parent_id"], []).append(c)
    
    category_info = []
    for c in parent_categories:
        subcats = subcats_by_parent.get(c["category_id"], [])
        subcat_str = ", ".join([f"{s['name']}: {s['category_id']}" for s in subcats])
        category_info.append(f"{c['name']} ({c['category_type']}): {c['category_id']} [subcategories: {subcat_str}]")
    
    return category_info


async def process_outlook_pending_emails(user_id: str, outlook_email: str = ""):
    query = {"user_id": user_id, "ai_status": {"$in": ["pending", "failed"]}, "source_provider": "outlook"}
    if outlook_email:
        query["outlook_email"] = outlook_email

    pending_emails = await db.synced_emails.find(query, {"_id": 0}).limit(50).to_list(50)

    if not openai_client:
        logger.error("OpenAI client not configured")
        return

    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    account_names = [f"{a['name']} ({a['account_type']}/{a.get('sub_type', '')}): {a['account_id']}" for a in accounts]
    category_info = await _get_category_info_for_ai(user_id)

    for email_doc in pending_emails:
        try:
            result = await analyze_email_with_ai(email_doc, account_names, category_info)

            if result and result.get("is_transaction"):
                await _create_transaction_from_ai_result(user_id, email_doc, result, accounts, "outlook")
            else:
                await db.synced_emails.update_one(
                    {"email_id": email_doc["email_id"]},
                    {"$set": {"ai_status": "no_transaction", "ai_result": result}}
                )

        except Exception as e:
            logger.error(f"Failed to process Outlook email {email_doc['email_id']}: {e}")
            await db.synced_emails.update_one(
                {"email_id": email_doc["email_id"]},
                {"$set": {"ai_status": "failed", "ai_error": str(e)}}
            )


# ─── Email Sync Routes ──────────────────────────────────────────────

@app.post("/api/email/start-sync")
async def start_email_sync(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    gmail_email = body.get("gmail_email")
    sync_from_date = body.get("sync_from_date")

    if not gmail_email or not sync_from_date:
        raise HTTPException(status_code=400, detail="gmail_email and sync_from_date required")

    token_doc = await db.gmail_tokens.find_one(
        {"user_id": user["user_id"], "gmail_email": gmail_email, "connected": True}, {"_id": 0}
    )
    if not token_doc:
        raise HTTPException(status_code=400, detail="Gmail not connected")

    await db.email_sync_config.update_one(
        {"user_id": user["user_id"], "gmail_email": gmail_email},
        {"$set": {
            "user_id": user["user_id"],
            "gmail_email": gmail_email,
            "sync_from_date": sync_from_date,
            "syncing": True,
            "started_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    asyncio.create_task(sync_emails_background(user["user_id"], gmail_email, sync_from_date))

    return {"message": "Email sync started", "gmail_email": gmail_email}


@app.post("/api/email/retry-pending")
async def retry_pending_emails(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    gmail_email = body.get("gmail_email", "")

    query = {"user_id": user["user_id"], "ai_status": {"$in": ["pending", "failed"]}}
    if gmail_email:
        query["gmail_email"] = gmail_email

    pending_count = await db.synced_emails.count_documents(query)
    if pending_count == 0:
        return {"message": "No pending emails to process", "count": 0}

    asyncio.create_task(process_pending_emails(user["user_id"], gmail_email))

    return {"message": f"Processing {pending_count} pending emails", "count": pending_count}


@app.get("/api/email/sync-stats")
async def email_sync_stats(user: dict = Depends(get_current_user), gmail_email: str = ""):
    if gmail_email:
        stats = await get_email_sync_stats(user["user_id"], gmail_email)
    else:
        stats = await get_email_sync_stats(user["user_id"])
    return stats


@app.get("/api/email/pending-review")
async def get_pending_review_transactions(user: dict = Depends(get_current_user), limit: int = 50, skip: int = 0):
    txns = await db.transactions.find(
        {"user_id": user["user_id"], "status": "pending_review", "source": {"$in": ["email", "sms", "statement"]}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(
        {"user_id": user["user_id"], "status": "pending_review", "source": {"$in": ["email", "sms", "statement"]}}
    )
    return {"transactions": txns, "total": total}


# ─── Email Sync Helpers ─────────────────────────────────────────────

async def get_email_sync_stats(user_id: str, gmail_email: str = None):
    query = {"user_id": user_id, "source_provider": {"$ne": "outlook"}}
    if gmail_email:
        query["gmail_email"] = gmail_email

    total_synced = await db.synced_emails.count_documents(query)
    processed = await db.synced_emails.count_documents({**query, "ai_status": "processed"})
    pending = await db.synced_emails.count_documents({**query, "ai_status": "pending"})
    failed = await db.synced_emails.count_documents({**query, "ai_status": "failed"})
    no_transaction = await db.synced_emails.count_documents({**query, "ai_status": "no_transaction"})

    txn_query = {"user_id": user_id, "source": "email", "source_provider": {"$ne": "outlook"}}
    transactions_created = await db.transactions.count_documents(txn_query)
    pending_review = await db.transactions.count_documents({**txn_query, "status": "pending_review"})

    return {
        "total_synced": total_synced,
        "processed_by_ai": processed,
        "no_transaction": no_transaction,
        "ai_pending": pending,
        "ai_failed": failed,
        "transactions_created": transactions_created,
        "pending_review": pending_review,
    }


async def get_gmail_credentials(user_id: str, gmail_email: str):
    token_doc = await db.gmail_tokens.find_one(
        {"user_id": user_id, "gmail_email": gmail_email, "connected": True}, {"_id": 0}
    )
    if not token_doc:
        return None

    creds = Credentials(
        token=token_doc["access_token"],
        refresh_token=token_doc.get("refresh_token"),
        token_uri=token_doc.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_doc.get("client_id", GOOGLE_CLIENT_ID),
        client_secret=token_doc.get("client_secret", GOOGLE_CLIENT_SECRET),
    )

    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc)

    if datetime.now(timezone.utc) >= expires_at:
        try:
            creds.refresh(GoogleRequest())
            await db.gmail_tokens.update_one(
                {"user_id": user_id, "gmail_email": gmail_email},
                {"$set": {
                    "access_token": creds.token,
                    "expires_at": datetime.now(timezone.utc) + timedelta(seconds=3600),
                }}
            )
        except Exception as e:
            logger.error(f"Failed to refresh Gmail token for {gmail_email}: {e}")
            return None

    return creds


async def sync_emails_background(user_id: str, gmail_email: str, sync_from_date: str):
    try:
        creds = await get_gmail_credentials(user_id, gmail_email)
        if not creds:
            logger.error(f"No valid Gmail credentials for {user_id}/{gmail_email}")
            return

        service = build("gmail", "v1", credentials=creds)
        query = f"after:{sync_from_date}"
        page_token = None
        total_fetched = 0

        while True:
            result = service.users().messages().list(
                userId="me", q=query, maxResults=100, pageToken=page_token
            ).execute()

            messages = result.get("messages", [])
            if not messages:
                break

            for msg_ref in messages:
                msg_id = msg_ref["id"]
                existing = await db.synced_emails.find_one(
                    {"user_id": user_id, "gmail_email": gmail_email, "message_id": msg_id}
                )
                if existing:
                    continue

                try:
                    msg = service.users().messages().get(
                        userId="me", id=msg_id, format="full"
                    ).execute()

                    headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
                    body_text = extract_email_body(msg.get("payload", {}))
                    snippet = msg.get("snippet", "")

                    email_doc = {
                        "email_id": f"em_{uuid.uuid4().hex[:12]}",
                        "user_id": user_id,
                        "gmail_email": gmail_email,
                        "message_id": msg_id,
                        "subject": headers.get("subject", ""),
                        "from_email": headers.get("from", ""),
                        "date": headers.get("date", ""),
                        "snippet": snippet,
                        "body_text": body_text[:5000] if body_text else snippet,
                        "ai_status": "pending",
                        "ai_result": None,
                        "synced_at": datetime.now(timezone.utc),
                    }
                    await db.synced_emails.insert_one(email_doc)
                    total_fetched += 1

                except Exception as e:
                    logger.error(f"Failed to fetch message {msg_id}: {e}")

            page_token = result.get("nextPageToken")
            if not page_token:
                break

        logger.info(f"Synced {total_fetched} emails for {user_id}/{gmail_email}")

        await db.email_sync_config.update_one(
            {"user_id": user_id, "gmail_email": gmail_email},
            {"$set": {"syncing": False, "last_sync_at": datetime.now(timezone.utc), "last_sync_count": total_fetched}}
        )

        await process_pending_emails(user_id, gmail_email)

    except Exception as e:
        logger.error(f"Email sync failed for {user_id}/{gmail_email}: {e}")
        await db.email_sync_config.update_one(
            {"user_id": user_id, "gmail_email": gmail_email},
            {"$set": {"syncing": False, "sync_error": str(e)}}
        )


def extract_email_body(payload):
    body = ""
    payload.get("mimeType", "")

    if "body" in payload and payload["body"].get("data"):
        data = payload["body"]["data"]
        body = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")

    if "parts" in payload:
        for part in payload["parts"]:
            part_mime = part.get("mimeType", "")
            if part_mime == "text/plain" and part.get("body", {}).get("data"):
                data = part["body"]["data"]
                body = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                break
            elif part_mime.startswith("multipart/"):
                body = extract_email_body(part)
                if body:
                    break

    body = re.sub(r'<[^>]+>', ' ', body)
    body = re.sub(r'\s+', ' ', body).strip()
    return body


async def process_pending_emails(user_id: str, gmail_email: str = ""):
    query = {"user_id": user_id, "ai_status": {"$in": ["pending", "failed"]}, "source_provider": {"$ne": "outlook"}}
    if gmail_email:
        query["gmail_email"] = gmail_email

    pending_emails = await db.synced_emails.find(query, {"_id": 0}).limit(50).to_list(50)

    if not openai_client:
        logger.error("OpenAI client not configured")
        return

    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    account_names = [f"{a['name']} ({a['account_type']}/{a.get('sub_type', '')}): {a['account_id']}" for a in accounts]
    category_info = await _get_category_info_for_ai(user_id)

    for email_doc in pending_emails:
        try:
            result = await analyze_email_with_ai(email_doc, account_names, category_info)

            if result and result.get("is_transaction"):
                await _create_transaction_from_ai_result(user_id, email_doc, result, accounts, "gmail")
            else:
                await db.synced_emails.update_one(
                    {"email_id": email_doc["email_id"]},
                    {"$set": {"ai_status": "no_transaction", "ai_result": result}}
                )

        except Exception as e:
            logger.error(f"Failed to process email {email_doc['email_id']}: {e}")
            await db.synced_emails.update_one(
                {"email_id": email_doc["email_id"]},
                {"$set": {"ai_status": "failed", "ai_error": str(e)}}
            )


# ─── Smart Cross-Source Duplicate Detection ──────────────────────────

def _extract_search_terms(payee: str, description: str) -> list:
    """Extract significant search terms from payee and description for fuzzy matching."""
    terms = []
    if payee:
        terms.extend(w for w in re.split(r'[\s\-_./,]+', payee.lower()) if len(w) >= 3)
    if description:
        terms.extend(w for w in re.split(r'[\s\-_./,]+', description.lower()) if len(w) >= 4)
    return terms


def _fuzzy_match_candidate(candidate: dict, search_terms: list, exact_amount: float) -> bool:
    """Check if a candidate transaction fuzzy-matches based on description terms or exact amount."""
    if not search_terms:
        return candidate.get("amount") == exact_amount
    cand_desc = (candidate.get("description") or "").lower()
    return any(term in cand_desc for term in search_terms)


async def check_cross_source_duplicate(user_id: str, amount: float, date_str: str, description: str = "", payee: str = ""):
    """
    Smart duplicate detection across email, SMS, and manual sources.
    Checks: amount match (±1%) + time window (±1 day) + fuzzy payee/description matching.
    Returns the duplicate transaction doc if found, else None.
    """
    if not amount or not date_str:
        return None

    try:
        txn_date = datetime.strptime(date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return None

    date_lower = (txn_date - timedelta(days=1)).strftime("%Y-%m-%d")
    date_upper = (txn_date + timedelta(days=1)).strftime("%Y-%m-%d")

    candidates = await db.transactions.find(
        {
            "user_id": user_id,
            "amount": {"$gte": amount * 0.99, "$lte": amount * 1.01},
            "date": {"$gte": date_lower, "$lte": date_upper},
        },
        {"_id": 0}
    ).to_list(50)

    if not candidates:
        return None

    search_terms = _extract_search_terms(payee, description)

    for candidate in candidates:
        if _fuzzy_match_candidate(candidate, search_terms, amount):
            return candidate

    return None


def _build_email_analysis_prompt(email_doc: dict, account_names: list, category_info: list) -> str:
    """Build the AI prompt for email transaction analysis."""
    return f"""Analyze this email and determine if it contains a financial transaction (income, expense, or transfer).

EMAIL:
Subject: {email_doc.get('subject', '')}
From: {email_doc.get('from_email', '')}
Date: {email_doc.get('date', '')}
Body: {email_doc.get('body_text', '')[:3000]}

AVAILABLE ACCOUNTS:
{chr(10).join(account_names) if account_names else "No accounts configured"}

AVAILABLE CATEGORIES:
{chr(10).join(category_info) if category_info else "No categories configured"}

INSTRUCTIONS:
- If this email contains a financial transaction (payment confirmation, receipt, bank alert, invoice, subscription charge, salary credit, etc.), extract the details.
- If this is NOT a financial transaction (newsletter, promotional, social, etc.), set is_transaction to false.
- For transaction_type: use "income" for money received, "expense" for money spent, "transfer" for money moved between accounts.
- Try to match account_id and category_id from the available options. If unsure, leave them as null.
- Extract the date in YYYY-MM-DD format from the email. If not clear, use the email date.
- Detect if this looks like a recurring transaction.

Respond ONLY with valid JSON (no markdown, no explanation):
{{
  "is_transaction": true/false,
  "transaction_type": "income" | "expense" | "transfer" | null,
  "amount": number or null,
  "date": "YYYY-MM-DD" or null,
  "description": "brief description" or null,
  "account_id": "matching account_id" or null,
  "to_account_id": "for transfers" or null,
  "category_id": "matching category_id" or null,
  "subcategory_id": "matching subcategory_id" or null,
  "is_recurring": true/false,
  "recurring_frequency": "monthly" | "weekly" | "yearly" | null,
  "confidence": "high" | "medium" | "low",
  "reason": "brief reason for classification"
}}"""


def _parse_ai_json_response(content: str) -> dict:
    """Parse and clean an AI JSON response."""
    content = content.strip()
    content = re.sub(r'^```json\s*', '', content)
    content = re.sub(r'\s*```$', '', content)
    return json.loads(content)


async def analyze_email_with_ai(email_doc: dict, account_names: list, category_info: list):
    prompt = _build_email_analysis_prompt(email_doc, account_names, category_info)

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a financial transaction analyzer. Extract transaction details from emails. Respond only with valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=500,
        )
        return _parse_ai_json_response(response.choices[0].message.content)

    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        raise


# ─── SMS Routes ──────────────────────────────────────────────────────

@app.post("/api/sms/upload")
async def upload_sms(data: SmsUpload, user: dict = Depends(get_current_user)):
    """Accept bulk SMS messages from mobile app for AI processing."""
    if not data.messages:
        raise HTTPException(status_code=400, detail="No SMS messages provided")

    stored = 0
    skipped = 0
    for msg in data.messages:
        existing = await db.synced_sms.find_one({
            "user_id": user["user_id"],
            "sender": msg.sender,
            "timestamp": msg.timestamp,
            "body_hash": hashlib.sha256(msg.body[:200].encode()).hexdigest(),
        })
        if existing:
            skipped += 1
            continue

        sms_doc = {
            "sms_id": f"sms_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "sender": msg.sender,
            "body": msg.body[:2000],
            "body_hash": hashlib.sha256(msg.body[:200].encode()).hexdigest(),
            "timestamp": msg.timestamp,
            "phone_number": msg.phone_number or "",
            "ai_status": "pending",
            "ai_result": None,
            "synced_at": datetime.now(timezone.utc),
        }
        await db.synced_sms.insert_one(sms_doc)
        del sms_doc["_id"]
        stored += 1

    if stored > 0:
        asyncio.create_task(process_pending_sms(user["user_id"]))

    return {"message": f"Uploaded {stored} SMS messages, skipped {skipped} duplicates", "stored": stored, "skipped": skipped}


@app.get("/api/sms/stats")
async def sms_stats(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    total_synced = await db.synced_sms.count_documents({"user_id": user_id})
    processed = await db.synced_sms.count_documents({"user_id": user_id, "ai_status": "processed"})
    pending = await db.synced_sms.count_documents({"user_id": user_id, "ai_status": "pending"})
    failed = await db.synced_sms.count_documents({"user_id": user_id, "ai_status": "failed"})
    no_transaction = await db.synced_sms.count_documents({"user_id": user_id, "ai_status": "no_transaction"})
    transactions_created = await db.transactions.count_documents({"user_id": user_id, "source": "sms"})
    pending_review = await db.transactions.count_documents({"user_id": user_id, "source": "sms", "status": "pending_review"})

    return {
        "total_synced": total_synced,
        "processed_by_ai": processed,
        "no_transaction": no_transaction,
        "ai_pending": pending,
        "ai_failed": failed,
        "transactions_created": transactions_created,
        "pending_review": pending_review,
    }


@app.post("/api/sms/retry-pending")
async def retry_pending_sms(user: dict = Depends(get_current_user)):
    pending_count = await db.synced_sms.count_documents(
        {"user_id": user["user_id"], "ai_status": {"$in": ["pending", "failed"]}}
    )
    if pending_count == 0:
        return {"message": "No pending SMS to process", "count": 0}

    asyncio.create_task(process_pending_sms(user["user_id"]))
    return {"message": f"Processing {pending_count} pending SMS messages", "count": pending_count}


# ─── SMS Processing Helpers ──────────────────────────────────────────

async def analyze_sms_with_ai(sms_doc: dict, account_names: list, category_info: list):
    prompt = f"""Analyze this SMS message and determine if it contains a financial transaction (income, expense, or transfer).

SMS:
From: {sms_doc.get('sender', '')}
Time: {sms_doc.get('timestamp', '')}
Message: {sms_doc.get('body', '')}

AVAILABLE ACCOUNTS:
{chr(10).join(account_names) if account_names else "No accounts configured"}

AVAILABLE CATEGORIES:
{chr(10).join(category_info) if category_info else "No categories configured"}

INSTRUCTIONS:
- Bank SMS alerts typically contain: amount, account details, transaction type (debited/credited), balance, reference number.
- UPI payment alerts: amount, payee name, UPI ID, reference.
- If this SMS contains a financial transaction, extract details.
- If NOT a financial transaction (OTP, promo, alert without transaction), set is_transaction to false.
- For transaction_type: "income" for credit/received, "expense" for debit/spent/paid, "transfer" for moved between accounts.
- Try to match account_id and category_id. If unsure, leave as null.
- Extract date in YYYY-MM-DD from timestamp.
- Extract payee name if visible (e.g., "paid to AMAZON" -> payee is "Amazon").

Respond ONLY with valid JSON (no markdown):
{{
  "is_transaction": true/false,
  "transaction_type": "income" | "expense" | "transfer" | null,
  "amount": number or null,
  "date": "YYYY-MM-DD" or null,
  "description": "brief description" or null,
  "payee": "payee name if identifiable" or null,
  "account_id": "matching account_id" or null,
  "to_account_id": "for transfers" or null,
  "category_id": "matching category_id" or null,
  "subcategory_id": "matching subcategory_id" or null,
  "is_recurring": true/false,
  "recurring_frequency": "monthly" | "weekly" | "yearly" | null,
  "confidence": "high" | "medium" | "low",
  "reason": "brief reason for classification"
}}"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a financial transaction analyzer specializing in SMS bank alerts and payment notifications. Extract transaction details from SMS. Respond only with valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=500,
        )

        content = response.choices[0].message.content.strip()
        content = re.sub(r'^```json\s*', '', content)
        content = re.sub(r'\s*```$', '', content)
        result = json.loads(content)
        return result

    except Exception as e:
        logger.error(f"AI SMS analysis failed: {e}")
        raise


async def process_pending_sms(user_id: str):
    pending_sms = await db.synced_sms.find(
        {"user_id": user_id, "ai_status": {"$in": ["pending", "failed"]}},
        {"_id": 0}
    ).limit(50).to_list(50)

    if not openai_client:
        logger.error("OpenAI client not configured")
        return

    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    account_names = [f"{a['name']} ({a['account_type']}/{a.get('sub_type', '')}): {a['account_id']}" for a in accounts]
    category_info = await _get_category_info_for_ai(user_id)

    for sms_doc in pending_sms:
        try:
            result = await analyze_sms_with_ai(sms_doc, account_names, category_info)

            if result and result.get("is_transaction"):
                await _process_sms_transaction(user_id, sms_doc, result, accounts)
            else:
                await db.synced_sms.update_one(
                    {"sms_id": sms_doc["sms_id"]},
                    {"$set": {"ai_status": "no_transaction", "ai_result": result}}
                )

        except Exception as e:
            logger.error(f"Failed to process SMS {sms_doc['sms_id']}: {e}")
            await db.synced_sms.update_one(
                {"sms_id": sms_doc["sms_id"]},
                {"$set": {"ai_status": "failed", "ai_error": str(e)}}
            )


async def _process_sms_transaction(user_id: str, sms_doc: dict, result: dict, accounts: list):
    """Handle a single SMS that was identified as a transaction."""
    duplicate = await check_cross_source_duplicate(
        user_id,
        amount=result.get("amount", 0),
        date_str=result.get("date", ""),
        description=result.get("description", ""),
        payee=result.get("payee", ""),
    )
    if duplicate:
        await db.synced_sms.update_one(
            {"sms_id": sms_doc["sms_id"]},
            {"$set": {"ai_status": "processed", "ai_result": {**result, "duplicate": True, "duplicate_txn_id": duplicate.get("transaction_id")}}}
        )
        return

    try:
        txn_date = datetime.strptime(sms_doc.get("timestamp", ""), "%Y-%m-%dT%H:%M:%S%z").strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        txn_date = result.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "transaction_type": result.get("transaction_type", "expense"),
        "amount": result.get("amount", 0),
        "date": result.get("date") or txn_date,
        "account_id": result.get("account_id", accounts[0]["account_id"] if accounts else ""),
        "to_account_id": result.get("to_account_id"),
        "category_id": result.get("category_id"),
        "subcategory_id": result.get("subcategory_id"),
        "description": result.get("description", ""),
        "payee": result.get("payee", ""),
        "is_recurring": result.get("is_recurring", False),
        "recurring_frequency": result.get("recurring_frequency"),
        "source": "sms",
        "source_sms_id": sms_doc["sms_id"],
        "status": "pending_review",
        "created_at": datetime.now(timezone.utc),
    }
    await db.transactions.insert_one(txn)
    del txn["_id"]

    await db.synced_sms.update_one(
        {"sms_id": sms_doc["sms_id"]},
        {"$set": {"ai_status": "processed", "ai_result": result}}
    )


# ─── Background Auto-Retry Task ─────────────────────────────────────

async def auto_retry_loop():
    while True:
        try:
            await asyncio.sleep(900)  # 15 minutes
            # Gmail auto-retry
            configs = await db.email_sync_config.find({"syncing": False}, {"_id": 0}).to_list(100)
            for config in configs:
                user_id = config["user_id"]
                gmail_email = config["gmail_email"]

                pending_count = await db.synced_emails.count_documents(
                    {"user_id": user_id, "gmail_email": gmail_email, "ai_status": {"$in": ["pending", "failed"]}}
                )
                if pending_count > 0:
                    logger.info(f"Auto-retry: Processing {pending_count} pending emails for {user_id}/{gmail_email}")
                    await process_pending_emails(user_id, gmail_email)

                token_doc = await db.gmail_tokens.find_one(
                    {"user_id": user_id, "gmail_email": gmail_email, "connected": True}, {"_id": 0}
                )
                if token_doc:
                    last_sync = config.get("last_sync_at")
                    if last_sync:
                        sync_date = config.get("sync_from_date", "")
                        await sync_emails_background(user_id, gmail_email, sync_date)

            # Outlook auto-retry
            outlook_configs = await db.outlook_sync_config.find({"syncing": False}, {"_id": 0}).to_list(100)
            for config in outlook_configs:
                user_id = config["user_id"]
                outlook_email = config["outlook_email"]

                pending_count = await db.synced_emails.count_documents(
                    {"user_id": user_id, "outlook_email": outlook_email, "source_provider": "outlook", "ai_status": {"$in": ["pending", "failed"]}}
                )
                if pending_count > 0:
                    logger.info(f"Auto-retry: Processing {pending_count} pending Outlook emails for {user_id}/{outlook_email}")
                    await process_outlook_pending_emails(user_id, outlook_email)

                token_doc = await db.outlook_tokens.find_one(
                    {"user_id": user_id, "outlook_email": outlook_email, "connected": True}, {"_id": 0}
                )
                if token_doc:
                    last_sync = config.get("last_sync_at")
                    if last_sync:
                        sync_date = config.get("sync_from_date", "")
                        await sync_outlook_emails_background(user_id, outlook_email, sync_date)

            # SMS auto-retry
            sms_pending = await db.synced_sms.find(
                {"ai_status": {"$in": ["pending", "failed"]}},
                {"_id": 0, "user_id": 1}
            ).to_list(100)
            sms_users = set(doc["user_id"] for doc in sms_pending)
            for uid in sms_users:
                logger.info(f"Auto-retry: Processing pending SMS for {uid}")
                await process_pending_sms(uid)

        except Exception as e:
            logger.error(f"Auto-retry loop error: {e}")


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(auto_retry_loop())
    await db.synced_emails.create_index([("user_id", 1), ("gmail_email", 1), ("message_id", 1)], unique=True, sparse=True)
    await db.gmail_tokens.create_index([("user_id", 1), ("gmail_email", 1)], unique=True)
    await db.email_sync_config.create_index([("user_id", 1), ("gmail_email", 1)], unique=True)
    await db.synced_emails.create_index([("user_id", 1), ("outlook_email", 1), ("message_id", 1)], unique=True, sparse=True)
    await db.outlook_tokens.create_index([("user_id", 1), ("outlook_email", 1)], unique=True)
    await db.outlook_sync_config.create_index([("user_id", 1), ("outlook_email", 1)], unique=True)
    await db.synced_sms.create_index([("user_id", 1), ("sender", 1), ("timestamp", 1), ("body_hash", 1)], sparse=True)
    await db.synced_sms.create_index([("user_id", 1), ("ai_status", 1)])


# ─── Health Check ────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SpentyAI API"}
