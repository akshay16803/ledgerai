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
from cryptography.fernet import Fernet, InvalidToken
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
    account_number: Optional[str] = None  # optional account number for reference
    opening_balance: float = 0.0
    balance_as_of_date: Optional[str] = None  # ISO date string
    currency: str = "INR"
    description: Optional[str] = None
    # Loan-specific fields (optional)
    loan_interest_rate: Optional[float] = None  # annual interest rate %
    loan_tenure_months: Optional[int] = None  # remaining tenure in months
    loan_emi_amount: Optional[float] = None  # monthly EMI amount
    loan_emi_day: Optional[int] = None  # day of month EMI is due (1-31)

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    sub_type: Optional[str] = None
    account_number: Optional[str] = None
    description: Optional[str] = None
    currency: Optional[str] = None
    opening_balance: Optional[float] = None
    balance_as_of_date: Optional[str] = None  # ISO date string
    balance: Optional[float] = None
    # Loan-specific fields (optional)
    loan_interest_rate: Optional[float] = None
    loan_tenure_months: Optional[int] = None
    loan_emi_amount: Optional[float] = None
    loan_emi_day: Optional[int] = None

class AccountSubTypeCreate(BaseModel):
    name: str
    account_type: str  # asset, liability, equity
    icon: Optional[str] = None  # optional icon identifier

class AccountSubTypeUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None

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
    payment_method: Optional[str] = None  # upi, credit_card, debit_card, net_banking, cash, wallet, other
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
    payment_method: Optional[str] = None
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
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    user_out = UserOut(**user).dict()
    user_out["settings"] = {
        "base_currency": (settings or {}).get("base_currency", "INR"),
        "date_format": (settings or {}).get("date_format", "DD/MM/YYYY"),
    }
    return user_out


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"message": "Logged out"}


# ─── Default Data Seeding ───────────────────────────────────────────

async def seed_default_data(user_id: str):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    default_accounts = [
        {"name": "Cash", "account_type": "asset", "sub_type": "cash", "opening_balance": 0, "currency": "INR"},
        {"name": "Bank Account", "account_type": "asset", "sub_type": "bank", "opening_balance": 0, "currency": "INR"},
        {"name": "Credit Card", "account_type": "liability", "sub_type": "credit_card", "opening_balance": 0, "currency": "INR"},
    ]
    for acc in default_accounts:
        acc["account_id"] = f"acc_{uuid.uuid4().hex[:12]}"
        acc["user_id"] = user_id
        acc["balance"] = acc["opening_balance"]
        acc["balance_as_of_date"] = today_str
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
    # Prevent duplicate accounts with same name + account_number for this user
    dup_query = {"user_id": user["user_id"], "name": data.name}
    if data.account_number:
        dup_query["account_number"] = data.account_number
    existing = await db.accounts.find_one(dup_query, {"_id": 0, "account_id": 1})
    if existing:
        raise HTTPException(status_code=400, detail=f"Account '{data.name}' already exists")
    
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    balance_date = data.balance_as_of_date or today_str
    account = {
        "account_id": f"acc_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.name,
        "account_type": data.account_type,
        "sub_type": data.sub_type or "",
        "account_number": data.account_number or "",
        "opening_balance": data.opening_balance,
        "balance_as_of_date": balance_date,
        "balance": data.opening_balance,
        "currency": data.currency,
        "description": data.description or "",
        "created_at": datetime.now(timezone.utc),
    }
    # Add loan-specific fields if provided
    if data.loan_interest_rate is not None:
        account["loan_interest_rate"] = data.loan_interest_rate
    if data.loan_tenure_months is not None:
        account["loan_tenure_months"] = data.loan_tenure_months
    if data.loan_emi_amount is not None:
        account["loan_emi_amount"] = data.loan_emi_amount
    if data.loan_emi_day is not None:
        account["loan_emi_day"] = data.loan_emi_day

    await db.accounts.insert_one(account)
    del account["_id"]
    # Recalculate balance if date is in the past (there might be transactions after that date)
    await recalculate_account_balance(user["user_id"], account["account_id"])
    account = await db.accounts.find_one({"account_id": account["account_id"]}, {"_id": 0})

    # Auto-create recurring EMI transaction if loan details are complete
    if data.loan_emi_amount and data.loan_tenure_months:
        await _create_loan_emi_recurring(user["user_id"], account)

    return account


@app.put("/api/accounts/{account_id}")
async def update_account(account_id: str, data: AccountUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # If setting opening_balance on an AI-created account, clear the needs_opening_balance flag
    if "opening_balance" in update_data:
        update_data["needs_opening_balance"] = False
    
    needs_recalculation = "opening_balance" in update_data or "balance_as_of_date" in update_data
    
    # Remove 'balance' from update_data if we're going to recalculate anyway
    if needs_recalculation:
        update_data.pop("balance", None)
    
    # Check if loan details are being added/updated
    loan_fields_changed = any(k in update_data for k in ["loan_emi_amount", "loan_tenure_months", "loan_interest_rate", "loan_emi_day"])
    
    result = await db.accounts.update_one(
        {"account_id": account_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Recalculate balance when opening_balance or balance_as_of_date changes
    if needs_recalculation:
        await recalculate_account_balance(user["user_id"], account_id)
    
    account = await db.accounts.find_one(
        {"account_id": account_id}, {"_id": 0}
    )
    
    # Auto-create/update recurring EMI transaction if loan details are complete
    if loan_fields_changed and account.get("loan_emi_amount") and account.get("loan_tenure_months"):
        await _create_loan_emi_recurring(user["user_id"], account)
    
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


@app.post("/api/accounts/{account_id}/recalculate")
async def recalculate_balance_endpoint(account_id: str, user: dict = Depends(get_current_user)):
    """Recalculate account balance from opening_balance + transactions after balance_as_of_date."""
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await recalculate_account_balance(user["user_id"], account_id)
    updated = await db.accounts.find_one({"account_id": account_id}, {"_id": 0})
    return updated


async def _create_loan_emi_recurring(user_id: str, account: dict):
    """Create or update a recurring EMI expense transaction for a loan account."""
    account_id = account["account_id"]
    emi_amount = account.get("loan_emi_amount", 0)
    emi_day = account.get("loan_emi_day", 1)
    
    if not emi_amount:
        return
    
    # Calculate the next EMI due date based on emi_day
    now = datetime.now(timezone.utc)
    try:
        emi_date = now.replace(day=min(emi_day, 28))  # Safe for all months
    except ValueError:
        emi_date = now.replace(day=28)
    if emi_date.date() < now.date():
        from dateutil.relativedelta import relativedelta
        emi_date = emi_date + relativedelta(months=1)
    emi_date_str = emi_date.strftime("%Y-%m-%d")
    
    # Check if a recurring EMI transaction already exists for this loan
    existing_emi = await db.transactions.find_one({
        "user_id": user_id,
        "account_id": account_id,
        "is_recurring": True,
        "source": "loan_emi",
    }, {"_id": 0})
    
    if existing_emi:
        # Update the existing recurring transaction
        await db.transactions.update_one(
            {"transaction_id": existing_emi["transaction_id"]},
            {"$set": {"amount": emi_amount, "description": f"EMI - {account['name']}", "date": emi_date_str, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        # Find or create an expense category for "Loan EMI"
        emi_category = await db.categories.find_one({
            "user_id": user_id,
            "name": {"$regex": "^(Loan|EMI|Loan EMI)$", "$options": "i"},
            "parent_id": None,
        }, {"_id": 0})
        
        category_id = emi_category["category_id"] if emi_category else None
        if not category_id:
            category_id = f"cat_{uuid.uuid4().hex[:12]}"
            await db.categories.insert_one({
                "category_id": category_id,
                "user_id": user_id,
                "name": "Loan EMI",
                "category_type": "expense",
                "parent_id": None,
                "created_at": datetime.now(timezone.utc),
            })
        
        txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "transaction_type": "expense",
            "amount": emi_amount,
            "date": emi_date_str,
            "account_id": account_id,
            "to_account_id": None,
            "category_id": category_id,
            "subcategory_id": None,
            "description": f"EMI - {account['name']}",
            "payment_method": None,
            "is_recurring": True,
            "recurring_frequency": "monthly",
            "source": "loan_emi",
            "status": "approved",
            "created_at": datetime.now(timezone.utc),
        }
        await db.transactions.insert_one(txn)
        del txn["_id"]
        # NOTE: Do NOT apply to balances — this is a recurring template for cash flow projection.
        # Actual payments will be recorded separately by the user.


def _generate_amortization_schedule(outstanding: float, annual_rate: float, tenure_months: int, emi: float, start_date_str: str, emi_day: int = 1):
    """Generate reducing balance amortization schedule from balance_as_of_date using emi_day."""
    schedule = []
    balance = abs(outstanding)  # Work with positive numbers
    monthly_rate = (annual_rate / 100) / 12
    
    from dateutil.relativedelta import relativedelta
    start = datetime.strptime(start_date_str, "%Y-%m-%d")
    # First EMI due date: the next occurrence of emi_day from start
    safe_day = min(emi_day, 28)
    try:
        first_due = start.replace(day=safe_day)
    except ValueError:
        first_due = start.replace(day=28)
    if first_due <= start:
        first_due = first_due + relativedelta(months=1)
    
    for month in range(1, tenure_months + 1):
        interest = round(balance * monthly_rate, 2)
        principal = round(emi - interest, 2)
        if principal > balance:
            principal = balance
            interest = round(emi - principal, 2) if emi > principal else 0
        balance = round(balance - principal, 2)
        if balance < 0:
            balance = 0
        
        due_date = first_due + relativedelta(months=month - 1)
        
        schedule.append({
            "month": month,
            "due_date": due_date.strftime("%Y-%m-%d"),
            "emi": round(emi, 2),
            "principal": principal,
            "interest": interest,
            "outstanding": balance,
        })
        
        if balance <= 0:
            break
    
    return schedule


@app.get("/api/accounts/{account_id}/amortization")
async def get_amortization(account_id: str, user: dict = Depends(get_current_user)):
    """Generate loan amortization schedule for a loan account."""
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    rate = account.get("loan_interest_rate")
    tenure = account.get("loan_tenure_months")
    emi = account.get("loan_emi_amount")
    outstanding = account.get("opening_balance", 0)
    emi_day = account.get("loan_emi_day", 1)
    start_date = account.get("balance_as_of_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    if not all([rate is not None, tenure, emi]):
        raise HTTPException(status_code=400, detail="Loan details (interest rate, tenure, EMI) are required")
    
    schedule = _generate_amortization_schedule(outstanding, rate, tenure, emi, start_date, emi_day)
    
    total_interest = sum(s["interest"] for s in schedule)
    total_payment = sum(s["emi"] for s in schedule)
    
    # Check which EMIs are "paid" based on actual expense transactions on this account
    payments = await db.transactions.find({
        "user_id": user["user_id"],
        "account_id": account_id,
        "transaction_type": "expense",
        "status": "approved",
    }, {"_id": 0, "date": 1, "amount": 1}).sort("date", 1).to_list(1000)
    
    paid_count = len(payments)
    total_paid = sum(p["amount"] for p in payments)
    
    return {
        "account_id": account_id,
        "account_name": account.get("name", ""),
        "outstanding_balance": abs(outstanding),
        "interest_rate": rate,
        "tenure_months": tenure,
        "emi_amount": emi,
        "emi_day": emi_day,
        "start_date": start_date,
        "total_interest": round(total_interest, 2),
        "total_payment": round(total_payment, 2),
        "payments_made": paid_count,
        "total_paid": round(total_paid, 2),
        "months_remaining": max(0, tenure - paid_count),
        "schedule": schedule,
    }


# ─── Account Sub Types Routes ────────────────────────────────────────

# Default sub types (used when user has no custom sub types)
DEFAULT_SUB_TYPES = {
    "asset": [
        {"name": "Bank", "sub_type_id": "default_bank", "icon": "bank"},
        {"name": "Cash", "sub_type_id": "default_cash", "icon": "cash"},
        {"name": "Wallet", "sub_type_id": "default_wallet", "icon": "wallet"},
        {"name": "Savings", "sub_type_id": "default_savings", "icon": "piggy_bank"},
        {"name": "Investment", "sub_type_id": "default_investment", "icon": "chart"},
        {"name": "Fixed Deposit", "sub_type_id": "default_fd", "icon": "lock"},
    ],
    "liability": [
        {"name": "Credit Card", "sub_type_id": "default_credit_card", "icon": "credit_card"},
        {"name": "Loan", "sub_type_id": "default_loan", "icon": "loan"},
        {"name": "Mortgage", "sub_type_id": "default_mortgage", "icon": "house"},
    ],
    "equity": [
        {"name": "Capital", "sub_type_id": "default_capital", "icon": "capital"},
        {"name": "Retained Earnings", "sub_type_id": "default_retained", "icon": "savings"},
    ],
}

@app.get("/api/account-sub-types")
async def list_account_sub_types(user: dict = Depends(get_current_user), account_type: Optional[str] = None):
    """List all account sub types (default + user custom)"""
    query = {"user_id": user["user_id"]}
    if account_type:
        query["account_type"] = account_type
    
    # Get user's custom sub types
    custom_types = await db.account_sub_types.find(query, {"_id": 0}).to_list(100)
    
    # Combine with defaults
    result = {}
    for acc_type in ["asset", "liability", "equity"]:
        if account_type and acc_type != account_type:
            continue
        # Start with defaults
        result[acc_type] = [
            {**st, "is_default": True, "account_type": acc_type} 
            for st in DEFAULT_SUB_TYPES.get(acc_type, [])
        ]
        # Add custom sub types
        for custom in custom_types:
            if custom.get("account_type") == acc_type:
                result[acc_type].append({**custom, "is_default": False})
    
    return result


@app.post("/api/account-sub-types")
async def create_account_sub_type(data: AccountSubTypeCreate, user: dict = Depends(get_current_user)):
    """Create a custom account sub type"""
    # Check if name already exists for this account type
    existing = await db.account_sub_types.find_one({
        "user_id": user["user_id"],
        "account_type": data.account_type,
        "name": {"$regex": f"^{re.escape(data.name)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Sub type with this name already exists")
    
    # Check if it conflicts with default names
    defaults = DEFAULT_SUB_TYPES.get(data.account_type, [])
    for d in defaults:
        if d["name"].lower() == data.name.lower():
            raise HTTPException(status_code=400, detail="Cannot create sub type with same name as default")
    
    sub_type = {
        "sub_type_id": f"subtype_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.name,
        "account_type": data.account_type,
        "icon": data.icon or "folder",
        "created_at": datetime.now(timezone.utc),
    }
    await db.account_sub_types.insert_one(sub_type)
    del sub_type["_id"]
    return sub_type


@app.put("/api/account-sub-types/{sub_type_id}")
async def update_account_sub_type(sub_type_id: str, data: AccountSubTypeUpdate, user: dict = Depends(get_current_user)):
    """Update a custom account sub type"""
    if sub_type_id.startswith("default_"):
        raise HTTPException(status_code=400, detail="Cannot modify default sub types")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # If renaming, check for conflicts
    if "name" in update_data:
        existing = await db.account_sub_types.find_one({
            "user_id": user["user_id"],
            "name": {"$regex": f"^{re.escape(update_data['name'])}$", "$options": "i"},
            "sub_type_id": {"$ne": sub_type_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Sub type with this name already exists")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.account_sub_types.update_one(
        {"sub_type_id": sub_type_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sub type not found")
    
    sub_type = await db.account_sub_types.find_one({"sub_type_id": sub_type_id}, {"_id": 0})
    return sub_type


@app.delete("/api/account-sub-types/{sub_type_id}")
async def delete_account_sub_type(sub_type_id: str, user: dict = Depends(get_current_user)):
    """Delete a custom account sub type"""
    if sub_type_id.startswith("default_"):
        raise HTTPException(status_code=400, detail="Cannot delete default sub types")
    
    # Check if any accounts use this sub type
    sub_type = await db.account_sub_types.find_one(
        {"sub_type_id": sub_type_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not sub_type:
        raise HTTPException(status_code=404, detail="Sub type not found")
    
    accounts_using = await db.accounts.count_documents({
        "user_id": user["user_id"],
        "sub_type": sub_type["name"]
    })
    if accounts_using > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete sub type used by {accounts_using} account(s)")
    
    await db.account_sub_types.delete_one({"sub_type_id": sub_type_id, "user_id": user["user_id"]})
    return {"message": "Sub type deleted"}


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
        "payment_method": data.payment_method,
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


async def recalculate_account_balance(user_id: str, account_id: str):
    """Recalculate account balance from opening_balance + all approved transactions after balance_as_of_date."""
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user_id}, {"_id": 0}
    )
    if not account:
        return
    
    opening = account.get("opening_balance", 0)
    as_of_date = account.get("balance_as_of_date")
    
    # Start from opening balance
    balance = opening
    
    if as_of_date:
        # Get all approved transactions for this account after the balance_as_of_date
        # "Opening balance for the day" means transactions ON that date are NOT yet included
        # Transactions on or after that date should be counted
        txn_query = {
            "user_id": user_id,
            "status": "approved",
            "date": {"$gte": as_of_date},
            "source": {"$ne": "loan_emi"},  # Exclude recurring EMI templates
        }
        
        # Transactions where this account is the primary account
        primary_txns = await db.transactions.find(
            {**txn_query, "account_id": account_id}, {"_id": 0}
        ).to_list(10000)
        
        for txn in primary_txns:
            if txn["transaction_type"] == "income":
                balance += txn["amount"]
            elif txn["transaction_type"] == "expense":
                balance -= txn["amount"]
            elif txn["transaction_type"] == "transfer":
                balance -= txn["amount"]  # Money leaving this account
        
        # Transfers INTO this account
        transfer_in_txns = await db.transactions.find(
            {**txn_query, "to_account_id": account_id, "transaction_type": "transfer"}, {"_id": 0}
        ).to_list(10000)
        
        for txn in transfer_in_txns:
            balance += txn["amount"]
    
    await db.accounts.update_one(
        {"account_id": account_id, "user_id": user_id},
        {"$set": {"balance": balance}}
    )


async def apply_transaction_to_balances(user_id: str, txn: dict):
    # Skip loan_emi recurring templates — they're for cash flow projection only
    if txn.get("source") == "loan_emi":
        return
    
    t_type = txn["transaction_type"]
    amount = txn["amount"]
    txn_date = txn.get("date", "")

    # Check if transaction date is on or after the account's balance_as_of_date
    # Opening balance for the day means transactions ON that date are not yet factored in
    async def should_apply(account_id):
        acc = await db.accounts.find_one(
            {"account_id": account_id, "user_id": user_id},
            {"_id": 0, "balance_as_of_date": 1}
        )
        as_of = acc.get("balance_as_of_date") if acc else None
        if not as_of:
            return True  # No date set, apply all transactions
        return txn_date >= as_of

    if t_type == "income":
        if await should_apply(txn["account_id"]):
            await db.accounts.update_one(
                {"account_id": txn["account_id"], "user_id": user_id},
                {"$inc": {"balance": amount}}
            )
    elif t_type == "expense":
        if await should_apply(txn["account_id"]):
            await db.accounts.update_one(
                {"account_id": txn["account_id"], "user_id": user_id},
                {"$inc": {"balance": -amount}}
            )
    elif t_type == "transfer":
        if await should_apply(txn["account_id"]):
            await db.accounts.update_one(
                {"account_id": txn["account_id"], "user_id": user_id},
                {"$inc": {"balance": -amount}}
            )
        if txn.get("to_account_id"):
            if await should_apply(txn["to_account_id"]):
                await db.accounts.update_one(
                    {"account_id": txn["to_account_id"], "user_id": user_id},
                    {"$inc": {"balance": amount}}
                )


async def reverse_transaction_balances(user_id: str, txn: dict):
    if txn.get("source") == "loan_emi":
        return
    
    t_type = txn["transaction_type"]
    amount = txn["amount"]
    txn_date = txn.get("date", "")

    async def should_apply(account_id):
        acc = await db.accounts.find_one(
            {"account_id": account_id, "user_id": user_id},
            {"_id": 0, "balance_as_of_date": 1}
        )
        as_of = acc.get("balance_as_of_date") if acc else None
        if not as_of:
            return True
        return txn_date >= as_of

    if t_type == "income":
        if await should_apply(txn["account_id"]):
            await db.accounts.update_one(
                {"account_id": txn["account_id"], "user_id": user_id},
                {"$inc": {"balance": -amount}}
            )
    elif t_type == "expense":
        if await should_apply(txn["account_id"]):
            await db.accounts.update_one(
                {"account_id": txn["account_id"], "user_id": user_id},
                {"$inc": {"balance": amount}}
            )
    elif t_type == "transfer":
        if await should_apply(txn["account_id"]):
            await db.accounts.update_one(
                {"account_id": txn["account_id"], "user_id": user_id},
                {"$inc": {"balance": amount}}
            )
        if txn.get("to_account_id"):
            if await should_apply(txn["to_account_id"]):
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

    # Archive the source email with attachments if this is an email-sourced transaction
    if existing.get("source") == "email" and existing.get("source_email_id"):
        asyncio.create_task(archive_email_for_transaction(user["user_id"], existing))

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

    # Remove archived email if it was already archived
    if existing.get("source_email_id"):
        await db.email_archives.delete_one({
            "user_id": user["user_id"],
            "source_email_id": existing["source_email_id"]
        })

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
    period_from: Optional[str] = Form(None),  # YYYY-MM-DD
    period_to: Optional[str] = Form(None),    # YYYY-MM-DD
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
        "account_sub_type": account.get("sub_type"),
        "statement_type": statement_type,
        "filename": file.filename,
        "file_ext": ext,
        "file_path": file_path,
        "file_size": len(content),
        "status": "parsing",
        "parsed_entries": [],
        "reconciliation": None,
        "period_from": (period_from or None),
        "period_to": (period_to or None),
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

    # Prefer user-selected period from upload; fall back to derived min/max
    # from parsed entries so older statements without a saved period still work.
    period_from = stmt.get("period_from")
    period_to = stmt.get("period_to")
    if not period_from or not period_to:
        dates = [e["date"] for e in parsed if e.get("date")]
        if not dates:
            raise HTTPException(status_code=400, detail="No valid dates in statement")
        period_from = period_from or min(dates)
        period_to = period_to or max(dates)

    ledger_txns = await db.transactions.find(
        {
            "user_id": user_id,
            "status": "approved",
            "$or": [{"account_id": account_id}, {"to_account_id": account_id}],
            "date": {"$gte": period_from, "$lte": period_to},
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


@app.post("/api/statements/{statement_id}/unlock")
async def unlock_statement(
    statement_id: str, request: Request, user: dict = Depends(get_current_user)
):
    """Retry parsing a password-protected PDF statement with a user-provided
    password. On success, the password is saved encrypted for this user+account
    so future uploads for the same account parse automatically."""
    body = await request.json()
    password = (body.get("password") or "").strip()
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")

    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    if stmt.get("file_ext") != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF statements can be unlocked")

    file_path = stmt.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Statement file missing on server")

    # Quick password validity check so we can give the user immediate
    # feedback on an incorrect password, without blocking the browser on
    # the full parse.
    is_valid = await asyncio.to_thread(_quick_pdf_password_check, file_path, password)
    if not is_valid:
        await db.statements.update_one(
            {"statement_id": statement_id},
            {"$set": {
                "status": "password_required",
                "parse_error": "The password you entered did not unlock this PDF.",
            }}
        )
        raise HTTPException(status_code=400, detail="Incorrect password for this PDF")

    # Mark back to parsing and reset progress so the UI shows a fresh bar.
    await db.statements.update_one(
        {"statement_id": statement_id},
        {"$set": {
            "status": "parsing",
            "parse_error": None,
            "processing_stage": "queued",
            "processing_stage_label": PARSE_STAGES["queued"]["label"],
            "processing_progress": PARSE_STAGES["queued"]["progress"],
            "processing_eta_seconds": PARSE_STAGES["queued"]["eta_seconds"],
            "processing_started_at": datetime.now(timezone.utc),
            "processing_updated_at": datetime.now(timezone.utc),
        }}
    )

    # Run the heavy parse in the background so the request returns immediately.
    asyncio.create_task(
        parse_statement_background(statement_id, user["user_id"], password=password)
    )

    return {
        "statement_id": statement_id,
        "status": "parsing",
        "message": "Password accepted, parsing in progress",
    }


# ─── Statement Parsing Helpers ───────────────────────────────────────

# Progress stages for statement parsing. Each tuple is:
#   (stage_name, percent_complete_at_stage_start, rough_remaining_seconds_at_stage_start)
# Used to drive the per-statement progress bar in the UI.
PARSE_STAGES = {
    "queued":          {"progress": 5,   "eta_seconds": 30, "label": "Queued"},
    "decrypting":      {"progress": 15,  "eta_seconds": 25, "label": "Decrypting PDF"},
    "extracting_text": {"progress": 35,  "eta_seconds": 20, "label": "Extracting text"},
    "ai_parsing":      {"progress": 70,  "eta_seconds": 12, "label": "Reading transactions"},
    "saving":          {"progress": 95,  "eta_seconds": 2,  "label": "Saving"},
    "parsed":          {"progress": 100, "eta_seconds": 0,  "label": "Done"},
    "parse_failed":    {"progress": 100, "eta_seconds": 0,  "label": "Failed"},
    "password_required": {"progress": 0, "eta_seconds": 0,  "label": "Password required"},
}


async def _set_parse_stage(statement_id: str, stage: str, *, reset_start: bool = False):
    """Write the current parsing stage + progress to the statement doc so the
    UI can render a live progress bar. Call at every stage transition."""
    info = PARSE_STAGES.get(stage, {"progress": 0, "eta_seconds": 0, "label": stage})
    now = datetime.now(timezone.utc)
    set_fields = {
        "processing_stage": stage,
        "processing_stage_label": info["label"],
        "processing_progress": info["progress"],
        "processing_eta_seconds": info["eta_seconds"],
        "processing_updated_at": now,
    }
    update: dict = {"$set": set_fields}
    if reset_start:
        set_fields["processing_started_at"] = now
    else:
        # Only set started_at if it doesn't already exist.
        update["$setOnInsert"] = {}
        # Use a separate update to avoid overwriting an existing started_at.
        existing = await db.statements.find_one(
            {"statement_id": statement_id}, {"processing_started_at": 1, "_id": 0}
        )
        if not existing or not existing.get("processing_started_at"):
            set_fields["processing_started_at"] = now
        update = {"$set": set_fields}
    await db.statements.update_one({"statement_id": statement_id}, update)


def _quick_pdf_password_check(file_path: str, password: str) -> bool:
    """Return True if the password successfully decrypts the PDF. Fast — just
    opens the PDF with pdfplumber and reads the first page's text length."""
    try:
        import pdfplumber  # imported lazily
        with pdfplumber.open(file_path, password=password) as pdf:
            if not pdf.pages:
                return False
            # If password is wrong, pdfplumber usually raises; if it silently
            # returns empty text on page 1, still treat as opened — the full
            # parser will handle empty extraction.
            try:
                _ = pdf.pages[0].extract_text()
            except Exception:
                pass
            return True
    except Exception as e:
        msg = str(e).lower()
        password_markers = (
            "password", "encrypt", "decrypt", "owner password",
            "user password", "pdfpasswordincorrect",
        )
        if any(m in msg for m in password_markers):
            return False
        # Non-password errors (corrupt file etc.) — treat as unable to verify.
        return False


async def parse_statement_background(statement_id: str, user_id: str, password: Optional[str] = None):
    try:
        await _set_parse_stage(statement_id, "queued", reset_start=True)
        stmt = await db.statements.find_one({"statement_id": statement_id}, {"_id": 0})
        if not stmt:
            return

        file_path = stmt["file_path"]
        ext = stmt["file_ext"]
        account_id = stmt.get("account_id")

        # Resolve password for encrypted PDFs: prefer explicit, else saved.
        effective_password = password
        if ext == "pdf" and not effective_password and account_id:
            effective_password = await get_saved_pdf_password(user_id, account_id)

        stmt_type = stmt.get("statement_type", "bank")
        raw_text_chars = 0
        try:
            if ext == "csv":
                await _set_parse_stage(statement_id, "extracting_text")
                entries = parse_csv_statement(file_path)
                # Apply the same Dr/Cr + narration overrides + dedupe to CSV rows.
                entries = _post_process_entries(
                    [{
                        "date": e.get("date"),
                        "description": e.get("description", ""),
                        "amount": e.get("amount", 0),
                        "transaction_type": e.get("transaction_type", "expense"),
                        "balance": e.get("balance"),
                    } for e in entries],
                    stmt_type,
                )
            elif ext == "pdf":
                await _set_parse_stage(statement_id, "decrypting")
                # Extract once so we can record the size for later verification.
                await _set_parse_stage(statement_id, "extracting_text")
                pdf_text = extract_pdf_text(file_path, password=effective_password)
                raw_text_chars = len(pdf_text or "")
                if pdf_text and len(pdf_text.strip()) >= 50:
                    await _set_parse_stage(statement_id, "ai_parsing")
                    entries = await parse_statement_text_with_ai(pdf_text, stmt_type)
                else:
                    entries = []
            else:
                entries = []
        except PdfPasswordRequired as e:
            # Encrypted PDF and we have no working password. Persist distinct status.
            logger.info(f"Statement {statement_id} requires a PDF password")
            await db.statements.update_one(
                {"statement_id": statement_id},
                {"$set": {
                    "status": "password_required",
                    "parse_error": "This PDF is password protected. Please provide the password.",
                    "processing_stage": "password_required",
                    "processing_stage_label": PARSE_STAGES["password_required"]["label"],
                    "processing_progress": 0,
                    "processing_eta_seconds": 0,
                    "processing_updated_at": datetime.now(timezone.utc),
                }}
            )
            return

        await _set_parse_stage(statement_id, "saving")

        # If user supplied a password that worked, remember it for next time.
        if password and entries and account_id:
            try:
                await save_pdf_password(user_id, account_id, password)
            except Exception as save_err:
                logger.error(f"Failed to save PDF password: {save_err}")

        final_stage = "parsed" if entries else "parse_failed"
        final_info = PARSE_STAGES[final_stage]
        await db.statements.update_one(
            {"statement_id": statement_id},
            {"$set": {
                "parsed_entries": entries,
                "status": "parsed" if entries else "parse_failed",
                "entry_count": len(entries),
                "parsed_at": datetime.now(timezone.utc),
                "parse_error": None if entries else "Could not extract any entries from this statement.",
                "raw_text_chars": raw_text_chars,
                "processing_stage": final_stage,
                "processing_stage_label": final_info["label"],
                "processing_progress": final_info["progress"],
                "processing_eta_seconds": 0,
                "processing_updated_at": datetime.now(timezone.utc),
            }}
        )
        logger.info(f"Parsed {len(entries)} entries from statement {statement_id}")

    except Exception as e:
        logger.error(f"Statement parsing failed for {statement_id}: {e}")
        await db.statements.update_one(
            {"statement_id": statement_id},
            {"$set": {
                "status": "parse_failed",
                "parse_error": str(e),
                "processing_stage": "parse_failed",
                "processing_stage_label": PARSE_STAGES["parse_failed"]["label"],
                "processing_progress": 100,
                "processing_eta_seconds": 0,
                "processing_updated_at": datetime.now(timezone.utc),
            }}
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


class PdfPasswordRequired(Exception):
    """Raised when a PDF is encrypted and the supplied password (if any) fails."""
    pass


_FERNET_CACHE: dict = {}


async def _get_pdf_fernet() -> Fernet:
    """Return a process-cached Fernet instance.
    Key is loaded from PDF_PASSWORD_KEY env var, or generated once and persisted
    in the `system_config` collection so encrypted data survives restarts.
    """
    if "fernet" in _FERNET_CACHE:
        return _FERNET_CACHE["fernet"]

    key = os.environ.get("PDF_PASSWORD_KEY")
    if not key:
        doc = await db.system_config.find_one({"key": "pdf_password_fernet_key"})
        if doc and doc.get("value"):
            key = doc["value"]
        else:
            key = Fernet.generate_key().decode()
            await db.system_config.update_one(
                {"key": "pdf_password_fernet_key"},
                {"$setOnInsert": {"key": "pdf_password_fernet_key", "value": key,
                                  "created_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
    fernet = Fernet(key.encode() if isinstance(key, str) else key)
    _FERNET_CACHE["fernet"] = fernet
    return fernet


async def encrypt_pdf_password(password: str) -> str:
    fernet = await _get_pdf_fernet()
    return fernet.encrypt(password.encode()).decode()


async def decrypt_pdf_password(ciphertext: str) -> Optional[str]:
    try:
        fernet = await _get_pdf_fernet()
        return fernet.decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception) as e:
        logger.warning(f"Failed to decrypt stored PDF password: {e}")
        return None


async def get_saved_pdf_password(user_id: str, account_id: str) -> Optional[str]:
    """Retrieve decrypted password scoped to this user + account. Never cross-user."""
    doc = await db.pdf_passwords.find_one(
        {"user_id": user_id, "account_id": account_id}, {"_id": 0}
    )
    if not doc or not doc.get("password_encrypted"):
        return None
    return await decrypt_pdf_password(doc["password_encrypted"])


async def save_pdf_password(user_id: str, account_id: str, password: str) -> None:
    """Store encrypted password for reuse on subsequent uploads for this account."""
    encrypted = await encrypt_pdf_password(password)
    await db.pdf_passwords.update_one(
        {"user_id": user_id, "account_id": account_id},
        {"$set": {
            "user_id": user_id,
            "account_id": account_id,
            "password_encrypted": encrypted,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )


def _pdf_has_encrypt_marker(file_path: str) -> bool:
    """Scan the raw PDF for an /Encrypt dictionary reference. Reliable way to
    detect encryption even when pdfplumber opens the file without raising
    (common with restricted-permission PDFs from Indian banks)."""
    try:
        with open(file_path, "rb") as f:
            head = f.read(4096)
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 16384))
            tail = f.read()
        return b"/Encrypt" in head or b"/Encrypt" in tail
    except Exception:
        return False


def extract_pdf_text(file_path: str, password: Optional[str] = None) -> str:
    """Extract text from a PDF. If the PDF is encrypted, a password can be
    supplied. Raises PdfPasswordRequired if the PDF is encrypted and the
    supplied password (or lack thereof) cannot open it — including the case
    where pdfplumber opens the file but returns no text because the PDF's
    permissions block extraction.
    """
    is_encrypted = _pdf_has_encrypt_marker(file_path)
    text_parts: list = []
    open_error: Optional[Exception] = None

    try:
        open_kwargs = {"password": password} if password else {}
        with pdfplumber.open(file_path, **open_kwargs) as pdf:
            for page in pdf.pages[:20]:
                try:
                    tables = page.extract_tables()
                except Exception:
                    tables = None
                if tables:
                    text_parts.extend(
                        " | ".join(str(c or "") for c in row)
                        for table in tables for row in table if row
                    )
                    continue
                try:
                    page_text = page.extract_text()
                except Exception:
                    page_text = None
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        open_error = e
        msg = str(e).lower()
        pw_markers = (
            "password", "encrypt", "decrypt", "owner password",
            "user password", "not allow", "permission", "pdfpasswordincorrect",
        )
        if any(m in msg for m in pw_markers) or is_encrypted:
            raise PdfPasswordRequired(str(e) or "PDF is password protected")
        logger.error(f"PDF extraction failed: {e}")

    joined = "\n".join(text_parts).strip()

    # Encrypted PDFs with restricted permissions often open cleanly but return
    # essentially no text. Treat that as password-required so the user is asked.
    if is_encrypted and len(joined) < 50:
        raise PdfPasswordRequired(
            "This PDF is password protected or has restricted permissions."
        )

    return joined


async def parse_pdf_statement(file_path: str, password: Optional[str] = None, statement_type: str = "bank") -> list:
    """Parse a PDF statement. Propagates PdfPasswordRequired if encrypted and
    the supplied password is missing or incorrect."""
    text = extract_pdf_text(file_path, password=password)
    if not text or len(text.strip()) < 50:
        return []
    return await parse_statement_text_with_ai(text, statement_type)


# Strong income/expense hint keywords — used to override an obviously-wrong
# AI classification using only deterministic markers (Dr/Cr suffix or
# unambiguous narration words). We DO NOT override on words that can apply
# to either side (e.g. "transfer").
_INCOME_NARRATION_MARKERS = (
    "refund", "reversal", "reversed", "cashback", "cash back",
    "interest credited", "interest credit", "int credit", "int.cr",
    "salary", "neft credit", "imps credit", "upi credit", "rtgs credit",
    "credit by", "credit from", "received from", "deposit",
    "dividend", "tax refund", "tds refund",
)
_EXPENSE_NARRATION_MARKERS = (
    "atm wdl", "atm withdrawal", "atm cash", "cash withdrawal",
    "pos purchase", "pos txn", "pos ", "purchase at", "merchant",
    "emi", "loan emi", "auto debit", "ach debit", "ecs debit",
    "neft debit", "imps debit", "upi debit", "rtgs debit",
    "debit by", "debit to", "paid to", "payment to",
    "charges", "service charge", "annual fee", "late fee", "penalty",
    "gst on ", "tds deduction", "min bal charges",
)


def _detect_dr_cr_suffix(description: str, raw_amount_text: str = "") -> str:
    """Return 'income', 'expense', or '' based on a Dr/Cr *suffix* on the
    amount text. Many Indian bank statements render amounts like
    "50,000.00 Cr" or "5,000.00 Dr". We only inspect raw_amount here — we
    intentionally do NOT scan the description, because descriptions
    routinely contain substrings like "CREDIT CARD", "CREDIT LIMIT",
    "DEBIT CARD" which would flip classification incorrectly."""
    if not raw_amount_text:
        return ""
    text = raw_amount_text.strip().lower()
    # Cr / Dr as a trailing token after a number (allow trailing punctuation).
    if re.search(r'\b(cr|cr\.)\s*$', text):
        return "income"
    if re.search(r'\b(dr|dr\.)\s*$', text):
        return "expense"
    return ""


def _classify_from_narration(description: str) -> str:
    """Use narration keywords as a tiebreaker. Returns 'income', 'expense'
    or '' if nothing definitive.

    When both an income and an expense marker appear in the same narration,
    dominant income markers (refund / reversal / cashback) win — these
    words specifically describe an outgoing transaction being undone, so
    their presence flips the sign regardless of the original txn type
    mentioned alongside (e.g. "REVERSAL POS TXN", "REFUND ATM WDL")."""
    desc = (description or "").lower()
    dominant_income = ("refund", "reversal", "reversed", "cashback", "cash back")
    if any(m in desc for m in dominant_income):
        return "income"

    inc = any(m in desc for m in _INCOME_NARRATION_MARKERS)
    exp = any(m in desc for m in _EXPENSE_NARRATION_MARKERS)
    if inc and not exp:
        return "income"
    if exp and not inc:
        return "expense"
    return ""


def _post_process_entries(entries: list, statement_type: str) -> list:
    """Apply deterministic overrides to AI-classified transactions, normalize
    fields, and dedupe (same chunk overlap can yield duplicates)."""
    seen = set()
    cleaned = []
    is_credit_card = (statement_type == "credit_card")

    for e in entries:
        if not e.get("date") or e.get("amount") in (None, "", 0, 0.0):
            continue
        try:
            amount = round(abs(float(e["amount"])), 2)
        except (ValueError, TypeError):
            continue
        if amount <= 0:
            continue

        date = str(e["date"]).strip()[:10]
        description = str(e.get("description", "") or "").strip()
        ai_type = (e.get("transaction_type") or "").lower()
        if ai_type not in ("income", "expense"):
            ai_type = "expense"

        # Deterministic overrides:
        #  1) Dr/Cr suffix wins over AI guess.
        #  2) Unambiguous narration keywords win.
        forced = _detect_dr_cr_suffix(description, str(e.get("raw_amount", "") or ""))
        if not forced:
            forced = _classify_from_narration(description)

        # For credit card statements, the bank's "credit" reduces what you
        # owe (refund/payment-in) — that's a transfer in to the card account
        # from the user's POV. The bank's "debit" / "purchase" increases
        # what you owe — that's an expense. We keep the same income/expense
        # convention but make sure inverted AI guesses get corrected via the
        # narration markers above.
        final_type = forced or ai_type

        balance = None
        if e.get("balance") not in (None, ""):
            try:
                balance = round(float(e["balance"]), 2)
            except (ValueError, TypeError):
                balance = None

        # Dedupe key tolerates slight description variation across chunk overlap.
        dedupe_key = (date, amount, final_type, description.lower()[:40])
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        cleaned.append({
            "date": date,
            "description": description,
            "amount": amount,
            "transaction_type": final_type,
            "balance": balance,
        })

    # Sort by date for predictable display
    cleaned.sort(key=lambda x: x["date"])
    return cleaned


def _chunk_statement_text(text: str, chunk_chars: int = 6000, overlap: int = 600) -> list:
    """Split long statement text into overlapping chunks so we never silently
    drop the tail of the statement. Overlap protects against a transaction
    being split across a chunk boundary."""
    text = text or ""
    if len(text) <= chunk_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_chars, len(text))
        # Try to break on a newline boundary so we don't slice mid-row.
        if end < len(text):
            nl = text.rfind("\n", start + chunk_chars - 800, end)
            if nl > start + 1000:
                end = nl
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


async def _ai_parse_chunk(chunk: str, statement_type: str, chunk_idx: int, chunk_total: int) -> list:
    """Send a single chunk to the AI and return the raw entry list."""
    is_credit_card = (statement_type == "credit_card")

    # Conventions are spelled out explicitly because Indian bank statements
    # use a mix of (a) Dr/Cr suffix on the amount, (b) separate Withdrawal/
    # Deposit columns, and (c) inline narration markers. Credit-card
    # statements invert "credit"/"debit" relative to the cardholder's POV.
    if is_credit_card:
        type_rules = """This is a CREDIT CARD statement.
- "transaction_type": "expense" for purchases, charges, fees, EMIs, cash advances, interest charged.
- "transaction_type": "income" ONLY for payments received from the cardholder, refunds, reversals, cashback credited, statement credits.
- The card statement may show charges as positive and payments as negative, or use "Dr"/"Cr" suffixes — read each row in context.
- Words like "PAYMENT RECEIVED", "PAYMENT - THANK YOU", "REFUND", "REVERSAL", "CASHBACK" mean income.
- Everything else (purchases at merchants, ATM cash, fees, GST, interest) is expense."""
    else:
        type_rules = """This is a BANK statement (savings / current).
- "transaction_type": "income" for credits, deposits, salary, refunds, interest credited, money received via NEFT/IMPS/UPI/RTGS.
- "transaction_type": "expense" for debits, withdrawals, ATM cash, POS purchases, EMI, charges, money sent via NEFT/IMPS/UPI/RTGS.
- Many Indian bank statements suffix the amount with " Cr" (credit = money in = income) or " Dr" (debit = money out = expense). RESPECT THESE SUFFIXES — they are authoritative.
- Many statements have separate Withdrawal/Debit and Deposit/Credit columns. If the row has a value only in the Deposit/Credit column, it's income. If only in Withdrawal/Debit, it's expense.
- Words like "CREDIT BY", "DEPOSIT", "INTEREST CREDITED", "REFUND", "REVERSAL", "SALARY" mean income.
- Words like "DEBIT BY", "ATM WDL", "POS", "EMI", "CHARGES", "GST ON" mean expense."""

    prompt = f"""You are parsing chunk {chunk_idx + 1} of {chunk_total} from a {statement_type} statement.
Extract EVERY transaction line you can identify in this chunk. Do not skip rows. Do not summarize.

{type_rules}

Return STRICT JSON with this exact shape:
{{"transactions": [
  {{"date":"YYYY-MM-DD","description":"...","amount":1234.56,"transaction_type":"income","balance":98765.43,"raw_amount":"1,234.56 Cr"}},
  ...
]}}

Field rules:
- "date": MUST be YYYY-MM-DD. Convert from any source format (DD/MM/YYYY, DD-MMM-YYYY, etc.).
- "amount": positive number, the absolute transaction value.
- "transaction_type": "income" or "expense" — apply the rules above strictly.
- "balance": the running balance after the transaction, or null if not shown.
- "raw_amount": the amount text exactly as it appears in the statement, including any Dr/Cr suffix, parentheses, or sign. This is REQUIRED so we can verify your classification.

If the chunk has no transaction lines, return {{"transactions": []}}.

STATEMENT CHUNK:
{chunk}
"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You parse bank and credit card statements into structured JSON. You never skip transactions. You always respect Dr/Cr suffixes. Output JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            max_tokens=16000,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Best-effort recovery for a truncated payload.
            data = _parse_ai_json_response(raw) if raw.strip() else {}
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            txns = data.get("transactions") or data.get("entries") or []
            return txns if isinstance(txns, list) else []
        return []
    except Exception as e:
        logger.error(f"AI chunk parse failed (chunk {chunk_idx + 1}/{chunk_total}): {e}")
        return []


async def parse_statement_text_with_ai(text: str, statement_type: str) -> list:
    """Parse statement text using the AI in overlapping chunks so nothing is
    truncated, then deterministically post-process the merged entries to
    correct income/expense flips and dedupe overlap-induced duplicates."""
    if not openai_client:
        logger.error("OpenAI not configured for statement parsing")
        return []

    chunks = _chunk_statement_text(text)
    logger.info(f"AI parsing statement: {len(text)} chars in {len(chunks)} chunk(s) ({statement_type})")

    all_entries: list = []
    for idx, chunk in enumerate(chunks):
        entries = await _ai_parse_chunk(chunk, statement_type, idx, len(chunks))
        all_entries.extend(entries)

    cleaned = _post_process_entries(all_entries, statement_type)
    logger.info(f"AI parsing produced {len(cleaned)} cleaned entries (from {len(all_entries)} raw)")
    return cleaned


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

        # Check if sync has failed with 0 emails despite having a sync date
        needs_reconnect = False
        if sync_config and sync_config.get("sync_from_date") and stats.get("total_synced", 0) == 0 and not sync_config.get("syncing"):
            # Likely a token issue — check last sync error
            last_error = sync_config.get("last_error")
            if last_error:
                needs_reconnect = True

        accounts.append({
            "gmail_email": t["gmail_email"],
            "connected": True,
            "connected_at": t.get("connected_at", "").isoformat() if isinstance(t.get("connected_at"), datetime) else str(t.get("connected_at", "")),
            "sync_from_date": sync_config.get("sync_from_date") if sync_config else None,
            "syncing": sync_config.get("syncing", False) if sync_config else False,
            "stats": stats,
            "needs_reconnect": needs_reconnect,
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

        needs_reconnect = False
        if sync_config and sync_config.get("sync_from_date") and stats.get("total_synced", 0) == 0 and not sync_config.get("syncing"):
            last_error = sync_config.get("last_error")
            if last_error:
                needs_reconnect = True

        accounts.append({
            "outlook_email": t["outlook_email"],
            "connected": True,
            "connected_at": t.get("connected_at", "").isoformat() if isinstance(t.get("connected_at"), datetime) else str(t.get("connected_at", "")),
            "sync_from_date": sync_config.get("sync_from_date") if sync_config else None,
            "syncing": sync_config.get("syncing", False) if sync_config else False,
            "stats": stats,
            "needs_reconnect": needs_reconnect,
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
    currently_processing = await db.synced_emails.count_documents({**query, "ai_status": "processing"})
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
        "ai_pending": pending + currently_processing,
        "ai_failed": failed,
        "transactions_created": transactions_created,
        "pending_review": pending_review,
        "is_processing": currently_processing > 0,
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
                    await db.outlook_sync_config.update_one(
                        {"user_id": user_id, "outlook_email": outlook_email},
                        {"$set": {"last_error": f"HTTP {resp.status_code}: {resp.text[:200]}"}}
                    )
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
            {"$set": {"syncing": False, "last_sync_at": datetime.now(timezone.utc), "last_sync_count": total_fetched, "last_error": None}}
        )

        await process_outlook_pending_emails(user_id, outlook_email)

    except Exception as e:
        logger.error(f"Outlook email sync failed for {user_id}/{outlook_email}: {e}")
        await db.outlook_sync_config.update_one(
            {"user_id": user_id, "outlook_email": outlook_email},
            {"$set": {"syncing": False, "last_error": str(e)}}
        )


async def _create_transaction_from_ai_result(
    user_id: str, email_doc: dict, result: dict, accounts: list, source_provider: str
) -> bool:
    """Create a pending_review transaction from AI analysis. Returns True if created (not duplicate)."""
    original_amount = result.get("amount", 0)
    original_currency = (result.get("currency") or "INR").upper()
    base_currency = await get_user_base_currency(user_id)
    converted_amount = original_amount
    exchange_rate = 1.0
    is_estimated_rate = False

    # Convert foreign currency to base currency
    if original_currency != base_currency and original_amount:
        txn_date = result.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        rate_info = await get_exchange_rate(original_currency, base_currency, txn_date)
        if rate_info["rate"]:
            exchange_rate = rate_info["rate"]
            converted_amount = round(original_amount * exchange_rate, 2)
            is_estimated_rate = rate_info["is_estimated"]
            logger.info(f"Currency conversion: {original_amount} {original_currency} -> {converted_amount} {base_currency} (rate: {exchange_rate}, estimated: {is_estimated_rate})")
        else:
            # Can't convert — store original amount as-is (this shouldn't happen with fallback rates)
            converted_amount = original_amount
            is_estimated_rate = True
            logger.warning(f"Currency conversion FAILED for {original_currency} -> {base_currency}, storing original amount: {original_amount}")

    duplicate = await check_cross_source_duplicate(
        user_id,
        amount=converted_amount,
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

    # Determine account_id - either use matched account or auto-create from detected bank
    account_id = result.get("account_id")
    detected_bank_name = result.get("detected_bank_name")
    detected_bank_type = result.get("detected_bank_type")
    
    # Also try to detect bank from email sender if AI didn't provide detected_bank_name
    if not detected_bank_name:
        from_email = (email_doc.get("from_email") or "").lower()
        subject = (email_doc.get("subject") or "").lower()
        body_preview = (email_doc.get("body_text") or "")[:500].lower()
        combined_text = f"{from_email} {subject} {body_preview}"
        
        # Common Indian bank email patterns
        bank_patterns = {
            "hdfc": "HDFC Bank",
            "icici": "ICICI Bank", 
            "sbi": "SBI",
            "axis": "Axis Bank",
            "kotak": "Kotak Bank",
            "idfc": "IDFC First Bank",
            "yes": "Yes Bank",
            "indusind": "IndusInd Bank",
            "pnb": "PNB",
            "bob": "Bank of Baroda",
            "canara": "Canara Bank",
            "union": "Union Bank",
            "indian": "Indian Bank",
            "boi": "Bank of India",
            "federal": "Federal Bank",
            "rbl": "RBL Bank",
            "paytm": "Paytm Wallet",
            "phonepe": "PhonePe",
            "gpay": "Google Pay",
            "amazonpay": "Amazon Pay",
            "citi": "Citibank",
            "amex": "American Express",
            "scb": "Standard Chartered",
            "hsbc": "HSBC",
        }
        
        for keyword, bank_name in bank_patterns.items():
            if keyword in combined_text:
                detected_bank_name = bank_name
                detected_bank_type = "wallet" if keyword in ["paytm", "phonepe", "gpay", "amazonpay"] else "savings"
                logger.info(f"Detected bank from email sender/content: {bank_name}")
                break
    
    # Try to match existing account by bank name keywords
    if detected_bank_name:
        # Extract key bank identifier (e.g., "HDFC" from "HDFC Bank Savings XX1234")
        bank_keywords = [w for w in detected_bank_name.upper().split() if len(w) >= 3]
        
        # Get all user accounts for matching
        existing_accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0, "account_id": 1, "name": 1}).to_list(100)
        
        for acc in existing_accounts:
            acc_name_upper = (acc.get("name") or "").upper()
            # Check if any keyword from detected bank name is in existing account name
            for keyword in bank_keywords:
                if keyword in acc_name_upper:
                    account_id = acc["account_id"]
                    logger.info(f"Matched existing account '{acc['name']}' with detected bank '{detected_bank_name}'")
                    break
            if account_id:
                break
    
    # If no match found, create new account with detected bank name
    if not account_id and detected_bank_name:
        # Auto-create the bank account
        bank_sub_type = "savings"  # default
        if detected_bank_type == "current":
            bank_sub_type = "current"
        elif detected_bank_type == "credit_card":
            bank_sub_type = "credit_card"
        elif detected_bank_type == "wallet":
            bank_sub_type = "wallet"
        
        new_account = {
            "account_id": f"acc_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "name": detected_bank_name[:100],  # Limit name length
            "account_type": "asset" if bank_sub_type in ["savings", "current", "wallet"] else "liability",
            "sub_type": bank_sub_type,
            "opening_balance": 0,  # Will be set during approval
            "balance_as_of_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "needs_opening_balance": True,  # Flag to prompt user during approval
            "ai_created": True,
            "created_at": datetime.now(timezone.utc),
        }
        await db.accounts.insert_one(new_account)
        del new_account["_id"]
        account_id = new_account["account_id"]
        logger.info(f"Auto-created bank account: {detected_bank_name} -> {account_id}")
    
    # If still no account_id, use "Unknown Bank" account
    if not account_id:
        unknown_account = await db.accounts.find_one({
            "user_id": user_id,
            "name": "Unknown Bank"
        }, {"_id": 0, "account_id": 1})
        
        if unknown_account:
            account_id = unknown_account["account_id"]
        else:
            # Create "Unknown Bank" account
            unknown_acc = {
                "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "name": "Unknown Bank",
                "account_type": "asset",
                "sub_type": "bank",
                "opening_balance": 0,
                "balance_as_of_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "needs_opening_balance": True,
                "ai_created": True,
                "created_at": datetime.now(timezone.utc),
            }
            await db.accounts.insert_one(unknown_acc)
            del unknown_acc["_id"]
            account_id = unknown_acc["account_id"]
            logger.info(f"Created 'Unknown Bank' fallback account: {account_id}")

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "transaction_type": result.get("transaction_type", "expense"),
        "amount": converted_amount,
        "original_amount": original_amount if original_currency != base_currency else None,
        "original_currency": original_currency if original_currency != base_currency else None,
        "exchange_rate": exchange_rate if original_currency != base_currency else None,
        "is_estimated_rate": is_estimated_rate if original_currency != base_currency else None,
        "date": result.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "account_id": account_id,
        "to_account_id": result.get("to_account_id"),
        "category_id": result.get("category_id"),
        "subcategory_id": result.get("subcategory_id"),
        "description": result.get("description", ""),
        "payment_method": result.get("payment_method"),
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

    lock_key = f"{user_id}:outlook:{outlook_email or 'all'}"
    existing_lock = await db.processing_locks.find_one({"lock_key": lock_key, "active": True})
    if existing_lock:
        logger.info(f"Already processing Outlook emails for {lock_key}, skipping")
        return

    await db.processing_locks.update_one(
        {"lock_key": lock_key},
        {"$set": {"lock_key": lock_key, "active": True, "started_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    try:
        pending_emails = await db.synced_emails.find(query, {"_id": 0}).limit(200).to_list(200)

        if not openai_client:
            logger.error("OpenAI client not configured")
            return

        if not pending_emails:
            return

        email_ids = [e["email_id"] for e in pending_emails]
        await db.synced_emails.update_many(
            {"email_id": {"$in": email_ids}, "ai_status": {"$in": ["pending", "failed"]}},
            {"$set": {"ai_status": "processing"}}
        )

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
    finally:
        await db.processing_locks.update_one(
            {"lock_key": lock_key},
            {"$set": {"active": False, "finished_at": datetime.now(timezone.utc)}}
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

    # Check if already processing
    lock_key = f"{user['user_id']}:{gmail_email or 'all'}"
    existing_lock = await db.processing_locks.find_one({"lock_key": lock_key, "active": True})
    if existing_lock:
        return {"message": "Already processing emails", "count": 0, "already_processing": True}

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
    currently_processing = await db.synced_emails.count_documents({**query, "ai_status": "processing"})
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
        "ai_pending": pending + currently_processing,
        "ai_failed": failed,
        "transactions_created": transactions_created,
        "pending_review": pending_review,
        "is_processing": currently_processing > 0,
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
            {"$set": {"syncing": False, "last_sync_at": datetime.now(timezone.utc), "last_sync_count": total_fetched, "last_error": None}}
        )

        await process_pending_emails(user_id, gmail_email)

    except Exception as e:
        logger.error(f"Email sync failed for {user_id}/{gmail_email}: {e}")
        await db.email_sync_config.update_one(
            {"user_id": user_id, "gmail_email": gmail_email},
            {"$set": {"syncing": False, "last_error": str(e)}}
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

    # Check if already processing (simple lock via DB)
    lock_key = f"{user_id}:{gmail_email or 'all'}"
    existing_lock = await db.processing_locks.find_one({"lock_key": lock_key, "active": True})
    if existing_lock:
        logger.info(f"Already processing emails for {lock_key}, skipping")
        return

    await db.processing_locks.update_one(
        {"lock_key": lock_key},
        {"$set": {"lock_key": lock_key, "active": True, "started_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    try:
        pending_emails = await db.synced_emails.find(query, {"_id": 0}).limit(200).to_list(200)

        if not openai_client:
            logger.error("OpenAI client not configured — cannot process emails")
            return

        if not pending_emails:
            logger.info(f"No pending emails to process for {user_id}/{gmail_email}")
            return

        logger.info(f"Processing {len(pending_emails)} pending emails for {user_id}/{gmail_email}")

        # Mark all as "processing" to prevent other tasks from picking them up
        email_ids = [e["email_id"] for e in pending_emails]
        await db.synced_emails.update_many(
            {"email_id": {"$in": email_ids}, "ai_status": {"$in": ["pending", "failed"]}},
            {"$set": {"ai_status": "processing"}}
        )

        accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
        account_names = [f"{a['name']} ({a['account_type']}/{a.get('sub_type', '')}): {a['account_id']}" for a in accounts]
        category_info = await _get_category_info_for_ai(user_id)

        for i, email_doc in enumerate(pending_emails):
            try:
                logger.info(f"Processing email {i+1}/{len(pending_emails)}: {email_doc.get('subject', '')[:50]}")
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

        logger.info(f"Finished processing emails for {user_id}/{gmail_email}")

    finally:
        await db.processing_locks.update_one(
            {"lock_key": lock_key},
            {"$set": {"active": False, "finished_at": datetime.now(timezone.utc)}}
        )


# ─── Smart Cross-Source Duplicate Detection ──────────────────────────

# ─── Exchange Rate Cache & Conversion ────────────────────────────────

_exchange_rate_cache = {}

async def get_exchange_rate(from_currency: str, to_currency: str, date_str: str) -> dict:
    """Fetch exchange rate from frankfurter.app. Returns {rate, is_estimated}."""
    if from_currency.upper() == to_currency.upper():
        return {"rate": 1.0, "is_estimated": False}

    cache_key = f"{from_currency}:{to_currency}:{date_str}"
    if cache_key in _exchange_rate_cache:
        return _exchange_rate_cache[cache_key]

    # Fallback rates for common currency pairs (updated periodically)
    # These are approximate rates as of 2024, used when API is unavailable
    fallback_rates_to_inr = {
        "USD": 83.5,
        "EUR": 91.0,
        "GBP": 106.0,
        "AUD": 55.0,
        "CAD": 62.0,
        "SGD": 62.0,
        "AED": 22.7,
        "SAR": 22.3,
        "JPY": 0.55,
        "CHF": 94.0,
        "CNY": 11.5,
        "HKD": 10.7,
        "NZD": 51.0,
        "THB": 2.3,
        "MYR": 17.7,
        "KRW": 0.062,
    }
    
    # Try exact date first
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(
                f"https://api.frankfurter.app/{date_str}",
                params={"from": from_currency.upper(), "to": to_currency.upper()},
            )
            if resp.status_code == 200:
                data = resp.json()
                rate = data.get("rates", {}).get(to_currency.upper())
                if rate:
                    result = {"rate": float(rate), "is_estimated": False}
                    _exchange_rate_cache[cache_key] = result
                    return result
    except Exception as e:
        logger.warning(f"Exchange rate fetch failed for {date_str}: {e}")

    # Fallback: latest rate (estimated)
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(
                "https://api.frankfurter.app/latest",
                params={"from": from_currency.upper(), "to": to_currency.upper()},
            )
            if resp.status_code == 200:
                data = resp.json()
                rate = data.get("rates", {}).get(to_currency.upper())
                if rate:
                    result = {"rate": float(rate), "is_estimated": True}
                    _exchange_rate_cache[cache_key] = result
                    return result
    except Exception as e:
        logger.warning(f"Latest exchange rate fetch failed: {e}")

    # Final fallback: use hardcoded approximate rates
    from_upper = from_currency.upper()
    to_upper = to_currency.upper()
    
    if to_upper == "INR" and from_upper in fallback_rates_to_inr:
        rate = fallback_rates_to_inr[from_upper]
        result = {"rate": rate, "is_estimated": True}
        _exchange_rate_cache[cache_key] = result
        logger.info(f"Using fallback exchange rate: 1 {from_upper} = {rate} INR")
        return result
    elif from_upper == "INR" and to_upper in fallback_rates_to_inr:
        # Reverse calculation
        rate = 1.0 / fallback_rates_to_inr[to_upper]
        result = {"rate": rate, "is_estimated": True}
        _exchange_rate_cache[cache_key] = result
        logger.info(f"Using fallback exchange rate: 1 INR = {rate} {to_upper}")
        return result

    return {"rate": None, "is_estimated": True}


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
    return f"""Analyze this email and determine if it contains an ACTUAL COMPLETED cash transaction.

EMAIL:
Subject: {email_doc.get('subject', '')}
From: {email_doc.get('from_email', '')}
Date: {email_doc.get('date', '')}
Body: {email_doc.get('body_text', '')[:3000]}

AVAILABLE ACCOUNTS:
{chr(10).join(account_names) if account_names else "No accounts configured"}

AVAILABLE CATEGORIES:
{chr(10).join(category_info) if category_info else "No categories configured"}

CRITICAL RULES — READ CAREFULLY:
1. ONLY mark as a transaction if there is a CONFIRMED cash inflow or outflow from a bank account, wallet, or UPI.
2. Set is_transaction to FALSE for ALL of the following:
   - Credit card BILLS/STATEMENTS (these summarize past transactions already recorded individually)
   - Credit card DUE REMINDERS or payment due notices (not a payment until actually paid)
   - Stock/mutual fund/trading notifications, alerts, or order confirmations (money moves within demat/trading accounts, not trackable via email)
   - Algo trading webhooks or signals (e.g., Kite, Zerodha, Groww, Upstox alerts)
   - Portfolio updates, NAV changes, dividend ANNOUNCEMENTS (not actual credits)
   - OTP/authentication emails
   - Newsletters, promotions, marketing emails
   - Account STATEMENTS or summaries (individual transactions are tracked separately)
   - Delivery/shipping notifications without payment info
   - Login alerts, security notifications
   - Balance check notifications (informational, not a transaction)
3. DO mark as a transaction:
   - UPI payment confirmations (money sent/received)
   - Bank account debit/credit alerts
   - Actual credit card PAYMENT confirmations (paying the bill, not the bill itself)
   - Salary/income credits to bank
   - Subscription charges debited from bank/card
   - Recharges, bill payments completed
   - EMI debits
   - Insurance premium debits
   - Refunds credited to bank
   - Actual dividend CREDITS to bank account
4. For transaction_type: "income" for money received, "expense" for money spent, "transfer" for money moved between your own accounts.
5. For account_id: Try to match from AVAILABLE ACCOUNTS. If you can detect a SPECIFIC bank account name from the email (e.g., "HDFC Bank A/c XX1234", "ICICI Savings", "SBI Account ending 5678"), include it in detected_bank_name even if not in AVAILABLE ACCOUNTS - we will auto-create it.
6. For payment_method: Detect how the payment was made. Common methods: "upi", "credit_card", "debit_card", "net_banking", "cash", "wallet", "cheque", "neft", "rtgs", "imps", "other".
7. Extract date in YYYY-MM-DD format. If not clear, use the email date.
8. CURRENCY: Detect the currency of the transaction from the email. Look for currency symbols ($, USD, EUR, GBP, etc.) or currency codes. If the email is from an Indian bank or UPI, use "INR". If unclear, default to "INR".

Respond ONLY with valid JSON (no markdown, no explanation):
{{
  "is_transaction": true/false,
  "transaction_type": "income" | "expense" | "transfer" | null,
  "amount": number or null,
  "currency": "INR" | "USD" | "EUR" | "GBP" | other ISO 4217 code | null,
  "date": "YYYY-MM-DD" or null,
  "description": "brief description" or null,
  "account_id": "matching account_id from AVAILABLE ACCOUNTS" or null,
  "detected_bank_name": "Name of bank account detected from email (e.g., 'HDFC Savings XX1234', 'ICICI Bank 5678')" or null,
  "detected_bank_type": "savings" | "current" | "credit_card" | "wallet" | null,
  "to_account_id": "for transfers" or null,
  "category_id": "matching category_id" or null,
  "subcategory_id": "matching subcategory_id" or null,
  "payment_method": "upi" | "credit_card" | "debit_card" | "net_banking" | "cash" | "wallet" | "cheque" | "neft" | "rtgs" | "imps" | "other" | null,
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
- For account_id: Try to match from AVAILABLE ACCOUNTS. If you detect a SPECIFIC bank name/account number not in the list (e.g., "HDFC XX1234", "ICICI 5678"), include it in detected_bank_name.
- For payment_method: Detect the payment method from the SMS. Common: "upi", "credit_card", "debit_card", "net_banking", "cash", "wallet", "cheque", "neft", "rtgs", "imps", "other".
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
  "account_id": "matching account_id from AVAILABLE ACCOUNTS" or null,
  "detected_bank_name": "Name of bank account detected (e.g., 'HDFC Savings XX1234')" or null,
  "detected_bank_type": "savings" | "current" | "credit_card" | "wallet" | null,
  "to_account_id": "for transfers" or null,
  "category_id": "matching category_id" or null,
  "subcategory_id": "matching subcategory_id" or null,
  "payment_method": "upi" | "credit_card" | "debit_card" | "net_banking" | "cash" | "wallet" | "cheque" | "neft" | "rtgs" | "imps" | "other" | null,
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

    # Determine account_id - either use matched account or auto-create from detected bank
    account_id = result.get("account_id")
    detected_bank_name = result.get("detected_bank_name")
    detected_bank_type = result.get("detected_bank_type")
    
    # Also try to detect bank from SMS sender if AI didn't provide detected_bank_name
    if not detected_bank_name:
        sender = (sms_doc.get("sender") or "").upper()
        body = (sms_doc.get("body") or "").lower()
        combined_text = f"{sender.lower()} {body}"
        
        # Common Indian bank SMS sender patterns
        bank_patterns = {
            "hdfc": "HDFC Bank",
            "icici": "ICICI Bank", 
            "sbi": "SBI",
            "axis": "Axis Bank",
            "kotak": "Kotak Bank",
            "idfc": "IDFC First Bank",
            "yes": "Yes Bank",
            "indusind": "IndusInd Bank",
            "pnb": "PNB",
            "bob": "Bank of Baroda",
            "canara": "Canara Bank",
            "union": "Union Bank",
            "federal": "Federal Bank",
            "rbl": "RBL Bank",
            "paytm": "Paytm Wallet",
            "phonepe": "PhonePe",
            "gpay": "Google Pay",
        }
        
        for keyword, bank_name in bank_patterns.items():
            if keyword in combined_text:
                detected_bank_name = bank_name
                detected_bank_type = "wallet" if keyword in ["paytm", "phonepe", "gpay"] else "savings"
                logger.info(f"Detected bank from SMS sender/content: {bank_name}")
                break
    
    # Try to match existing account by bank name keywords
    if detected_bank_name:
        bank_keywords = [w for w in detected_bank_name.upper().split() if len(w) >= 3]
        existing_accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0, "account_id": 1, "name": 1}).to_list(100)
        
        for acc in existing_accounts:
            acc_name_upper = (acc.get("name") or "").upper()
            for keyword in bank_keywords:
                if keyword in acc_name_upper:
                    account_id = acc["account_id"]
                    logger.info(f"Matched existing account '{acc['name']}' with detected bank '{detected_bank_name}'")
                    break
            if account_id:
                break
    
    # If no match found, create new account with detected bank name
    if not account_id and detected_bank_name:
        bank_sub_type = "savings"
        if detected_bank_type == "current":
            bank_sub_type = "current"
        elif detected_bank_type == "credit_card":
            bank_sub_type = "credit_card"
        elif detected_bank_type == "wallet":
            bank_sub_type = "wallet"
        
        new_account = {
            "account_id": f"acc_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "name": detected_bank_name[:100],
            "account_type": "asset" if bank_sub_type in ["savings", "current", "wallet"] else "liability",
            "sub_type": bank_sub_type,
            "opening_balance": 0,
            "balance_as_of_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "needs_opening_balance": True,
            "ai_created": True,
            "created_at": datetime.now(timezone.utc),
        }
        await db.accounts.insert_one(new_account)
        del new_account["_id"]
        account_id = new_account["account_id"]
        logger.info(f"Auto-created bank account from SMS: {detected_bank_name} -> {account_id}")
    
    # If still no account_id, use "Unknown Bank" account
    if not account_id:
        unknown_account = await db.accounts.find_one({
            "user_id": user_id,
            "name": "Unknown Bank"
        }, {"_id": 0, "account_id": 1})
        
        if unknown_account:
            account_id = unknown_account["account_id"]
        else:
            # Create "Unknown Bank" account
            unknown_acc = {
                "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "name": "Unknown Bank",
                "account_type": "asset",
                "sub_type": "bank",
                "opening_balance": 0,
                "balance_as_of_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "needs_opening_balance": True,
                "ai_created": True,
                "created_at": datetime.now(timezone.utc),
            }
            await db.accounts.insert_one(unknown_acc)
            del unknown_acc["_id"]
            account_id = unknown_acc["account_id"]
            logger.info(f"Created 'Unknown Bank' fallback account for SMS: {account_id}")

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "transaction_type": result.get("transaction_type", "expense"),
        "amount": result.get("amount", 0),
        "date": result.get("date") or txn_date,
        "account_id": account_id,
        "to_account_id": result.get("to_account_id"),
        "category_id": result.get("category_id"),
        "subcategory_id": result.get("subcategory_id"),
        "description": result.get("description", ""),
        "payee": result.get("payee", ""),
        "payment_method": result.get("payment_method"),
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
    # First run: process any pending emails immediately after startup (10s delay for DB readiness)
    await asyncio.sleep(10)
    await _run_pending_processing()

    while True:
        try:
            await asyncio.sleep(120)  # Check every 2 minutes
            await _run_pending_processing()
        except Exception as e:
            logger.error(f"Auto-retry loop error: {e}")


async def _run_pending_processing():
    """Fetch new emails from all connected accounts in parallel and process pending emails/SMS."""
    try:
        tasks = []

        # Gmail: gather all sync tasks
        configs = await db.email_sync_config.find({"syncing": False}, {"_id": 0}).to_list(100)
        for config in configs:
            user_id = config["user_id"]
            gmail_email = config["gmail_email"]
            sync_date = config.get("sync_from_date", "")
            if not sync_date:
                continue
            token_doc = await db.gmail_tokens.find_one(
                {"user_id": user_id, "gmail_email": gmail_email, "connected": True}, {"_id": 0}
            )
            if not token_doc:
                continue
            tasks.append(_safe_sync_gmail(user_id, gmail_email, sync_date))

        # Outlook: gather all sync tasks
        outlook_configs = await db.outlook_sync_config.find({"syncing": False}, {"_id": 0}).to_list(100)
        for config in outlook_configs:
            user_id = config["user_id"]
            outlook_email = config["outlook_email"]
            sync_date = config.get("sync_from_date", "")
            if not sync_date:
                continue
            token_doc = await db.outlook_tokens.find_one(
                {"user_id": user_id, "outlook_email": outlook_email, "connected": True}, {"_id": 0}
            )
            if not token_doc:
                continue
            tasks.append(_safe_sync_outlook(user_id, outlook_email, sync_date))

        # SMS: gather pending
        sms_pending = await db.synced_sms.find(
            {"ai_status": {"$in": ["pending", "failed"]}},
            {"_id": 0, "user_id": 1}
        ).to_list(100)
        sms_users = set(doc["user_id"] for doc in sms_pending)
        for uid in sms_users:
            tasks.append(_safe_process_sms(uid))

        # Run ALL tasks in parallel
        if tasks:
            logger.info(f"Auto-sync: Running {len(tasks)} sync/processing tasks in parallel")
            await asyncio.gather(*tasks)

    except Exception as e:
        logger.error(f"Auto-sync/processing error: {e}")


async def _safe_sync_gmail(user_id: str, gmail_email: str, sync_date: str):
    try:
        logger.info(f"Auto-sync: Fetching new emails for {user_id}/{gmail_email}")
        await sync_emails_background(user_id, gmail_email, sync_date)
    except Exception as e:
        logger.error(f"Auto-sync Gmail failed for {user_id}/{gmail_email}: {e}")


async def _safe_sync_outlook(user_id: str, outlook_email: str, sync_date: str):
    try:
        logger.info(f"Auto-sync: Fetching new Outlook emails for {user_id}/{outlook_email}")
        await sync_outlook_emails_background(user_id, outlook_email, sync_date)
    except Exception as e:
        logger.error(f"Auto-sync Outlook failed for {user_id}/{outlook_email}: {e}")


async def _safe_process_sms(user_id: str):
    try:
        logger.info(f"Auto-retry: Processing pending SMS for {user_id}")
        await process_pending_sms(user_id)
    except Exception as e:
        logger.error(f"Auto-retry SMS failed for {user_id}: {e}")


@app.on_event("startup")
async def startup_event():
    # Clean up stale state from previous deploys
    # Reset stuck "processing" emails back to "pending"
    reset_result = await db.synced_emails.update_many(
        {"ai_status": "processing"},
        {"$set": {"ai_status": "pending"}}
    )
    if reset_result.modified_count > 0:
        logger.info(f"Startup: Reset {reset_result.modified_count} stuck 'processing' emails back to 'pending'")

    # Clear all processing locks (stale from previous deploy)
    await db.processing_locks.update_many(
        {"active": True},
        {"$set": {"active": False, "finished_at": datetime.now(timezone.utc)}}
    )

    # Reset stuck syncing flags (interrupted by deploy)
    await db.email_sync_config.update_many({"syncing": True}, {"$set": {"syncing": False}})
    await db.outlook_sync_config.update_many({"syncing": True}, {"$set": {"syncing": False}})

    asyncio.create_task(auto_retry_loop())
    await db.synced_emails.create_index([("user_id", 1), ("gmail_email", 1), ("message_id", 1)], unique=True, sparse=True)
    await db.gmail_tokens.create_index([("user_id", 1), ("gmail_email", 1)], unique=True)
    await db.email_sync_config.create_index([("user_id", 1), ("gmail_email", 1)], unique=True)
    await db.synced_emails.create_index([("user_id", 1), ("outlook_email", 1), ("message_id", 1)], unique=True, sparse=True)
    await db.outlook_tokens.create_index([("user_id", 1), ("outlook_email", 1)], unique=True)
    await db.outlook_sync_config.create_index([("user_id", 1), ("outlook_email", 1)], unique=True)
    await db.synced_sms.create_index([("user_id", 1), ("sender", 1), ("timestamp", 1), ("body_hash", 1)], sparse=True)
    await db.synced_sms.create_index([("user_id", 1), ("ai_status", 1)])


# ─── Email Archive & Records ─────────────────────────────────────────

async def archive_email_for_transaction(user_id: str, transaction: dict):
    """Fetch full email with attachments and archive it when a transaction is approved."""
    source_email_id = transaction.get("source_email_id")
    if not source_email_id:
        return

    # Check if already archived
    existing_archive = await db.email_archives.find_one({"source_email_id": source_email_id})
    if existing_archive:
        return

    email_doc = await db.synced_emails.find_one({"email_id": source_email_id}, {"_id": 0})
    if not email_doc:
        return

    source_provider = transaction.get("source_provider", "gmail")
    attachments = []
    raw_eml = None

    try:
        if source_provider == "gmail":
            gmail_email = email_doc.get("gmail_email", "")
            creds = await get_gmail_credentials(user_id, gmail_email)
            if creds:
                service = build("gmail", "v1", credentials=creds)
                msg_id = email_doc.get("message_id")

                # Get raw email for .eml download
                try:
                    raw_msg = service.users().messages().get(userId="me", id=msg_id, format="raw").execute()
                    raw_eml = raw_msg.get("raw", "")
                except Exception as e:
                    logger.error(f"Failed to fetch raw email {msg_id}: {e}")

                # Get full message with attachment metadata
                full_msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
                attachments = await _extract_gmail_attachments(service, msg_id, full_msg.get("payload", {}))

        elif source_provider == "outlook":
            outlook_email = email_doc.get("outlook_email", "")
            access_token = await get_outlook_access_token(user_id, outlook_email)
            if access_token:
                msg_id = email_doc.get("message_id")

                # Get MIME content for .eml
                async with httpx.AsyncClient() as http_client:
                    mime_resp = await http_client.get(
                        f"{MS_GRAPH_BASE}/me/messages/{msg_id}/$value",
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if mime_resp.status_code == 200:
                        raw_eml = base64.urlsafe_b64encode(mime_resp.content).decode()

                # Get attachments
                async with httpx.AsyncClient() as http_client:
                    att_resp = await http_client.get(
                        f"{MS_GRAPH_BASE}/me/messages/{msg_id}/attachments",
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if att_resp.status_code == 200:
                        for att in att_resp.json().get("value", []):
                            if att.get("@odata.type") == "#microsoft.graph.fileAttachment":
                                attachments.append({
                                    "filename": att.get("name", "attachment"),
                                    "mime_type": att.get("contentType", "application/octet-stream"),
                                    "size": att.get("size", 0),
                                    "data": att.get("contentBytes", ""),
                                })

    except Exception as e:
        logger.error(f"Failed to fetch email attachments for archival: {e}")

    # Parse the email date to a standard format for filtering
    email_date = email_doc.get("date", "")
    parsed_date = ""
    try:
        parsed_dt = parsedate_to_datetime(email_date)
        parsed_date = parsed_dt.strftime("%Y-%m-%d")
    except Exception:
        parsed_date = transaction.get("date", "")

    archive_doc = {
        "archive_id": f"arc_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "source_email_id": source_email_id,
        "transaction_id": transaction.get("transaction_id"),
        "subject": email_doc.get("subject", ""),
        "from_email": email_doc.get("from_email", ""),
        "date": parsed_date,
        "email_date_raw": email_date,
        "snippet": email_doc.get("snippet", ""),
        "body_text": email_doc.get("body_text", ""),
        "source_provider": source_provider,
        "transaction_amount": transaction.get("amount", 0),
        "transaction_type": transaction.get("transaction_type", ""),
        "transaction_description": transaction.get("description", ""),
        "raw_eml": raw_eml,
        "attachments": attachments,
        "attachment_count": len(attachments),
        "archived_at": datetime.now(timezone.utc),
    }

    await db.email_archives.insert_one(archive_doc)
    logger.info(f"Archived email {source_email_id} with {len(attachments)} attachments for txn {transaction.get('transaction_id')}")


async def _extract_gmail_attachments(service, msg_id: str, payload: dict) -> list:
    """Extract attachments from a Gmail message payload."""
    attachments = []

    def _walk_parts(parts):
        for part in parts:
            filename = part.get("filename", "")
            body = part.get("body", {})
            attachment_id = body.get("attachmentId")

            if filename and attachment_id:
                try:
                    att_data = service.users().messages().attachments().get(
                        userId="me", messageId=msg_id, id=attachment_id
                    ).execute()
                    attachments.append({
                        "filename": filename,
                        "mime_type": part.get("mimeType", "application/octet-stream"),
                        "size": body.get("size", 0),
                        "data": att_data.get("data", ""),
                    })
                except Exception as e:
                    logger.error(f"Failed to fetch attachment {filename}: {e}")

            if "parts" in part:
                _walk_parts(part["parts"])

    if "parts" in payload:
        _walk_parts(payload["parts"])

    return attachments


# ─── Records API Routes ──────────────────────────────────────────────

@app.get("/api/records")
async def get_records(
    user: dict = Depends(get_current_user),
    search: str = "",
    date_from: str = "",
    date_to: str = "",
    amount_min: str = "",
    amount_max: str = "",
    sort_by: str = "date",
    sort_order: str = "desc",
    limit: int = 50,
    skip: int = 0,
):
    query = {"user_id": user["user_id"]}

    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"subject": search_regex},
            {"from_email": search_regex},
            {"transaction_description": search_regex},
            {"snippet": search_regex},
        ]

    if date_from:
        query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to

    if amount_min:
        try:
            query.setdefault("transaction_amount", {})["$gte"] = float(amount_min)
        except ValueError:
            pass
    if amount_max:
        try:
            query.setdefault("transaction_amount", {})["$lte"] = float(amount_max)
        except ValueError:
            pass

    sort_dir = -1 if sort_order == "desc" else 1

    records = await db.email_archives.find(
        query, {"_id": 0, "raw_eml": 0, "attachments.data": 0}
    ).sort(sort_by, sort_dir).skip(skip).limit(limit).to_list(limit)

    total = await db.email_archives.count_documents(query)

    # Convert datetime fields for JSON
    for r in records:
        if isinstance(r.get("archived_at"), datetime):
            r["archived_at"] = r["archived_at"].isoformat()

    return {"records": records, "total": total}


@app.get("/api/records/{archive_id}/download-eml")
async def download_eml(archive_id: str, user: dict = Depends(get_current_user)):
    record = await db.email_archives.find_one(
        {"archive_id": archive_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if not record.get("raw_eml"):
        raise HTTPException(status_code=404, detail="Email content not available")

    eml_bytes = base64.urlsafe_b64decode(record["raw_eml"])
    subject_clean = re.sub(r'[^\w\s-]', '', record.get("subject", "email"))[:50].strip()
    filename = f"{subject_clean}.eml"

    return Response(
        content=eml_bytes,
        media_type="message/rfc822",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/records/{archive_id}/attachments/{att_index}/download")
async def download_attachment(archive_id: str, att_index: int, user: dict = Depends(get_current_user)):
    record = await db.email_archives.find_one(
        {"archive_id": archive_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    attachments = record.get("attachments", [])
    if att_index < 0 or att_index >= len(attachments):
        raise HTTPException(status_code=404, detail="Attachment not found")

    att = attachments[att_index]
    att_bytes = base64.urlsafe_b64decode(att["data"])

    return Response(
        content=att_bytes,
        media_type=att.get("mime_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{att["filename"]}"'},
    )


@app.get("/api/records/{archive_id}/preview")
async def preview_record(archive_id: str, user: dict = Depends(get_current_user)):
    record = await db.email_archives.find_one(
        {"archive_id": archive_id, "user_id": user["user_id"]},
        {"_id": 0, "raw_eml": 0, "attachments.data": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if isinstance(record.get("archived_at"), datetime):
        record["archived_at"] = record["archived_at"].isoformat()
    return record


@app.post("/api/records/download-zip")
async def download_records_zip(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    archive_ids = body.get("archive_ids", [])

    if not archive_ids:
        raise HTTPException(status_code=400, detail="No records selected")

    records = await db.email_archives.find(
        {"archive_id": {"$in": archive_ids}, "user_id": user["user_id"]}, {"_id": 0}
    ).to_list(100)

    if not records:
        raise HTTPException(status_code=404, detail="No records found")

    import zipfile
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for record in records:
            subject_clean = re.sub(r'[^\w\s-]', '', record.get("subject", "email"))[:40].strip()
            date_str = record.get("date", "unknown")
            folder = f"{date_str}_{subject_clean}"

            # Add .eml file
            if record.get("raw_eml"):
                try:
                    eml_bytes = base64.urlsafe_b64decode(record["raw_eml"])
                    zf.writestr(f"{folder}/{subject_clean}.eml", eml_bytes)
                except Exception:
                    pass

            # Add attachments
            for i, att in enumerate(record.get("attachments", [])):
                if att.get("data"):
                    try:
                        att_bytes = base64.urlsafe_b64decode(att["data"])
                        zf.writestr(f"{folder}/attachments/{att['filename']}", att_bytes)
                    except Exception:
                        pass

    zip_buffer.seek(0)

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="spentyai_records.zip"'},
    )


# ─── Tax Summary ─────────────────────────────────────────────────────

@app.post("/api/tax-summary")
async def create_tax_summary(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    name = body.get("name", "").strip()
    date_from = body.get("date_from", "")
    date_to = body.get("date_to", "")
    email_address = body.get("email_address", "")
    provider = body.get("provider", "gmail")

    if not name or not date_from or not date_to or not email_address:
        raise HTTPException(status_code=400, detail="name, date_from, date_to, and email_address are required")

    summary_id = f"ts_{uuid.uuid4().hex[:12]}"
    summary = {
        "summary_id": summary_id,
        "user_id": user["user_id"],
        "name": name,
        "date_from": date_from,
        "date_to": date_to,
        "email_address": email_address,
        "provider": provider,
        "status": "processing",
        "total_emails_scanned": 0,
        "total_income": 0,
        "total_expenses": 0,
        "transaction_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    await db.tax_summaries.insert_one(summary)
    del summary["_id"]

    asyncio.create_task(process_tax_summary(user["user_id"], summary_id, email_address, provider, date_from, date_to))

    return summary


@app.get("/api/tax-summary")
async def list_tax_summaries(user: dict = Depends(get_current_user)):
    summaries = await db.tax_summaries.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for s in summaries:
        if isinstance(s.get("created_at"), datetime):
            s["created_at"] = s["created_at"].isoformat()
    return {"summaries": summaries}


@app.get("/api/tax-summary/{summary_id}")
async def get_tax_summary(summary_id: str, user: dict = Depends(get_current_user)):
    summary = await db.tax_summaries.find_one(
        {"summary_id": summary_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    if isinstance(summary.get("created_at"), datetime):
        summary["created_at"] = summary["created_at"].isoformat()

    txns = await db.tax_summary_transactions.find(
        {"summary_id": summary_id, "user_id": user["user_id"]}, {"_id": 0}
    ).sort("date", 1).to_list(5000)

    return {"summary": summary, "transactions": txns}


@app.delete("/api/tax-summary/{summary_id}")
async def delete_tax_summary(summary_id: str, user: dict = Depends(get_current_user)):
    result = await db.tax_summaries.delete_one(
        {"summary_id": summary_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Summary not found")
    await db.tax_summary_transactions.delete_many({"summary_id": summary_id})
    return {"message": "Summary deleted"}


@app.post("/api/tax-summary/{summary_id}/transactions")
async def add_tax_summary_transaction(summary_id: str, request: Request, user: dict = Depends(get_current_user)):
    summary = await db.tax_summaries.find_one(
        {"summary_id": summary_id, "user_id": user["user_id"]}
    )
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    body = await request.json()
    txn = {
        "txn_id": f"tstxn_{uuid.uuid4().hex[:12]}",
        "summary_id": summary_id,
        "user_id": user["user_id"],
        "transaction_type": body.get("transaction_type", "expense"),
        "amount": float(body.get("amount", 0)),
        "date": body.get("date", ""),
        "description": body.get("description", ""),
        "category": body.get("category", ""),
        "from_email": body.get("from_email", "Manual"),
        "source": "manual",
    }
    await db.tax_summary_transactions.insert_one(txn)
    del txn["_id"]
    await _recalculate_tax_summary(summary_id)
    return txn


@app.put("/api/tax-summary/{summary_id}/transactions/{txn_id}")
async def update_tax_summary_transaction(summary_id: str, txn_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    update_fields = {}
    for field in ["transaction_type", "amount", "date", "description", "category"]:
        if field in body:
            update_fields[field] = body[field]
    if "amount" in update_fields:
        update_fields["amount"] = float(update_fields["amount"])

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.tax_summary_transactions.update_one(
        {"txn_id": txn_id, "summary_id": summary_id, "user_id": user["user_id"]},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await _recalculate_tax_summary(summary_id)
    updated = await db.tax_summary_transactions.find_one({"txn_id": txn_id}, {"_id": 0})
    return updated


@app.delete("/api/tax-summary/{summary_id}/transactions/{txn_id}")
async def delete_tax_summary_transaction(summary_id: str, txn_id: str, user: dict = Depends(get_current_user)):
    result = await db.tax_summary_transactions.delete_one(
        {"txn_id": txn_id, "summary_id": summary_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await _recalculate_tax_summary(summary_id)
    return {"message": "Transaction deleted"}


@app.get("/api/tax-summary/{summary_id}/export")
async def export_tax_summary(summary_id: str, user: dict = Depends(get_current_user)):
    summary = await db.tax_summaries.find_one(
        {"summary_id": summary_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    txns = await db.tax_summary_transactions.find(
        {"summary_id": summary_id}, {"_id": 0}
    ).sort("date", 1).to_list(5000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Description", "Category", "Amount (INR)", "Source Email"])
    for t in txns:
        writer.writerow([
            t.get("date", ""), t.get("transaction_type", ""),
            t.get("description", ""), t.get("category", ""),
            t.get("amount", 0), t.get("from_email", ""),
        ])
    writer.writerow([])
    writer.writerow(["Summary", summary.get("name", "")])
    writer.writerow(["Period", f"{summary.get('date_from', '')} to {summary.get('date_to', '')}"])
    writer.writerow(["Total Income", summary.get("total_income", 0)])
    writer.writerow(["Total Expenses", summary.get("total_expenses", 0)])
    writer.writerow(["Net", summary.get("total_income", 0) - summary.get("total_expenses", 0)])

    csv_bytes = output.getvalue().encode("utf-8-sig")
    filename = re.sub(r'[^\w\s-]', '', summary.get("name", "tax_summary"))[:40].strip()

    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )


@app.get("/api/tax-summary/available-emails")
async def get_available_emails_for_tax(user: dict = Depends(get_current_user)):
    """Get all connected Gmail and Outlook emails available for tax summary scanning."""
    gmail_tokens = await db.gmail_tokens.find(
        {"user_id": user["user_id"], "connected": True}, {"_id": 0, "gmail_email": 1}
    ).to_list(10)
    outlook_tokens = await db.outlook_tokens.find(
        {"user_id": user["user_id"], "connected": True}, {"_id": 0, "outlook_email": 1}
    ).to_list(10)

    emails = []
    for t in gmail_tokens:
        emails.append({"email": t["gmail_email"], "provider": "gmail"})
    for t in outlook_tokens:
        emails.append({"email": t["outlook_email"], "provider": "outlook"})
    return {"emails": emails}


async def _recalculate_tax_summary(summary_id: str):
    """Recalculate totals for a tax summary."""
    txns = await db.tax_summary_transactions.find(
        {"summary_id": summary_id}, {"_id": 0, "transaction_type": 1, "amount": 1}
    ).to_list(5000)

    total_income = sum(t["amount"] for t in txns if t.get("transaction_type") == "income")
    total_expenses = sum(t["amount"] for t in txns if t.get("transaction_type") == "expense")

    await db.tax_summaries.update_one(
        {"summary_id": summary_id},
        {"$set": {
            "total_income": total_income,
            "total_expenses": total_expenses,
            "transaction_count": len(txns),
        }}
    )


async def process_tax_summary(user_id: str, summary_id: str, email_address: str, provider: str, date_from: str, date_to: str):
    """Background task: scan emails for a date range and create isolated tax transactions."""
    try:
        emails_scanned = 0
        email_docs = []

        if provider == "gmail":
            creds = await get_gmail_credentials(user_id, email_address)
            if not creds:
                await db.tax_summaries.update_one(
                    {"summary_id": summary_id},
                    {"$set": {"status": "error", "error_message": "Gmail credentials not found. Please reconnect Gmail from Email & SMS tab."}}
                )
                return

            service = build("gmail", "v1", credentials=creds)
            query = f"after:{date_from} before:{date_to}"
            page_token = None

            while True:
                result = service.users().messages().list(
                    userId="me", q=query, maxResults=100, pageToken=page_token
                ).execute()
                messages = result.get("messages", [])
                if not messages:
                    break

                for msg_ref in messages:
                    try:
                        msg = service.users().messages().get(
                            userId="me", id=msg_ref["id"], format="full"
                        ).execute()
                        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
                        body_text = extract_email_body(msg.get("payload", {}))

                        email_docs.append({
                            "subject": headers.get("subject", ""),
                            "from_email": headers.get("from", ""),
                            "date": headers.get("date", ""),
                            "body_text": body_text[:5000] if body_text else msg.get("snippet", ""),
                        })
                        emails_scanned += 1
                    except Exception as e:
                        logger.error(f"Tax summary: failed to fetch Gmail message: {e}")

                page_token = result.get("nextPageToken")
                if not page_token:
                    break

        elif provider == "outlook":
            access_token = await get_outlook_access_token(user_id, email_address)
            if not access_token:
                await db.tax_summaries.update_one(
                    {"summary_id": summary_id},
                    {"$set": {"status": "error", "error_message": "Outlook credentials not found. Please reconnect Outlook from Email & SMS tab."}}
                )
                return

            filter_str = f"receivedDateTime ge {date_from}T00:00:00Z and receivedDateTime le {date_to}T23:59:59Z"
            url = f"{MS_GRAPH_BASE}/me/messages?$filter={filter_str}&$top=100&$select=subject,from,receivedDateTime,bodyPreview,body"

            async with httpx.AsyncClient() as http_client:
                while url:
                    resp = await http_client.get(url, headers={"Authorization": f"Bearer {access_token}"})
                    if resp.status_code != 200:
                        break
                    data = resp.json()
                    for msg in data.get("value", []):
                        body_content = msg.get("body", {}).get("content", "")
                        body_text = re.sub(r'<[^>]+>', ' ', body_content)
                        body_text = re.sub(r'\s+', ' ', body_text).strip()
                        from_info = msg.get("from", {}).get("emailAddress", {})
                        email_docs.append({
                            "subject": msg.get("subject", ""),
                            "from_email": from_info.get("address", ""),
                            "date": msg.get("receivedDateTime", ""),
                            "body_text": body_text[:5000] if body_text else msg.get("bodyPreview", ""),
                        })
                        emails_scanned += 1
                    url = data.get("@odata.nextLink")

        await db.tax_summaries.update_one(
            {"summary_id": summary_id},
            {"$set": {"total_emails_scanned": emails_scanned, "status": "analyzing"}}
        )

        if not openai_client or not email_docs:
            await db.tax_summaries.update_one(
                {"summary_id": summary_id},
                {"$set": {"status": "complete" if not email_docs else "error",
                          "error_message": "OpenAI not configured" if not email_docs and openai_client else None}}
            )
            await _recalculate_tax_summary(summary_id)
            return

        # Process emails through AI
        accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
        account_names = [f"{a['name']} ({a['account_type']}/{a.get('sub_type', '')})" for a in accounts]
        category_info = await _get_category_info_for_ai(user_id)

        for i, email_doc in enumerate(email_docs):
            try:
                result = await analyze_email_with_ai(email_doc, account_names, category_info)
                if result and result.get("is_transaction"):
                    parsed_date = result.get("date", "")
                    if not parsed_date:
                        try:
                            parsed_dt = parsedate_to_datetime(email_doc.get("date", ""))
                            parsed_date = parsed_dt.strftime("%Y-%m-%d")
                        except Exception:
                            parsed_date = date_from

                    txn = {
                        "txn_id": f"tstxn_{uuid.uuid4().hex[:12]}",
                        "summary_id": summary_id,
                        "user_id": user_id,
                        "transaction_type": result.get("transaction_type", "expense"),
                        "amount": float(result.get("amount", 0)),
                        "date": parsed_date,
                        "description": result.get("description", ""),
                        "category": result.get("category_id", ""),
                        "from_email": email_doc.get("from_email", ""),
                        "source": "email",
                        "confidence": result.get("confidence", "medium"),
                    }
                    await db.tax_summary_transactions.insert_one(txn)

                # Update progress every 10 emails
                if (i + 1) % 10 == 0:
                    await _recalculate_tax_summary(summary_id)
                    await db.tax_summaries.update_one(
                        {"summary_id": summary_id},
                        {"$set": {"emails_analyzed": i + 1}}
                    )

            except Exception as e:
                logger.error(f"Tax summary AI analysis failed: {e}")

        await _recalculate_tax_summary(summary_id)
        await db.tax_summaries.update_one(
            {"summary_id": summary_id},
            {"$set": {"status": "complete", "completed_at": datetime.now(timezone.utc), "emails_analyzed": len(email_docs)}}
        )
        logger.info(f"Tax summary {summary_id} complete: scanned {emails_scanned} emails")

    except Exception as e:
        logger.error(f"Tax summary processing failed: {e}")
        await db.tax_summaries.update_one(
            {"summary_id": summary_id},
            {"$set": {"status": "error", "error_message": str(e)}}
        )


# ─── User Settings ───────────────────────────────────────────────────

@app.get("/api/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not settings:
        settings = {"user_id": user["user_id"], "base_currency": "INR", "date_format": "DD/MM/YYYY"}
        await db.user_settings.insert_one(settings)
        del settings["_id"]
    return settings


@app.put("/api/settings")
async def update_settings(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    update_fields = {}
    if "base_currency" in body:
        update_fields["base_currency"] = body["base_currency"].upper()
    if "date_format" in body:
        update_fields["date_format"] = body["date_format"]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.user_settings.update_one(
        {"user_id": user["user_id"]},
        {"$set": update_fields},
        upsert=True,
    )
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return settings


async def get_user_base_currency(user_id: str) -> str:
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0, "base_currency": 1})
    return (settings or {}).get("base_currency", "INR")


# ─── Support Tickets ────────────────────────────────────────────────────

SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", SENDER_EMAIL)  # Falls back to SENDER_EMAIL if not set

@app.post("/api/support/ticket")
async def create_support_ticket(request: Request, user: dict = Depends(get_current_user)):
    """Submit a support ticket that gets sent via email"""
    data = await request.json()
    subject = data.get("subject", "").strip()
    category = data.get("category", "general")
    priority = data.get("priority", "medium")
    message = data.get("message", "").strip()
    
    if not subject:
        raise HTTPException(status_code=400, detail="Subject is required")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    # Build ticket document
    ticket = {
        "user_id": user.get("user_id"),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "subject": subject,
        "category": category,
        "priority": priority,
        "message": message,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # Save to database
    result = await db.support_tickets.insert_one(ticket)
    ticket_id = str(result.inserted_id)
    
    # Priority labels
    priority_labels = {"low": "LOW", "medium": "MEDIUM", "high": "HIGH - URGENT"}
    priority_colors = {"low": "#6c757d", "medium": "#ffc107", "high": "#dc3545"}
    category_labels = {
        "bug": "Bug Report",
        "feature": "Feature Request", 
        "billing": "Billing Issue",
        "account": "Account Help",
        "data": "Data & Sync",
        "general": "General Inquiry"
    }
    
    # Send email notification
    if RESEND_API_KEY and SUPPORT_EMAIL:
        try:
            email_html = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1a1a2e; color: white; padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">SpentyAI Support Ticket</h1>
                </div>
                
                <div style="padding: 24px; background: #f8f9fa;">
                    <div style="background: white; border-radius: 8px; padding: 24px; border: 1px solid #e9ecef;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e9ecef; padding-bottom: 16px;">
                            <span style="background: {priority_colors.get(priority, '#6c757d')}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                {priority_labels.get(priority, 'MEDIUM')}
                            </span>
                            <span style="color: #6c757d; font-size: 13px;">
                                {category_labels.get(category, 'General Inquiry')}
                            </span>
                        </div>
                        
                        <h2 style="margin: 0 0 16px 0; color: #212529; font-size: 18px;">{subject}</h2>
                        
                        <div style="background: #f8f9fa; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
                            <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #495057;">{message}</p>
                        </div>
                        
                        <div style="border-top: 1px solid #e9ecef; padding-top: 16px; color: #6c757d; font-size: 13px;">
                            <p style="margin: 0 0 8px 0;"><strong>From:</strong> {user.get('name', 'Unknown')} ({user.get('email', 'No email')})</p>
                            <p style="margin: 0 0 8px 0;"><strong>Ticket ID:</strong> {ticket_id}</p>
                            <p style="margin: 0;"><strong>Reply to:</strong> {user.get('email', 'No email')}</p>
                        </div>
                    </div>
                </div>
                
                <div style="padding: 16px; text-align: center; color: #6c757d; font-size: 12px;">
                    <p style="margin: 0;">This ticket was submitted via SpentyAI Support</p>
                </div>
            </div>
            """
            
            params = {
                "from": f"SpentyAI Support <{SENDER_EMAIL}>",
                "to": [SUPPORT_EMAIL],
                "reply_to": user.get("email"),
                "subject": f"[{priority.upper()}] {category_labels.get(category, 'Support')}: {subject}",
                "html": email_html,
            }
            await asyncio.to_thread(resend.Emails.send, params)
            ticket["email_sent"] = True
        except Exception as e:
            print(f"Failed to send support ticket email: {e}")
            ticket["email_sent"] = False
            ticket["email_error"] = str(e)
    else:
        ticket["email_sent"] = False
        ticket["email_error"] = "Email not configured"
    
    # Update ticket with email status
    await db.support_tickets.update_one(
        {"_id": result.inserted_id},
        {"$set": {"email_sent": ticket.get("email_sent", False), "email_error": ticket.get("email_error")}}
    )
    
    return {"success": True, "ticket_id": ticket_id, "email_sent": ticket.get("email_sent", False)}


# ─── Health Check ────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SpentyAI API"}
