from fastapi import FastAPI, HTTPException, Request, Response, Depends, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta, date as date_cls
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
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
from fpdf import FPDF
from cryptography.fernet import Fernet, InvalidToken
from urllib.parse import urlencode, quote
from email.utils import parsedate_to_datetime

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from openai import OpenAI, AsyncOpenAI
import resend
import razorpay
import hmac

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
GOOGLE_IOS_CLIENT_ID = os.environ.get("GOOGLE_IOS_CLIENT_ID") or GOOGLE_CLIENT_ID  # fallback to web client ID
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
# Async client used specifically for statement parsing so the event loop
# is not blocked while we wait on OpenAI (a long statement can take minutes).
async_openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

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

client = AsyncIOMotorClient(MONGO_URL, tz_aware=True)
db = client[DB_NAME]

# Durable storage for uploaded statement files. Host disk is ephemeral
# on the preview infra, so we keep a canonical copy in Mongo (GridFS)
# and lazily rehydrate the local copy when a parse/unlock/retry needs
# it. Bucket name `statement_files` → collections `statement_files.files`
# and `statement_files.chunks` get auto-created.
statement_fs = AsyncIOMotorGridFSBucket(db, bucket_name="statement_files")
receipt_fs = AsyncIOMotorGridFSBucket(db, bucket_name="receipt_files")

RECEIPT_UPLOAD_DIR = "/app/uploads/receipts"
os.makedirs(RECEIPT_UPLOAD_DIR, exist_ok=True)


# ─── Pydantic Models ───────────────────────────────────────────────

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    email_verified: bool = False
    subscription_plan: Optional[str] = None
    subscription_status: Optional[str] = None
    subscription_expiry: Optional[str] = None

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
    loan_sanctioned_amount: Optional[float] = None  # original sanctioned loan amount
    # Demat/Trading-specific fields (optional)
    broker_name: Optional[str] = None  # e.g., "Zerodha", "Groww"

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
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
    loan_sanctioned_amount: Optional[float] = None
    broker_name: Optional[str] = None

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
    recurring_frequency: Optional[str] = None  # daily, weekly, monthly, quarterly, yearly
    recurrence_date: Optional[int] = None  # day of month (1-31) or day of week (1-7) for recurrence
    source: str = "manual"  # manual, email, sms
    status: str = "approved"  # approved, pending_review, rejected
    receipt_id: Optional[str] = None

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
    recurrence_date: Optional[int] = None
    receipt_id: Optional[str] = None
    status: Optional[str] = None  # B10: Allow status changes including revert to pending_review

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

    # Build redirect response — send to /billing if no active subscription, else /dashboard
    user_doc = existing_user or await db.users.find_one({"user_id": user_id}, {"_id": 0})
    has_subscription = user_doc and user_doc.get("subscription_status") == "active"
    redirect_target = "dashboard" if has_subscription else "billing"
    redirect_resp = RedirectResponse(f"{frontend_url}/{redirect_target}", status_code=302)
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
    # Include subscription info
    user_out["subscription_plan"] = user.get("subscription_plan")
    user_out["subscription_status"] = user.get("subscription_status")
    user_out["subscription_expiry"] = user.get("subscription_expiry")
    return user_out


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"message": "Logged out"}



@app.post("/api/auth/google/mobile")
async def google_mobile_login(request: Request, response: Response):
    """Handle Google Sign-In from mobile app using ID token."""
    body = await request.json()
    id_token = body.get("id_token") or body.get("credential")
    if not id_token:
        raise HTTPException(status_code=400, detail="id_token is required")

    # Verify the ID token with Google
    try:
        async with httpx.AsyncClient() as http_client:
            token_info_resp = await http_client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
            )
        if token_info_resp.status_code != 200:
            logger.error(f"[MobileLogin] Google tokeninfo returned {token_info_resp.status_code}: {token_info_resp.text[:200]}")
            raise HTTPException(status_code=401, detail=f"Invalid ID token (Google returned {token_info_resp.status_code})")

        token_info = token_info_resp.json()
        email = token_info.get("email", "")
        name = token_info.get("name", "")
        picture = token_info.get("picture", "")

        if not email:
            raise HTTPException(status_code=400, detail="No email in token")

        # Log the audience for diagnostics. We skip strict audience validation
        # here because Google's tokeninfo endpoint already confirms the token
        # is genuine, and the iOS app may use a different OAuth client ID than
        # the web app.  The PKCE flow on iOS already prevents token theft.
        token_aud = token_info.get("aud")
        logger.info(f"[MobileLogin] Verified token for {email}, aud={token_aud}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google mobile token verification error: {e}")
        raise HTTPException(status_code=401, detail="Failed to verify token")

    # Create or update user
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name or existing_user.get("name", ""), "picture": picture, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "email_verified": True,  # Google-verified
            "created_at": datetime.now(timezone.utc),
        })
        await seed_default_data(user_id)

    # Create session
    session_token = secrets.token_urlsafe(48)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc),
    })

    user_doc = existing_user or await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "session_token": session_token,
        "user": {
            "user_id": user_id,
            "email": email,
            "name": name or (user_doc or {}).get("name", ""),
            "picture": picture,
            "subscription_plan": (user_doc or {}).get("subscription_plan"),
            "subscription_status": (user_doc or {}).get("subscription_status"),
        },
    }


@app.post("/api/auth/dev/simulator-login")
async def simulator_login(request: Request):
    """DEV ONLY: Create a session for an existing user by email, bypassing Google OAuth.
    Used by the iOS simulator when Google Sign-In is unavailable."""
    body = await request.json()
    email = body.get("email")
    dev_secret = body.get("dev_secret")

    # Guard: require a shared secret so this endpoint cannot be abused
    expected_secret = os.environ.get("DEV_SIMULATOR_SECRET", "spenty-sim-bypass-2026")
    if dev_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid dev secret")

    if not email:
        raise HTTPException(status_code=400, detail="email is required")

    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = existing_user["user_id"]

    # Create session (same logic as normal login)
    session_token = secrets.token_urlsafe(48)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc),
    })

    return {
        "session_token": session_token,
        "user": {
            "user_id": user_id,
            "email": existing_user.get("email", ""),
            "name": existing_user.get("name", ""),
            "picture": existing_user.get("picture", ""),
            "subscription_plan": existing_user.get("subscription_plan"),
            "subscription_status": existing_user.get("subscription_status"),
        },
    }


@app.delete("/api/auth/delete-account")
async def delete_account(request: Request, user: dict = Depends(get_current_user)):
    """Permanently delete user account and all associated data."""
    user_id = user["user_id"]

    # Delete all user data from every collection
    await db.transactions.delete_many({"user_id": user_id})
    await db.accounts.delete_many({"user_id": user_id})
    await db.categories.delete_many({"user_id": user_id})
    await db.invoices.delete_many({"user_id": user_id})
    await db.bills.delete_many({"user_id": user_id})
    await db.customers.delete_many({"user_id": user_id})
    await db.vendors.delete_many({"user_id": user_id})
    await db.mandates.delete_many({"user_id": user_id})
    await db.statements.delete_many({"user_id": user_id})
    await db.synced_sms.delete_many({"user_id": user_id})
    await db.receipts.delete_many({"user_id": user_id})
    await db.email_archives.delete_many({"user_id": user_id})
    await db.feature_requests.delete_many({"user_id": user_id})
    await db.tax_summaries.delete_many({"user_id": user_id})
    await db.tax_summary_transactions.delete_many({"user_id": user_id})
    await db.payment_orders.delete_many({"user_id": user_id})
    await db.user_settings.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.ai_chat_history.delete_many({"user_id": user_id})
    await db.gmail_tokens.delete_many({"user_id": user_id})
    await db.outlook_tokens.delete_many({"user_id": user_id})
    await db.users.delete_one({"user_id": user_id})

    return {"message": "Account and all data permanently deleted"}


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
    return {"accounts": accounts}


@app.get("/api/accounts/{account_id}")
async def get_account(account_id: str, user: dict = Depends(get_current_user)):
    """Get a single account by ID."""
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"account": account}


@app.post("/api/accounts", status_code=201)
async def create_account(data: AccountCreate, user: dict = Depends(get_current_user)):
    # B6: Validate account_type
    valid_account_types = {"asset", "liability", "equity", "investment"}
    if data.account_type not in valid_account_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid account_type '{data.account_type}'. Must be one of: {', '.join(sorted(valid_account_types))}"
        )
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
    if data.loan_sanctioned_amount is not None:
        account["loan_sanctioned_amount"] = data.loan_sanctioned_amount

    if data.broker_name:
        account["broker_name"] = data.broker_name

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
            "emi_amount": round(emi, 2),
            "principal": principal,
            "principal_component": principal,
            "interest": interest,
            "interest_component": interest,
            "outstanding": balance,
            "outstanding_balance": balance,
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



@app.get("/api/accounts/{account_id}/balance")
async def get_account_balance(account_id: str, user: dict = Depends(get_current_user)):
    """Get the current balance and recent activity for an account."""
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return {
        "account_id": account_id,
        "name": account.get("name"),
        "balance": account.get("balance", 0),
        "opening_balance": account.get("opening_balance", 0),
        "currency": account.get("currency", "INR"),
        "account_type": account.get("account_type"),
        "sub_type": account.get("sub_type"),
    }


# --- Endpoint 6.5: GET /api/accounts/{account_id}/transactions ---

@app.get("/api/accounts/{account_id}/transactions")
async def get_account_transactions(
    account_id: str,
    user: dict = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0,
    from_date: str = None,
    to_date: str = None,
    transaction_type: Optional[str] = None,
    category_id: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
):
    """Get transactions for a specific account with optional filters."""
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    query = {
        "user_id": user["user_id"],
        "$or": [{"account_id": account_id}, {"to_account_id": account_id}],
    }
    if from_date:
        query.setdefault("date", {})["$gte"] = from_date
    if to_date:
        query.setdefault("date", {})["$lte"] = to_date
    if transaction_type:
        query["transaction_type"] = transaction_type
    if category_id:
        query["category_id"] = category_id
    if min_amount is not None:
        query.setdefault("amount", {})["$gte"] = min_amount
    if max_amount is not None:
        query.setdefault("amount", {})["$lte"] = max_amount
    if search:
        query["description"] = {"$regex": search, "$options": "i"}
    if status:
        query["status"] = status

    txns = await db.transactions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    txns = await enrich_transactions_with_names(user["user_id"], txns)

    return {"transactions": txns, "total": total, "account_name": account.get("name")}


# =====================================================================


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
        {"name": "Overdraft", "sub_type_id": "default_overdraft", "icon": "bank"},
    ],
    "equity": [
        {"name": "Capital", "sub_type_id": "default_capital", "icon": "capital"},
        {"name": "Retained Earnings", "sub_type_id": "default_retained", "icon": "savings"},
    ],
    "investment": [
        {"name": "Demat", "sub_type_id": "default_demat", "icon": "chart_line"},
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
    
    # Combine with defaults — build both grouped dict and flat list
    result = {}
    flat_list = []
    for acc_type in ["asset", "liability", "equity", "investment"]:
        if account_type and acc_type != account_type:
            continue
        # Start with defaults
        type_list = [
            {**st, "is_default": True, "account_type": acc_type}
            for st in DEFAULT_SUB_TYPES.get(acc_type, [])
        ]
        # Add custom sub types
        for custom in custom_types:
            if custom.get("account_type") == acc_type:
                type_list.append({**custom, "is_default": False})
        result[acc_type] = type_list
        flat_list.extend(type_list)

    # Return both flat list (for iOS) and grouped dict (for backward compat)
    return {"sub_types": flat_list, "grouped": result}


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
    return {"sub_type": sub_type}


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
    return {"sub_type": sub_type}


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


@app.post("/api/categories", status_code=201)
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



@app.get("/api/categories/defaults")
async def get_default_categories(user: dict = Depends(get_current_user)):
    """Get the default category template (useful for resetting or reference)."""
    income_categories = [
        {"name": "Salary", "subcategories": ["Full-time", "Part-time", "Freelance"]},
        {"name": "Business Income", "subcategories": ["Sales", "Services", "Consulting"]},
        {"name": "Investment Income", "subcategories": ["Dividends", "Interest", "Capital Gains"]},
        {"name": "Rental Income", "subcategories": []},
        {"name": "Other Income", "subcategories": []},
    ]
    expense_categories = [
        {"name": "Food & Dining", "subcategories": ["Groceries", "Restaurants", "Coffee & Tea"]},
        {"name": "Transportation", "subcategories": ["Fuel", "Public Transit", "Cab/Taxi", "Maintenance"]},
        {"name": "Housing", "subcategories": ["Rent", "Mortgage", "Utilities", "Repairs"]},
        {"name": "Shopping", "subcategories": ["Clothing", "Electronics", "Home & Garden"]},
        {"name": "Healthcare", "subcategories": ["Doctor", "Pharmacy", "Insurance"]},
        {"name": "Entertainment", "subcategories": ["Movies", "Subscriptions", "Sports"]},
        {"name": "Education", "subcategories": ["Tuition", "Books", "Courses"]},
        {"name": "Bills & Utilities", "subcategories": ["Electricity", "Water", "Internet", "Phone"]},
        {"name": "Personal Care", "subcategories": ["Grooming", "Fitness"]},
        {"name": "Other Expenses", "subcategories": []},
    ]
    return {"income": income_categories, "expense": expense_categories}


@app.post("/api/categories/merge")
async def merge_categories(request: Request, user: dict = Depends(get_current_user)):
    """Merge one category into another (reassign all transactions)."""
    body = await request.json()
    source_id = body.get("source_category_id")
    target_id = body.get("target_category_id")
    if not source_id or not target_id:
        raise HTTPException(status_code=400, detail="source_category_id and target_category_id are required")
    if source_id == target_id:
        raise HTTPException(status_code=400, detail="Cannot merge a category into itself")

    # Verify both categories exist and belong to user
    source = await db.categories.find_one(
        {"category_id": source_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    target = await db.categories.find_one(
        {"category_id": target_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source category not found")
    if not target:
        raise HTTPException(status_code=404, detail="Target category not found")

    # Reassign transactions from source to target
    result = await db.transactions.update_many(
        {"category_id": source_id, "user_id": user["user_id"]},
        {"$set": {"category_id": target_id}}
    )

    # Also reassign subcategory references
    await db.transactions.update_many(
        {"subcategory_id": source_id, "user_id": user["user_id"]},
        {"$set": {"subcategory_id": target_id}}
    )

    # Move subcategories of source under target
    await db.categories.update_many(
        {"parent_id": source_id, "user_id": user["user_id"]},
        {"$set": {"parent_id": target_id}}
    )

    # Delete the source category
    await db.categories.delete_one({"category_id": source_id, "user_id": user["user_id"]})

    return {
        "message": f"Merged '{source['name']}' into '{target['name']}'",
        "transactions_reassigned": result.modified_count,
    }


def snake_to_camel(s: str) -> str:
    """Convert snake_case string to camelCase."""
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def camelise(obj):
    """Recursively convert all dict keys from snake_case to camelCase."""
    if isinstance(obj, list):
        return [camelise(item) for item in obj]
    if isinstance(obj, dict):
        return {snake_to_camel(k): camelise(v) for k, v in obj.items()}
    return obj


async def enrich_transactions_with_names(user_id: str, transactions: list) -> list:
    """Resolve category_id, subcategory_id, account_id, to_account_id into human-readable names."""
    if not transactions:
        return transactions

    # Collect all unique IDs
    category_ids = set()
    subcategory_ids = set()
    account_ids = set()
    for txn in transactions:
        if txn.get("category_id"):
            category_ids.add(txn["category_id"])
        if txn.get("subcategory_id"):
            subcategory_ids.add(txn["subcategory_id"])
        if txn.get("account_id"):
            account_ids.add(txn["account_id"])
        if txn.get("to_account_id"):
            account_ids.add(txn["to_account_id"])

    # Batch-fetch categories (parent + subcategories are all in the same collection)
    # Subcategories are separate documents with parent_id set, using category_id as their ID
    all_cat_ids = category_ids | subcategory_ids
    cat_map = {}
    if all_cat_ids:
        cats = await db.categories.find(
            {"category_id": {"$in": list(all_cat_ids)}, "user_id": user_id},
            {"_id": 0, "category_id": 1, "name": 1},
        ).to_list(None)
        for cat in cats:
            cat_map[cat["category_id"]] = cat["name"]

    acc_map = {}
    if account_ids:
        accs = await db.accounts.find(
            {"account_id": {"$in": list(account_ids)}, "user_id": user_id},
            {"_id": 0, "account_id": 1, "name": 1},
        ).to_list(None)
        for acc in accs:
            acc_map[acc["account_id"]] = acc["name"]

    # Enrich each transaction
    for txn in transactions:
        txn["category_name"] = cat_map.get(txn.get("category_id"))
        txn["subcategory_name"] = cat_map.get(txn.get("subcategory_id"))
        txn["account_name"] = acc_map.get(txn.get("account_id"))
        txn["to_account_name"] = acc_map.get(txn.get("to_account_id"))

    return transactions


# ─── Transactions Routes ────────────────────────────────────────────

@app.get("/api/transactions")
async def list_transactions(
    user: dict = Depends(get_current_user),
    transaction_type: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    account_id: Optional[str] = None,
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    # B5: Validate limit and skip are non-negative
    if limit < 0 or skip < 0:
        raise HTTPException(status_code=400, detail="limit and skip must be non-negative")

    query = {"user_id": user["user_id"]}
    if transaction_type:
        query["transaction_type"] = transaction_type
    if status:
        query["status"] = status
    if account_id:
        query["$or"] = [{"account_id": account_id}, {"to_account_id": account_id}]
    if category_id:
        query["category_id"] = category_id
    if subcategory_id:
        query["subcategory_id"] = subcategory_id
    # B9: If date_from > date_to, swap them
    if from_date and to_date and from_date > to_date:
        from_date, to_date = to_date, from_date
    if from_date:
        query.setdefault("date", {})["$gte"] = from_date
    if to_date:
        query.setdefault("date", {})["$lte"] = to_date
    if min_amount is not None:
        query.setdefault("amount", {})["$gte"] = min_amount
    if max_amount is not None:
        query.setdefault("amount", {})["$lte"] = max_amount
    if search:
        query["description"] = {"$regex": search, "$options": "i"}

    txns = await db.transactions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    txns = await enrich_transactions_with_names(user["user_id"], txns)
    return {"transactions": txns, "total": total}


@app.get("/api/transactions/pending")
async def list_pending_transactions(
    user: dict = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0,
):
    """List all pending review transactions."""
    query = {"user_id": user["user_id"], "status": "pending_review"}
    txns = await db.transactions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    txns = await enrich_transactions_with_names(user["user_id"], txns)
    return {"items": txns, "total": total}


@app.get("/api/transactions/search")
async def search_transactions(
    q: str = "",
    user: dict = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0,
):
    """Search transactions by description, amount, or date."""
    user_id = user["user_id"]
    query: dict = {"user_id": user_id}

    if q:
        # Try parsing as a number for amount search
        try:
            amount_val = float(q)
            query["$or"] = [
                {"description": {"$regex": q, "$options": "i"}},
                {"amount": amount_val},
            ]
        except ValueError:
            query["description"] = {"$regex": q, "$options": "i"}

    txns = await db.transactions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    txns = await enrich_transactions_with_names(user["user_id"], txns)
    return {"items": txns, "total": total}


@app.get("/api/transactions/{transaction_id}")
async def get_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    txn = await db.transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    enriched = await enrich_transactions_with_names(user["user_id"], [txn])
    return enriched[0]


@app.post("/api/transactions", status_code=201)
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
        "recurrence_date": data.recurrence_date,
        "source": data.source,
        "status": data.status,
        "receipt_id": data.receipt_id,
        "created_at": datetime.now(timezone.utc),
    }
    await db.transactions.insert_one(txn)
    del txn["_id"]

    if data.status == "approved":
        await apply_transaction_to_balances(user["user_id"], txn)

    # Link receipt to this transaction
    if data.receipt_id:
        await db.receipts.update_one(
            {"receipt_id": data.receipt_id, "user_id": user["user_id"]},
            {"$set": {"transaction_id": txn["transaction_id"], "linked_at": datetime.now(timezone.utc)}}
        )

    # B8: Warn if transaction date is more than 30 days in the future
    warning = None
    try:
        from datetime import timedelta
        txn_date = datetime.strptime(data.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if txn_date > datetime.now(timezone.utc) + timedelta(days=30):
            warning = f"Transaction date {data.date} is more than 30 days in the future"
    except (ValueError, TypeError):
        pass
    if warning:
        txn["warning"] = warning

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
    is_od = (account.get("sub_type") or "").lower() == "overdraft"

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
                if is_od:
                    # Overdraft: transferring OUT means using the credit line,
                    # which INCREASES the outstanding balance.
                    balance += txn["amount"]
                else:
                    balance -= txn["amount"]  # Money leaving this account

        # Transfers INTO this account
        transfer_in_txns = await db.transactions.find(
            {**txn_query, "to_account_id": account_id, "transaction_type": "transfer"}, {"_id": 0}
        ).to_list(10000)

        for txn in transfer_in_txns:
            if is_od:
                # Overdraft: transferring IN means repaying, which DECREASES
                # the outstanding balance.
                balance -= txn["amount"]
            else:
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

    async def is_od(account_id):
        acc = await db.accounts.find_one(
            {"account_id": account_id, "user_id": user_id},
            {"_id": 0, "sub_type": 1}
        )
        return (acc.get("sub_type") or "").lower() == "overdraft" if acc else False

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
        # Batch all read queries in parallel for transfers
        src_id = txn["account_id"]
        dst_id = txn.get("to_account_id")
        if dst_id:
            src_apply, src_od, dst_apply, dst_od = await asyncio.gather(
                should_apply(src_id), is_od(src_id),
                should_apply(dst_id), is_od(dst_id),
            )
        else:
            src_apply, src_od = await asyncio.gather(
                should_apply(src_id), is_od(src_id),
            )

        if src_apply:
            # Overdraft source: withdrawal INCREASES outstanding
            await db.accounts.update_one(
                {"account_id": src_id, "user_id": user_id},
                {"$inc": {"balance": amount if src_od else -amount}}
            )
        if dst_id and dst_apply:
            # Overdraft destination: repayment DECREASES outstanding
            await db.accounts.update_one(
                {"account_id": dst_id, "user_id": user_id},
                {"$inc": {"balance": -amount if dst_od else amount}}
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

    async def is_od(account_id):
        acc = await db.accounts.find_one(
            {"account_id": account_id, "user_id": user_id},
            {"_id": 0, "sub_type": 1}
        )
        return (acc.get("sub_type") or "").lower() == "overdraft" if acc else False

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
            # Reverse of apply: OD source withdrawal was +amount, so reverse is -amount
            od_src = await is_od(txn["account_id"])
            await db.accounts.update_one(
                {"account_id": txn["account_id"], "user_id": user_id},
                {"$inc": {"balance": -amount if od_src else amount}}
            )
        if txn.get("to_account_id"):
            if await should_apply(txn["to_account_id"]):
                # Reverse of apply: OD destination repayment was -amount, so reverse is +amount
                od_dst = await is_od(txn["to_account_id"])
                await db.accounts.update_one(
                    {"account_id": txn["to_account_id"], "user_id": user_id},
                    {"$inc": {"balance": amount if od_dst else -amount}}
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

    enriched = await enrich_transactions_with_names(user["user_id"], [updated])
    return enriched[0]


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
    existing["status"] = "approved"
    await apply_transaction_to_balances(user["user_id"], existing)

    # Archive the source email with attachments if this is an email-sourced transaction
    if existing.get("source") == "email" and existing.get("source_email_id"):
        asyncio.create_task(archive_email_for_transaction(user["user_id"], existing))

    # --- Layer 2: Save sender→account mapping on approval ---
    if existing.get("source_email_id") and existing.get("account_id"):
        src_email_doc = await db.synced_emails.find_one(
            {"email_id": existing["source_email_id"]}, {"_id": 0, "from_email": 1}
        )
        if src_email_doc and src_email_doc.get("from_email"):
            sender_email = src_email_doc["from_email"].strip().lower()
            now = datetime.now(timezone.utc)
            await db.sender_account_mappings.update_one(
                {"user_id": user["user_id"], "from_email": sender_email, "account_id": existing["account_id"]},
                {
                    "$inc": {"confidence_count": 1},
                    "$set": {"last_used_at": now},
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
            )

    existing["approved_at"] = datetime.now(timezone.utc)
    enriched = await enrich_transactions_with_names(user["user_id"], [existing])
    return enriched[0]


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



@app.post("/api/transactions/bulk-approve")
async def bulk_approve_transactions(request: Request, user: dict = Depends(get_current_user)):
    """Approve multiple transactions at once."""
    body = await request.json()
    transaction_ids = body.get("transaction_ids", [])
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="transaction_ids is required")

    async def _approve_one(tid: str):
        txn = await db.transactions.find_one(
            {"transaction_id": tid, "user_id": user["user_id"]}, {"_id": 0}
        )
        if not txn:
            return {"transaction_id": tid, "error": "Not found"}
        if txn["status"] == "approved":
            return {"transaction_id": tid, "error": "Already approved"}

        await db.transactions.update_one(
            {"transaction_id": tid},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}}
        )
        await apply_transaction_to_balances(user["user_id"], txn)

        if txn.get("source") == "email" and txn.get("source_email_id"):
            asyncio.create_task(archive_email_for_transaction(user["user_id"], txn))

        # --- Layer 2: Save sender→account mapping on approval ---
        if txn.get("source_email_id") and txn.get("account_id"):
            src_email_doc = await db.synced_emails.find_one(
                {"email_id": txn["source_email_id"]}, {"_id": 0, "from_email": 1}
            )
            if src_email_doc and src_email_doc.get("from_email"):
                sender_email = src_email_doc["from_email"].strip().lower()
                now = datetime.now(timezone.utc)
                await db.sender_account_mappings.update_one(
                    {"user_id": user["user_id"], "from_email": sender_email, "account_id": txn["account_id"]},
                    {
                        "$inc": {"confidence_count": 1},
                        "$set": {"last_used_at": now},
                        "$setOnInsert": {"created_at": now},
                    },
                    upsert=True,
                )

        return None

    results = await asyncio.gather(*[_approve_one(tid) for tid in transaction_ids])
    errors = [r for r in results if r is not None]
    approved = len(results) - len(errors)

    return {"approved": approved, "errors": errors, "total": len(transaction_ids)}


@app.post("/api/transactions/bulk-reject")
async def bulk_reject_transactions(request: Request, user: dict = Depends(get_current_user)):
    """Reject multiple transactions at once."""
    body = await request.json()
    transaction_ids = body.get("transaction_ids", [])
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="transaction_ids is required")

    rejected = 0
    errors = []
    for tid in transaction_ids:
        txn = await db.transactions.find_one(
            {"transaction_id": tid, "user_id": user["user_id"]}, {"_id": 0}
        )
        if not txn:
            errors.append({"transaction_id": tid, "error": "Not found"})
            continue

        if txn["status"] == "approved":
            await reverse_transaction_balances(user["user_id"], txn)

        await db.transactions.update_one(
            {"transaction_id": tid},
            {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc)}}
        )

        if txn.get("source_email_id"):
            await db.email_archives.delete_one({
                "user_id": user["user_id"],
                "source_email_id": txn["source_email_id"]
            })

        rejected += 1

    return {"rejected": rejected, "errors": errors, "total": len(transaction_ids)}


@app.post("/api/transactions/bulk-delete")
async def bulk_delete_transactions(request: Request, user: dict = Depends(get_current_user)):
    """Delete multiple transactions at once."""
    body = await request.json()
    transaction_ids = body.get("transaction_ids", [])
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="transaction_ids is required")

    deleted = 0
    errors = []
    for tid in transaction_ids:
        txn = await db.transactions.find_one(
            {"transaction_id": tid, "user_id": user["user_id"]}, {"_id": 0}
        )
        if not txn:
            errors.append({"transaction_id": tid, "error": "Not found"})
            continue

        if txn["status"] == "approved":
            await reverse_transaction_balances(user["user_id"], txn)

        await db.transactions.delete_one(
            {"transaction_id": tid, "user_id": user["user_id"]}
        )
        deleted += 1

    return {"deleted": deleted, "errors": errors, "total": len(transaction_ids)}


@app.post("/api/transactions/bulk-update")
async def bulk_update_transactions(request: Request, user: dict = Depends(get_current_user)):
    """Update fields on multiple transactions at once (e.g., category, description)."""
    body = await request.json()
    transaction_ids = body.get("transaction_ids", [])
    update_fields = body.get("fields", {})
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="transaction_ids is required")
    if not update_fields:
        raise HTTPException(status_code=400, detail="fields is required")

    allowed_fields = {"category_id", "subcategory_id", "description", "payment_method"}
    set_fields = {k: v for k, v in update_fields.items() if k in allowed_fields}
    if not set_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    result = await db.transactions.update_many(
        {"transaction_id": {"$in": transaction_ids}, "user_id": user["user_id"]},
        {"$set": set_fields}
    )

    return {"updated": result.modified_count, "total": len(transaction_ids)}


# ─── Recurring & Cash Flow Routes ────────────────────────────────────

@app.get("/api/recurring/list")
async def list_recurring(user: dict = Depends(get_current_user)):
    txns = await db.transactions.find(
        {"user_id": user["user_id"], "is_recurring": True, "status": "approved"},
        {"_id": 0}
    ).sort("date", -1).to_list(200)
    txns = await enrich_transactions_with_names(user["user_id"], txns)
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
    "daily": 30.44,
    "weekly": 4.33,
    "biweekly": 2.17,
    "monthly": 1.0,
    "quarterly": 1.0 / 3.0,
    "yearly": 1.0 / 12.0,
}

# Known recurring service vendors — used to auto-detect recurring charges
KNOWN_RECURRING_VENDORS = {
    # Streaming & entertainment
    "netflix", "spotify", "apple music", "amazon prime", "disney+", "hotstar",
    "youtube premium", "youtube music", "hbo", "hulu", "apple tv",
    "jio cinema", "zee5", "sonyliv", "voot", "mubi", "crunchyroll",
    # Cloud & tech
    "google one", "google play", "google storage", "icloud", "apple media services",
    "apple.com/bill", "dropbox", "microsoft 365", "office 365", "adobe",
    "github", "chatgpt", "openai",
    # Communication
    "zoom", "slack", "notion", "canva",
    # Fitness & health
    "gym", "fitness", "cult.fit", "cure.fit", "peloton", "fitbit premium",
    # Insurance
    "lic", "insurance", "health insurance", "life insurance", "term plan",
    "bajaj allianz", "hdfc life", "icici prudential", "max life", "star health",
    # Utilities & telecom
    "jio", "airtel", "vodafone", "vi", "bsnl", "tata play", "dish tv",
    "electricity", "water bill", "gas bill", "broadband",
    # News & reading
    "kindle unlimited", "audible", "medium", "substack", "the hindu",
    "times of india", "economic times",
    # Software / SaaS
    "aws", "azure", "heroku", "vercel", "netlify", "digitalocean",
    "namecheap", "godaddy", "cloudflare", "freshworks",
}

# Keywords in email/SMS content that hint at recurring billing
RECURRING_KEYWORDS = [
    "subscription", "recurring", "monthly", "renewal", "billing cycle",
    "auto-renewal", "auto renewal", "autopay", "auto pay", "auto debit",
    "your plan", "membership", "premium plan", "next billing", "renews on",
    "charged monthly", "charged yearly", "annual plan", "yearly plan",
    "billing period", "next payment", "plan renewal",
]


def _detect_recurring_from_vendor_and_content(
    vendor_or_description: str, content: str = ""
) -> dict:
    """Check if a transaction is likely recurring based on vendor name and content.
    Returns dict with is_recurring, recurrence_frequency, recurrence_date (if detectable)."""
    vendor_lower = (vendor_or_description or "").lower()
    content_lower = (content or "").lower()
    combined = f"{vendor_lower} {content_lower}"

    is_recurring = False
    frequency = None
    recurrence_date = None

    # Check vendor name against known recurring services
    for known_vendor in KNOWN_RECURRING_VENDORS:
        if known_vendor in vendor_lower or known_vendor in content_lower:
            is_recurring = True
            frequency = "monthly"  # default for subscriptions
            break

    # Check content for recurring keywords
    if not is_recurring:
        for keyword in RECURRING_KEYWORDS:
            if keyword in combined:
                is_recurring = True
                frequency = "monthly"  # default
                break

    # Try to detect frequency from content
    if is_recurring:
        if any(w in combined for w in ["yearly", "annual", "per year", "/year", "charged yearly"]):
            frequency = "yearly"
        elif any(w in combined for w in ["quarterly", "per quarter", "every 3 months"]):
            frequency = "quarterly"
        elif any(w in combined for w in ["weekly", "per week", "/week", "every week"]):
            frequency = "weekly"
        elif any(w in combined for w in ["daily", "per day", "/day", "every day"]):
            frequency = "daily"
        # else keep monthly default

    # Try to extract recurrence date from content
    if is_recurring:
        # Look for patterns like "15th of each month", "on the 5th", "billing date: 20"
        date_patterns = [
            r'(\d{1,2})(?:st|nd|rd|th)\s+of\s+(?:each|every)\s+month',
            r'(?:billing|renewal|payment)\s+(?:date|day)[:\s]+(\d{1,2})',
            r'(?:on|every)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)',
            r'renews?\s+(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)',
            r'next\s+(?:billing|payment|charge)\s+(?:on\s+)?(?:\w+\s+)?(\d{1,2})',
        ]
        for pattern in date_patterns:
            match = re.search(pattern, combined)
            if match:
                day = int(match.group(1))
                if 1 <= day <= 31:
                    recurrence_date = day
                    break

    return {
        "is_recurring": is_recurring,
        "recurrence_frequency": frequency,
        "recurrence_date": recurrence_date,
    }


def _compute_recurring_summary(recurring_txns: list) -> tuple:
    """Compute recurring items, monthly income, and monthly expense from recurring transactions."""
    monthly_income = 0.0
    monthly_expense = 0.0
    items = []

    for txn in recurring_txns:
        freq = txn.get("recurring_frequency", "monthly")
        monthly_amount = txn["amount"] * FREQ_MULTIPLIERS.get(freq, 1.0)
        # Derive recurrence_date from transaction date if not explicitly set
        rec_date = txn.get("recurrence_date")
        if rec_date is None and txn.get("date"):
            try:
                rec_date = int(txn["date"].split("-")[2].split("T")[0])
            except (IndexError, ValueError):
                rec_date = None
        items.append({
            "transaction_id": txn["transaction_id"],
            "description": txn.get("description", ""),
            "transaction_type": txn["transaction_type"],
            "amount": txn["amount"],
            "frequency": freq,
            "recurrence_date": rec_date,
            "monthly_amount": round(monthly_amount, 2),
            "category_id": txn.get("category_id"),
            "account_id": txn.get("account_id"),
        })
        if txn["transaction_type"] == "income":
            monthly_income += monthly_amount
        elif txn["transaction_type"] == "expense":
            monthly_expense += monthly_amount

    return items, monthly_income, monthly_expense


def _mandate_monthly_outflow(mandate: dict) -> float:
    """Convert a mandate amount + frequency into its equivalent monthly
    outflow, for use in cash-flow projection. Non-monthly frequencies
    are amortised across months."""
    try:
        amt = float(mandate.get("amount") or 0)
    except Exception:
        amt = 0.0
    if amt <= 0:
        return 0.0
    freq = (mandate.get("frequency") or "monthly").lower()
    if freq == "daily":
        return amt * 30.44
    if freq == "monthly":
        return amt
    if freq == "weekly":
        return amt * (52 / 12)
    if freq == "yearly":
        return amt / 12
    if freq == "quarterly":
        return amt / 3
    return amt  # unknown frequency → treat as monthly


def _mandate_active_in_month(mandate: dict, month_start: date_cls, month_end: date_cls) -> bool:
    """A mandate contributes to a given month only if its status is
    active and the month falls between its start/end dates."""
    if (mandate.get("status") or "active").lower() != "active":
        return False
    sd_raw = mandate.get("start_date")
    ed_raw = mandate.get("end_date")

    def _parse(d):
        if not d:
            return None
        if isinstance(d, datetime):
            return d.date()
        try:
            return datetime.strptime(str(d)[:10], "%Y-%m-%d").date()
        except Exception:
            return None

    sd = _parse(sd_raw)
    ed = _parse(ed_raw)
    if sd and sd > month_end:
        return False
    if ed and ed < month_start:
        return False
    return True


@app.get("/api/mandates")
async def list_mandates(user: dict = Depends(get_current_user)):
    """List every mandate on this user, newest first."""
    items = await db.mandates.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return {"mandates": items}


@app.post("/api/mandates", status_code=201)
async def create_mandate(payload: dict = Body(...), user: dict = Depends(get_current_user)):
    """Manually create a mandate (for cases the AI didn't catch, or
    mandates the user knows about but didn't get an email for)."""
    merchant = (payload.get("merchant") or "").strip()
    amount = payload.get("amount")
    if not merchant or amount is None:
        raise HTTPException(status_code=400, detail="merchant and amount are required")
    try:
        amount = float(amount)
    except Exception:
        raise HTTPException(status_code=400, detail="amount must be a number")
    now = datetime.now(timezone.utc)
    doc = {
        "mandate_id": f"mnd_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "merchant": merchant,
        "amount": amount,
        "currency": (payload.get("currency") or "INR").upper(),
        "frequency": (payload.get("frequency") or "monthly").lower(),
        "mandate_type": (payload.get("mandate_type") or "other").lower(),
        "start_date": payload.get("start_date"),
        "end_date": payload.get("end_date"),
        "debit_day": payload.get("debit_day"),
        "account_id": payload.get("account_id"),
        "detected_bank_name": payload.get("detected_bank_name"),
        "status": (payload.get("status") or "active").lower(),
        "source": "manual",
        "created_at": now,
        "updated_at": now,
    }
    await db.mandates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.get("/api/mandates/{mandate_id}")
async def get_mandate(mandate_id: str, user: dict = Depends(get_current_user)):
    """Get a single mandate by ID."""
    mandate = await db.mandates.find_one(
        {"mandate_id": mandate_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return mandate


@app.put("/api/mandates/{mandate_id}")
async def put_mandate(mandate_id: str, payload: dict = Body(...), user: dict = Depends(get_current_user)):
    """Update a mandate (PUT). Same logic as PATCH."""
    mandate = await db.mandates.find_one(
        {"mandate_id": mandate_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    updatable = {
        "merchant", "amount", "currency", "frequency", "mandate_type",
        "start_date", "end_date", "debit_day", "account_id", "status",
    }
    set_fields: dict = {}
    for k, v in payload.items():
        if k not in updatable:
            continue
        if k == "amount" and v is not None:
            try:
                set_fields[k] = float(v)
            except Exception:
                raise HTTPException(status_code=400, detail="amount must be a number")
        elif k in ("frequency", "mandate_type", "status", "currency") and v is not None:
            set_fields[k] = str(v).lower()
        else:
            set_fields[k] = v
    if not set_fields:
        return mandate
    set_fields["updated_at"] = datetime.now(timezone.utc)
    await db.mandates.update_one(
        {"mandate_id": mandate_id, "user_id": user["user_id"]},
        {"$set": set_fields},
    )
    updated = await db.mandates.find_one(
        {"mandate_id": mandate_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return updated


@app.patch("/api/mandates/{mandate_id}")
async def update_mandate(mandate_id: str, payload: dict = Body(...), user: dict = Depends(get_current_user)):
    mandate = await db.mandates.find_one(
        {"mandate_id": mandate_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    updatable = {
        "merchant", "amount", "currency", "frequency", "mandate_type",
        "start_date", "end_date", "debit_day", "account_id", "status",
    }
    set_fields: dict = {}
    for k, v in payload.items():
        if k not in updatable:
            continue
        if k == "amount" and v is not None:
            try:
                set_fields[k] = float(v)
            except Exception:
                raise HTTPException(status_code=400, detail="amount must be a number")
        elif k in ("frequency", "mandate_type", "status", "currency") and v is not None:
            set_fields[k] = str(v).lower()
        else:
            set_fields[k] = v
    if not set_fields:
        return mandate
    set_fields["updated_at"] = datetime.now(timezone.utc)
    await db.mandates.update_one(
        {"mandate_id": mandate_id, "user_id": user["user_id"]},
        {"$set": set_fields},
    )
    updated = await db.mandates.find_one(
        {"mandate_id": mandate_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return updated


@app.delete("/api/mandates/{mandate_id}")
async def delete_mandate(mandate_id: str, user: dict = Depends(get_current_user)):
    res = await db.mandates.delete_one(
        {"mandate_id": mandate_id, "user_id": user["user_id"]}
    )
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return {"message": "Mandate deleted"}



@app.post("/api/mandates/detect")
async def detect_mandates(user: dict = Depends(get_current_user)):
    """Auto-detect recurring mandates from transaction history."""
    user_id = user["user_id"]

    # Get recent approved transactions
    txns = await db.transactions.find(
        {"user_id": user_id, "status": "approved", "transaction_type": "expense"},
        {"_id": 0}
    ).sort("date", -1).to_list(2000)

    # Group by description (normalized) to find recurring patterns
    from collections import defaultdict
    desc_groups = defaultdict(list)
    for t in txns:
        desc = (t.get("description") or "").strip().lower()
        if desc and len(desc) > 3:
            desc_groups[desc].append(t)

    detected = []
    now = datetime.now(timezone.utc)
    for desc, group in desc_groups.items():
        if len(group) < 2:
            continue

        # Check if amounts are similar (within 10%)
        amounts = [t["amount"] for t in group]
        avg_amount = sum(amounts) / len(amounts)
        if avg_amount == 0:
            continue
        if any(abs(a - avg_amount) / avg_amount > 0.1 for a in amounts):
            continue

        # Check for monthly-ish frequency
        dates = sorted([t["date"] for t in group])
        if len(dates) >= 2:
            # Check if already exists as mandate
            existing = await db.mandates.find_one({
                "user_id": user_id,
                "merchant": {"$regex": desc[:20], "$options": "i"},
            })
            if existing:
                continue

            detected.append({
                "merchant": group[0].get("description", desc),
                "amount": round(avg_amount, 2),
                "frequency": "monthly",
                "occurrences": len(group),
                "last_date": dates[-1],
                "account_id": group[0].get("account_id"),
            })

    return {"detected": detected[:20], "total": len(detected)}


@app.get("/api/mandates/upcoming")
async def upcoming_mandates(
    days: int = 30,
    user: dict = Depends(get_current_user),
):
    """List mandates with upcoming charges in the next N days."""
    user_id = user["user_id"]
    mandates = await db.mandates.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    ).to_list(500)

    now = datetime.now(timezone.utc)
    today = now.day
    upcoming = []

    for m in mandates:
        debit_day = m.get("debit_day")
        if debit_day is None:
            continue
        try:
            debit_day = int(debit_day)
        except (ValueError, TypeError):
            continue

        # Calculate next debit date
        year, month = now.year, now.month
        if debit_day <= today:
            # Already passed this month, next occurrence is next month
            month += 1
            if month > 12:
                month = 1
                year += 1

        try:
            next_date = date_cls(year, month, min(debit_day, 28))
        except ValueError:
            next_date = date_cls(year, month, 28)

        days_until = (next_date - now.date()).days
        if 0 <= days_until <= days:
            upcoming.append({
                **m,
                "next_debit_date": next_date.isoformat(),
                "days_until": days_until,
            })

    upcoming.sort(key=lambda x: x["days_until"])
    return {"upcoming": upcoming, "total": len(upcoming)}


async def _compute_od_monthly_interest(user_id: str, account: dict) -> tuple:
    """
    Compute the current month's daily interest for an OD account.
    Uses the same timeline-replay logic as the OD interest endpoint.
    Returns the total interest amount for the current month.
    """
    rate = account.get("loan_interest_rate")
    if not rate or rate <= 0:
        return 0.0, 0.0

    now = datetime.now(timezone.utc)
    year, mon = now.year, now.month
    month_start = date_cls(year, mon, 1)
    if mon == 12:
        month_end = date_cls(year + 1, 1, 1)
    else:
        month_end = date_cls(year, mon + 1, 1)

    num_days = (month_end - month_start).days
    daily_rate = rate / 100.0 / 365.0

    opening = account.get("opening_balance", 0)
    as_of_date = account.get("balance_as_of_date") or month_start.isoformat()
    as_of_str = as_of_date if isinstance(as_of_date, str) else as_of_date.isoformat()
    month_end_str = month_end.isoformat()
    account_id = account["account_id"]

    txn_query = {
        "user_id": user_id,
        "status": "approved",
        "transaction_type": "transfer",
        "date": {"$gte": as_of_str, "$lt": month_end_str},
        "source": {"$ne": "loan_emi"},
    }

    withdrawals = await db.transactions.find(
        {**txn_query, "account_id": account_id},
        {"_id": 0, "date": 1, "amount": 1}
    ).sort("date", 1).to_list(10000)

    repayments = await db.transactions.find(
        {**txn_query, "to_account_id": account_id},
        {"_id": 0, "date": 1, "amount": 1}
    ).sort("date", 1).to_list(10000)

    expense_query = {
        "user_id": user_id,
        "status": "approved",
        "account_id": account_id,
        "transaction_type": "expense",
        "date": {"$gte": as_of_str, "$lt": month_end_str},
        "source": {"$ne": "loan_emi"},
    }
    expenses = await db.transactions.find(
        expense_query, {"_id": 0, "date": 1, "amount": 1}
    ).sort("date", 1).to_list(10000)

    events = []
    for w in withdrawals:
        events.append({"date": w["date"], "delta": w["amount"]})
    for r in repayments:
        events.append({"date": r["date"], "delta": -r["amount"]})
    for e in expenses:
        events.append({"date": e["date"], "delta": e["amount"]})
    events.sort(key=lambda x: x["date"])

    balance = opening
    pre_month_events = [e for e in events if e["date"] < month_start.isoformat()]
    for e in pre_month_events:
        balance += e["delta"]

    month_events = [e for e in events if month_start.isoformat() <= e["date"] < month_end_str]

    total_interest = 0.0
    event_idx = 0
    for day_offset in range(num_days):
        current_date = month_start + timedelta(days=day_offset)
        current_str = current_date.isoformat()
        while event_idx < len(month_events) and month_events[event_idx]["date"] <= current_str:
            balance += month_events[event_idx]["delta"]
            event_idx += 1
        total_interest += max(0, balance) * daily_rate

    return round(total_interest, 2), round(max(0, balance), 2)


@app.get("/api/cashflow/projection")
async def cashflow_projection(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]

    recurring_txns = await db.transactions.find(
        {"user_id": user_id, "is_recurring": True, "status": "approved"},
        {"_id": 0}
    ).to_list(500)

    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    current_balance = sum(
        a.get("balance", 0) if a.get("account_type") in ("asset", "investment") else -a.get("balance", 0)
        for a in accounts
    )

    # Compute projected monthly OD interest for overdraft accounts
    od_accounts = [
        a for a in accounts
        if (a.get("sub_type") or "").lower() == "overdraft" and a.get("loan_interest_rate")
    ]
    od_interest_items = []
    monthly_od_interest = 0.0
    for od_acc in od_accounts:
        interest, outstanding = await _compute_od_monthly_interest(user_id, od_acc)
        if interest > 0:
            od_interest_items.append({
                "account_id": od_acc["account_id"],
                "account_name": od_acc.get("name", "OD Account"),
                "rate": od_acc.get("loan_interest_rate"),
                "interest_charge_day": od_acc.get("loan_emi_day"),
                "monthly_interest": interest,
                "balance": outstanding,
            })
            monthly_od_interest += interest

    recurring_items, monthly_recurring_income, monthly_recurring_expense = _compute_recurring_summary(recurring_txns)

    # Mandates are committed future outflows. Add them to expense side
    # only for the months they are active.
    mandates = await db.mandates.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    ).to_list(500)
    base_currency = await get_user_base_currency(user_id)
    mandate_items = []
    for m in mandates:
        raw_amount = float(m.get("amount") or 0)
        mandate_currency = (m.get("currency") or base_currency).upper()
        monthly_eq = round(_mandate_monthly_outflow(m), 2)

        # Currency conversion: convert to user's base currency if different
        base_amount = raw_amount
        base_monthly = monthly_eq
        is_estimated_rate = False
        exchange_rate = None
        if mandate_currency != base_currency.upper():
            rate_info = await get_exchange_rate(mandate_currency, base_currency)
            if rate_info and rate_info.get("rate"):
                exchange_rate = rate_info["rate"]
                is_estimated_rate = rate_info.get("is_estimated", True)
                base_amount = round(raw_amount * exchange_rate, 2)
                base_monthly = round(monthly_eq * exchange_rate, 2)

        mandate_items.append({
            "mandate_id": m.get("mandate_id"),
            "merchant": m.get("merchant"),
            "amount": base_amount,
            "original_amount": raw_amount,
            "currency": mandate_currency,
            "base_currency": base_currency.upper(),
            "exchange_rate": exchange_rate,
            "is_estimated_rate": is_estimated_rate,
            "frequency": m.get("frequency") or "monthly",
            "mandate_type": m.get("mandate_type"),
            "start_date": m.get("start_date"),
            "end_date": m.get("end_date"),
            "debit_day": m.get("debit_day"),
            "monthly_equivalent": base_monthly,
            "source": m.get("source"),
            "source_email_id": m.get("source_email_id"),
            "source_email_subject": m.get("source_email_subject"),
        })
    monthly_mandate_expense = sum(i["monthly_equivalent"] for i in mandate_items)

    now = datetime.now(timezone.utc)
    running_balance = current_balance
    months = []
    for i in range(24):
        month_anchor = now + timedelta(days=30 * (i + 1))
        month_start = month_anchor.replace(day=1).date()
        # Month end = last day; approx with +31 days then drop to month_start's month.
        next_month = (month_anchor.replace(day=28) + timedelta(days=6)).replace(day=1)
        month_end = (next_month - timedelta(days=1)).date()

        # Mandate expense specifically for this month
        month_mandate = sum(
            _mandate_monthly_outflow(m)
            for m in mandates
            if _mandate_active_in_month(m, month_start, month_end)
        )

        projected_income = monthly_recurring_income
        projected_expense = monthly_recurring_expense          # recurring only; mandates & OD sent separately
        net = projected_income - projected_expense - month_mandate - monthly_od_interest
        running_balance += net
        months.append({
            "month": i + 1,
            "label": month_anchor.strftime("%b %Y"),
            "projected_income": round(projected_income, 2),
            "projected_expense": round(projected_expense, 2),
            "mandate_expense": round(month_mandate, 2),
            "od_interest": round(monthly_od_interest, 2),
            "net": round(net, 2),
            "running_balance": round(running_balance, 2),
        })

    # Extract EMI items from accounts with loan_emi_amount
    emi_items = []
    monthly_emi_total = 0.0
    for acc in accounts:
        emi_amt = acc.get("loan_emi_amount")
        if emi_amt and emi_amt > 0:
            emi_items.append({
                "account_id": acc.get("account_id"),
                "account_name": acc.get("name", "Loan Account"),
                "emi_amount": round(emi_amt, 2),
                "emi_day": acc.get("loan_emi_day", 1),
                "loan_interest_rate": acc.get("loan_interest_rate"),
                "loan_tenure_months": acc.get("loan_tenure_months"),
            })
            monthly_emi_total += emi_amt

    return {
        "current_balance": round(current_balance, 2),
        "monthly_recurring_income": round(monthly_recurring_income, 2),
        "monthly_recurring_expense": round(monthly_recurring_expense, 2),
        "monthly_mandate_expense": round(monthly_mandate_expense, 2),
        "monthly_od_interest": round(monthly_od_interest, 2),
        "monthly_emi_total": round(monthly_emi_total, 2),
        "monthly_net": round(monthly_recurring_income - monthly_recurring_expense - monthly_mandate_expense - monthly_od_interest, 2),
        "recurring_items": recurring_items,
        "mandate_items": mandate_items,
        "od_interest_items": od_interest_items,
        "emi_items": emi_items,
        "projection": months,
    }



@app.get("/api/cashflow/history")
async def cashflow_history(
    months: int = 12,
    user: dict = Depends(get_current_user),
):
    """Get historical monthly cash flow (income - expense) for the last N months."""
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)

    history = []
    for i in range(months - 1, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        month_start = f"{year:04d}-{month:02d}-01"
        if month == 12:
            month_end = f"{year + 1:04d}-01-01"
        else:
            month_end = f"{year:04d}-{month + 1:02d}-01"

        txns = await db.transactions.find(
            {"user_id": user_id, "status": "approved", "date": {"$gte": month_start, "$lt": month_end}},
            {"_id": 0, "transaction_type": 1, "amount": 1}
        ).to_list(5000)

        income = sum(t["amount"] for t in txns if t["transaction_type"] == "income")
        expense = sum(t["amount"] for t in txns if t["transaction_type"] == "expense")

        history.append({
            "month": month_start[:7],
            "income": round(income, 2),
            "expense": round(expense, 2),
            "net_cashflow": round(income - expense, 2),
        })

    # Compute running balance
    running = 0
    for h in history:
        running += h["net_cashflow"]
        h["cumulative"] = round(running, 2)

    return {"history": history}


# ─── Dashboard Routes ───────────────────────────────────────────────

@app.get("/api/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)

    total_assets = sum(a.get("balance", 0) for a in accounts if a.get("account_type") in ("asset", "investment"))
    total_liabilities = sum(a.get("balance", 0) for a in accounts if a.get("account_type") == "liability")
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
        {"user_id": user_id, "status": "pending_review", "source": {"$in": ["email", "sms", "statement"]}}
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



@app.get("/api/dashboard/trends")
async def dashboard_trends(
    months: int = 6,
    user: dict = Depends(get_current_user),
):
    """Get income/expense trends for the last N months."""
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)

    trends = []
    for i in range(months - 1, -1, -1):
        # Calculate month start/end
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        month_start = f"{year:04d}-{month:02d}-01"
        if month == 12:
            month_end = f"{year + 1:04d}-01-01"
        else:
            month_end = f"{year:04d}-{month + 1:02d}-01"

        txns = await db.transactions.find(
            {"user_id": user_id, "status": "approved", "date": {"$gte": month_start, "$lt": month_end}},
            {"_id": 0, "transaction_type": 1, "amount": 1}
        ).to_list(5000)

        income = sum(t["amount"] for t in txns if t["transaction_type"] == "income")
        expense = sum(t["amount"] for t in txns if t["transaction_type"] == "expense")

        trends.append({
            "month": month_start[:7],
            "income": round(income, 2),
            "expense": round(expense, 2),
            "net": round(income - expense, 2),
        })

    return {"trends": trends}


@app.get("/api/dashboard/monthly-comparison")
async def dashboard_monthly_comparison(user: dict = Depends(get_current_user)):
    """Compare current month with previous month."""
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)

    # Current month
    curr_start = now.replace(day=1).strftime("%Y-%m-%d")
    curr_end = now.strftime("%Y-%m-%d")

    # Previous month
    if now.month == 1:
        prev_year, prev_month = now.year - 1, 12
    else:
        prev_year, prev_month = now.year, now.month - 1
    prev_start = f"{prev_year:04d}-{prev_month:02d}-01"
    prev_end = f"{prev_year:04d}-{prev_month:02d}-{28}"  # approximate

    async def get_month_totals(start, end):
        txns = await db.transactions.find(
            {"user_id": user_id, "status": "approved", "date": {"$gte": start, "$lte": end}},
            {"_id": 0, "transaction_type": 1, "amount": 1}
        ).to_list(5000)
        income = sum(t["amount"] for t in txns if t["transaction_type"] == "income")
        expense = sum(t["amount"] for t in txns if t["transaction_type"] == "expense")
        return {"income": round(income, 2), "expense": round(expense, 2), "net": round(income - expense, 2)}

    current = await get_month_totals(curr_start, curr_end)
    previous = await get_month_totals(prev_start, prev_end)

    def pct_change(curr, prev):
        if prev == 0:
            return 100.0 if curr > 0 else 0.0
        return round(((curr - prev) / prev) * 100, 1)

    return {
        "current_month": {**current, "period": curr_start[:7]},
        "previous_month": {**previous, "period": prev_start[:7]},
        "income_change_pct": pct_change(current["income"], previous["income"]),
        "expense_change_pct": pct_change(current["expense"], previous["expense"]),
    }


# =====================================================================


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



@app.get("/api/reports/account")
async def reports_by_account(
    start_date: str = None, end_date: str = None,
    account_id: str = None,
    user: dict = Depends(get_current_user),
):
    """Get transaction summary grouped by account."""
    user_id = user["user_id"]
    query = {"user_id": user_id, "status": "approved"}
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if account_id:
        query["$or"] = [{"account_id": account_id}, {"to_account_id": account_id}]

    txns = await db.transactions.find(query, {"_id": 0}).to_list(5000)
    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    acc_map = {a["account_id"]: a.get("name", "Unknown") for a in accounts}

    by_account = {}
    for t in txns:
        aid = t.get("account_id", "unknown")
        if aid not in by_account:
            by_account[aid] = {
                "account_id": aid,
                "account_name": acc_map.get(aid, "Unknown"),
                "income": 0, "expense": 0, "transfers_out": 0, "transfers_in": 0, "count": 0,
            }
        by_account[aid]["count"] += 1
        if t["transaction_type"] == "income":
            by_account[aid]["income"] += t["amount"]
        elif t["transaction_type"] == "expense":
            by_account[aid]["expense"] += t["amount"]
        elif t["transaction_type"] == "transfer":
            by_account[aid]["transfers_out"] += t["amount"]
            to_aid = t.get("to_account_id")
            if to_aid:
                if to_aid not in by_account:
                    by_account[to_aid] = {
                        "account_id": to_aid,
                        "account_name": acc_map.get(to_aid, "Unknown"),
                        "income": 0, "expense": 0, "transfers_out": 0, "transfers_in": 0, "count": 0,
                    }
                by_account[to_aid]["transfers_in"] += t["amount"]

    result = sorted(by_account.values(), key=lambda x: x["income"] + x["expense"], reverse=True)
    for r in result:
        r["income"] = round(r["income"], 2)
        r["expense"] = round(r["expense"], 2)
        r["transfers_out"] = round(r["transfers_out"], 2)
        r["transfers_in"] = round(r["transfers_in"], 2)

    return {"accounts": result}


@app.get("/api/reports/income-expense")
async def reports_income_expense(
    start_date: str = None, end_date: str = None,
    user: dict = Depends(get_current_user),
):
    """Detailed income vs expense breakdown with category drill-down."""
    user_id = user["user_id"]
    query = {"user_id": user_id, "status": "approved"}
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date

    txns = await db.transactions.find(query, {"_id": 0}).to_list(5000)
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    cat_map = {c["category_id"]: c for c in categories}

    income_txns = [t for t in txns if t["transaction_type"] == "income"]
    expense_txns = [t for t in txns if t["transaction_type"] == "expense"]

    return {
        "total_income": round(sum(t["amount"] for t in income_txns), 2),
        "total_expense": round(sum(t["amount"] for t in expense_txns), 2),
        "net": round(sum(t["amount"] for t in income_txns) - sum(t["amount"] for t in expense_txns), 2),
        "income_by_category": _aggregate_by_category(income_txns, cat_map),
        "expense_by_category": _aggregate_by_category(expense_txns, cat_map),
        "start_date": start_date,
        "end_date": end_date,
    }


@app.get("/api/reports/export/csv")
async def export_report_csv(
    start_date: str = None, end_date: str = None,
    transaction_type: str = None,
    user: dict = Depends(get_current_user),
):
    """Export transactions as CSV."""
    user_id = user["user_id"]
    query = {"user_id": user_id, "status": "approved"}
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if transaction_type:
        query["transaction_type"] = transaction_type

    txns = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    acc_map = {a["account_id"]: a.get("name", "") for a in accounts}
    cat_map = {c["category_id"]: c.get("name", "") for c in categories}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Type", "Amount", "Account", "To Account",
        "Category", "Subcategory", "Description", "Payment Method",
        "Recurring", "Frequency", "Status", "Source",
        "Original Currency", "Original Amount", "Exchange Rate",
    ])
    for t in txns:
        writer.writerow([
            t.get("date", ""),
            t.get("transaction_type", ""),
            t.get("amount", 0),
            acc_map.get(t.get("account_id"), ""),
            acc_map.get(t.get("to_account_id"), "") if t.get("to_account_id") else "",
            cat_map.get(t.get("category_id"), ""),
            cat_map.get(t.get("subcategory_id"), "") if t.get("subcategory_id") else "",
            t.get("description", ""),
            t.get("payment_method", ""),
            "Yes" if t.get("is_recurring") else "No",
            t.get("recurring_frequency", "") if t.get("is_recurring") else "",
            t.get("status", ""),
            t.get("source", "manual"),
            t.get("original_currency", ""),
            t.get("original_amount", "") if t.get("original_amount") else "",
            t.get("exchange_rate", "") if t.get("exchange_rate") else "",
        ])

    csv_bytes = output.getvalue().encode("utf-8-sig")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="transactions_{start_date or "all"}_{end_date or "all"}.csv"'},
    )


@app.get("/api/reports/export/pdf")
async def export_report_pdf(
    start_date: str = None, end_date: str = None,
    transaction_type: str = None,
    user: dict = Depends(get_current_user),
):
    """Generate and return a proper PDF report."""
    user_id = user["user_id"]
    query = {"user_id": user_id, "status": "approved"}
    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if transaction_type:
        query["transaction_type"] = transaction_type

    txns = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}

    acc_map = {a["account_id"]: a.get("name", "") for a in accounts}
    cat_map = {c["category_id"]: c.get("name", "") for c in categories}

    total_income = sum(t["amount"] for t in txns if t["transaction_type"] == "income")
    total_expense = sum(t["amount"] for t in txns if t["transaction_type"] == "expense")
    currency = settings.get("base_currency", "INR")
    firm_name = settings.get("firm_name", "SpentyAI Report")

    # Build PDF with fpdf2
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, firm_name, ln=True, align="C")
    pdf.set_font("Helvetica", "", 11)
    period_label = f"Period: {start_date or 'All'} to {end_date or 'All'}"
    pdf.cell(0, 7, period_label, ln=True, align="C")
    pdf.ln(4)

    # Summary row
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(70, 8, f"Total Income: {currency} {total_income:,.2f}", border=1, fill=True)
    pdf.cell(70, 8, f"Total Expense: {currency} {total_expense:,.2f}", border=1, fill=True)
    net = total_income - total_expense
    pdf.cell(70, 8, f"Net: {currency} {net:,.2f}", border=1, fill=True)
    pdf.cell(67, 8, f"Transactions: {len(txns)}", border=1, fill=True, ln=True)
    pdf.ln(4)

    # Table header
    col_widths = [22, 18, 24, 36, 36, 30, 30, 50, 31]
    headers = ["Date", "Type", "Amount", "Account", "To Account", "Category", "Subcategory", "Description", "Payment Method"]
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(50, 50, 50)
    pdf.set_text_color(255, 255, 255)
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 7, h, border=1, fill=True, align="C")
    pdf.ln()

    # Table rows
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(0, 0, 0)
    fill = False
    for t in txns[:500]:
        if fill:
            pdf.set_fill_color(248, 248, 248)
        else:
            pdf.set_fill_color(255, 255, 255)

        row = [
            str(t.get("date", ""))[:10],
            str(t.get("transaction_type", "")),
            f"{t.get('amount', 0):,.2f}",
            str(acc_map.get(t.get("account_id"), ""))[:20],
            str(acc_map.get(t.get("to_account_id"), ""))[:20] if t.get("to_account_id") else "",
            str(cat_map.get(t.get("category_id"), ""))[:18],
            str(cat_map.get(t.get("subcategory_id"), ""))[:18] if t.get("subcategory_id") else "",
            str(t.get("description", ""))[:32],
            str(t.get("payment_method", "")),
        ]
        for i, val in enumerate(row):
            pdf.cell(col_widths[i], 6, val, border=1, fill=True)
        pdf.ln()
        fill = not fill

    # Output PDF bytes
    pdf_bytes = pdf.output()
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report_{start_date or "all"}_{end_date or "all"}.pdf"'},
    )


# =====================================================================


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



@app.get("/api/feature-requests/{request_id}")
async def get_feature_request(request_id: str, user: dict = Depends(get_current_user)):
    """Get a single feature request."""
    req = await db.feature_requests.find_one(
        {"request_id": request_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Feature request not found")
    if isinstance(req.get("created_at"), datetime):
        req["created_at"] = req["created_at"].isoformat()
    return req


# --- Endpoint 6.15: POST /api/feature-requests/{request_id}/vote ---

@app.post("/api/feature-requests/{request_id}/vote")
async def vote_feature_request(request_id: str, user: dict = Depends(get_current_user)):
    """Upvote a feature request."""
    req = await db.feature_requests.find_one(
        {"request_id": request_id}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Feature request not found")

    # Check if user already voted
    voters = req.get("voters", [])
    if user["user_id"] in voters:
        raise HTTPException(status_code=400, detail="Already voted")

    await db.feature_requests.update_one(
        {"request_id": request_id},
        {
            "$inc": {"votes": 1},
            "$push": {"voters": user["user_id"]},
        },
    )

    return {"message": "Vote recorded", "votes": req.get("votes", 0) + 1}


# =====================================================================


# ─── Statement Upload & Reconciliation Routes ───────────────────────

UPLOAD_DIR = "/app/uploads/statements"
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def ensure_statement_file(stmt: dict) -> Optional[str]:
    """Guarantee the statement's source file is present on local disk so
    the rest of the parse pipeline (which reads from paths) keeps working
    unchanged. If the on-disk copy is missing but we have a durable copy
    in GridFS, re-hydrate to the expected path. Returns the path, or
    None if no recoverable copy exists.
    """
    statement_id = stmt.get("statement_id")
    ext = stmt.get("file_ext") or "pdf"
    file_path = stmt.get("file_path") or os.path.join(UPLOAD_DIR, f"{statement_id}.{ext}")

    if file_path and os.path.exists(file_path):
        return file_path

    # Disk copy is gone — try rehydrating from GridFS.
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        stream = await statement_fs.open_download_stream(statement_id)
        try:
            data = await stream.read()
        finally:
            await stream.close()
        with open(file_path, "wb") as out:
            out.write(data)
        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            logger.info(f"Rehydrated statement file from GridFS: {statement_id}")
            # Keep the stored file_path authoritative for callers.
            await db.statements.update_one(
                {"statement_id": statement_id},
                {"$set": {"file_path": file_path, "has_stored_bytes": True}},
            )
            return file_path
    except Exception as e:
        logger.error(f"GridFS rehydrate failed for {statement_id}: {e}")

    return None


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

    # Durable copy in GridFS. Keyed by statement_id so rehydrate is trivial.
    has_stored_bytes = False
    try:
        await statement_fs.upload_from_stream_with_id(
            statement_id, f"{statement_id}.{ext}", content,
            metadata={"user_id": user["user_id"], "file_ext": ext, "filename": file.filename},
        )
        has_stored_bytes = True
    except Exception as e:
        # Non-fatal: keep going with the on-disk copy. Retry after restart
        # won't work for this one, but upload still succeeds.
        logger.error(f"GridFS store failed for {statement_id}: {e}")

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
        "has_stored_bytes": has_stored_bytes,
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

    return camelise({
        "statement_id": statement_id,
        "message": "Statement uploaded, parsing in progress",
        "filename": file.filename,
    })


@app.get("/api/statements/list")
async def list_statements(user: dict = Depends(get_current_user)):
    stmts = await db.statements.find(
        {"user_id": user["user_id"]}, {"_id": 0, "file_path": 0}
    ).sort("uploaded_at", -1).to_list(50)
    return camelise({"statements": stmts})


@app.get("/api/statements/{statement_id}")
async def get_statement(statement_id: str, user: dict = Depends(get_current_user)):
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]},
        {"_id": 0, "file_path": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return camelise(stmt)


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

    logger.info(
        f"Reconciling statement {statement_id}: {len(parsed)} parsed entries, "
        f"{len(ledger_txns)} ledger txns in period {period_from}..{period_to}"
    )
    if parsed:
        sample = parsed[0]
        logger.info(f"  Sample parsed entry: date={sample.get('date')}, amount={sample.get('amount')}, desc={sample.get('description','')[:40]}")
    if ledger_txns:
        sample = ledger_txns[0]
        logger.info(f"  Sample ledger txn: date={sample.get('date')}, amount={sample.get('amount')}, desc={sample.get('description','')[:40]}")

    results = reconcile_entries(parsed, ledger_txns, account_id)

    logger.info(
        f"Reconciliation results: matched={results['summary']['matched']}, "
        f"missing_from_ledger={results['summary']['missing_from_ledger']}, "
        f"missing_from_statement={results['summary']['missing_from_statement']}, "
        f"conflicts={results['summary']['conflicts']}"
    )

    await db.statements.update_one(
        {"statement_id": statement_id},
        {"$set": {
            "reconciliation": results,
            "status": "reconciled",
            "reconciled_at": datetime.now(timezone.utc),
        }}
    )

    return camelise(results)


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

    # Best-effort delete the durable copy too.
    try:
        await statement_fs.delete(statement_id)
    except Exception:
        pass  # already gone or never existed

    await db.statements.delete_one({"statement_id": statement_id})
    return {"message": "Statement deleted"}


@app.post("/api/statements/{statement_id}/reaudit")
async def reaudit_statement(statement_id: str, user: dict = Depends(get_current_user)):
    """Re-run the full parse + audit + correction pipeline on an already
    uploaded statement. Useful when the first audit found issues the
    auto-correction couldn't fully resolve, or the user wants a fresh
    pass after tweaking their category list."""
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    file_path = await ensure_statement_file(stmt)
    if not file_path:
        raise HTTPException(
            status_code=410,
            detail="Original file is no longer available. Please delete this statement and re-upload.",
        )

    # Flip status back into the parsing state so the UI progress bar
    # picks it up the same way an unlock/upload would.
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

    asyncio.create_task(parse_statement_background(statement_id, user["user_id"]))
    return camelise({"statement_id": statement_id, "status": "parsing", "message": "Re-audit started"})



@app.post("/api/statements/{statement_id}/approve")
async def approve_statement(statement_id: str, user: dict = Depends(get_current_user)):
    """Approve all entries in a parsed statement and create transactions."""
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    entries = stmt.get("parsed_entries", [])
    if not entries:
        raise HTTPException(status_code=400, detail="No entries to approve")

    created = 0
    for entry in entries:
        if entry.get("status") == "approved":
            continue

        txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "transaction_type": entry.get("transaction_type", "expense"),
            "amount": abs(float(entry.get("amount", 0))),
            "date": entry.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "account_id": stmt.get("account_id", ""),
            "category_id": entry.get("category_id"),
            "subcategory_id": entry.get("subcategory_id"),
            "description": entry.get("description", ""),
            "payment_method": entry.get("payment_method"),
            "source": "statement",
            "status": "approved",
            "created_at": datetime.now(timezone.utc),
        }
        await db.transactions.insert_one(txn)
        await apply_transaction_to_balances(user["user_id"], txn)
        created += 1

    # Mark statement as approved
    await db.statements.update_one(
        {"statement_id": statement_id, "user_id": user["user_id"]},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}},
    )

    return camelise({"message": f"Statement approved, {created} transactions created", "transactions_created": created})


@app.post("/api/statements/{statement_id}/reject")
async def reject_statement(statement_id: str, user: dict = Depends(get_current_user)):
    """Reject/dismiss a parsed statement."""
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    await db.statements.update_one(
        {"statement_id": statement_id, "user_id": user["user_id"]},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc)}},
    )

    return {"message": "Statement rejected"}


@app.get("/api/statements/{statement_id}/entries")
async def get_statement_entries(statement_id: str, user: dict = Depends(get_current_user)):
    """Get all entries for a parsed statement."""
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0, "file_path": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    entries = stmt.get("parsed_entries", [])
    return camelise({"entries": entries, "total": len(entries), "statement_id": statement_id})


@app.post("/api/statements/{statement_id}/bulk-categorize")
async def bulk_categorize_statement(statement_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Bulk update categories on statement entries."""
    body = await request.json()
    updates = body.get("updates", [])  # [{entry_index: int, category_id: str, subcategory_id?: str}]
    if not updates:
        raise HTTPException(status_code=400, detail="updates array is required")

    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    entries = stmt.get("parsed_entries", [])
    updated_count = 0

    for upd in updates:
        idx = upd.get("entry_index")
        if idx is None or idx < 0 or idx >= len(entries):
            continue
        if upd.get("category_id"):
            entries[idx]["category_id"] = upd["category_id"]
        if upd.get("subcategory_id"):
            entries[idx]["subcategory_id"] = upd["subcategory_id"]
        updated_count += 1

    await db.statements.update_one(
        {"statement_id": statement_id, "user_id": user["user_id"]},
        {"$set": {"parsed_entries": entries}},
    )

    return {"updated": updated_count, "total": len(updates)}


@app.patch("/api/statements/{statement_id}/entries/{entry_index}")
async def update_statement_entry(
    statement_id: str,
    entry_index: int,
    payload: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """Update a single parsed entry's category / subcategory / transaction_type
    on an already-parsed statement. Accepts any of
    {category_id, subcategory_id, transaction_type} (each may be null/omitted).
    When transaction_type flips, category/subcategory are cleared because
    categories are typed (income vs expense). Category names are resolved
    from the user's own category list for display."""
    stmt = await db.statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    entries = stmt.get("parsed_entries") or []
    if entry_index < 0 or entry_index >= len(entries):
        raise HTTPException(status_code=400, detail="Invalid entry index")

    existing = entries[entry_index]

    # Determine the final transaction_type: either the one being set, or
    # the existing one. Only accept "income" or "expense".
    new_type_raw = payload.get("transaction_type")
    type_changing = False
    if "transaction_type" in payload and new_type_raw in ("income", "expense"):
        final_type = new_type_raw
        if existing.get("transaction_type") != final_type:
            type_changing = True
    else:
        final_type = existing.get("transaction_type")

    # If the type is changing, clear category/subcategory regardless of
    # what the client sent (old category_id would belong to the old type).
    if type_changing:
        category_id = None
        subcategory_id = None
    else:
        category_id = payload.get("category_id")
        subcategory_id = payload.get("subcategory_id")

    # Resolve names from ids (so the UI stays consistent with the
    # initial stamping). Unknown ids are treated as unset.
    cat_name = None
    sub_name = None
    if category_id:
        cat = await db.categories.find_one(
            {"category_id": category_id, "user_id": user["user_id"]},
            {"_id": 0, "name": 1, "parent_id": 1},
        )
        if cat and not cat.get("parent_id"):
            cat_name = cat.get("name")
        else:
            category_id = None
    if subcategory_id and category_id:
        sub = await db.categories.find_one(
            {"category_id": subcategory_id, "user_id": user["user_id"], "parent_id": category_id},
            {"_id": 0, "name": 1},
        )
        if sub:
            sub_name = sub.get("name")
        else:
            subcategory_id = None
    else:
        subcategory_id = None

    entry = dict(existing)
    entry["transaction_type"] = final_type
    entry["category_id"] = category_id
    entry["subcategory_id"] = subcategory_id
    entry["category_name"] = cat_name
    entry["subcategory_name"] = sub_name
    entries[entry_index] = entry

    await db.statements.update_one(
        {"statement_id": statement_id, "user_id": user["user_id"]},
        {"$set": {"parsed_entries": entries, "updated_at": datetime.now(timezone.utc)}},
    )

    return camelise({"entry_index": entry_index, "entry": entry})


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

    file_path = await ensure_statement_file(stmt)
    if not file_path:
        raise HTTPException(
            status_code=410,
            detail="Original file is no longer available. Please delete this statement and re-upload.",
        )

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

    return camelise({
        "statement_id": statement_id,
        "status": "parsing",
        "message": "Password accepted, parsing in progress",
    })


# ─── Statement Parsing Helpers ───────────────────────────────────────

# Progress stages for statement parsing. Each tuple is:
#   (stage_name, percent_complete_at_stage_start, rough_remaining_seconds_at_stage_start)
# Used to drive the per-statement progress bar in the UI.
PARSE_STAGES = {
    "queued":          {"progress": 3,   "eta_seconds": 30, "label": "Queued"},
    "decrypting":      {"progress": 8,   "eta_seconds": 25, "label": "Decrypting PDF"},
    "extracting_text": {"progress": 20,  "eta_seconds": 20, "label": "Extracting text"},
    # ai_parsing progress is driven by real chunk completion (see
    # _set_chunk_progress); the value here is the floor we start at.
    "ai_parsing":      {"progress": 30,  "eta_seconds": 60, "label": "Reading transactions"},
    "auditing":        {"progress": 92,  "eta_seconds": 3,  "label": "Verifying completeness"},
    "saving":          {"progress": 97,  "eta_seconds": 1,  "label": "Saving"},
    "parsed":          {"progress": 100, "eta_seconds": 0,  "label": "Done"},
    "parse_failed":    {"progress": 100, "eta_seconds": 0,  "label": "Failed"},
    "password_required": {"progress": 0, "eta_seconds": 0,  "label": "Password required"},
}

# Hard ceiling on a single OpenAI chunk call. Chunks usually finish in
# 10–60s even for very long statements; 4 minutes is comfortably above
# the slowest observed and below "user abandons page".
AI_CHUNK_TIMEOUT_SECONDS = 240

# Stall thresholds for the stuck-statement watchdog. A live parse bumps
# processing_updated_at on every chunk completion (~30–60s apart), so a
# threshold much larger than that still safely catches dead tasks.
STUCK_SWEEP_STARTUP_SECONDS = 5 * 60     # on boot, anything idle > 5 min is dead
STUCK_WATCHDOG_SECONDS       = 8 * 60     # during runtime, 8 min of no progress = dead
STUCK_WATCHDOG_INTERVAL_SECONDS = 60

# The AI-parsing phase is what takes most of the wall-clock time, so we
# spread real progress across this range and update it as each chunk
# finishes. Stages before/after sit at the edges.
_AI_PROGRESS_FLOOR = 30
_AI_PROGRESS_CEIL = 90


async def _set_chunk_progress(
    statement_id: str,
    chunks_done: int,
    chunks_total: int,
    phase_started_at: datetime,
    extra_label: Optional[str] = None,
):
    """Update the statement row with real AI-parsing progress based on
    how many chunks have actually completed. ETA is projected from the
    observed average time per completed chunk.

    processing_progress is written with ``$max`` so it is monotonic: a
    corrective re-pass over a partially parsed statement will never cause
    the UI bar to jump backwards."""
    if chunks_total <= 0:
        return
    frac = max(0.0, min(1.0, chunks_done / chunks_total))
    progress = int(_AI_PROGRESS_FLOOR + (_AI_PROGRESS_CEIL - _AI_PROGRESS_FLOOR) * frac)
    now = datetime.now(timezone.utc)
    elapsed = max(0.1, (now - phase_started_at).total_seconds())
    if chunks_done > 0:
        avg = elapsed / chunks_done
        remaining = max(0, chunks_total - chunks_done)
        eta = int(avg * remaining)
    else:
        eta = int(PARSE_STAGES["ai_parsing"]["eta_seconds"])
    label = PARSE_STAGES["ai_parsing"]["label"]
    if extra_label:
        label = f"{label} ({extra_label})"
    await db.statements.update_one(
        {"statement_id": statement_id},
        {
            "$set": {
                "processing_stage": "ai_parsing",
                "processing_stage_label": label,
                "processing_eta_seconds": eta,
                "processing_updated_at": now,
                "processing_chunks_done": chunks_done,
                "processing_chunks_total": chunks_total,
            },
            "$max": {"processing_progress": progress},
        },
    )


async def _set_parse_stage(statement_id: str, stage: str, *, reset_start: bool = False):
    """Write the current parsing stage + progress to the statement doc so the
    UI can render a live progress bar. Call at every stage transition.

    ``processing_progress`` is written with ``$max`` by default so it never
    regresses mid-parse (e.g. a post-audit correction pass re-entering the
    "ai_parsing" stage won't drop the bar back to the stage floor of 30%).
    When ``reset_start=True`` (a fresh parse run), progress is force-set so
    a retry correctly starts the bar from the beginning."""
    info = PARSE_STAGES.get(stage, {"progress": 0, "eta_seconds": 0, "label": stage})
    now = datetime.now(timezone.utc)
    set_fields = {
        "processing_stage": stage,
        "processing_stage_label": info["label"],
        "processing_eta_seconds": info["eta_seconds"],
        "processing_updated_at": now,
    }
    if reset_start:
        # Fresh run — force progress to the stage floor, reset timers and
        # chunk counters so a retry starts truly from scratch.
        set_fields["processing_progress"] = info["progress"]
        set_fields["processing_started_at"] = now
        set_fields["processing_chunks_done"] = 0
        set_fields["processing_chunks_total"] = 0
        update: dict = {"$set": set_fields}
    else:
        # Only set started_at if it doesn't already exist.
        existing = await db.statements.find_one(
            {"statement_id": statement_id}, {"processing_started_at": 1, "_id": 0}
        )
        if not existing or not existing.get("processing_started_at"):
            set_fields["processing_started_at"] = now
        # Monotonic: never let progress drop mid-parse.
        update = {"$set": set_fields, "$max": {"processing_progress": info["progress"]}}
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

        ext = stmt["file_ext"]
        account_id = stmt.get("account_id")

        # Ensure the source file is actually present — rehydrate from the
        # durable GridFS copy if the ephemeral disk has been wiped.
        file_path = await ensure_statement_file(stmt)
        if not file_path:
            await db.statements.update_one(
                {"statement_id": statement_id},
                {"$set": {
                    "status": "parse_failed",
                    "parse_error": "Original file is no longer available. Please delete and re-upload.",
                    "processing_stage": "parse_failed",
                    "processing_stage_label": PARSE_STAGES["parse_failed"]["label"],
                    "processing_progress": 100,
                    "processing_eta_seconds": 0,
                    "processing_updated_at": datetime.now(timezone.utc),
                }},
            )
            return

        # Resolve password for encrypted PDFs: prefer explicit, else saved.
        effective_password = password
        if ext == "pdf" and not effective_password and account_id:
            effective_password = await get_saved_pdf_password(user_id, account_id)

        stmt_type = stmt.get("statement_type", "bank")
        raw_text_chars = 0
        pdf_text_for_audit = ""
        audit_result: Optional[dict] = None
        audit_status = "skipped"
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
                pdf_text_for_audit = pdf_text or ""
                if pdf_text and len(pdf_text.strip()) >= 50:
                    await _set_parse_stage(statement_id, "ai_parsing")
                    entries = await parse_statement_text_with_ai(
                        pdf_text, stmt_type, user_id=user_id, statement_id=statement_id,
                    )
                else:
                    entries = []
            else:
                entries = []

            # ─── Audit + auto-correct + stamp account/category fields ───
            if entries:
                await _set_parse_stage(statement_id, "auditing")
                # Stamp account / statement / category metadata on every entry.
                entries = await _stamp_entries_with_account(entries, stmt, user_id)

                # Only run the completeness/balance audit when we have the
                # original text (PDF path). CSV rows are already row-exact.
                if pdf_text_for_audit:
                    audit_result = _audit_parsed_entries(pdf_text_for_audit, entries, stmt_type)
                    if not audit_result["ok"]:
                        logger.info(
                            f"Audit found {len(audit_result['issues'])} issue(s) on "
                            f"{statement_id}; running corrective AI pass."
                        )
                        await _set_parse_stage(statement_id, "ai_parsing")
                        category_hint = await _build_category_hint(user_id)
                        corrected_raw = await _ai_correction_pass(
                            pdf_text_for_audit, entries,
                            audit_result["issues"], stmt_type, category_hint,
                        )
                        if corrected_raw:
                            corrected = _post_process_entries(corrected_raw, stmt_type)
                            corrected = await _stamp_entries_with_account(corrected, stmt, user_id)
                            # Re-audit after correction.
                            re_audit = _audit_parsed_entries(pdf_text_for_audit, corrected, stmt_type)
                            # Keep the corrected list even if still not perfect —
                            # it will at minimum be closer to complete.
                            entries = corrected
                            audit_result = re_audit
                            audit_status = "corrected" if re_audit["ok"] else "corrected_with_warnings"
                        else:
                            audit_status = "issues_found"
                    else:
                        audit_status = "verified"
                else:
                    audit_status = "verified"
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
                "audit_status": audit_status,
                "audit_issues": (audit_result or {}).get("issues", []),
                "audit_expected_count": (audit_result or {}).get("expected_count", 0),
                "audit_parsed_count": (audit_result or {}).get("parsed_count", len(entries)),
                "audit_balance_mismatch": (audit_result or {}).get("balance_delta_mismatch"),
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


async def _mark_stuck_statements_failed(idle_threshold_seconds: int, reason: str) -> int:
    """Flip any statement stuck in `status=parsing` whose
    processing_updated_at is older than `idle_threshold_seconds` to
    parse_failed with a clear message. Returns how many were reset.

    Safe for long parses: _set_chunk_progress writes processing_updated_at
    on every AI chunk completion (~30-60s apart), so a genuinely-working
    large PDF never hits the threshold.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=idle_threshold_seconds)
    result = await db.statements.update_many(
        {
            "status": "parsing",
            "$or": [
                {"processing_updated_at": {"$lt": cutoff}},
                {"processing_updated_at": {"$exists": False}},
            ],
        },
        {"$set": {
            "status": "parse_failed",
            "parse_error": reason,
            "processing_stage": "parse_failed",
            "processing_stage_label": PARSE_STAGES["parse_failed"]["label"],
            "processing_progress": 100,
            "processing_eta_seconds": 0,
            "processing_updated_at": datetime.now(timezone.utc),
        }},
    )
    return result.modified_count


async def stuck_statements_watchdog_loop():
    """Runs forever after startup. Once a minute it checks for statements
    that have been sitting in `parsing` with no progress heartbeat for
    longer than STUCK_WATCHDOG_SECONDS and marks them parse_failed.

    This catches the case where the backend is up (so the startup sweep
    never ran) but a task died from an unhandled exception, OOM, or a
    hung OpenAI request past the per-chunk timeout.
    """
    while True:
        try:
            n = await _mark_stuck_statements_failed(
                STUCK_WATCHDOG_SECONDS,
                "Parsing stalled with no progress — task likely died. Click Retry to re-run.",
            )
            if n:
                logger.info(f"Watchdog: reset {n} stalled parsing statement(s)")
        except Exception as e:
            logger.error(f"Watchdog iteration failed: {e}")
        await asyncio.sleep(STUCK_WATCHDOG_INTERVAL_SECONDS)


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


async def parse_pdf_statement(file_path: str, password: Optional[str] = None,
                              statement_type: str = "bank",
                              user_id: Optional[str] = None) -> list:
    """Parse a PDF statement. Propagates PdfPasswordRequired if encrypted and
    the supplied password is missing or incorrect."""
    text = extract_pdf_text(file_path, password=password)
    if not text or len(text.strip()) < 50:
        return []
    return await parse_statement_text_with_ai(text, statement_type, user_id=user_id)


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

        date = normalize_date(str(e["date"]).strip()[:10]) or str(e["date"]).strip()[:10]
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
            "category_name": (e.get("category_name") or "").strip() or None,
            "subcategory_name": (e.get("subcategory_name") or "").strip() or None,
        })

    # Sort by date for predictable display
    cleaned.sort(key=lambda x: x["date"])
    return cleaned


def _chunk_statement_text(text: str, chunk_chars: int = 4500, overlap: int = 800) -> list:
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


async def _ai_parse_chunk(chunk: str, statement_type: str, chunk_idx: int, chunk_total: int,
                          category_hint: str = "") -> list:
    """Send a single chunk to the AI and return the raw entry list.

    category_hint: a pre-formatted string of the user's available income and
    expense categories with their subcategories. If provided, the model is
    asked to classify each transaction into one of these categories so we
    get category/subcategory fields on every entry for free."""
    is_credit_card = (statement_type == "credit_card")

    # Conventions are spelled out explicitly because Indian bank statements
    # use a mix of (a) Dr/Cr suffix on the amount, (b) separate Withdrawal/
    # Deposit columns, and (c) inline narration markers. Credit-card
    # statements invert "credit"/"debit" relative to the cardholder's POV.
    is_loan = (statement_type == "loan")
    if is_credit_card:
        type_rules = """This is a CREDIT CARD statement.
- "transaction_type": "expense" for purchases, charges, fees, EMIs, cash advances, interest charged.
- "transaction_type": "income" ONLY for payments received from the cardholder, refunds, reversals, cashback credited, statement credits.
- The card statement may show charges as positive and payments as negative, or use "Dr"/"Cr" suffixes — read each row in context.
- Words like "PAYMENT RECEIVED", "PAYMENT - THANK YOU", "REFUND", "REVERSAL", "CASHBACK" mean income.
- Everything else (purchases at merchants, ATM cash, fees, GST, interest) is expense."""
    elif is_loan:
        type_rules = """This is a LOAN / MORTGAGE statement.
- "transaction_type": "expense" for EMI payments, interest charged/accrued, principal portion of EMI, processing fees, late payment charges, prepayment penalties, and any charges debited to the loan account.
- "transaction_type": "income" ONLY for disbursements (lender releasing loan amount), loan top-ups, and refunds/reversals of charges.
- A typical loan statement shows EMI rows broken into Principal + Interest — treat each line item separately if listed separately.
- Words like "EMI", "INTEREST CHARGED", "INT DR", "PRINCIPAL", "PROCESSING FEE", "LATE FEE", "FORECLOSURE" mean expense.
- Words like "DISBURSEMENT", "DISBURSAL", "LOAN TOP-UP", "REFUND" mean income."""
    else:
        type_rules = """This is a BANK statement (savings / current).
- "transaction_type": "income" for credits, deposits, salary, refunds, interest credited, money received via NEFT/IMPS/UPI/RTGS.
- "transaction_type": "expense" for debits, withdrawals, ATM cash, POS purchases, EMI, charges, money sent via NEFT/IMPS/UPI/RTGS.
- Many Indian bank statements suffix the amount with " Cr" (credit = money in = income) or " Dr" (debit = money out = expense). RESPECT THESE SUFFIXES — they are authoritative.
- Many statements have separate Withdrawal/Debit and Deposit/Credit columns. If the row has a value only in the Deposit/Credit column, it's income. If only in Withdrawal/Debit, it's expense.
- Words like "CREDIT BY", "DEPOSIT", "INTEREST CREDITED", "REFUND", "REVERSAL", "SALARY" mean income.
- Words like "DEBIT BY", "ATM WDL", "POS", "EMI", "CHARGES", "GST ON" mean expense."""

    prompt = f"""You are parsing chunk {chunk_idx + 1} of {chunk_total} from a {statement_type} statement.

CRITICAL: Extract EVERY single transaction line. Do not skip any. Do not
summarize. Do not deduplicate. Even if two rows look similar, if they
appear on separate lines they are separate transactions and must BOTH
appear in your output. First count how many transaction rows are in the
chunk, then make sure your "transactions" array has exactly that many
elements.

{type_rules}

Return STRICT JSON with this exact shape:
{{"transactions": [
  {{"date":"YYYY-MM-DD","description":"...","amount":1234.56,"transaction_type":"income","balance":98765.43,"raw_amount":"1,234.56 Cr","category_name":"Food & Dining","subcategory_name":"Restaurants"}},
  ...
]}}

Field rules:
- "date": MUST be YYYY-MM-DD. Convert from any source format (DD/MM/YYYY, DD-MMM-YYYY, etc.).
- "amount": positive number, the absolute transaction value.
- "transaction_type": "income" or "expense" — apply the rules above strictly.
- "balance": the running balance after the transaction, or null if not shown.
- "raw_amount": the amount text exactly as it appears in the statement, including any Dr/Cr suffix, parentheses, or sign. This is REQUIRED so we can verify your classification.
- "category_name" and "subcategory_name": MUST be chosen from the user's category list below. If nothing fits well, use "Other Income" or "Other Expenses" as category_name and leave subcategory_name as null. Do NOT invent categories.

{category_hint}

Skip only: headers, column names, page numbers, separator lines, summary
totals, and opening/closing balance lines that are not dated
transactions. Every DATED row with an amount is a transaction — include it.

If the chunk has no transaction lines, return {{"transactions": []}}.

STATEMENT CHUNK:
{chunk}
"""

    try:
        # 4-minute hard ceiling per chunk: a hung OpenAI connection cannot
        # freeze the whole parse — it raises TimeoutError, which the
        # parent wraps as a clean parse_failed.
        response = await asyncio.wait_for(
            async_openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You parse bank and credit card statements into structured JSON. You never skip transactions. You always respect Dr/Cr suffixes. Output JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
                max_tokens=16000,
                response_format={"type": "json_object"},
            ),
            timeout=AI_CHUNK_TIMEOUT_SECONDS,
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


async def _stamp_entries_with_account(entries: list, stmt: dict, user_id: str) -> list:
    """Stamp every parsed entry with deterministic fields copied from the
    statement doc, and resolve the AI-suggested category_name /
    subcategory_name into category_id / subcategory_id from the user's
    actual category list. Fields that can't be resolved stay as None.

    Fields stamped on every entry:
      - account_id, account_name, account_sub_type: from stmt / account
      - statement_type: from stmt
      - statement_id: link back to the source statement
      - category_id, subcategory_id: resolved from category_name/subcategory_name
    """
    if not entries:
        return entries

    account_id = stmt.get("account_id")
    account_name = stmt.get("account_name", "")
    account_sub_type = stmt.get("account_sub_type")
    statement_type = stmt.get("statement_type", "bank")
    statement_id = stmt.get("statement_id")

    # Build a name -> id map from the user's categories for resolution.
    try:
        cats = await db.categories.find(
            {"user_id": user_id}, {"_id": 0, "category_id": 1, "name": 1, "parent_id": 1}
        ).to_list(1000)
    except Exception:
        cats = []
    top_by_name = {c["name"].strip().lower(): c for c in cats if not c.get("parent_id")}
    # Subcategory map: (parent_id, sub_name_lower) -> sub
    sub_by_parent_and_name = {
        (c.get("parent_id"), c["name"].strip().lower()): c
        for c in cats if c.get("parent_id")
    }

    stamped = []
    for e in entries:
        cat_name = (e.get("category_name") or "").strip()
        sub_name = (e.get("subcategory_name") or "").strip()
        cat_id = None
        sub_id = None
        if cat_name:
            top = top_by_name.get(cat_name.lower())
            if top:
                cat_id = top["category_id"]
                if sub_name:
                    sub = sub_by_parent_and_name.get((cat_id, sub_name.lower()))
                    if sub:
                        sub_id = sub["category_id"]

        stamped.append({
            **e,
            "account_id": account_id,
            "account_name": account_name,
            "account_sub_type": account_sub_type,
            "statement_type": statement_type,
            "statement_id": statement_id,
            "category_id": cat_id,
            "subcategory_id": sub_id,
        })
    return stamped


# ─── Audit: verify the parse is complete and self-consistent ────────

_DATE_LINE_PATTERNS = [
    # DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY at line start (with optional spaces)
    re.compile(r'^\s*\d{1,2}[-/.]\d{1,2}[-/.](?:\d{2}|\d{4})\b'),
    # DD-MMM-YYYY, DD MMM YYYY
    re.compile(r'^\s*\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]{0,6}[-\s]\d{2,4}\b', re.IGNORECASE),
    # YYYY-MM-DD
    re.compile(r'^\s*\d{4}-\d{1,2}-\d{1,2}\b'),
]


def _count_dated_rows(text: str) -> int:
    """Conservatively count lines that look like a dated transaction row.
    Used as a lower-bound estimate for how many transactions SHOULD exist."""
    if not text:
        return 0
    count = 0
    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 8:
            continue
        if any(p.search(line) for p in _DATE_LINE_PATTERNS):
            # Exclude obvious non-txn rows like "Statement Period: 01-Mar-2026"
            lower = line.lower()
            if any(x in lower for x in ("statement period", "period from", "period:", "generated on", "printed on", "date of issue")):
                continue
            count += 1
    return count


def _audit_parsed_entries(source_text: str, entries: list, statement_type: str) -> dict:
    """Deterministic check that the AI parse looks complete and
    self-consistent. Returns:
      {
        "ok": bool,
        "issues": [str, ...],
        "expected_count": int,        # best-guess lower bound from source text
        "parsed_count": int,
        "balance_delta_mismatch": float|None,   # rupees off, if checkable
      }
    """
    issues = []
    parsed_count = len(entries)
    expected_count = _count_dated_rows(source_text)

    # 1) Row-count completeness check (tolerate +/- 5% or 3 rows)
    tolerance = max(3, int(expected_count * 0.05))
    if expected_count > 0 and parsed_count < expected_count - tolerance:
        issues.append(
            f"Parsed {parsed_count} rows but source text has at least "
            f"{expected_count} dated lines (gap = {expected_count - parsed_count})."
        )

    # 2) Balance-delta sanity check: if first and last entry both have
    # balance values, the sum of (credits - debits) in between should
    # roughly equal (last_balance - first_balance).
    with_balance = [e for e in entries if isinstance(e.get("balance"), (int, float))]
    if len(with_balance) >= 2:
        first_b = with_balance[0]["balance"]
        last_b = with_balance[-1]["balance"]
        # Expected delta = net inflow across those rows inclusive of last
        # but exclusive of first (since first_b is the balance AFTER the
        # first txn, so we tally from second onwards).
        tally = 0.0
        for e in with_balance[1:]:
            amt = e["amount"] if e["transaction_type"] == "income" else -e["amount"]
            tally += amt
        expected_delta = last_b - first_b
        off = abs(tally - expected_delta)
        threshold = max(1.0, abs(expected_delta) * 0.01)
        if off > threshold:
            issues.append(
                f"Balance delta check: sum(credits)-sum(debits) = {tally:,.2f} "
                f"but balance moved {expected_delta:,.2f} "
                f"(off by {off:,.2f})."
            )
        balance_mismatch = off if off > threshold else None
    else:
        balance_mismatch = None

    # 3) Empty description / zero amount sanity
    empties = sum(1 for e in entries if not e.get("description") or e.get("amount", 0) <= 0)
    if empties:
        issues.append(f"{empties} entries have empty description or zero amount.")

    return {
        "ok": len(issues) == 0,
        "issues": issues,
        "expected_count": expected_count,
        "parsed_count": parsed_count,
        "balance_delta_mismatch": balance_mismatch,
    }


async def _ai_correction_pass(source_text: str, current_entries: list,
                              issues: list, statement_type: str,
                              category_hint: str) -> list:
    """Run one corrective AI pass: feed the model the full source text,
    the current parse, and the list of audit issues; ask for a corrected
    full transaction list. Returns the corrected raw entry list (before
    post-processing)."""
    if not async_openai_client:
        return current_entries

    # Truncate source text for the correction prompt if huge — keep it
    # bounded to fit in one call. The audit issues list already points to
    # likely-wrong areas.
    src = source_text if len(source_text) <= 20000 else source_text[:20000] + "\n...[truncated]"

    prompt = f"""Your previous parse of this {statement_type} statement failed an audit.

Audit issues:
{chr(10).join(f'- {iss}' for iss in issues)}

Current parse (JSON array):
{json.dumps(current_entries[:400])}

Full statement text:
{src}

{category_hint}

Produce a CORRECTED complete list of transactions that fixes the audit
issues. Add any missed rows. Remove any rows that are not in the source.
Fix any income/expense misclassifications. Fix any wrong dates or
amounts.

Return STRICT JSON: {{"transactions": [ {{ same schema as before }} ]}}.
"""

    try:
        response = await asyncio.wait_for(
            async_openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a statement-parse auditor. Produce a corrected complete transaction list in JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
                max_tokens=16000,
                response_format={"type": "json_object"},
            ),
            timeout=AI_CHUNK_TIMEOUT_SECONDS,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        if isinstance(data, dict):
            txns = data.get("transactions") or []
            return txns if isinstance(txns, list) else current_entries
        return current_entries
    except Exception as e:
        logger.error(f"AI correction pass failed: {e}")
        return current_entries


async def _build_category_hint(user_id: Optional[str]) -> str:
    """Fetch the user's categories from the DB and render them as a prompt
    fragment the AI can classify against. Returns '' if no user."""
    if not user_id:
        return ""
    try:
        cats = await db.categories.find(
            {"user_id": user_id}, {"_id": 0, "category_id": 1, "name": 1, "category_type": 1, "parent_id": 1}
        ).to_list(1000)
    except Exception:
        return ""
    if not cats:
        return ""

    parents = {c["category_id"]: c for c in cats if not c.get("parent_id")}
    children_by_parent: dict = {}
    for c in cats:
        if c.get("parent_id"):
            children_by_parent.setdefault(c["parent_id"], []).append(c["name"])

    def _fmt_section(kind: str) -> str:
        lines = []
        for cid, c in parents.items():
            if c.get("category_type") != kind:
                continue
            subs = children_by_parent.get(cid, [])
            if subs:
                lines.append(f'  - "{c["name"]}"  (subcategories: {", ".join(subs)})')
            else:
                lines.append(f'  - "{c["name"]}"')
        return "\n".join(lines) or "  (none defined)"

    return (
        "User's category list — pick category_name/subcategory_name from these:\n"
        "INCOME CATEGORIES:\n"
        f"{_fmt_section('income')}\n"
        "EXPENSE CATEGORIES:\n"
        f"{_fmt_section('expense')}\n"
    )


async def parse_statement_text_with_ai(
    text: str,
    statement_type: str,
    user_id: Optional[str] = None,
    statement_id: Optional[str] = None,
) -> list:
    """Parse statement text using the AI in overlapping chunks so nothing is
    truncated, then deterministically post-process the merged entries to
    correct income/expense flips and dedupe overlap-induced duplicates.

    user_id, if provided, is used to fetch the user's category list so the
    AI can populate category/subcategory fields on every parsed entry.
    statement_id, if provided, is used to emit per-chunk progress updates
    so the UI progress bar reflects actual work completed (not fixed
    stage percentages)."""
    if not openai_client:
        logger.error("OpenAI not configured for statement parsing")
        return []

    category_hint = await _build_category_hint(user_id)

    chunks = _chunk_statement_text(text)
    total = len(chunks)
    logger.info(f"AI parsing statement: {len(text)} chars in {total} chunk(s) ({statement_type})")

    phase_started_at = datetime.now(timezone.utc)
    # Initial 0/N update so the progress bar snaps to the floor immediately.
    if statement_id and total > 0:
        await _set_chunk_progress(statement_id, 0, total, phase_started_at)

    # Run chunk calls concurrently — they are independent. Cap concurrency
    # so we don't blow through the OpenAI rate limit on very large
    # statements.
    sem = asyncio.Semaphore(6)
    done_counter = {"n": 0}

    async def _guarded(idx, chunk):
        async with sem:
            result = await _ai_parse_chunk(chunk, statement_type, idx, total, category_hint)
        done_counter["n"] += 1
        if statement_id:
            try:
                await _set_chunk_progress(statement_id, done_counter["n"], total, phase_started_at)
            except Exception as pe:
                logger.debug(f"progress update skipped: {pe}")
        return result

    results = await asyncio.gather(
        *[_guarded(i, c) for i, c in enumerate(chunks)]
    )
    all_entries: list = []
    for res in results:
        all_entries.extend(res)

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


def _parse_date_flexible(date_str: str):
    """Try multiple date formats and return a datetime or None."""
    if not date_str:
        return None
    date_str = date_str.strip()
    for fmt in [
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
        "%d-%b-%Y", "%d %b %Y", "%d-%B-%Y", "%d %B %Y",
        "%Y/%m/%d", "%d.%m.%Y", "%m-%d-%Y",
        "%d-%m-%y", "%d/%m/%y", "%m/%d/%y",
    ]:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.year < 100:
                dt = dt.replace(year=dt.year + 2000)
            return dt
        except ValueError:
            continue
    return None


def _extract_payee_from_description(desc: str) -> str:
    """Extract the merchant/payee name from bank statement descriptions.

    Bank statements use formats like:
    - UPI/407115789532/SWIGGY/ORDER/FOOD DELIVERY → swiggy
    - NEFT CR-ZERODHA BROKING LIMITED-NEFTCR123456 → zerodha broking limited
    - ATM/CASH WITHDRAWAL/SAMARQAND/ATM-001 → atm cash withdrawal
    - IMPS/TRANSFER/TO SAVINGS/ACCOUNT-987654 → transfer to savings
    - NEFT DR-HDFC BANK/TRANSFER/OWN ACCOUNT → hdfc bank transfer
    """
    if not desc:
        return ""
    d = desc.lower().strip()

    # UPI format: UPI/ref_number/MERCHANT/purpose/detail
    upi_match = re.match(r'upi/\d+/(.+)', d)
    if upi_match:
        parts = upi_match.group(1).split('/')
        # First part after ref is the merchant/payee name
        merchant = parts[0].strip() if parts else ""
        # Also include purpose keywords for better matching
        purpose_parts = [p.strip() for p in parts[1:] if p.strip() and not re.match(r'^\d+$', p.strip())]
        return f"{merchant} {' '.join(purpose_parts)}".strip()

    # NEFT CR format: NEFT CR-NAME-REFERENCE
    neft_cr_match = re.match(r'neft\s+cr[- ]+(.+?)(?:-[A-Z0-9]+\d{3,})?$', d, re.IGNORECASE)
    if neft_cr_match:
        name = neft_cr_match.group(1).strip()
        # Remove trailing reference numbers
        name = re.sub(r'[-\s]+[a-z]*\d{4,}$', '', name)
        return name

    # NEFT DR format: NEFT DR-NAME/purpose
    neft_dr_match = re.match(r'neft\s+dr[- ]+(.+)', d, re.IGNORECASE)
    if neft_dr_match:
        parts = neft_dr_match.group(1).split('/')
        return ' '.join(p.strip() for p in parts if p.strip() and not re.match(r'^\d+$', p.strip()))

    # ATM format
    if d.startswith('atm'):
        parts = d.split('/')
        return ' '.join(p.strip() for p in parts[:2] if p.strip())

    # IMPS format
    imps_match = re.match(r'imps/(.+)', d)
    if imps_match:
        parts = imps_match.group(1).split('/')
        return ' '.join(p.strip() for p in parts if p.strip() and not re.match(r'^\d+$', p.strip()) and not re.match(r'^account', p.strip()))

    return d


def _normalize_description(desc: str) -> set:
    """Return a set of normalized significant tokens from a description."""
    if not desc:
        return set()
    d = desc.lower()
    # Split on common delimiters
    tokens = set(re.split(r'[\s\-_./,;:@()\[\]]+', d))
    # Filter out short tokens, pure numbers, and common noise words
    noise = {'upi', 'neft', 'imps', 'atm', 'ref', 'cr', 'dr', 'the', 'for',
             'and', 'via', 'from', 'payment', 'transfer', 'transaction',
             'bill', 'order', 'merchant', 'purchase', 'p2p', 'autopay',
             'subscription', 'recharge', 'prepaid', 'food', 'delivery',
             'online', 'charges', 'trip', 'ride', 'store', 'agreement',
             'top', 'shop', 'premium'}
    return {t for t in tokens if len(t) >= 3 and not re.match(r'^\d+$', t) and t not in noise}


def _score_date_match(entry_date: str, ledger_date: str) -> int:
    """Score date similarity between a statement entry and ledger transaction."""
    if ledger_date == entry_date:
        return 40
    d1 = _parse_date_flexible(entry_date)
    d2 = _parse_date_flexible(ledger_date)
    if d1 and d2:
        diff = abs((d1 - d2).days)
        if diff == 0:
            return 40
        if diff <= 1:
            return 35
        if diff <= 2:
            return 25
        if diff <= 3:
            return 15
        if diff <= 5:
            return 8
    return 0


def _score_amount_match(entry_amt: float, ledger_amt: float) -> int:
    """Score amount similarity. Compares absolute values to handle sign
    differences between statement (always positive after post-processing)
    and ledger transactions (which may store as positive or negative).

    Exact match is worth 40 points. Near-exact (within 5%) gets partial
    credit scaled by closeness."""
    a = abs(entry_amt)
    b = abs(ledger_amt)
    if abs(a - b) < 0.01:
        return 40
    # Within 1% difference
    denom = max(a, b, 1)
    pct_diff = abs(a - b) / denom
    if pct_diff < 0.01:
        return 35
    # Within 5% difference (handles rounding, fees, taxes)
    if pct_diff < 0.05:
        return 20
    # Within 10% — very weak signal but still non-zero
    if pct_diff < 0.10:
        return 10
    return 0


def _score_description_match(entry_desc: str, ledger_desc: str) -> int:
    """Score description similarity using multiple strategies:

    1. Word overlap between normalized tokens
    2. Payee extraction and comparison
    3. Substring containment
    4. Key merchant name matching

    Bank statement descriptions are often verbose with transaction IDs, bank
    codes, and reference numbers (e.g. ``UPI/407115789532/SWIGGY/...``) while
    ledger descriptions are clean (``UPI SWIGGY`` or ``Swiggy Food Order``).
    """
    if not entry_desc or not ledger_desc:
        return 0
    el = entry_desc.lower()
    ll = ledger_desc.lower()

    best_score = 0

    # Strategy 1: Extract payee and compare
    entry_payee = _extract_payee_from_description(entry_desc)
    ledger_payee = _extract_payee_from_description(ledger_desc)

    if entry_payee and ledger_payee:
        ep_tokens = _normalize_description(entry_payee)
        lp_tokens = _normalize_description(ledger_payee)
        if ep_tokens and lp_tokens:
            overlap = ep_tokens & lp_tokens
            if overlap:
                # Strong payee match
                score = min(20, len(overlap) * 7)
                best_score = max(best_score, score)
            # Check if one payee contains the other
            if entry_payee in ledger_payee or ledger_payee in entry_payee:
                best_score = max(best_score, 20)

    # Strategy 2: Normalized token overlap
    entry_tokens = _normalize_description(entry_desc)
    ledger_tokens = _normalize_description(ledger_desc)
    if entry_tokens and ledger_tokens:
        overlap = entry_tokens & ledger_tokens
        if overlap:
            score = min(20, len(overlap) * 5)
            best_score = max(best_score, score)

    # Strategy 3: Raw word overlap (less filtering)
    entry_words = set(re.split(r'[\s\-_./,;:@()]+', el))
    ledger_words = set(re.split(r'[\s\-_./,;:@()]+', ll))
    significant = {w for w in (entry_words & ledger_words) if len(w) >= 3}
    if significant:
        word_score = min(20, len(significant) * 5)
        best_score = max(best_score, word_score)

    # Strategy 4: Substring containment — all significant words of shorter
    # description appear in the longer one
    shorter_words = ledger_words if len(ll) <= len(el) else entry_words
    longer_text = el if len(ll) <= len(el) else ll
    sig_shorter = {w for w in shorter_words if len(w) >= 3}
    if sig_shorter and all(w in longer_text for w in sig_shorter):
        best_score = max(best_score, min(20, len(sig_shorter) * 7))

    # Strategy 5: Direct substring match of key merchant names
    # If the ledger description (typically short) appears directly in the entry
    # description or vice versa
    if len(ll) >= 4 and ll in el:
        best_score = 20
    if len(el) >= 4 and el in ll:
        best_score = 20

    return best_score


def _determine_entry_type(entry: dict) -> str:
    """Determine if a statement entry is a debit or credit.
    Uses transaction_type field if available, otherwise infers from context."""
    txn_type = entry.get("transaction_type", "").lower()
    if txn_type in ("credit", "income", "cr"):
        return "credit"
    if txn_type in ("debit", "expense", "dr"):
        return "debit"
    # If the entry has explicit debit/credit fields from parsing
    if entry.get("credit") and not entry.get("debit"):
        return "credit"
    if entry.get("debit") and not entry.get("credit"):
        return "debit"
    return "unknown"


def _determine_ledger_type(ltxn: dict, account_id: str) -> str:
    """Determine if a ledger transaction is a debit or credit relative to the account."""
    txn_type = ltxn.get("transaction_type", "").lower()
    # If this is a transfer TO this account, it's a credit
    if ltxn.get("to_account_id") == account_id and ltxn.get("account_id") != account_id:
        return "credit"
    if txn_type in ("income", "credit"):
        return "credit"
    if txn_type in ("expense", "debit", "transfer"):
        # Transfer FROM this account is a debit
        return "debit"
    return "unknown"


def _find_best_match(entry: dict, candidates: list, account_id: str = "") -> tuple:
    """Find the best matching ledger transaction for a statement entry.

    Uses a 3-factor scoring system: date (40pts) + amount (40pts) + description (20pts).
    Threshold is 40 (date+amount exact is enough; amount alone with description is enough).

    Also applies transaction type filtering: prevents matching a debit entry with a
    credit ledger transaction unless types are unknown."""
    best_match = None
    best_score = 0
    entry_type = _determine_entry_type(entry)

    for ltxn in candidates:
        # Transaction type filter: skip obvious mismatches
        ledger_type = _determine_ledger_type(ltxn, account_id)
        if entry_type != "unknown" and ledger_type != "unknown" and entry_type != ledger_type:
            continue

        score = (
            _score_date_match(entry["date"], ltxn["date"])
            + _score_amount_match(entry["amount"], ltxn["amount"])
            + _score_description_match(entry.get("description", ""), ltxn.get("description", ""))
        )

        # Lower threshold: 40 means date-match(40) alone works, or amount(40) alone,
        # or date-close(35) + any description(5+), etc.
        if score > best_score and score >= 40:
            best_score = score
            best_match = ltxn
    return best_match, best_score


def reconcile_entries(parsed: list, ledger_txns: list, account_id: str) -> dict:
    """Reconcile statement entries against ledger transactions.

    Uses a two-pass approach:
    Pass 1: Match high-confidence pairs (score >= 60) greedily
    Pass 2: Match remaining entries with lower threshold (score >= 40)

    This prevents low-confidence matches from stealing candidates from
    entries that would have matched them at high confidence."""
    matched = []
    missing_from_ledger = []
    conflicts = []
    ledger_unmatched = list(ledger_txns)

    # Build all match scores first for optimal assignment
    # Each entry gets a list of (candidate, score) pairs
    unmatched_entries = list(parsed)

    # Pass 1: High-confidence matches (score >= 60)
    still_unmatched = []
    for entry in unmatched_entries:
        best_match = None
        best_score = 0
        for ltxn in ledger_unmatched:
            entry_type = _determine_entry_type(entry)
            ledger_type = _determine_ledger_type(ltxn, account_id)
            if entry_type != "unknown" and ledger_type != "unknown" and entry_type != ledger_type:
                continue
            score = (
                _score_date_match(entry["date"], ltxn["date"])
                + _score_amount_match(entry["amount"], ltxn["amount"])
                + _score_description_match(entry.get("description", ""), ltxn.get("description", ""))
            )
            if score > best_score and score >= 60:
                best_score = score
                best_match = ltxn

        if best_match:
            amt_match = abs(abs(entry["amount"]) - abs(best_match["amount"])) < 0.01
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
            still_unmatched.append(entry)

    # Pass 2: Lower-confidence matches (score >= 40) for remaining entries
    for entry in still_unmatched:
        best_match, best_score = _find_best_match(entry, ledger_unmatched, account_id)

        if best_match:
            amt_match = abs(abs(entry["amount"]) - abs(best_match["amount"])) < 0.01
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
async def gmail_connect(request: Request, platform: Optional[str] = None, user: dict = Depends(get_current_user)):
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
        "platform": platform,  # "ios" for mobile app
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })
    return {"auth_url": auth_url}


@app.get("/api/gmail/callback")
async def gmail_callback(request: Request, code: str = None, state: str = None, error: str = None):
    frontend = _get_frontend_url(request)

    # Helper: redirect to iOS app or web frontend based on platform stored in state
    def _redirect(path_or_params: str, is_error: bool = False, state_doc: dict = None):
        is_ios = state_doc.get("platform") == "ios" if state_doc else False
        if is_ios:
            scheme = "spentyai://gmail-callback"
            if is_error:
                return RedirectResponse(f"{scheme}?error={path_or_params}")
            return RedirectResponse(f"{scheme}?status=connected")
        if is_error:
            return RedirectResponse(f"{frontend}/?gmail_error={path_or_params}")
        return RedirectResponse(f"{frontend}{path_or_params}")

    if error:
        logger.error(f"Gmail OAuth error: {error}")
        return _redirect(error, is_error=True)

    if not code or not state:
        return _redirect("missing_params", is_error=True)

    state_doc = await db.gmail_oauth_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        return _redirect("invalid_state", is_error=True)

    expires_at = state_doc["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        return _redirect("state_expired", is_error=True, state_doc=state_doc)

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

        return _redirect("/email-sync?gmail=connected", state_doc=state_doc)

    except Exception as e:
        logger.error(f"Gmail OAuth token exchange failed: {e}")
        return _redirect("token_exchange_failed", is_error=True, state_doc=state_doc)


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
async def outlook_connect(request: Request, platform: Optional[str] = None, user: dict = Depends(get_current_user)):
    redirect_uri = get_outlook_redirect_uri(request)
    state = secrets.token_urlsafe(32)

    await db.outlook_oauth_states.insert_one({
        "state": state,
        "user_id": user["user_id"],
        "redirect_uri": redirect_uri,
        "platform": platform,  # "ios" for mobile app
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

    # Helper: redirect to iOS app or web frontend based on platform stored in state
    def _redirect(path_or_params: str, is_error: bool = False, state_doc: dict = None):
        is_ios = state_doc.get("platform") == "ios" if state_doc else False
        if is_ios:
            scheme = "spentyai://outlook-callback"
            if is_error:
                return RedirectResponse(f"{scheme}?error={path_or_params}")
            return RedirectResponse(f"{scheme}?status=connected")
        if is_error:
            return RedirectResponse(f"{frontend}/?outlook_error={path_or_params}")
        return RedirectResponse(f"{frontend}{path_or_params}")

    if error:
        logger.error(f"Outlook OAuth error: {error}")
        return _redirect(error, is_error=True)

    if not code or not state:
        return _redirect("missing_params", is_error=True)

    state_doc = await db.outlook_oauth_states.find_one({"state": state}, {"_id": 0})
    if not state_doc:
        return _redirect("invalid_state", is_error=True)

    expires_at = state_doc["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        return _redirect("state_expired", is_error=True, state_doc=state_doc)

    await db.outlook_oauth_states.delete_one({"state": state})
    user_id = state_doc["user_id"]

    try:
        tokens = await _exchange_outlook_token(code, state_doc["redirect_uri"])
        if not tokens:
            return _redirect("token_exchange_failed", is_error=True, state_doc=state_doc)

        profile = await _fetch_outlook_profile(tokens["access_token"])
        if not profile:
            return _redirect("profile_fetch_failed", is_error=True, state_doc=state_doc)

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
        return _redirect("/email-sync?outlook=connected", state_doc=state_doc)

    except Exception as e:
        logger.error(f"Outlook OAuth callback failed: {e}")
        return _redirect("token_exchange_failed", is_error=True, state_doc=state_doc)


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
            await db.outlook_sync_config.update_one(
                {"user_id": user_id, "outlook_email": outlook_email},
                {"$set": {"syncing": False, "last_error": "Outlook credentials expired or missing. Please reconnect."}}
            )
            return

        headers = {"Authorization": f"Bearer {access_token}"}
        # Normalise the sync date into ISO 8601 datetime for Microsoft Graph OData filter
        outlook_date_str = sync_from_date
        try:
            parsed_dt = datetime.fromisoformat(sync_from_date.replace("Z", "+00:00"))
            outlook_date_str = parsed_dt.strftime("%Y-%m-%dT00:00:00Z")
        except (ValueError, AttributeError):
            # Fallback: strip time component and rebuild
            clean = sync_from_date.split("T")[0].replace("/", "-")
            outlook_date_str = f"{clean}T00:00:00Z"
        filter_query = f"receivedDateTime ge {outlook_date_str}"
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

                # Start AI processing in parallel after first batch
                if total_fetched >= 50:
                    asyncio.create_task(process_outlook_pending_emails(user_id, outlook_email))

        logger.info(f"Synced {total_fetched} Outlook emails for {user_id}/{outlook_email}")

        await db.outlook_sync_config.update_one(
            {"user_id": user_id, "outlook_email": outlook_email},
            {"$set": {"syncing": False, "last_sync_at": datetime.now(timezone.utc), "last_sync_count": total_fetched, "last_error": None}}
        )

        # Process any remaining pending emails after fetch completes
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

    # --- Layer 2: Check sender→account mapping from past approvals ---
    if not account_id:
        from_email = (email_doc.get("from_email") or "").strip().lower()
        if from_email:
            sender_mapping = await db.sender_account_mappings.find_one(
                {"user_id": user_id, "from_email": from_email},
                sort=[("confidence_count", -1)],
            )
            if sender_mapping:
                # Verify the mapped account still exists
                mapped_acc = await db.accounts.find_one(
                    {"account_id": sender_mapping["account_id"], "user_id": user_id}
                )
                if mapped_acc:
                    account_id = sender_mapping["account_id"]
                    logger.info(f"Sender mapping hit: {from_email} -> {mapped_acc['name']} (confidence: {sender_mapping['confidence_count']})")

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
    if not account_id and detected_bank_name:
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
        # Check if an account with this exact name already exists for this user
        existing_account = await db.accounts.find_one({
            "user_id": user_id,
            "name": detected_bank_name[:100]
        }, {"_id": 0, "account_id": 1})

        if existing_account:
            account_id = existing_account["account_id"]
            logger.info(f"Found existing account with same name '{detected_bank_name}' -> {account_id}, skipping duplicate creation")
        else:
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
                "currency": "INR",  # Default currency, can be changed by user
                "balance": 0,
                "description": "Auto-detected from email sync. Please review and update.",
                "balance_as_of_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "needs_opening_balance": True,  # Flag to prompt user during approval
                "ai_created": True,
                "created_at": datetime.now(timezone.utc),
            }
            await db.accounts.insert_one(new_account)
            del new_account["_id"]
            account_id = new_account["account_id"]
            logger.info(f"Auto-created bank account: {detected_bank_name} -> {account_id}")
    
    # If still no account_id, leave it as None — user will assign during pending review
    if not account_id:
        logger.info("No account matched and no bank detected — leaving account_id as None for user review")

    # --- Category pre-fill from historical approved transactions ---
    prefilled_category = await _prefill_category_from_history(
        user_id,
        description=result.get("description", ""),
        payee=result.get("payee", ""),
    )
    final_category_id = prefilled_category.get("category_id") or result.get("category_id")
    final_subcategory_id = prefilled_category.get("subcategory_id") or result.get("subcategory_id")

    # --- Recurring detection: merge AI result with server-side vendor/keyword detection ---
    ai_is_recurring = result.get("is_recurring", False)
    ai_frequency = result.get("recurring_frequency")
    ai_recurrence_date = result.get("recurrence_date")

    if not ai_is_recurring:
        # Server-side fallback: check vendor name and email content for recurring patterns
        email_content = f"{email_doc.get('subject', '')} {email_doc.get('body_text', '')[:2000]}"
        vendor_detection = _detect_recurring_from_vendor_and_content(
            result.get("description", ""), email_content
        )
        if vendor_detection["is_recurring"]:
            ai_is_recurring = True
            ai_frequency = ai_frequency or vendor_detection["recurrence_frequency"]
            ai_recurrence_date = ai_recurrence_date or vendor_detection["recurrence_date"]

    # If recurrence_date not detected, try to extract from the transaction date
    if ai_is_recurring and not ai_recurrence_date:
        txn_date_str = result.get("date", "")
        if txn_date_str:
            try:
                ai_recurrence_date = int(txn_date_str.split("-")[2])
            except (IndexError, ValueError):
                pass

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
        "category_id": final_category_id,
        "subcategory_id": final_subcategory_id,
        "category_prefilled": bool(prefilled_category),
        "description": result.get("description", ""),
        "payment_method": result.get("payment_method"),
        "is_recurring": ai_is_recurring,
        "recurring_frequency": ai_frequency,
        "recurrence_date": ai_recurrence_date,
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


async def _create_mandate_from_ai_result(
    user_id: str, email_doc: dict, result: dict, source_provider: str
) -> bool:
    """Persist a mandate detected in an email. Returns True if a new
    mandate was stored (False on duplicate / missing fields)."""
    merchant = (result.get("mandate_merchant") or "").strip()
    amount = result.get("mandate_amount") or 0
    frequency = (result.get("mandate_frequency") or "monthly").lower()
    mandate_type = (result.get("mandate_type") or "other").lower()

    # Require enough data to make the mandate meaningful for projection.
    if not merchant or not amount or amount <= 0:
        return False

    # Try to match the debit account from the AI result or fallback to a
    # per-user default if the AI detected a specific bank.
    account_id = result.get("account_id")
    detected_bank_name = result.get("detected_bank_name")

    # De-dupe on (user, merchant, amount, frequency) so repeated mandate
    # confirmation emails don't create piles of rows.
    existing = await db.mandates.find_one({
        "user_id": user_id,
        "merchant": merchant,
        "amount": float(amount),
        "frequency": frequency,
        "status": {"$ne": "cancelled"},
    })
    if existing:
        # Keep latest email link for context but don't duplicate.
        await db.mandates.update_one(
            {"mandate_id": existing["mandate_id"]},
            {"$set": {
                "source_email_id": email_doc.get("email_id"),
                "source_email_subject": email_doc.get("subject"),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        await db.synced_emails.update_one(
            {"email_id": email_doc["email_id"]},
            {"$set": {"ai_status": "mandate_detected", "ai_result": result}},
        )
        return False

    now = datetime.now(timezone.utc)
    mandate_doc = {
        "mandate_id": f"mnd_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "merchant": merchant,
        "amount": float(amount),
        "currency": (result.get("currency") or "INR").upper(),
        "frequency": frequency,
        "mandate_type": mandate_type,
        "start_date": result.get("mandate_start_date") or result.get("date"),
        "end_date": result.get("mandate_end_date"),
        "debit_day": result.get("mandate_debit_day"),
        "account_id": account_id,
        "detected_bank_name": detected_bank_name,
        "status": "pending_review",
        "source": f"email:{source_provider}",
        "source_email_id": email_doc.get("email_id"),
        "source_email_subject": email_doc.get("subject"),
        "created_at": now,
        "updated_at": now,
    }
    await db.mandates.insert_one(mandate_doc)
    await db.synced_emails.update_one(
        {"email_id": email_doc["email_id"]},
        {"$set": {"ai_status": "mandate_detected", "ai_result": result}},
    )
    logger.info(f"Mandate detected from email: {merchant} {amount} {frequency}")
    return True


async def _prefill_category_from_history(user_id: str, description: str, payee: str = "") -> dict:
    """Look up previously approved transactions to pre-fill category/subcategory.

    Strategy:
      1. Exact description match (case-insensitive, trimmed).
      2. Exact payee match (if payee is provided).
      3. Fuzzy match — check if significant keywords from the description or payee
         appear inside a past transaction's description (e.g., both contain "Amazon").

    Returns a dict with category_id, subcategory_id (any of which may be None)
    taken from the most recent approved match.  Returns empty dict when no match.
    """
    desc_clean = (description or "").strip()
    payee_clean = (payee or "").strip()

    if not desc_clean and not payee_clean:
        return {}

    _CATEGORY_FIELDS = {"category_id": 1, "subcategory_id": 1, "description": 1, "payee": 1}

    # --- 1. Exact description match (case-insensitive) ---
    if desc_clean:
        exact_match = await db.transactions.find_one(
            {
                "user_id": user_id,
                "status": "approved",
                "description": {"$regex": f"^{re.escape(desc_clean)}$", "$options": "i"},
            },
            {**_CATEGORY_FIELDS, "_id": 0},
            sort=[("created_at", -1)],
        )
        if exact_match and exact_match.get("category_id"):
            logger.info(f"Category pre-fill: exact description match for '{desc_clean}'")
            return {"category_id": exact_match.get("category_id"),
                    "subcategory_id": exact_match.get("subcategory_id")}

    # --- 2. Exact payee match ---
    if payee_clean:
        payee_match = await db.transactions.find_one(
            {
                "user_id": user_id,
                "status": "approved",
                "payee": {"$regex": f"^{re.escape(payee_clean)}$", "$options": "i"},
                "category_id": {"$ne": None},
            },
            {**_CATEGORY_FIELDS, "_id": 0},
            sort=[("created_at", -1)],
        )
        if payee_match:
            logger.info(f"Category pre-fill: exact payee match for '{payee_clean}'")
            return {"category_id": payee_match.get("category_id"),
                    "subcategory_id": payee_match.get("subcategory_id")}

    # --- 3. Fuzzy / keyword match ---
    # Extract significant words (>=3 chars) from description and payee
    keywords = set()
    for text in [desc_clean, payee_clean]:
        if text:
            keywords.update(w for w in re.split(r'[\s\-_./,]+', text.lower()) if len(w) >= 3)
    # Remove very common noise words
    noise = {"the", "for", "from", "payment", "paid", "transaction", "via", "ref", "upi", "imps",
             "neft", "rtgs", "debit", "credit", "card", "bank", "account", "transfer", "towards"}
    keywords -= noise

    if keywords:
        # Build an $or regex query for any keyword appearing in the description
        keyword_regexes = [{"description": {"$regex": re.escape(kw), "$options": "i"}} for kw in list(keywords)[:5]]
        fuzzy_match = await db.transactions.find_one(
            {
                "user_id": user_id,
                "status": "approved",
                "category_id": {"$ne": None},
                "$or": keyword_regexes,
            },
            {**_CATEGORY_FIELDS, "_id": 0},
            sort=[("created_at", -1)],
        )
        if fuzzy_match:
            logger.info(f"Category pre-fill: fuzzy keyword match (keywords={keywords})")
            return {"category_id": fuzzy_match.get("category_id"),
                    "subcategory_id": fuzzy_match.get("subcategory_id")}

    return {}


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
        account_names = [
            f"- account_id: {a['account_id']} | name: {a['name']} | type: {a['account_type']}/{a.get('sub_type', '')} | balance: {a.get('opening_balance', 0)}"
            for a in accounts
        ]
        category_info = await _get_category_info_for_ai(user_id)

        # Load sender->account mappings for AI context
        sender_mappings = await db.sender_account_mappings.find(
            {"user_id": user_id}, {"_id": 0}
        ).sort("confidence_count", -1).limit(50).to_list(50)

        for email_doc in pending_emails:
            try:
                result = await analyze_email_with_ai(email_doc, account_names, category_info, sender_mappings=sender_mappings)

                if result and result.get("is_mandate"):
                    await _create_mandate_from_ai_result(user_id, email_doc, result, "outlook")
                elif result and result.get("is_transaction"):
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


@app.get("/api/email/debug-samples")
async def email_debug_samples(email: str = "", user: dict = Depends(get_current_user)):
    """Debug: Return sample emails by status to diagnose 0 transactions issue."""
    user_id = user["user_id"]

    return await _email_debug_samples_impl(user_id)


@app.get("/api/dev/email-debug/{user_email}")
async def email_debug_noauth(user_email: str, key: str = ""):
    """Temporary no-auth debug endpoint — will be removed after investigation."""
    if key != "spenty-debug-2026":
        raise HTTPException(status_code=403, detail="Invalid key")
    user_doc = await db.users.find_one({"email": user_email}, {"_id": 0, "user_id": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return await _email_debug_samples_impl(user_doc["user_id"])


@app.post("/api/dev/reset-data/{user_email}")
async def dev_reset_data(user_email: str, key: str = ""):
    """Temporary no-auth reset endpoint — will be removed after testing."""
    if key != "spenty-debug-2026":
        raise HTTPException(status_code=403, detail="Invalid key")
    user_doc = await db.users.find_one({"email": user_email}, {"_id": 0, "user_id": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user_doc["user_id"]

    await db.transactions.delete_many({"user_id": user_id})
    await db.accounts.delete_many({"user_id": user_id})
    await db.categories.delete_many({"user_id": user_id})
    await db.invoices.delete_many({"user_id": user_id})
    await db.bills.delete_many({"user_id": user_id})
    await db.customers.delete_many({"user_id": user_id})
    await db.vendors.delete_many({"user_id": user_id})
    await db.mandates.delete_many({"user_id": user_id})
    await db.statements.delete_many({"user_id": user_id})
    await db.synced_sms.delete_many({"user_id": user_id})
    await db.receipts.delete_many({"user_id": user_id})
    await db.email_archives.delete_many({"user_id": user_id})
    await db.feature_requests.delete_many({"user_id": user_id})
    await db.tax_summaries.delete_many({"user_id": user_id})
    await db.tax_summary_transactions.delete_many({"user_id": user_id})
    await db.payment_orders.delete_many({"user_id": user_id})
    await db.ai_chat_history.delete_many({"user_id": user_id})
    await db.gmail_tokens.delete_many({"user_id": user_id})
    await db.outlook_tokens.delete_many({"user_id": user_id})
    await db.synced_emails.delete_many({"user_id": user_id})
    await db.email_sync_config.delete_many({"user_id": user_id})
    await db.outlook_sync_config.delete_many({"user_id": user_id})
    # Clean up processing locks so stuck emails don't block future processing
    await db.processing_locks.delete_many({"lock_key": {"$regex": f"^{user_id}:"}})
    await seed_default_data(user_id)

    return {"message": "All data reset successfully."}


@app.post("/api/dev/retry-emails/{user_email}")
async def dev_retry_emails(user_email: str, key: str = ""):
    """Temporary no-auth endpoint to trigger email retry processing."""
    if key != "spenty-debug-2026":
        raise HTTPException(status_code=403, detail="Invalid key")
    user_doc = await db.users.find_one({"email": user_email}, {"_id": 0, "user_id": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user_doc["user_id"]

    # Reset failed emails back to pending so they get reprocessed
    result = await db.synced_emails.update_many(
        {"user_id": user_id, "ai_status": "failed"},
        {"$set": {"ai_status": "pending"}, "$unset": {"ai_error": ""}}
    )
    return {"message": f"Reset {result.modified_count} failed emails to pending for reprocessing."}


@app.post("/api/dev/process-emails/{user_email}")
async def dev_process_emails(user_email: str, key: str = ""):
    """Temporary no-auth endpoint to trigger AI processing of pending emails."""
    if key != "spenty-debug-2026":
        raise HTTPException(status_code=403, detail="Invalid key")
    user_doc = await db.users.find_one({"email": user_email}, {"_id": 0, "user_id": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    user_id = user_doc["user_id"]

    # Clear any stale processing locks
    await db.processing_locks.delete_many({"lock_key": {"$regex": f"^{user_id}:"}})

    # Count pending emails
    pending_count = await db.synced_emails.count_documents({"user_id": user_id, "ai_status": {"$in": ["pending", "failed"]}})

    # Trigger processing in background
    asyncio.create_task(process_pending_emails(user_id, user_email))

    return {"message": f"Started AI processing for {pending_count} pending emails."}


async def _email_debug_samples_impl(user_id: str):
    """Debug: Return sample emails by status to diagnose 0 transactions issue."""

    # Get counts by status
    status_counts = {}
    for status in ["processed", "no_transaction", "failed", "pending", "processing"]:
        count = await db.synced_emails.count_documents({"user_id": user_id, "ai_status": status})
        status_counts[status] = count

    # Get 3 sample failed emails (subject + error)
    failed_samples = await db.synced_emails.find(
        {"user_id": user_id, "ai_status": "failed"},
        {"_id": 0, "email_id": 1, "subject": 1, "from_email": 1, "ai_error": 1, "date": 1}
    ).limit(5).to_list(5)

    # Get 3 sample no_transaction emails (subject + AI reason)
    no_txn_samples = await db.synced_emails.find(
        {"user_id": user_id, "ai_status": "no_transaction"},
        {"_id": 0, "email_id": 1, "subject": 1, "from_email": 1, "ai_result.reason": 1, "ai_result.is_transaction": 1, "date": 1}
    ).limit(5).to_list(5)

    # Get 3 sample processed emails (these should be transactions)
    processed_samples = await db.synced_emails.find(
        {"user_id": user_id, "ai_status": "processed"},
        {"_id": 0, "email_id": 1, "subject": 1, "from_email": 1, "ai_result.is_transaction": 1, "ai_result.amount": 1, "ai_result.description": 1, "date": 1}
    ).limit(5).to_list(5)

    # Check for any financial-looking subjects in failed emails
    financial_keywords = ["debit", "credit", "payment", "upi", "transfer", "salary", "refund", "emi", "recharge", "transaction"]
    financial_failed = await db.synced_emails.find(
        {"user_id": user_id, "ai_status": "failed"},
        {"_id": 0, "subject": 1, "from_email": 1, "ai_error": 1}
    ).to_list(300)
    financial_in_failed = [
        e for e in financial_failed
        if any(kw in (e.get("subject") or "").lower() for kw in financial_keywords)
    ]

    return {
        "status_counts": status_counts,
        "failed_samples": failed_samples,
        "no_transaction_samples": no_txn_samples,
        "processed_samples": processed_samples,
        "financial_emails_in_failed_count": len(financial_in_failed),
        "financial_emails_in_failed_samples": financial_in_failed[:10],
    }


@app.get("/api/source/{source_id}")
async def get_source_content(source_id: str, user: dict = Depends(get_current_user)):
    """Return the original email or SMS content for a given source_email_id or source_sms_id."""
    user_id = user["user_id"]

    # Try email first (em_ prefix)
    if source_id.startswith("em_"):
        doc = await db.synced_emails.find_one(
            {"email_id": source_id, "user_id": user_id}, {"_id": 0}
        )
        if not doc:
            raise HTTPException(status_code=404, detail="Email source not found")
        return {
            "type": "email",
            "source_id": doc["email_id"],
            "subject": doc.get("subject", ""),
            "from": doc.get("from_email", ""),
            "date": doc.get("date", ""),
            "snippet": doc.get("snippet", ""),
            "body": doc.get("body_text", doc.get("snippet", "")),
        }

    # Try SMS (sms_ prefix)
    if source_id.startswith("sms_"):
        doc = await db.synced_sms.find_one(
            {"sms_id": source_id, "user_id": user_id}, {"_id": 0}
        )
        if not doc:
            raise HTTPException(status_code=404, detail="SMS source not found")
        return {
            "type": "sms",
            "source_id": doc["sms_id"],
            "sender": doc.get("sender", ""),
            "date": doc.get("timestamp", ""),
            "body": doc.get("body", ""),
        }

    raise HTTPException(status_code=400, detail="Invalid source ID format")


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
            await db.email_sync_config.update_one(
                {"user_id": user_id, "gmail_email": gmail_email},
                {"$set": {"syncing": False, "last_error": "Gmail credentials expired or missing. Please reconnect."}}
            )
            return

        service = build("gmail", "v1", credentials=creds)

        # Gmail search requires dates in YYYY/MM/DD format, not ISO 8601.
        # The iOS app sends ISO 8601 (e.g. "2025-01-01T00:00:00Z"), so convert it.
        gmail_date = sync_from_date
        try:
            parsed_dt = datetime.fromisoformat(sync_from_date.replace("Z", "+00:00"))
            gmail_date = parsed_dt.strftime("%Y/%m/%d")
        except (ValueError, AttributeError):
            # If it's already in YYYY/MM/DD or another format, try to clean it up
            clean = sync_from_date.split("T")[0].replace("-", "/")
            if len(clean.split("/")) == 3:
                gmail_date = clean
        logger.info(f"Gmail sync query date: '{sync_from_date}' -> '{gmail_date}'")

        query = f"after:{gmail_date}"
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

            # Start AI processing in parallel after first batch of emails
            # The lock mechanism inside process_pending_emails prevents duplicates
            if total_fetched >= 50:
                existing_lock = await db.processing_locks.find_one(
                    {"lock_key": f"{user_id}:{gmail_email or 'all'}", "active": True}
                )
                if not existing_lock:
                    logger.info(f"Starting concurrent AI processing while still fetching ({total_fetched} emails fetched so far)")
                    asyncio.create_task(process_pending_emails(user_id, gmail_email))

            # Safety: check if tokens were revoked mid-sync (e.g. user reset data)
            token_still_valid = await db.gmail_tokens.find_one(
                {"user_id": user_id, "gmail_email": gmail_email, "connected": True}
            )
            if not token_still_valid:
                logger.info(f"Gmail token removed mid-sync for {user_id}/{gmail_email} — aborting")
                break

        logger.info(f"Synced {total_fetched} emails for {user_id}/{gmail_email}")

        await db.email_sync_config.update_one(
            {"user_id": user_id, "gmail_email": gmail_email},
            {"$set": {"syncing": False, "last_sync_at": datetime.now(timezone.utc), "last_sync_count": total_fetched, "last_error": None}}
        )

        # Process any remaining pending emails after fetch completes
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
    # Guard: don't process if Gmail is not connected (e.g. after reset)
    if gmail_email:
        token_exists = await db.gmail_tokens.find_one(
            {"user_id": user_id, "gmail_email": gmail_email, "connected": True}
        )
        if not token_exists:
            logger.info(f"Gmail not connected for {user_id}/{gmail_email} — skipping email processing")
            return
    else:
        # If no specific email, check if ANY gmail token exists for this user
        any_token = await db.gmail_tokens.find_one({"user_id": user_id, "connected": True})
        any_outlook = await db.outlook_tokens.find_one({"user_id": user_id, "connected": True})
        if not any_token and not any_outlook:
            logger.info(f"No email accounts connected for {user_id} — skipping email processing")
            return

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
        pending_emails = await db.synced_emails.find(query, {"_id": 0}).limit(500).to_list(500)

        if not async_openai_client:
            logger.error("OpenAI async client not configured — cannot process emails")
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
        account_names = [
            f"- account_id: {a['account_id']} | name: {a['name']} | type: {a['account_type']}/{a.get('sub_type', '')} | balance: {a.get('opening_balance', 0)}"
            for a in accounts
        ]
        category_info = await _get_category_info_for_ai(user_id)

        # Load sender->account mappings for AI context
        sender_mappings = await db.sender_account_mappings.find(
            {"user_id": user_id}, {"_id": 0}
        ).sort("confidence_count", -1).limit(50).to_list(50)

        # Process emails with rate limiting to avoid OpenAI API throttling
        consecutive_failures = 0
        for i, email_doc in enumerate(pending_emails):
            try:
                logger.info(f"Processing email {i+1}/{len(pending_emails)}: {email_doc.get('subject', '')[:50]}")

                # Retry logic with exponential backoff for rate limit errors
                result = None
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        result = await analyze_email_with_ai(email_doc, account_names, category_info, sender_mappings=sender_mappings)
                        consecutive_failures = 0
                        break
                    except Exception as retry_err:
                        err_str = str(retry_err).lower()
                        is_rate_limit = "rate" in err_str or "429" in err_str or "quota" in err_str or "limit" in err_str
                        if is_rate_limit and attempt < max_retries - 1:
                            wait_time = (2 ** attempt) * 5  # 5s, 10s, 20s
                            logger.warning(f"Rate limited on email {email_doc['email_id']}, waiting {wait_time}s (attempt {attempt+1}/{max_retries})")
                            await asyncio.sleep(wait_time)
                        else:
                            raise

                if result and result.get("is_mandate"):
                    await _create_mandate_from_ai_result(user_id, email_doc, result, "gmail")
                elif result and result.get("is_transaction"):
                    await _create_transaction_from_ai_result(user_id, email_doc, result, accounts, "gmail")
                else:
                    await db.synced_emails.update_one(
                        {"email_id": email_doc["email_id"]},
                        {"$set": {"ai_status": "no_transaction", "ai_result": result}}
                    )

                # Small delay between calls to avoid rate limiting (100ms)
                if i < len(pending_emails) - 1:
                    await asyncio.sleep(0.15)

            except Exception as e:
                consecutive_failures += 1
                logger.error(f"Failed to process email {email_doc['email_id']}: {e}")
                await db.synced_emails.update_one(
                    {"email_id": email_doc["email_id"]},
                    {"$set": {"ai_status": "failed", "ai_error": str(e)}}
                )
                # If we get 10+ consecutive failures, likely a systemic issue — back off heavily
                if consecutive_failures >= 10:
                    logger.warning(f"10 consecutive failures — backing off 30s before continuing")
                    await asyncio.sleep(30)
                    consecutive_failures = 0

        # If there are more pending emails beyond this batch, schedule another run
        remaining = await db.synced_emails.count_documents(
            {"user_id": user_id, "ai_status": {"$in": ["pending", "failed"]}, "source_provider": {"$ne": "outlook"}}
        )
        if remaining > 0:
            logger.info(f"{remaining} emails still pending — scheduling next batch")

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


def _build_email_analysis_prompt(email_doc: dict, account_names: list, category_info: list, sender_mappings: list = None) -> str:
    """Build the AI prompt for email transaction analysis."""
    # Build sender mapping context text
    if sender_mappings:
        mapping_lines = []
        for m in sender_mappings:
            mapping_lines.append(f"- Emails from \"{m['from_email']}\" → account_id: {m['account_id']} (used {m.get('confidence_count', 1)} times)")
        sender_mapping_text = chr(10).join(mapping_lines)
    else:
        sender_mapping_text = "No history yet"

    return f"""Analyze this email and determine if it contains an ACTUAL COMPLETED cash transaction.

EMAIL:
Subject: {email_doc.get('subject', '')}
From: {email_doc.get('from_email', '')}
Date: {email_doc.get('date', '')}
Body: {email_doc.get('body_text', '')[:3000]}

AVAILABLE ACCOUNTS:
{chr(10).join(account_names) if account_names else "No accounts configured"}

SENDER-TO-ACCOUNT HISTORY (from past approved transactions):
{sender_mapping_text}

AVAILABLE CATEGORIES:
{chr(10).join(category_info) if category_info else "No categories configured"}

MANDATE / AUTO-PAY DETECTION (SEPARATE FROM TRANSACTIONS):
Some emails are notifications that an AUTO-DEBIT MANDATE has been registered — not a transaction. Examples:
  - "e-Mandate for ₹15,000/month to HDFC Home Loan registered"
  - "UPI AutoPay set up for Netflix Premium ₹799/month"
  - "NACH / ECS mandate activated for SIP of ₹10,000"
  - "Standing instruction created for Airtel Postpaid ₹1,499/month"
  - "Auto-debit enabled for Amazon Prime ₹1,499/year"
If the email is a mandate creation / activation / registration (not a debit), set is_mandate=true and populate the mandate_* fields below.
A mandate is FUTURE COMMITTED outflow — it is NOT is_transaction=true and is NOT is_recurring=true.
A debit that happened BECAUSE of a mandate is a normal transaction (is_transaction=true, is_mandate=false).

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
4. For transaction_type:
   - "income" for money received INTO your accounts from external sources (salary, freelance payment, refund, dividend credit, interest credit)
   - "expense" for money spent/paid OUT to external parties (purchases, subscriptions, bills, food, services)
   - "transfer" for money moved BETWEEN YOUR OWN ACCOUNTS. CRITICAL: Credit card bill PAYMENTS (paying off your CC balance) are ALWAYS "transfer" — the money moves from your bank account to your credit card account. Set account_id to the bank/source account and to_account_id to the credit card account. This is NOT an expense because the individual charges were already expenses.
5. For account_id: IMPORTANT — try hard to match from AVAILABLE ACCOUNTS by comparing bank name in the email (sender domain, subject, body mentions) against account names. For example, if the email is from HDFC Bank and there is an account named "HDFC" or "HDFC Savings", use that account_id. Match by bank keyword (e.g., "hdfc" in email → account with "HDFC" in name). If you can detect a SPECIFIC bank account name from the email but none of the AVAILABLE ACCOUNTS match, include it in detected_bank_name — we will auto-create it.
6. For payment_method: Detect how the payment was made. Common methods: "upi", "credit_card", "debit_card", "net_banking", "cash", "wallet", "cheque", "neft", "rtgs", "imps", "other".
7. Extract date in YYYY-MM-DD format. If not clear, use the email date.
8. CURRENCY: Detect the currency of the transaction from the email. Look for currency symbols ($, USD, EUR, GBP, etc.) or currency codes. If the email is from an Indian bank or UPI, use "INR". If unclear, default to "INR".
9. RECURRING DETECTION: ONLY set is_recurring to true when there is CLEAR EVIDENCE of a recurring/subscription charge. Valid evidence includes:
   - The email explicitly says "subscription", "recurring", "renewal", "billing cycle", "auto-renewal", "monthly plan", "annual plan"
   - It is from a well-known subscription service (Netflix, Spotify, Google Play, Apple, Amazon Prime, gym, insurance, SaaS platform, telecom carrier)
   - The email mentions a billing period or next renewal date
   Do NOT mark as recurring just because it is a UPI payment, bank debit, or generic expense. One-time purchases, P2P transfers, grocery deliveries, and ad-hoc payments are NOT recurring even if the user makes them frequently.
   IMPORTANT: Default is_recurring to FALSE. When in doubt, set is_recurring=false. The user can mark it as recurring during review. It is FAR better to miss a recurring flag than to wrongly mark a one-time payment as recurring.
   Specific NON-RECURRING examples: Person-to-person UPI transfers (to Akshay, Rohit, etc.), airline tickets, one-time purchases (electronics, household items), EMI payments (unless explicitly stated as auto-debit/recurring), large lump-sum payments (property, car), food delivery orders, taxi rides.
10. CATEGORY ASSIGNMENT — BEST EFFORT:
   - Use your best judgment to assign the most appropriate category based on the email content, merchant name, transaction description, and context.
   - NEVER use an income category (Salary, Business Income, Investment Income, Rental Income, Other Income) for an expense transaction. Income categories are ONLY for transaction_type "income".
   - NEVER use an expense category for an income transaction.
   - For credit card bill payments (transaction_type "transfer"), set category_id to null.
   - If you truly cannot determine any reasonable category (e.g., a completely generic bank debit with zero context), set category_id to null.
   - CRITICAL: Do NOT default to "Food & Dining > Restaurants" for unknown transactions. "Restaurants" is ONLY for actual food delivery (Swiggy, Zomato) or restaurant payments. If you don't know what a transaction is, use "Other Expenses" for expenses or "Other Income" for income.
   - For API credits, software subscriptions, SaaS payments (OpenAI, Anthropic, Supabase, AWS, etc.) → use "Subscriptions" or "Other Expenses", NEVER "Restaurants" or "Sales"
   - For payments to companies/businesses → use "Other Expenses" unless you know the specific category
   - NEVER categorize an EXPENSE as income category. If transaction_type="expense", the category MUST be an expense category.
   - For telecom payments (JIO, Airtel, Vi, BSNL) → use "Bills & Utilities > Phone"
   - For EMI/loan payments → use "Housing > Mortgage" or "Other Expenses", NEVER "Electricity"
   - Examples of good category assignments:
     * "Your Swiggy order" → Food & Dining > Restaurants
     * "Electricity bill payment" → Bills & Utilities > Electricity
     * "Netflix subscription renewed" → Subscriptions
     * "Salary credited" → Salary
     * "OpenAI API top-up" → Technology / Software (best guess is fine)
     * UPI to a person → Other Expenses (if no better context available)
   - The user can always change the category during review, so a reasonable guess is better than leaving it empty.

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
  "recurring_frequency": "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | null,
  "recurrence_date": integer 1-31 (day of month when this charge recurs) or null,
  "is_mandate": true/false,
  "mandate_type": "nach" | "enach" | "upi_autopay" | "ecs" | "sip" | "standing_instruction" | "credit_card_autopay" | "other" | null,
  "mandate_merchant": "payee / merchant name the mandate is for (e.g. 'HDFC Home Loan', 'Netflix', 'ICICI Prudential SIP')" or null,
  "mandate_amount": number or null,
  "mandate_frequency": "monthly" | "weekly" | "yearly" | "quarterly" | null,
  "mandate_start_date": "YYYY-MM-DD (first debit date, or mandate activation date)" or null,
  "mandate_end_date": "YYYY-MM-DD (expiry, if stated)" or null,
  "mandate_debit_day": integer 1-31 if a specific day of the month is mentioned, else null,
  "confidence": "high" | "medium" | "low",
  "reason": "brief reason for classification"
}}"""


def _parse_ai_json_response(content: str) -> dict:
    """Parse and clean an AI JSON response."""
    content = content.strip()
    content = re.sub(r'^```json\s*', '', content)
    content = re.sub(r'\s*```$', '', content)
    return json.loads(content)


async def analyze_email_with_ai(email_doc: dict, account_names: list, category_info: list, sender_mappings: list = None):
    if not async_openai_client:
        raise RuntimeError("OpenAI async client not configured — check OPENAI_API_KEY env var")

    prompt = _build_email_analysis_prompt(email_doc, account_names, category_info, sender_mappings=sender_mappings)

    try:
        response = await async_openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a careful financial transaction analyzer. Read the ENTIRE email first to understand its context before extracting details. Default is_recurring to false. Only use income categories for income transactions. Never default to 'Restaurants' for unknown transactions. Respond only with valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=500,
            timeout=30,
        )
        return _parse_ai_json_response(response.choices[0].message.content)

    except Exception as e:
        logger.error(f"AI analysis failed for email {email_doc.get('email_id', 'unknown')}: {type(e).__name__}: {e}")
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



@app.post("/api/sms/parse")
async def parse_single_sms(body: dict = Body(...), user: dict = Depends(get_current_user)):
    """Parse a single SMS message and return extracted transaction data (without saving)."""
    message = body.get("message", "").strip()
    sender = body.get("sender", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    if not async_openai_client:
        raise HTTPException(status_code=503, detail="AI service not configured")

    accounts = await db.accounts.find({"user_id": user["user_id"]}, {"_id": 0, "name": 1, "account_id": 1}).to_list(50)
    account_names = [f"{a['name']} (ID: {a['account_id']})" for a in accounts]
    categories = await db.categories.find({"user_id": user["user_id"]}, {"_id": 0, "name": 1, "category_id": 1, "category_type": 1}).to_list(200)
    category_info = [f"{c['name']} ({c['category_type']}, ID: {c['category_id']})" for c in categories]

    sms_doc = {"sender": sender, "body": message, "timestamp": datetime.now(timezone.utc).isoformat()}
    result = await analyze_sms_with_ai(sms_doc, account_names, category_info)

    return {"parsed": result}


@app.post("/api/sms/bulk-parse")
async def bulk_parse_sms(body: dict = Body(...), user: dict = Depends(get_current_user)):
    """Trigger AI processing on all pending SMS messages."""
    pending_count = await db.synced_sms.count_documents(
        {"user_id": user["user_id"], "ai_status": {"$in": ["pending", "failed"]}}
    )
    if pending_count == 0:
        return {"message": "No pending SMS to process", "count": 0}

    asyncio.create_task(process_pending_sms(user["user_id"]))
    return {"message": f"Processing {pending_count} SMS messages", "count": pending_count}


@app.post("/api/sms/detect-mandates")
async def sms_detect_mandates(user: dict = Depends(get_current_user)):
    """Detect recurring mandates from processed SMS transactions."""
    user_id = user["user_id"]

    # Get SMS-sourced transactions
    sms_txns = await db.transactions.find(
        {"user_id": user_id, "source": "sms", "status": "approved", "transaction_type": "expense"},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)

    from collections import defaultdict
    desc_groups = defaultdict(list)
    for t in sms_txns:
        desc = (t.get("description") or "").strip().lower()
        if desc and len(desc) > 3:
            desc_groups[desc].append(t)

    detected = []
    for desc, group in desc_groups.items():
        if len(group) < 2:
            continue
        amounts = [t["amount"] for t in group]
        avg_amount = sum(amounts) / len(amounts)
        if any(abs(a - avg_amount) / avg_amount > 0.15 for a in amounts if avg_amount > 0):
            continue

        existing = await db.mandates.find_one({
            "user_id": user_id,
            "merchant": {"$regex": desc[:20], "$options": "i"},
        })
        if existing:
            continue

        detected.append({
            "merchant": group[0].get("description", desc),
            "amount": round(avg_amount, 2),
            "frequency": "monthly",
            "occurrences": len(group),
            "source": "sms",
        })

    return {"detected": detected[:20], "total": len(detected)}


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
- RECURRING DETECTION: If the payee is a known subscription/recurring service (Netflix, Spotify, Google Play, Apple, Amazon Prime, gym, insurance, etc.) OR the SMS mentions "subscription", "recurring", "renewal", "auto-debit", etc., set is_recurring to true. Detect the billing frequency and recurrence day if mentioned.

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
  "recurring_frequency": "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | null,
  "recurrence_date": integer 1-31 (day of month when this charge recurs) or null,
  "confidence": "high" | "medium" | "low",
  "reason": "brief reason for classification"
}}"""

    try:
        response = await async_openai_client.chat.completions.create(
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
        # Check if an account with this exact name already exists for this user
        existing_account = await db.accounts.find_one({
            "user_id": user_id,
            "name": detected_bank_name[:100]
        }, {"_id": 0, "account_id": 1})

        if existing_account:
            account_id = existing_account["account_id"]
            logger.info(f"Found existing account with same name '{detected_bank_name}' -> {account_id}, skipping duplicate creation (SMS)")
        else:
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
                "currency": "INR",  # Default currency, can be changed by user
                "balance": 0,
                "description": "Auto-detected from email sync. Please review and update.",
                "balance_as_of_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "needs_opening_balance": True,
                "ai_created": True,
                "created_at": datetime.now(timezone.utc),
            }
            await db.accounts.insert_one(new_account)
            del new_account["_id"]
            account_id = new_account["account_id"]
            logger.info(f"Auto-created bank account from SMS: {detected_bank_name} -> {account_id}")
    
    # If still no account_id, leave it as None — user will assign during pending review
    if not account_id:
        logger.info("No account matched and no bank detected from SMS — leaving account_id as None for user review")

    # --- Category pre-fill from historical approved transactions ---
    prefilled_category = await _prefill_category_from_history(
        user_id,
        description=result.get("description", ""),
        payee=result.get("payee", ""),
    )
    final_category_id = prefilled_category.get("category_id") or result.get("category_id")
    final_subcategory_id = prefilled_category.get("subcategory_id") or result.get("subcategory_id")

    # --- Recurring detection: merge AI result with server-side vendor/keyword detection ---
    ai_is_recurring = result.get("is_recurring", False)
    ai_frequency = result.get("recurring_frequency")
    ai_recurrence_date = result.get("recurrence_date")

    if not ai_is_recurring:
        sms_content = sms_doc.get("body", "")
        vendor_detection = _detect_recurring_from_vendor_and_content(
            result.get("description", "") + " " + result.get("payee", ""),
            sms_content,
        )
        if vendor_detection["is_recurring"]:
            ai_is_recurring = True
            ai_frequency = ai_frequency or vendor_detection["recurrence_frequency"]
            ai_recurrence_date = ai_recurrence_date or vendor_detection["recurrence_date"]

    # If recurrence_date not detected, try to extract from the transaction date
    if ai_is_recurring and not ai_recurrence_date:
        txn_date_str = result.get("date") or txn_date
        if txn_date_str:
            try:
                ai_recurrence_date = int(txn_date_str.split("-")[2])
            except (IndexError, ValueError):
                pass

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "transaction_type": result.get("transaction_type", "expense"),
        "amount": result.get("amount", 0),
        "date": result.get("date") or txn_date,
        "account_id": account_id,
        "to_account_id": result.get("to_account_id"),
        "category_id": final_category_id,
        "subcategory_id": final_subcategory_id,
        "category_prefilled": bool(prefilled_category),
        "description": result.get("description", ""),
        "payee": result.get("payee", ""),
        "payment_method": result.get("payment_method"),
        "is_recurring": ai_is_recurring,
        "recurring_frequency": ai_frequency,
        "recurrence_date": ai_recurrence_date,
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

    # Recover any statement that was mid-parse when the previous worker died.
    # A fresh boot means no parse tasks are running yet, so anything still
    # flagged "parsing" with no recent heartbeat is definitely orphaned.
    try:
        stuck_n = await _mark_stuck_statements_failed(
            STUCK_SWEEP_STARTUP_SECONDS,
            "Processing was interrupted by a server restart. Click Retry to re-run.",
        )
        if stuck_n:
            logger.info(f"Startup: marked {stuck_n} orphan parsing statement(s) as parse_failed")
    except Exception as e:
        logger.error(f"Startup: stuck-statement sweep failed: {e}")

    asyncio.create_task(auto_retry_loop())
    asyncio.create_task(stuck_statements_watchdog_loop())
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

    # Convert datetime fields and normalise field names for iOS
    for r in records:
        if isinstance(r.get("archived_at"), datetime):
            r["archived_at"] = r["archived_at"].isoformat()
        if "source_provider" in r:
            r["source"] = r.pop("source_provider")

    return {"records": records, "total": total}




@app.get("/api/records/search")
async def search_records(
    q: str = "",
    user: dict = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0,
):
    """Search email records by subject, sender, or description."""
    query = {"user_id": user["user_id"]}
    if q:
        search_regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"subject": search_regex},
            {"from_email": search_regex},
            {"transaction_description": search_regex},
        ]

    records = await db.email_archives.find(
        query, {"_id": 0, "raw_eml": 0, "attachments.data": 0}
    ).sort("archived_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.email_archives.count_documents(query)
    for r in records:
        if isinstance(r.get("archived_at"), datetime):
            r["archived_at"] = r["archived_at"].isoformat()
        if "source_provider" in r:
            r["source"] = r.pop("source_provider")

    return {"items": records, "total": total}


# =====================================================================

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

    # Build clean response with field names matching iOS model
    archived_at = record.get("archived_at")
    if isinstance(archived_at, datetime):
        archived_at = archived_at.isoformat()

    attachments = []
    for i, att in enumerate(record.get("attachments") or []):
        attachments.append({
            "index": i,
            "filename": att.get("filename"),
            "mime_type": att.get("mime_type"),
            "size": att.get("size"),
        })

    return {
        "archive_id": record.get("archive_id"),
        "subject": record.get("subject"),
        "from_email": record.get("from_email"),
        "archived_at": archived_at,
        "source": record.get("source_provider"),
        "body": record.get("body_text"),
        "body_html": record.get("body_html"),
        "attachments": attachments,
        "transaction_id": record.get("transaction_id"),
    }



@app.get("/api/records/by-transaction/{transaction_id}")
async def get_record_by_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    """Find the archive record linked to a given transaction."""
    record = await db.email_archives.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]},
        {"_id": 0, "raw_eml": 0, "attachments.data": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="No archive found for this transaction")

    archived_at = record.get("archived_at")
    if isinstance(archived_at, datetime):
        archived_at = archived_at.isoformat()

    attachments = []
    for i, att in enumerate(record.get("attachments") or []):
        attachments.append({
            "index": i,
            "filename": att.get("filename"),
            "mime_type": att.get("mime_type"),
            "size": att.get("size"),
        })

    return {
        "archive_id": record.get("archive_id"),
        "subject": record.get("subject"),
        "from_email": record.get("from_email"),
        "archived_at": archived_at,
        "source": record.get("source_provider"),
        "body": record.get("body_text"),
        "body_html": record.get("body_html"),
        "attachments": attachments,
        "transaction_id": record.get("transaction_id"),
    }


@app.get("/api/records/{archive_id}")
async def get_record(archive_id: str, user: dict = Depends(get_current_user)):
    """Get a single email record by ID."""
    record = await db.email_archives.find_one(
        {"archive_id": archive_id, "user_id": user["user_id"]},
        {"_id": 0, "raw_eml": 0, "attachments.data": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if isinstance(record.get("archived_at"), datetime):
        record["archived_at"] = record["archived_at"].isoformat()
    if "source_provider" in record:
        record["source"] = record.pop("source_provider")
    return record


# --- Endpoint 6.8: DELETE /api/records/{archive_id} ---

@app.delete("/api/records/{archive_id}")
async def delete_record(archive_id: str, user: dict = Depends(get_current_user)):
    """Delete an email record."""
    result = await db.email_archives.delete_one(
        {"archive_id": archive_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Record deleted"}


# =====================================================================


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


@app.get("/api/tax-summary/generate")
async def generate_tax_summary_from_transactions(
    date_from: str = None,
    date_to: str = None,
    user: dict = Depends(get_current_user),
):
    """Generate a tax summary from existing transactions (without email scanning)."""
    user_id = user["user_id"]
    if not date_from or not date_to:
        raise HTTPException(status_code=400, detail="date_from and date_to are required")

    txns = await db.transactions.find(
        {"user_id": user_id, "status": "approved", "date": {"$gte": date_from, "$lte": date_to}},
        {"_id": 0}
    ).to_list(10000)

    total_income = sum(t["amount"] for t in txns if t["transaction_type"] == "income")
    total_expenses = sum(t["amount"] for t in txns if t["transaction_type"] == "expense")

    # Group by category
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    cat_map = {c["category_id"]: c["name"] for c in categories}

    income_by_cat = {}
    expense_by_cat = {}
    for t in txns:
        cat_name = cat_map.get(t.get("category_id"), "Uncategorized")
        if t["transaction_type"] == "income":
            income_by_cat[cat_name] = income_by_cat.get(cat_name, 0) + t["amount"]
        elif t["transaction_type"] == "expense":
            expense_by_cat[cat_name] = expense_by_cat.get(cat_name, 0) + t["amount"]

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net": round(total_income - total_expenses, 2),
        "transaction_count": len(txns),
        "income_by_category": {k: round(v, 2) for k, v in sorted(income_by_cat.items(), key=lambda x: -x[1])},
        "expense_by_category": {k: round(v, 2) for k, v in sorted(expense_by_cat.items(), key=lambda x: -x[1])},
    }


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

@app.get("/api/tax-summary/{summary_id}/download")
async def download_tax_summary(summary_id: str, user: dict = Depends(get_current_user)):
    """Download a tax summary as CSV (alias for export endpoint)."""
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


# =====================================================================


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

    # Business country
    if "business_country" in body:
        update_fields["business_country"] = body["business_country"]

    # Firm / invoicing settings
    invoicing_keys = [
        "firm_name", "firm_address", "firm_city", "firm_state", "firm_pincode",
        "firm_gstin", "firm_pan", "firm_phone", "firm_email",
        "invoice_bank_name", "invoice_bank_account_no", "invoice_bank_ifsc", "invoice_bank_branch",
        "invoice_prefix", "invoice_terms",
        "bill_prefix", "bill_terms",
    ]
    for key in invoicing_keys:
        if key in body:
            update_fields[key] = body[key]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db.user_settings.update_one(
        {"user_id": user["user_id"]},
        {"$set": update_fields},
        upsert=True,
    )
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return settings



@app.get("/api/settings/currencies")
async def get_currencies(user: dict = Depends(get_current_user)):
    """Return list of supported currencies."""
    currencies = [
        {"code": "INR", "name": "Indian Rupee", "symbol": "\u20b9"},
        {"code": "USD", "name": "US Dollar", "symbol": "$"},
        {"code": "EUR", "name": "Euro", "symbol": "\u20ac"},
        {"code": "GBP", "name": "British Pound", "symbol": "\u00a3"},
        {"code": "AED", "name": "UAE Dirham", "symbol": "\u062f.\u0625"},
        {"code": "SGD", "name": "Singapore Dollar", "symbol": "S$"},
        {"code": "AUD", "name": "Australian Dollar", "symbol": "A$"},
        {"code": "CAD", "name": "Canadian Dollar", "symbol": "C$"},
        {"code": "JPY", "name": "Japanese Yen", "symbol": "\u00a5"},
        {"code": "CNY", "name": "Chinese Yuan", "symbol": "\u00a5"},
    ]
    return {"currencies": currencies}


@app.get("/api/settings/date-formats")
async def get_date_formats(user: dict = Depends(get_current_user)):
    """Return list of supported date formats."""
    formats = [
        {"value": "DD/MM/YYYY", "label": "DD/MM/YYYY", "example": "18/04/2026"},
        {"value": "MM/DD/YYYY", "label": "MM/DD/YYYY", "example": "04/18/2026"},
        {"value": "YYYY-MM-DD", "label": "YYYY-MM-DD", "example": "2026-04-18"},
        {"value": "DD-MM-YYYY", "label": "DD-MM-YYYY", "example": "18-04-2026"},
        {"value": "DD MMM YYYY", "label": "DD MMM YYYY", "example": "18 Apr 2026"},
    ]
    return {"formats": formats}


@app.post("/api/settings/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a company logo for invoices."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    allowed = ("jpg", "jpeg", "png", "webp", "svg")
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed)}")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    logo_id = f"logo_{user['user_id']}"
    # Store in GridFS
    try:
        # Delete old logo if exists
        try:
            await receipt_fs.delete(logo_id)
        except Exception:
            pass
        await receipt_fs.upload_from_stream_with_id(
            logo_id, f"logo.{ext}", content,
            metadata={"user_id": user["user_id"], "file_ext": ext, "type": "logo"},
        )
    except Exception as e:
        logger.error(f"Failed to store logo: {e}")

    # Store base64 URL in settings
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "svg": "image/svg+xml"}
    mime = mime_map.get(ext, "application/octet-stream")
    logo_url = f"data:{mime};base64,{base64.b64encode(content).decode()}"

    await db.user_settings.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"logo_url": logo_url, "logo_filename": file.filename}},
        upsert=True,
    )

    return {"message": "Logo uploaded", "logo_url": logo_url}


@app.delete("/api/settings/logo")
async def delete_logo(user: dict = Depends(get_current_user)):
    """Delete the company logo."""
    await db.user_settings.update_one(
        {"user_id": user["user_id"]},
        {"$unset": {"logo_url": "", "logo_filename": ""}},
    )
    try:
        await receipt_fs.delete(f"logo_{user['user_id']}")
    except Exception:
        pass
    return {"message": "Logo deleted"}


@app.post("/api/settings/signature")
async def upload_signature(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a signature image for invoices."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    allowed = ("jpg", "jpeg", "png", "webp")
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed)}")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 2 MB)")

    sig_id = f"sig_{user['user_id']}"
    try:
        try:
            await receipt_fs.delete(sig_id)
        except Exception:
            pass
        await receipt_fs.upload_from_stream_with_id(
            sig_id, f"signature.{ext}", content,
            metadata={"user_id": user["user_id"], "file_ext": ext, "type": "signature"},
        )
    except Exception as e:
        logger.error(f"Failed to store signature: {e}")

    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
    mime = mime_map.get(ext, "application/octet-stream")
    signature_url = f"data:{mime};base64,{base64.b64encode(content).decode()}"

    await db.user_settings.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"signature_url": signature_url, "signature_filename": file.filename}},
        upsert=True,
    )

    return {"message": "Signature uploaded", "signature_url": signature_url}


@app.delete("/api/settings/signature")
async def delete_signature(user: dict = Depends(get_current_user)):
    """Delete the signature image."""
    await db.user_settings.update_one(
        {"user_id": user["user_id"]},
        {"$unset": {"signature_url": "", "signature_filename": ""}},
    )
    try:
        await receipt_fs.delete(f"sig_{user['user_id']}")
    except Exception:
        pass
    return {"message": "Signature deleted"}


@app.post("/api/settings/reset-data")
async def reset_data(request: Request, user: dict = Depends(get_current_user)):
    """Reset all user data — wipes transactions, accounts, categories, invoices, etc.
    Keeps the user account, settings, and active sessions intact.
    Re-seeds default accounts and categories so the user starts fresh."""
    user_id = user["user_id"]

    body = await request.json()
    confirmation = body.get("confirmation", "")
    if confirmation != "RESET":
        raise HTTPException(status_code=400, detail="You must send confirmation: 'RESET' to proceed.")

    # Delete all user data from every collection (but keep user account, settings, sessions)
    await db.transactions.delete_many({"user_id": user_id})
    await db.accounts.delete_many({"user_id": user_id})
    await db.categories.delete_many({"user_id": user_id})
    await db.invoices.delete_many({"user_id": user_id})
    await db.bills.delete_many({"user_id": user_id})
    await db.customers.delete_many({"user_id": user_id})
    await db.vendors.delete_many({"user_id": user_id})
    await db.mandates.delete_many({"user_id": user_id})
    await db.statements.delete_many({"user_id": user_id})
    await db.synced_sms.delete_many({"user_id": user_id})
    await db.receipts.delete_many({"user_id": user_id})
    await db.email_archives.delete_many({"user_id": user_id})
    await db.feature_requests.delete_many({"user_id": user_id})
    await db.tax_summaries.delete_many({"user_id": user_id})
    await db.tax_summary_transactions.delete_many({"user_id": user_id})
    await db.payment_orders.delete_many({"user_id": user_id})
    await db.ai_chat_history.delete_many({"user_id": user_id})

    # Disconnect and remove all email sync data (Gmail + Outlook)
    await db.gmail_tokens.delete_many({"user_id": user_id})
    await db.outlook_tokens.delete_many({"user_id": user_id})
    await db.synced_emails.delete_many({"user_id": user_id})
    await db.email_sync_config.delete_many({"user_id": user_id})
    await db.outlook_sync_config.delete_many({"user_id": user_id})
    # Clean up processing locks so stuck emails don't block future processing
    await db.processing_locks.delete_many({"lock_key": {"$regex": f"^{user_id}:"}})

    # Re-seed default accounts and categories
    await seed_default_data(user_id)

    return {"message": "All data has been reset. Your account is now fresh — default accounts and categories have been restored."}


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



@app.get("/api/support/faq")
async def get_faq(user: dict = Depends(get_current_user)):
    """Return frequently asked questions."""
    faqs = [
        {
            "question": "How do I connect my email for automatic transaction tracking?",
            "answer": "Go to Settings > Email Connections and click 'Connect Gmail' or 'Connect Outlook'. We'll only read transaction-related emails.",
        },
        {
            "question": "How do I upload bank statements?",
            "answer": "Navigate to Statements > Upload, select your bank account, and upload a PDF or CSV statement. Our AI will parse and categorize the entries.",
        },
        {
            "question": "How do I create a GST invoice?",
            "answer": "Go to Invoices > Create Invoice, select 'GST' as the invoice type, add your customer details and line items with HSN/SAC codes and GST rates.",
        },
        {
            "question": "Can I track SMS banking alerts?",
            "answer": "Yes! Use the mobile app to sync your SMS messages. Our AI will automatically extract transactions from banking alerts.",
        },
        {
            "question": "How do I manage recurring expenses?",
            "answer": "SpentyAI auto-detects mandates from your transactions. You can also manually add them from the Mandates section.",
        },
        {
            "question": "How do I export my data?",
            "answer": "Go to Reports and use the Export button to download your transactions as CSV. Tax summaries can also be exported.",
        },
        {
            "question": "What payment methods are supported?",
            "answer": "We accept payments via Razorpay (credit/debit cards, UPI, net banking) and Apple In-App Purchase for iOS users.",
        },
        {
            "question": "How do I cancel my subscription?",
            "answer": "Go to Settings > Billing and click 'Cancel Subscription'. You'll retain access until the end of your billing period.",
        },
    ]
    return {"faqs": faqs}


# =====================================================================


# ─── Overdraft Interest Calculation ──────────────────────────────────

@app.get("/api/accounts/{account_id}/od-interest")
async def calculate_od_interest(account_id: str, month: str, user: dict = Depends(get_current_user)):
    """
    Compute daily interest for an overdraft account for a given month.
    Query param `month` should be YYYY-MM (e.g., 2026-04).
    Returns a day-by-day breakdown and the total.
    """
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if (account.get("sub_type") or "").lower() != "overdraft":
        raise HTTPException(status_code=400, detail="This endpoint is only for overdraft accounts")
    rate = account.get("loan_interest_rate")
    if not rate or rate <= 0:
        raise HTTPException(status_code=400, detail="No interest rate set on this account")

    # Parse month string into start/end dates
    try:
        year, mon = int(month[:4]), int(month[5:7])
        month_start = date_cls(year, mon, 1)
        if mon == 12:
            month_end = date_cls(year + 1, 1, 1)
        else:
            month_end = date_cls(year, mon + 1, 1)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    num_days = (month_end - month_start).days
    daily_rate = rate / 100.0 / 365.0

    # ── Build the outstanding balance timeline for the month ──
    # Start with the opening balance, then replay all approved transfers
    # from balance_as_of_date up to month_end to get balances at each date.

    opening = account.get("opening_balance", 0)
    as_of_date = account.get("balance_as_of_date") or month_start.isoformat()
    as_of_str = as_of_date if isinstance(as_of_date, str) else as_of_date.isoformat()
    month_end_str = month_end.isoformat()

    # All approved transfers involving this OD account up to month_end
    txn_query = {
        "user_id": user["user_id"],
        "status": "approved",
        "transaction_type": "transfer",
        "date": {"$gte": as_of_str, "$lt": month_end_str},
        "source": {"$ne": "loan_emi"},
    }

    # Withdrawals (OD is source → outstanding increases)
    withdrawals = await db.transactions.find(
        {**txn_query, "account_id": account_id},
        {"_id": 0, "date": 1, "amount": 1, "description": 1}
    ).sort("date", 1).to_list(10000)

    # Repayments (OD is destination → outstanding decreases)
    repayments = await db.transactions.find(
        {**txn_query, "to_account_id": account_id},
        {"_id": 0, "date": 1, "amount": 1, "description": 1}
    ).sort("date", 1).to_list(10000)

    # Also include expense transactions on the OD account (e.g., previous
    # interest debits recorded as expenses) since they reduce balance.
    expense_query = {
        "user_id": user["user_id"],
        "status": "approved",
        "account_id": account_id,
        "transaction_type": "expense",
        "date": {"$gte": as_of_str, "$lt": month_end_str},
        "source": {"$ne": "loan_emi"},
    }
    expenses = await db.transactions.find(
        expense_query,
        {"_id": 0, "date": 1, "amount": 1, "description": 1}
    ).sort("date", 1).to_list(10000)

    # Build ordered list of balance-change events
    events = []
    for w in withdrawals:
        events.append({"date": w["date"], "delta": w["amount"], "desc": w.get("description", "Withdrawal")})
    for r in repayments:
        events.append({"date": r["date"], "delta": -r["amount"], "desc": r.get("description", "Repayment")})
    for e in expenses:
        events.append({"date": e["date"], "delta": e["amount"], "desc": e.get("description", "Expense")})
    events.sort(key=lambda x: x["date"])

    # Walk from as_of_date to month_end, applying events to get daily outstanding
    balance = opening
    # Apply events BEFORE the month starts so we know the opening balance
    pre_month_events = [e for e in events if e["date"] < month_start.isoformat()]
    for e in pre_month_events:
        balance += e["delta"]

    month_events = [e for e in events if month_start.isoformat() <= e["date"] < month_end_str]

    # Build day-by-day breakdown
    daily_breakdown = []
    total_interest = 0.0
    event_idx = 0

    for day_offset in range(num_days):
        current_date = month_start + timedelta(days=day_offset)
        current_str = current_date.isoformat()
        # Apply any events on this date
        while event_idx < len(month_events) and month_events[event_idx]["date"] <= current_str:
            balance += month_events[event_idx]["delta"]
            event_idx += 1
        interest = max(0, balance) * daily_rate
        total_interest += interest
        daily_breakdown.append({
            "date": current_str,
            "outstanding": round(balance, 2),
            "interest": round(interest, 2),
        })

    return {
        "account_id": account_id,
        "month": month,
        "interest_rate": rate,
        "daily_rate": round(daily_rate * 100, 6),
        "total_interest": round(total_interest, 2),
        "daily_breakdown": daily_breakdown,
        "closing_outstanding": round(balance, 2),
    }


@app.post("/api/accounts/{account_id}/od-interest/calculate")
async def calculate_od_interest_post(account_id: str, body: dict = Body(...), user: dict = Depends(get_current_user)):
    """
    Calculate OD interest via POST (iOS uses this with fromDate/toDate).
    Body: { fromDate: str (ISO date), toDate: str (ISO date) }
    Derives the month from fromDate and delegates to the GET calculation logic.
    """
    from_date = body.get("fromDate") or body.get("from_date", "")
    if not from_date:
        raise HTTPException(status_code=400, detail="fromDate is required")
    # Derive month from fromDate (YYYY-MM)
    month = from_date[:7]
    return await calculate_od_interest(account_id, month, user)


@app.post("/api/accounts/{account_id}/od-interest")
async def save_od_interest(account_id: str, body: dict = Body(...), user: dict = Depends(get_current_user)):
    """
    Save the OD interest as an expense transaction on the OD account.
    Body: { amount: float, date: str (ISO), month: str (YYYY-MM), description?: str }
    The transaction increases the outstanding balance.
    """
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if (account.get("sub_type") or "").lower() != "overdraft":
        raise HTTPException(status_code=400, detail="This endpoint is only for overdraft accounts")

    amount = body.get("amount")
    txn_date = body.get("date")
    month_label = body.get("month", "")
    description = body.get("description") or f"OD Interest — {month_label}"

    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if not txn_date:
        raise HTTPException(status_code=400, detail="Date is required")

    txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "transaction_type": "expense",
        "amount": round(amount, 2),
        "date": txn_date,
        "account_id": account_id,
        "to_account_id": None,
        "category_id": None,
        "subcategory_id": None,
        "description": description,
        "payment_method": "other",
        "is_recurring": False,
        "recurring_frequency": None,
        "source": "od_interest",
        "status": "approved",
        "created_at": datetime.now(timezone.utc),
    }
    await db.transactions.insert_one(txn)
    del txn["_id"]

    # Recalculate the OD account balance
    await recalculate_account_balance(user["user_id"], account_id)

    return {"transaction": txn, "message": "Interest entry added to your overdraft account"}


# ─── AI Chat Assistant ───────────────────────────────────────────────

@app.post("/api/ai/chat")
async def ai_chat(body: dict = Body(...), user: dict = Depends(get_current_user)):
    """
    AI chat assistant that answers questions about the user's finances
    and can post transactions when all required fields are provided.
    """
    if not async_openai_client:
        raise HTTPException(status_code=503, detail="AI service not configured")

    user_id = user["user_id"]
    message = body.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    # ── Fetch user's financial snapshot (approved only) ──
    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    recent_txns = await db.transactions.find(
        {"user_id": user_id, "status": "approved", "source": {"$ne": "loan_emi"}},
        {"_id": 0, "transaction_id": 1, "transaction_type": 1, "amount": 1,
         "date": 1, "account_id": 1, "to_account_id": 1, "category_id": 1,
         "description": 1, "source": 1}
    ).sort("date", -1).limit(200).to_list(200)

    # ── Fetch invoices, customers, and settings for invoice context ──
    customers = await db.customers.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    recent_invoices = await db.invoices.find(
        {"user_id": user_id},
        {"_id": 0, "invoice_id": 1, "invoice_number": 1, "invoice_type": 1,
         "invoice_date": 1, "due_date": 1, "customer_id": 1, "customer_name": 1,
         "grand_total": 1, "amount_paid": 1, "payment_status": 1, "line_items": 1}
    ).sort("invoice_date", -1).limit(100).to_list(100)
    user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}

    # ── Fetch vendors and bills for purchase context ──
    vendors = await db.vendors.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    recent_bills = await db.bills.find(
        {"user_id": user_id},
        {"_id": 0, "bill_id": 1, "bill_number": 1, "bill_type": 1,
         "bill_date": 1, "due_date": 1, "vendor_id": 1, "vendor_name": 1,
         "grand_total": 1, "amount_paid": 1, "payment_status": 1, "line_items": 1}
    ).sort("bill_date", -1).limit(100).to_list(100)

    # Summary stats
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    today_str = now.strftime("%Y-%m-%d")

    total_assets = sum(a.get("balance", 0) for a in accounts if a.get("account_type") in ("asset", "investment"))
    total_liabilities = sum(a.get("balance", 0) for a in accounts if a.get("account_type") == "liability")
    net_worth = total_assets - total_liabilities

    income_this_month = sum(t["amount"] for t in recent_txns if t["transaction_type"] == "income" and t["date"] >= month_start)
    expense_this_month = sum(t["amount"] for t in recent_txns if t["transaction_type"] == "expense" and t["date"] >= month_start)

    # Invoice stats
    total_invoiced = sum(inv.get("grand_total", 0) for inv in recent_invoices)
    total_received = sum(inv.get("amount_paid", 0) for inv in recent_invoices)
    total_outstanding = total_invoiced - total_received
    invoices_this_month = [inv for inv in recent_invoices if inv.get("invoice_date", "") >= month_start]
    invoiced_this_month = sum(inv.get("grand_total", 0) for inv in invoices_this_month)

    # Bill stats
    total_billed = sum(b.get("grand_total", 0) for b in recent_bills)
    total_paid_bills = sum(b.get("amount_paid", 0) for b in recent_bills)
    total_payable = total_billed - total_paid_bills
    bills_this_month = [b for b in recent_bills if b.get("bill_date", "") >= month_start]
    billed_this_month = sum(b.get("grand_total", 0) for b in bills_this_month)

    # Build compact account list
    acc_lines = []
    for a in accounts:
        line = f"- {a['name']} (ID: {a['account_id']}, type: {a.get('account_type','asset')}/{a.get('sub_type','general')}, balance: {a.get('balance', 0)}"
        if a.get("loan_interest_rate"):
            line += f", rate: {a['loan_interest_rate']}%"
        if a.get("loan_sanctioned_amount"):
            line += f", limit: {a['loan_sanctioned_amount']}"
        line += ")"
        acc_lines.append(line)

    # Build compact category list
    cat_lines = [f"- {c['name']} (ID: {c['category_id']}, type: {c.get('category_type','expense')})" for c in categories]

    # Build compact customer list
    cust_lines = []
    for c in customers:
        cust_line = f"- {c['name']} (ID: {c.get('customer_id', c.get('id', '?'))}"
        extras = []
        if c.get("city"): extras.append(c["city"])
        if c.get("state"): extras.append(c["state"])
        if c.get("gstin"): extras.append(f"GSTIN: {c['gstin']}")
        if c.get("phone"): extras.append(f"Ph: {c['phone']}")
        if extras:
            cust_line += f", {', '.join(extras)}"
        cust_line += ")"
        cust_lines.append(cust_line)

    # Build compact invoice list
    inv_lines = []
    for inv in recent_invoices:
        status = inv.get("payment_status", "unpaid")
        outstanding = inv.get("grand_total", 0) - inv.get("amount_paid", 0)
        items_summary = ", ".join(li.get("description", "?") for li in (inv.get("line_items") or [])[:3])
        inv_lines.append(
            f"  {inv.get('invoice_number','?')} | {inv.get('invoice_date','')} | {inv.get('customer_name','?')} "
            f"| ₹{inv.get('grand_total',0):,.2f} | {status} | outstanding: ₹{outstanding:,.2f} | items: {items_summary}"
        )

    # Build compact vendor list
    vendor_lines = []
    for v in vendors:
        v_line = f"- {v['name']} (ID: {v.get('vendor_id', v.get('id', '?'))}"
        v_extras = []
        if v.get("city"): v_extras.append(v["city"])
        if v.get("state"): v_extras.append(v["state"])
        if v.get("gstin"): v_extras.append(f"GSTIN: {v['gstin']}")
        if v.get("phone"): v_extras.append(f"Ph: {v['phone']}")
        if v_extras:
            v_line += f", {', '.join(v_extras)}"
        v_line += ")"
        vendor_lines.append(v_line)

    # Build compact bill list
    bill_lines = []
    for b in recent_bills:
        b_status = b.get("payment_status", "unpaid")
        b_outstanding = b.get("grand_total", 0) - b.get("amount_paid", 0)
        b_items_summary = ", ".join(li.get("description", "?") for li in (b.get("line_items") or [])[:3])
        bill_lines.append(
            f"  {b.get('bill_number','?')} | {b.get('bill_date','')} | {b.get('vendor_name','?')} "
            f"| ₹{b.get('grand_total',0):,.2f} | {b_status} | payable: ₹{b_outstanding:,.2f} | items: {b_items_summary}"
        )

    # Build invoice settings summary
    firm_name = user_settings.get("firm_name", "")
    firm_state = user_settings.get("firm_state", "")
    has_bank = bool(user_settings.get("invoice_bank_name") or user_settings.get("invoice_bank_account_no"))

    # Build compact recent transactions
    acc_map = {a["account_id"]: a.get("name", "Unknown") for a in accounts}
    cat_map = {c["category_id"]: c.get("name", "Unknown") for c in categories}
    txn_lines = []
    for t in recent_txns[:200]:
        acc_name = acc_map.get(t.get("account_id"), "?")
        cat_name = cat_map.get(t.get("category_id"), "")
        to_acc = f" → {acc_map.get(t.get('to_account_id'), '?')}" if t.get("to_account_id") else ""
        desc = t.get("description", "") or ""
        txn_lines.append(f"  {t['date']} | {t['transaction_type']} | ₹{t['amount']} | {acc_name}{to_acc} | {cat_name} | {desc}")

    system_prompt = f"""You are SpentyAI Assistant — a smart financial assistant for the user's personal accounting app.

CRITICAL RULES:
1. You ONLY answer based on the user's ACTUAL ledger data (approved transactions listed below) and their account balances. NEVER make up or hallucinate transactions or numbers.
2. If the user asks about something not in the data, say "I don't have that information in your ledger."
3. Use Indian number formatting for currency (₹1,00,000 not ₹100,000).
4. Be concise but helpful. Use plain language.
5. You know general financial concepts and can give advice, but ALWAYS tie it back to the user's actual numbers.
6. Today's date is {today_str}.

═══ LANGUAGE MATCHING (CRITICAL) ═══
Auto-detect the language/register of the user's LATEST message and REPLY IN THE EXACT SAME REGISTER:
- If the user writes in pure English → reply in English.
- If the user writes in pure Hindi (Devanagari script) → reply in Hindi (Devanagari).
- If the user writes in Hinglish (Hindi words in Roman script mixed with English, e.g. "kitna kharcha hua is mahine", "payment kaise karu", "mera balance kya hai") → reply in natural Indian Hinglish using Roman script for Hindi words. Do NOT switch to pure English. Do NOT switch to Devanagari. Use the exact code-switched style a real Indian would use, e.g. "Is mahine aapne ₹45,200 kharch kiya hai. Sabse zyada spend Food category mein hua hai."
- Never ask which language to use — just match automatically.

═══ USER'S FINANCIAL SNAPSHOT ═══

Net Worth: ₹{net_worth:,.2f}
Total Assets: ₹{total_assets:,.2f}
Total Liabilities: ₹{total_liabilities:,.2f}
Income This Month: ₹{income_this_month:,.2f}
Expenses This Month: ₹{expense_this_month:,.2f}
Savings This Month: ₹{income_this_month - expense_this_month:,.2f}

═══ ACCOUNTS ═══
{chr(10).join(acc_lines) if acc_lines else "No accounts yet."}

═══ CATEGORIES ═══
{chr(10).join(cat_lines) if cat_lines else "No categories yet."}

═══ RECENT APPROVED TRANSACTIONS (newest first) ═══
{chr(10).join(txn_lines) if txn_lines else "No transactions yet."}

═══ CUSTOMERS ═══
{chr(10).join(cust_lines) if cust_lines else "No customers yet."}

═══ INVOICES (newest first) ═══
Total Invoiced: ₹{total_invoiced:,.2f} | Total Received: ₹{total_received:,.2f} | Outstanding: ₹{total_outstanding:,.2f}
Invoiced This Month: ₹{invoiced_this_month:,.2f}
{chr(10).join(inv_lines) if inv_lines else "No invoices yet."}

═══ INVOICE SETTINGS ═══
Firm Name: {firm_name or "(not set)"}
Firm State: {firm_state or "(not set)"}
Bank Details Configured: {"Yes" if has_bank else "No"}

═══ VENDORS ═══
{chr(10).join(vendor_lines) if vendor_lines else "No vendors yet."}

═══ PURCHASE BILLS (newest first) ═══
Total Billed: ₹{total_billed:,.2f} | Total Paid: ₹{total_paid_bills:,.2f} | Payable: ₹{total_payable:,.2f}
Billed This Month: ₹{billed_this_month:,.2f}
{chr(10).join(bill_lines) if bill_lines else "No purchase bills yet."}

═══ POSTING TRANSACTIONS ═══
You can help the user post transactions. STRICT RULES:
1. For income/expense you MUST have ALL of: transaction_type, amount, date (YYYY-MM-DD), account_id, category_id, description.
2. For transfer you MUST have ALL of: transaction_type, amount, date (YYYY-MM-DD), account_id (source), to_account_id (destination), description.
3. If ANY required field is missing or ambiguous, ASK the user. Do NOT guess account or category — show them the options and ask them to pick.
4. If the user says "today" use {today_str}. If they say a date like "15th April", convert to ISO format.
5. Before posting, show a clear summary of what you'll record.
6. Check recent transactions for duplicates — if a similar transaction exists within 3 days, WARN the user.
7. When ALL fields are confirmed, output the transaction JSON wrapped EXACTLY like this (on its own lines):
|||TRANSACTION|||
{{"transaction_type": "...", "amount": ..., "date": "YYYY-MM-DD", "account_id": "...", "category_id": "...", "to_account_id": "...", "description": "..."}}
|||TRANSACTION|||
8. Only include to_account_id for transfers. Only include category_id for income/expense.
9. NEVER post without explicit user confirmation of the details.

═══ CREATING INVOICES ═══
You can help the user create sales invoices. STRICT RULES:
1. You MUST have AT MINIMUM: customer_id (pick from existing customers or ask to create), at least one line item with description and rate, invoice_type ("simple" or "gst"), and payment_status ("paid", "partial", or "unpaid").
2. For GST invoices you also need: place_of_supply (Indian state), and each line item should have gst_rate (0, 5, 12, 18, or 28).
3. If the customer exists in the list above, use their customer_id. If it's a new customer, tell the user to create them first from the Invoices page, or ask if they'd like you to just use the name.
4. If payment is "paid" or "partial", you need: payment_account_id (from accounts list), payment_date, payment_method (upi/cash/neft/cheque/etc).
5. Before creating, show a clear summary: customer, items with qty × rate, taxes (if GST), total, payment status.
6. When ALL fields are confirmed, output the invoice JSON wrapped EXACTLY like this:
|||INVOICE|||
{{"invoice_type": "simple or gst", "customer_id": "...", "customer_name": "...", "customer_state": "...", "invoice_date": "YYYY-MM-DD", "due_date": "YYYY-MM-DD or null", "place_of_supply": "state or null", "line_items": [{{"description": "...", "quantity": 1, "rate": 1000, "discount_percent": 0, "gst_rate": 18, "hsn_sac": "..."}}], "payment_status": "unpaid", "amount_paid": 0, "payment_account_id": null, "payment_date": null, "payment_method": null, "notes": "..."}}
|||INVOICE|||
7. The server will auto-calculate taxes, totals, round-off, and invoice number.
8. NEVER create an invoice without explicit user confirmation of the details.
9. You can answer questions about existing invoices, outstanding amounts, debtor status, and customer sales history using the data above.

═══ CREATING PURCHASE BILLS ═══
You can help the user record purchase bills (expenses from vendors/suppliers). STRICT RULES:
1. You MUST have AT MINIMUM: vendor_id (pick from existing vendors or ask to create), at least one line item with description and rate, bill_type ("simple" or "gst"), and payment_status ("paid", "partial", or "unpaid").
2. For GST bills you also need: place_of_supply (Indian state), and each line item should have gst_rate (0, 5, 12, 18, or 28).
3. If the vendor exists in the VENDORS list above, use their vendor_id. If it's a new vendor, tell the user to create them first from the Purchases page.
4. If payment is "paid" or "partial", you need: payment_account_id (from accounts list), payment_date, payment_method (upi/cash/neft/cheque/etc).
5. Optionally include bill_reference (the vendor's original invoice/bill number).
6. Before creating, show a clear summary: vendor, items with qty × rate, taxes (if GST), total, payment status.
7. When ALL fields are confirmed, output the bill JSON wrapped EXACTLY like this:
|||BILL|||
{{"bill_type": "simple or gst", "vendor_id": "...", "vendor_name": "...", "vendor_state": "...", "bill_date": "YYYY-MM-DD", "due_date": "YYYY-MM-DD or null", "place_of_supply": "state or null", "bill_reference": "vendor invoice number or null", "line_items": [{{"description": "...", "quantity": 1, "rate": 1000, "discount_percent": 0, "gst_rate": 18, "hsn_sac": "..."}}], "payment_status": "unpaid", "amount_paid": 0, "payment_account_id": null, "payment_date": null, "payment_method": null, "notes": "..."}}
|||BILL|||
8. The server will auto-calculate taxes, totals, round-off, and bill number.
9. NEVER create a bill without explicit user confirmation of the details.
10. You can answer questions about existing bills, payable amounts, creditor status, and vendor purchase history using the data above."""

    # Build messages
    messages = [{"role": "system", "content": system_prompt}]
    for msg in (body.get("conversation") or [])[-20:]:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    try:
        response = await async_openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=2000,
        )
        ai_reply = response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"OpenAI error in AI chat: {e}")
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable")

    # ── Check for transaction posting ──
    transaction_posted = False
    posted_txn = None
    clean_reply = ai_reply

    if "|||TRANSACTION|||" in ai_reply:
        parts = ai_reply.split("|||TRANSACTION|||")
        if len(parts) >= 3:
            txn_json_str = parts[1].strip()
            try:
                txn_data = json.loads(txn_json_str)

                # Validate required fields
                t_type = txn_data.get("transaction_type")
                amount = txn_data.get("amount")
                date_str = txn_data.get("date")
                account_id = txn_data.get("account_id")

                errors = []
                if t_type not in ("income", "expense", "transfer"):
                    errors.append("Invalid transaction type")
                if not amount or float(amount) <= 0:
                    errors.append("Invalid amount")
                if not date_str:
                    errors.append("Date is required")
                if not account_id:
                    errors.append("Account is required")

                # Verify account belongs to user
                acc = await db.accounts.find_one({"account_id": account_id, "user_id": user_id})
                if not acc:
                    errors.append(f"Account {account_id} not found")

                if t_type in ("income", "expense"):
                    cat_id = txn_data.get("category_id")
                    if not cat_id:
                        errors.append("Category is required for income/expense")
                    else:
                        cat = await db.categories.find_one({"category_id": cat_id, "user_id": user_id})
                        if not cat:
                            errors.append(f"Category {cat_id} not found")

                if t_type == "transfer":
                    to_acc_id = txn_data.get("to_account_id")
                    if not to_acc_id:
                        errors.append("Destination account is required for transfer")
                    else:
                        to_acc = await db.accounts.find_one({"account_id": to_acc_id, "user_id": user_id})
                        if not to_acc:
                            errors.append(f"Destination account {to_acc_id} not found")

                if errors:
                    clean_reply = ai_reply.replace(f"|||TRANSACTION|||{parts[1]}|||TRANSACTION|||", "")
                    clean_reply += f"\n\n⚠️ Could not post: {', '.join(errors)}"
                else:
                    # Create the transaction
                    txn = {
                        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                        "user_id": user_id,
                        "transaction_type": t_type,
                        "amount": float(amount),
                        "date": date_str,
                        "account_id": account_id,
                        "to_account_id": txn_data.get("to_account_id"),
                        "category_id": txn_data.get("category_id"),
                        "subcategory_id": None,
                        "description": txn_data.get("description", ""),
                        "payment_method": None,
                        "is_recurring": False,
                        "recurring_frequency": None,
                        "source": "ai_chat",
                        "status": "approved",
                        "created_at": datetime.now(timezone.utc),
                    }
                    await db.transactions.insert_one(txn)
                    del txn["_id"]
                    await apply_transaction_to_balances(user_id, txn)

                    transaction_posted = True
                    posted_txn = {k: v for k, v in txn.items() if k != "_id"}
                    # Make datetime serializable
                    if "created_at" in posted_txn:
                        posted_txn["created_at"] = posted_txn["created_at"].isoformat()

                    # Clean up the reply — remove the raw JSON block
                    clean_reply = ai_reply.replace(f"|||TRANSACTION|||{parts[1]}|||TRANSACTION|||", "").strip()
                    if not clean_reply:
                        clean_reply = "✅ Transaction posted successfully!"

            except json.JSONDecodeError:
                clean_reply = ai_reply.replace(f"|||TRANSACTION|||{parts[1]}|||TRANSACTION|||", "")
                clean_reply += "\n\n⚠️ I tried to create a transaction but the format was invalid. Let me try again — please confirm the details."

    # ── Check for invoice creation ──
    invoice_created = False
    created_invoice = None

    if "|||INVOICE|||" in clean_reply:
        inv_parts = clean_reply.split("|||INVOICE|||")
        if len(inv_parts) >= 3:
            inv_json_str = inv_parts[1].strip()
            try:
                inv_data = json.loads(inv_json_str)
                inv_errors = []

                # Validate basics
                inv_type = inv_data.get("invoice_type", "simple")
                raw_items = inv_data.get("line_items", [])
                if not raw_items:
                    inv_errors.append("At least one line item is required")
                for idx, item in enumerate(raw_items):
                    if not item.get("description"):
                        inv_errors.append(f"Line item {idx+1} needs a description")
                    if not item.get("rate") or float(item.get("rate", 0)) <= 0:
                        inv_errors.append(f"Line item {idx+1} needs a valid rate")

                customer_id = inv_data.get("customer_id", "")
                customer_name = inv_data.get("customer_name", "")
                if not customer_id and not customer_name:
                    inv_errors.append("Customer is required")

                # Validate payment account if paid/partial
                pay_status = inv_data.get("payment_status", "unpaid")
                if pay_status in ("paid", "partial"):
                    pay_acc_id = inv_data.get("payment_account_id")
                    if not pay_acc_id:
                        inv_errors.append("Payment account is required for paid/partial invoices")
                    else:
                        pay_acc = await db.accounts.find_one({"account_id": pay_acc_id, "user_id": user_id})
                        if not pay_acc:
                            inv_errors.append(f"Payment account {pay_acc_id} not found")

                if inv_errors:
                    clean_reply = clean_reply.replace(f"|||INVOICE|||{inv_parts[1]}|||INVOICE|||", "")
                    clean_reply += f"\n\n⚠️ Could not create invoice: {', '.join(inv_errors)}"
                else:
                    # Look up customer details if customer_id provided
                    if customer_id:
                        cust_doc = await db.customers.find_one({"customer_id": customer_id, "user_id": user_id})
                        if cust_doc:
                            customer_name = cust_doc.get("name", customer_name)
                            inv_data["customer_state"] = inv_data.get("customer_state") or cust_doc.get("state", "")

                    # Determine same-state for GST calc
                    inv_firm_state = user_settings.get("firm_state", "")
                    inv_cust_state = inv_data.get("customer_state") or inv_data.get("place_of_supply") or ""
                    inv_is_same_state = (inv_firm_state.strip().lower() == inv_cust_state.strip().lower()) if inv_firm_state and inv_cust_state else True

                    # Calculate line items and totals
                    calc_items = _calculate_line_items(raw_items, inv_type, inv_is_same_state)
                    inv_totals = _calculate_invoice_totals(calc_items)

                    inv_number = await _get_next_invoice_number(user_id)
                    inv_now = datetime.now(timezone.utc)

                    amount_paid = float(inv_data.get("amount_paid", 0))
                    if pay_status == "paid":
                        amount_paid = inv_totals["grand_total"]

                    invoice_doc = {
                        "invoice_id": uuid.uuid4().hex[:16],
                        "user_id": user_id,
                        "invoice_number": inv_number,
                        "invoice_type": inv_type,
                        "invoice_date": inv_data.get("invoice_date", today_str),
                        "due_date": inv_data.get("due_date"),
                        "customer_id": customer_id,
                        "customer_name": customer_name,
                        "customer_gstin": inv_data.get("customer_gstin"),
                        "customer_address": inv_data.get("customer_address"),
                        "customer_state": inv_cust_state,
                        "place_of_supply": inv_data.get("place_of_supply"),
                        "line_items": calc_items,
                        **inv_totals,
                        "amount_in_words": amount_to_words_inr(inv_totals["grand_total"]),
                        "payment_status": pay_status,
                        "amount_paid": amount_paid,
                        "payment_account_id": inv_data.get("payment_account_id"),
                        "payment_method": inv_data.get("payment_method"),
                        "payment_date": inv_data.get("payment_date"),
                        "transaction_id": None,
                        "notes": inv_data.get("notes"),
                        "terms_conditions": inv_data.get("terms_conditions", user_settings.get("invoice_terms")),
                        "created_at": inv_now,
                        "updated_at": inv_now,
                        "source": "ai_chat",
                    }

                    # Auto-post transaction if paid/partial
                    if pay_status == "paid":
                        txn_id = await _auto_post_invoice_transaction(user_id, invoice_doc, inv_totals["grand_total"])
                        invoice_doc["transaction_id"] = txn_id
                    elif pay_status == "partial" and amount_paid > 0:
                        txn_id = await _auto_post_invoice_transaction(user_id, invoice_doc, amount_paid)
                        invoice_doc["transaction_id"] = txn_id

                    await db.invoices.insert_one(invoice_doc)
                    del invoice_doc["_id"]

                    invoice_created = True
                    created_invoice = {
                        "invoice_id": invoice_doc["invoice_id"],
                        "invoice_number": inv_number,
                        "grand_total": inv_totals["grand_total"],
                        "customer_name": customer_name,
                        "payment_status": pay_status,
                    }

                    clean_reply = clean_reply.replace(f"|||INVOICE|||{inv_parts[1]}|||INVOICE|||", "").strip()
                    if not clean_reply:
                        clean_reply = f"✅ Invoice {inv_number} created successfully for {customer_name} — ₹{inv_totals['grand_total']:,.2f}"

            except json.JSONDecodeError:
                clean_reply = clean_reply.replace(f"|||INVOICE|||{inv_parts[1]}|||INVOICE|||", "")
                clean_reply += "\n\n⚠️ I tried to create an invoice but the format was invalid. Let me try again — please confirm the details."

    # ── Check for bill creation ──
    bill_created = False
    created_bill = None

    if "|||BILL|||" in clean_reply:
        bill_parts = clean_reply.split("|||BILL|||")
        if len(bill_parts) >= 3:
            bill_json_str = bill_parts[1].strip()
            try:
                bill_data = json.loads(bill_json_str)
                bill_errors = []

                # Validate basics
                bill_type = bill_data.get("bill_type", "simple")
                raw_bill_items = bill_data.get("line_items", [])
                if not raw_bill_items:
                    bill_errors.append("At least one line item is required")
                for idx, item in enumerate(raw_bill_items):
                    if not item.get("description"):
                        bill_errors.append(f"Line item {idx+1} needs a description")
                    if not item.get("rate") or float(item.get("rate", 0)) <= 0:
                        bill_errors.append(f"Line item {idx+1} needs a valid rate")

                vendor_id = bill_data.get("vendor_id", "")
                vendor_name = bill_data.get("vendor_name", "")
                if not vendor_id and not vendor_name:
                    bill_errors.append("Vendor is required")

                # Validate payment account if paid/partial
                bill_pay_status = bill_data.get("payment_status", "unpaid")
                if bill_pay_status in ("paid", "partial"):
                    bill_pay_acc_id = bill_data.get("payment_account_id")
                    if not bill_pay_acc_id:
                        bill_errors.append("Payment account is required for paid/partial bills")
                    else:
                        bill_pay_acc = await db.accounts.find_one({"account_id": bill_pay_acc_id, "user_id": user_id})
                        if not bill_pay_acc:
                            bill_errors.append(f"Payment account {bill_pay_acc_id} not found")

                if bill_errors:
                    clean_reply = clean_reply.replace(f"|||BILL|||{bill_parts[1]}|||BILL|||", "")
                    clean_reply += f"\n\n⚠️ Could not create bill: {', '.join(bill_errors)}"
                else:
                    # Look up vendor details if vendor_id provided
                    if vendor_id:
                        vendor_doc = await db.vendors.find_one({"vendor_id": vendor_id, "user_id": user_id})
                        if vendor_doc:
                            vendor_name = vendor_doc.get("name", vendor_name)
                            bill_data["vendor_state"] = bill_data.get("vendor_state") or vendor_doc.get("state", "")

                    # Determine same-state for GST calc
                    bill_firm_state = user_settings.get("firm_state", "")
                    bill_vendor_state = bill_data.get("vendor_state") or bill_data.get("place_of_supply") or ""
                    bill_is_same_state = (bill_firm_state.strip().lower() == bill_vendor_state.strip().lower()) if bill_firm_state and bill_vendor_state else True

                    # Calculate line items and totals
                    bill_calc_items = _calculate_line_items(raw_bill_items, bill_type, bill_is_same_state)
                    bill_totals = _calculate_invoice_totals(bill_calc_items)

                    bill_number = await _get_next_bill_number(user_id)
                    bill_now = datetime.now(timezone.utc)

                    bill_amount_paid = float(bill_data.get("amount_paid", 0))
                    if bill_pay_status == "paid":
                        bill_amount_paid = bill_totals["grand_total"]

                    bill_doc = {
                        "bill_id": uuid.uuid4().hex[:16],
                        "user_id": user_id,
                        "bill_number": bill_number,
                        "bill_type": bill_type,
                        "bill_date": bill_data.get("bill_date", today_str),
                        "due_date": bill_data.get("due_date"),
                        "vendor_id": vendor_id,
                        "vendor_name": vendor_name,
                        "vendor_gstin": bill_data.get("vendor_gstin"),
                        "vendor_address": bill_data.get("vendor_address"),
                        "vendor_state": bill_vendor_state,
                        "place_of_supply": bill_data.get("place_of_supply"),
                        "line_items": bill_calc_items,
                        **bill_totals,
                        "amount_in_words": amount_to_words_inr(bill_totals["grand_total"]),
                        "payment_status": bill_pay_status,
                        "amount_paid": bill_amount_paid,
                        "payment_account_id": bill_data.get("payment_account_id"),
                        "payment_method": bill_data.get("payment_method"),
                        "payment_date": bill_data.get("payment_date"),
                        "transaction_id": None,
                        "bill_reference": bill_data.get("bill_reference"),
                        "notes": bill_data.get("notes"),
                        "terms_conditions": bill_data.get("terms_conditions", user_settings.get("bill_terms")),
                        "created_at": bill_now,
                        "updated_at": bill_now,
                        "source": "ai_chat",
                    }

                    # Auto-post expense transaction if paid/partial
                    if bill_pay_status == "paid":
                        bill_txn_id = await _auto_post_bill_transaction(user_id, bill_doc, bill_totals["grand_total"])
                        bill_doc["transaction_id"] = bill_txn_id
                    elif bill_pay_status == "partial" and bill_amount_paid > 0:
                        bill_txn_id = await _auto_post_bill_transaction(user_id, bill_doc, bill_amount_paid)
                        bill_doc["transaction_id"] = bill_txn_id

                    await db.bills.insert_one(bill_doc)
                    del bill_doc["_id"]

                    bill_created = True
                    created_bill = {
                        "bill_id": bill_doc["bill_id"],
                        "bill_number": bill_number,
                        "grand_total": bill_totals["grand_total"],
                        "vendor_name": vendor_name,
                        "payment_status": bill_pay_status,
                    }

                    clean_reply = clean_reply.replace(f"|||BILL|||{bill_parts[1]}|||BILL|||", "").strip()
                    if not clean_reply:
                        clean_reply = f"✅ Bill {bill_number} recorded successfully for {vendor_name} — ₹{bill_totals['grand_total']:,.2f}"

            except json.JSONDecodeError:
                clean_reply = clean_reply.replace(f"|||BILL|||{bill_parts[1]}|||BILL|||", "")
                clean_reply += "\n\n⚠️ I tried to create a bill but the format was invalid. Let me try again — please confirm the details."

    # Persist both user and assistant messages to chat history
    now_ts = datetime.now(timezone.utc)
    try:
        await db.ai_chat_history.insert_many([
            {"user_id": user_id, "role": "user", "content": message, "created_at": now_ts},
            {"user_id": user_id, "role": "assistant", "content": clean_reply.strip(),
             "transaction_posted": transaction_posted, "invoice_created": invoice_created,
             "bill_created": bill_created, "created_at": now_ts + timedelta(milliseconds=1)},
        ])
    except Exception as e:
        logger.error(f"Failed to persist chat history: {e}")

    return {
        "reply": clean_reply.strip(),
        "transaction_posted": transaction_posted,
        "transaction": posted_txn,
        "invoice_created": invoice_created,
        "invoice": created_invoice,
        "bill_created": bill_created,
        "bill": created_bill,
    }



@app.get("/api/ai/chat/history")
async def get_chat_history(
    limit: int = 50,
    skip: int = 0,
    user: dict = Depends(get_current_user),
):
    """Get AI chat conversation history."""
    messages = await db.ai_chat_history.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    for m in messages:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()

    return {"messages": list(reversed(messages)), "total": await db.ai_chat_history.count_documents({"user_id": user["user_id"]})}


# --- Endpoint 6.2: DELETE /api/ai/chat/history/clear ---

@app.delete("/api/ai/chat/history/clear")
async def clear_chat_history(user: dict = Depends(get_current_user)):
    """Clear all AI chat history for the user."""
    result = await db.ai_chat_history.delete_many({"user_id": user["user_id"]})
    return {"message": "Chat history cleared", "deleted": result.deleted_count}


# --- Endpoint 6.3: GET /api/ai/chat/suggestions ---

@app.get("/api/ai/chat/suggestions")
async def get_chat_suggestions(user: dict = Depends(get_current_user)):
    """Get contextual chat suggestions based on user's data."""
    user_id = user["user_id"]
    pending = await db.transactions.count_documents({"user_id": user_id, "status": "pending_review"})
    txn_count = await db.transactions.count_documents({"user_id": user_id})

    suggestions = [
        "What's my net worth?",
        "Show me my spending this month",
        "How much did I earn last month?",
    ]

    if pending > 0:
        suggestions.insert(0, f"I have {pending} transactions pending review. Can you summarize them?")
    if txn_count > 10:
        suggestions.append("What are my top expense categories?")
        suggestions.append("Am I spending more than last month?")
    if txn_count == 0:
        suggestions = [
            "How do I get started with SpentyAI?",
            "What can you help me with?",
            "How do I connect my email for auto-tracking?",
        ]

    return {"suggestions": suggestions}


# =====================================================================


# ─── Razorpay Payments ───────────────────────────────────────────────

PLAN_PRICES = {
    "monthly": {"amount": 19900, "currency": "INR", "description": "SpentyAI Monthly Plan", "duration_days": 30},
    "quarterly": {"amount": 44900, "currency": "INR", "description": "SpentyAI Quarterly Plan", "duration_days": 90},
    "yearly": {"amount": 149900, "currency": "INR", "description": "SpentyAI Yearly Plan", "duration_days": 365},
    "lifetime": {"amount": 499900, "currency": "INR", "description": "SpentyAI Lifetime Access", "duration_days": 36500},
}


@app.post("/api/payments/create-order")
async def create_payment_order(body: dict = Body(...), user: dict = Depends(get_current_user)):
    """Create a Razorpay order for the selected plan."""
    plan_key = body.get("plan")
    if plan_key not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {plan_key}")

    plan = PLAN_PRICES[plan_key]

    try:
        order = razorpay_client.order.create({
            "amount": plan["amount"],
            "currency": plan["currency"],
            "receipt": f"rcpt_{user['user_id']}_{plan_key}_{uuid.uuid4().hex[:8]}",
            "notes": {
                "user_id": user["user_id"],
                "plan": plan_key,
                "email": user["email"],
            },
        })
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=502, detail="Payment service temporarily unavailable")

    # Store the order in DB for verification later
    await db.payment_orders.insert_one({
        "order_id": order["id"],
        "user_id": user["user_id"],
        "plan": plan_key,
        "amount": plan["amount"],
        "currency": plan["currency"],
        "status": "created",
        "created_at": datetime.now(timezone.utc),
    })

    return {
        "order_id": order["id"],
        "amount": plan["amount"],
        "currency": plan["currency"],
        "key_id": RAZORPAY_KEY_ID,
        "description": plan["description"],
        "prefill": {
            "name": user.get("name", ""),
            "email": user.get("email", ""),
        },
    }


@app.post("/api/payments/verify")
async def verify_payment(body: dict = Body(...), user: dict = Depends(get_current_user)):
    """Verify Razorpay payment signature and activate subscription."""
    razorpay_order_id = body.get("razorpay_order_id")
    razorpay_payment_id = body.get("razorpay_payment_id")
    razorpay_signature = body.get("razorpay_signature")

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        raise HTTPException(status_code=400, detail="Missing payment details")

    # Verify signature
    message = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if expected_signature != razorpay_signature:
        logger.warning(f"Payment signature mismatch for order {razorpay_order_id}")
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Look up the order
    order_doc = await db.payment_orders.find_one({
        "order_id": razorpay_order_id,
        "user_id": user["user_id"],
    })
    if not order_doc:
        raise HTTPException(status_code=404, detail="Order not found")

    if order_doc.get("status") == "paid":
        return {"message": "Payment already verified", "subscription_plan": order_doc["plan"]}

    plan_key = order_doc["plan"]
    plan = PLAN_PRICES[plan_key]
    now = datetime.now(timezone.utc)
    expiry = now + timedelta(days=plan["duration_days"])

    # Update the order
    await db.payment_orders.update_one(
        {"order_id": razorpay_order_id},
        {"$set": {
            "status": "paid",
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
            "paid_at": now,
        }},
    )

    # Update user's subscription
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "subscription_plan": plan_key,
            "subscription_status": "active",
            "subscription_expiry": expiry.isoformat(),
            "subscription_payment_id": razorpay_payment_id,
            "subscription_updated_at": now,
        }},
    )

    return {
        "message": "Payment verified successfully",
        "subscription_plan": plan_key,
        "subscription_status": "active",
        "subscription_expiry": expiry.isoformat(),
    }


@app.get("/api/payments/history")
async def payment_history(user: dict = Depends(get_current_user)):
    """Get user's payment history."""
    orders = await db.payment_orders.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    # Make datetime fields serializable
    for o in orders:
        for key in ("created_at", "paid_at"):
            if key in o and isinstance(o[key], datetime):
                o[key] = o[key].isoformat()
    return {"orders": orders}



@app.get("/api/payments/plans")
async def get_payment_plans(user: dict = Depends(get_current_user)):
    """Return available subscription plans."""
    plans = []
    for key, plan in PLAN_PRICES.items():
        plans.append({
            "plan_id": key,
            "name": plan["description"],
            "amount": plan["amount"],
            "amount_display": f"₹{plan['amount'] / 100:,.0f}",
            "currency": plan["currency"],
            "duration_days": plan["duration_days"],
        })
    return {"plans": plans}


@app.post("/api/payments/apple/verify")
async def verify_apple_payment(body: dict = Body(...), user: dict = Depends(get_current_user)):
    """Verify an Apple In-App Purchase receipt and activate subscription."""
    receipt_data = body.get("receipt_data")
    product_id = body.get("product_id", "")
    if not receipt_data:
        raise HTTPException(status_code=400, detail="receipt_data is required")

    # Map Apple product IDs to plan keys
    apple_plan_map = {
        "com.spentyai.monthly": "monthly",
        "com.spentyai.quarterly": "quarterly",
        "com.spentyai.yearly": "yearly",
        "com.spentyai.lifetime": "lifetime",
    }
    plan_key = apple_plan_map.get(product_id, "monthly")

    # Verify receipt with Apple (production first, then sandbox)
    verify_url = "https://buy.itunes.apple.com/verifyReceipt"
    payload = {"receipt-data": receipt_data, "password": os.environ.get("APPLE_SHARED_SECRET", "")}

    try:
        async with httpx.AsyncClient() as http_client:
            resp = await http_client.post(verify_url, json=payload)
            result = resp.json()
            # If status 21007, it's a sandbox receipt — retry with sandbox URL
            if result.get("status") == 21007:
                sandbox_url = "https://sandbox.itunes.apple.com/verifyReceipt"
                resp = await http_client.post(sandbox_url, json=payload)
                result = resp.json()

        if result.get("status") != 0:
            raise HTTPException(status_code=400, detail=f"Apple receipt verification failed (status: {result.get('status')})")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Apple receipt verification error: {e}")
        raise HTTPException(status_code=502, detail="Apple verification service unavailable")

    plan = PLAN_PRICES.get(plan_key, PLAN_PRICES["monthly"])
    now = datetime.now(timezone.utc)
    expiry = now + timedelta(days=plan["duration_days"])

    # Store payment record
    order_id = f"apple_{uuid.uuid4().hex[:12]}"
    await db.payment_orders.insert_one({
        "order_id": order_id,
        "user_id": user["user_id"],
        "plan": plan_key,
        "amount": plan["amount"],
        "currency": plan["currency"],
        "payment_provider": "apple",
        "product_id": product_id,
        "status": "paid",
        "paid_at": now,
        "created_at": now,
    })

    # Activate subscription
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "subscription_plan": plan_key,
            "subscription_status": "active",
            "subscription_expiry": expiry.isoformat(),
            "subscription_provider": "apple",
            "updated_at": now,
        }},
    )

    return {
        "message": "Subscription activated",
        "plan": plan_key,
        "expiry": expiry.isoformat(),
    }


@app.post("/api/payments/apple/webhook")
async def apple_webhook(request: Request):
    """Handle Apple App Store server notifications (subscription events)."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    notification_type = body.get("notification_type", "")
    unified_receipt = body.get("unified_receipt", {})
    latest_receipt_info = (unified_receipt.get("latest_receipt_info") or [{}])
    if latest_receipt_info:
        latest = latest_receipt_info[-1] if isinstance(latest_receipt_info, list) else {}
    else:
        latest = {}

    original_transaction_id = latest.get("original_transaction_id", "")
    logger.info(f"Apple webhook: {notification_type} for txn {original_transaction_id}")

    # TODO: Implement Apple App Store signature verification (StoreKit 2 JWS)
    # to ensure webhook payloads are authentic and haven't been tampered with.
    # Basic payload validation
    if not notification_type or not original_transaction_id:
        raise HTTPException(status_code=400, detail="Missing required fields: notification_type and original_transaction_id")

    # Handle cancellation/expiry
    if notification_type in ("CANCEL", "DID_FAIL_TO_RENEW", "REFUND"):
        # Find user by apple transaction — search payment_orders
        order = await db.payment_orders.find_one({
            "payment_provider": "apple",
            "status": "paid",
            "apple_transaction_id": original_transaction_id,
        })
        if order:
            await db.users.update_one(
                {"user_id": order["user_id"]},
                {"$set": {"subscription_status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
            )

    return {"status": "ok"}


@app.get("/api/payments/status")
async def payment_status(user: dict = Depends(get_current_user)):
    """Get current subscription status for the user."""
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "subscription_plan": user_doc.get("subscription_plan"),
        "subscription_status": user_doc.get("subscription_status"),
        "subscription_expiry": user_doc.get("subscription_expiry"),
        "subscription_provider": user_doc.get("subscription_provider"),
        "is_active": user_doc.get("subscription_status") == "active",
    }


@app.post("/api/payments/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    """Cancel the user's subscription (keeps access until expiry)."""
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    if user_doc.get("subscription_status") != "active":
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "subscription_status": "cancelled",
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    return {
        "success": True,
        "message": "Subscription cancelled. Access continues until expiry.",
        "expiry": user_doc.get("subscription_expiry"),
    }


# ─── Promo Codes ─────────────────────────────────────────────────────

PROMO_CODES = {
    "SPENTYFOUNDER": {"type": "lifetime", "description": "Founder access"},
    "SPENTYFRIENDS": {"type": "lifetime", "description": "Friends & family"},
    "SPENTYTEST2026": {"type": "lifetime", "description": "Testing access"},
    "SPENTYBETA": {"type": "lifetime", "description": "Beta tester access"},
    "SPENTYDEV": {"type": "lifetime", "description": "Developer access"},
}


class PromoCodeRequest(BaseModel):
    code: str


@app.post("/api/promo/validate")
async def validate_promo_code(data: PromoCodeRequest, user: dict = Depends(get_current_user)):
    """Check if a promo code is valid."""
    code = data.code.strip().upper()
    if code not in PROMO_CODES:
        raise HTTPException(status_code=400, detail="Invalid promo code")

    # Check if user already has active subscription
    if user.get("subscription_status") == "active":
        raise HTTPException(status_code=400, detail="You already have an active subscription")

    return {"valid": True, "code": code, "description": PROMO_CODES[code]["description"], "message": PROMO_CODES[code]["description"]}


@app.post("/api/promo/activate")
async def activate_promo_code(data: PromoCodeRequest, user: dict = Depends(get_current_user)):
    """Activate a promo code — grants lifetime subscription."""
    code = data.code.strip().upper()
    if code not in PROMO_CODES:
        raise HTTPException(status_code=400, detail="Invalid promo code")

    if user.get("subscription_status") == "active":
        raise HTTPException(status_code=400, detail="You already have an active subscription")

    now = datetime.now(timezone.utc)

    # Grant lifetime subscription
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "subscription_plan": "lifetime",
            "subscription_status": "active",
            "subscription_expiry": None,
            "promo_code_used": code,
            "subscription_updated_at": now,
        }}
    )

    # Log the promo activation
    await db.promo_activations.insert_one({
        "user_id": user["user_id"],
        "email": user.get("email"),
        "code": code,
        "activated_at": now,
    })

    return {
        "valid": True,
        "message": "Promo code activated! You now have lifetime access.",
        "subscription_plan": "lifetime",
        "subscription_status": "active",
    }


# ─── Demat / Trading Income ──────────────────────────────────────────

DEMAT_UPLOAD_DIR = "/app/uploads/demat_statements"
os.makedirs(DEMAT_UPLOAD_DIR, exist_ok=True)


class DematManualEntry(BaseModel):
    account_id: str
    date: str  # ISO date string
    net_pnl: float  # positive = profit, negative = loss
    charges: float = 0.0
    description: Optional[str] = None


@app.post("/api/demat/upload-statement")
async def upload_demat_statement(
    file: UploadFile = File(...),
    account_id: str = Form(...),
    period_from: Optional[str] = Form(None),
    period_to: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    """Upload a broker/demat statement (PDF or CSV) and parse trading P&L."""
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
    if account.get("account_type") != "investment":
        raise HTTPException(status_code=400, detail="Account must be an investment/demat type")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    statement_id = f"demat_{uuid.uuid4().hex[:12]}"
    file_path = os.path.join(DEMAT_UPLOAD_DIR, f"{statement_id}.{ext}")
    with open(file_path, "wb") as f:
        f.write(content)

    # Durable copy in GridFS
    has_stored_bytes = False
    try:
        await statement_fs.upload_from_stream_with_id(
            statement_id, f"{statement_id}.{ext}", content,
            metadata={"user_id": user["user_id"], "file_ext": ext, "filename": file.filename, "type": "demat"},
        )
        has_stored_bytes = True
    except Exception as e:
        logger.error(f"GridFS store failed for demat {statement_id}: {e}")

    # Extract text from file
    text = ""
    if ext == "pdf":
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            logger.error(f"PDF extraction failed for {statement_id}: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")
    elif ext == "csv":
        try:
            text = content.decode("utf-8", errors="replace")
        except Exception:
            text = content.decode("latin-1", errors="replace")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    # Parse via OpenAI
    if not async_openai_client:
        raise HTTPException(status_code=500, detail="OpenAI client not configured")

    prompt = f"""You are a financial statement parser. Parse this broker/demat account statement and extract a NET SUMMARY.

Return ONLY valid JSON:
{{
  "period_from": "YYYY-MM-DD or null",
  "period_to": "YYYY-MM-DD or null",
  "total_buy_value": number,
  "total_sell_value": number,
  "charges": {{
    "brokerage": number,
    "stt": number,
    "gst": number,
    "exchange_fees": number,
    "dp_charges": number,
    "stamp_duty": number,
    "other": number,
    "total": number
  }},
  "net_realized_pnl": number (positive = profit, negative = loss),
  "num_trades": number,
  "notes": "any relevant notes"
}}

If the statement is not a valid broker/trading statement, return:
{{"error": "Not a valid trading statement"}}

Statement text:
{text}"""

    try:
        response = await async_openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        raw_reply = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw_reply.startswith("```"):
            raw_reply = raw_reply.split("\n", 1)[-1]
        if raw_reply.endswith("```"):
            raw_reply = raw_reply.rsplit("```", 1)[0]
        parsed = json.loads(raw_reply)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse OpenAI response as JSON")
    except Exception as e:
        logger.error(f"OpenAI demat parse error: {e}")
        raise HTTPException(status_code=500, detail=f"OpenAI parsing failed: {e}")

    if "error" in parsed:
        raise HTTPException(status_code=400, detail=parsed["error"])

    # Use provided period or parsed period
    final_period_from = period_from or parsed.get("period_from")
    final_period_to = period_to or parsed.get("period_to")

    now = datetime.now(timezone.utc)
    user_id = user["user_id"]

    # Store in demat_statements collection — NO transactions created yet.
    # User must approve from the UI before anything hits the ledger.
    demat_doc = {
        "statement_id": statement_id,
        "user_id": user_id,
        "account_id": account_id,
        "filename": file.filename,
        "file_ext": ext,
        "file_path": file_path,
        "file_size": len(content),
        "has_stored_bytes": has_stored_bytes,
        "status": "pending_approval",
        "parsed_summary": parsed,
        "period_from": final_period_from,
        "period_to": final_period_to,
        "transaction_ids": [],
        "created_at": now,
    }
    await db.demat_statements.insert_one(demat_doc)

    return {
        "statement_id": statement_id,
        "parsed_summary": parsed,
        "period_from": final_period_from,
        "period_to": final_period_to,
        "message": "Statement parsed — review and approve to post to ledger",
    }


@app.post("/api/demat/manual-entry")
async def demat_manual_entry(
    data: DematManualEntry,
    user: dict = Depends(get_current_user),
):
    """Manually record trading P&L and charges for a demat account."""
    account = await db.accounts.find_one(
        {"account_id": data.account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.get("account_type") != "investment":
        raise HTTPException(status_code=400, detail="Account must be an investment/demat type")

    now = datetime.now(timezone.utc)
    user_id = user["user_id"]
    transaction_ids = []
    txn_date = data.date or now.strftime("%Y-%m-%d")
    desc_suffix = data.description or txn_date

    # P&L transaction — manual entries are posted directly (no approval needed)
    if data.net_pnl > 0:
        txn_id = f"txn_{uuid.uuid4().hex[:12]}"
        txn = {
            "transaction_id": txn_id,
            "user_id": user_id,
            "account_id": data.account_id,
            "transaction_type": "income",
            "amount": round(abs(data.net_pnl), 2),
            "date": txn_date,
            "description": f"Trading P&L: {desc_suffix}",
            "category_id": None,
            "status": "approved",
            "source": "demat_manual",
            "approved_at": now,
            "created_at": now,
        }
        await db.transactions.insert_one(txn)
        transaction_ids.append(txn_id)
    elif data.net_pnl < 0:
        txn_id = f"txn_{uuid.uuid4().hex[:12]}"
        txn = {
            "transaction_id": txn_id,
            "user_id": user_id,
            "account_id": data.account_id,
            "transaction_type": "expense",
            "amount": round(abs(data.net_pnl), 2),
            "date": txn_date,
            "description": f"Trading Loss: {desc_suffix}",
            "category_id": None,
            "status": "approved",
            "source": "demat_manual",
            "approved_at": now,
            "created_at": now,
        }
        await db.transactions.insert_one(txn)
        transaction_ids.append(txn_id)

    # Charges transaction
    if data.charges > 0:
        charges_txn_id = f"txn_{uuid.uuid4().hex[:12]}"
        charges_txn = {
            "transaction_id": charges_txn_id,
            "user_id": user_id,
            "account_id": data.account_id,
            "transaction_type": "expense",
            "amount": round(abs(data.charges), 2),
            "date": txn_date,
            "description": f"Trading Charges: {desc_suffix}",
            "category_id": None,
            "status": "approved",
            "source": "demat_manual",
            "approved_at": now,
            "created_at": now,
        }
        await db.transactions.insert_one(charges_txn)
        transaction_ids.append(charges_txn_id)

    # Recalculate account balance since transactions are posted directly
    await recalculate_account_balance(user_id, data.account_id)

    return {
        "transaction_ids": transaction_ids,
        "message": "Entry posted to ledger",
    }


@app.get("/api/demat/statements/{account_id}")
async def list_demat_statements(
    account_id: str,
    user: dict = Depends(get_current_user),
):
    """List uploaded demat statements for a given account."""
    account = await db.accounts.find_one(
        {"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    stmts = await db.demat_statements.find(
        {"account_id": account_id, "user_id": user["user_id"]},
        {"_id": 0, "file_path": 0}
    ).sort("created_at", -1).to_list(100)

    # Ensure datetime fields are serializable and add iOS-expected fields
    for s in stmts:
        if "created_at" in s and isinstance(s["created_at"], datetime):
            s["created_at"] = s["created_at"].isoformat()
        # iOS expects uploaded_at (maps from created_at)
        s["uploaded_at"] = s.get("created_at")
        # iOS expects transactions_count
        s["transactions_count"] = len(s.get("transaction_ids", []))

    return {"statements": stmts}


@app.post("/api/demat/approve-statement/{statement_id}")
async def approve_demat_statement(statement_id: str, user: dict = Depends(get_current_user)):
    """Approve a parsed demat statement — creates approved transactions and updates balance."""
    stmt = await db.demat_statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    if stmt.get("status") != "pending_approval":
        raise HTTPException(status_code=400, detail=f"Statement already {stmt.get('status', 'processed')}")

    parsed = stmt.get("parsed_summary", {})
    account_id = stmt["account_id"]
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)
    final_period_from = stmt.get("period_from")
    final_period_to = stmt.get("period_to")
    period_label = f"{final_period_from or '?'} to {final_period_to or '?'}"

    net_pnl = parsed.get("net_realized_pnl", 0)
    total_charges = parsed.get("charges", {}).get("total", 0)
    transaction_ids = []

    # Create P&L transaction (approved immediately)
    if net_pnl > 0:
        txn_id = f"txn_{uuid.uuid4().hex[:12]}"
        txn = {
            "transaction_id": txn_id,
            "user_id": user_id,
            "account_id": account_id,
            "transaction_type": "income",
            "amount": round(abs(net_pnl), 2),
            "date": final_period_to or now.strftime("%Y-%m-%d"),
            "description": f"Trading P&L: {period_label}",
            "category_id": None,
            "status": "approved",
            "source": "demat_statement",
            "demat_statement_id": statement_id,
            "approved_at": now,
            "created_at": now,
        }
        await db.transactions.insert_one(txn)
        transaction_ids.append(txn_id)
    elif net_pnl < 0:
        txn_id = f"txn_{uuid.uuid4().hex[:12]}"
        txn = {
            "transaction_id": txn_id,
            "user_id": user_id,
            "account_id": account_id,
            "transaction_type": "expense",
            "amount": round(abs(net_pnl), 2),
            "date": final_period_to or now.strftime("%Y-%m-%d"),
            "description": f"Trading Loss: {period_label}",
            "category_id": None,
            "status": "approved",
            "source": "demat_statement",
            "demat_statement_id": statement_id,
            "approved_at": now,
            "created_at": now,
        }
        await db.transactions.insert_one(txn)
        transaction_ids.append(txn_id)

    # Create charges transaction (approved immediately)
    if total_charges > 0:
        charges_txn_id = f"txn_{uuid.uuid4().hex[:12]}"
        charges_txn = {
            "transaction_id": charges_txn_id,
            "user_id": user_id,
            "account_id": account_id,
            "transaction_type": "expense",
            "amount": round(abs(total_charges), 2),
            "date": final_period_to or now.strftime("%Y-%m-%d"),
            "description": f"Trading Charges: {period_label}",
            "category_id": None,
            "status": "approved",
            "source": "demat_statement",
            "demat_statement_id": statement_id,
            "approved_at": now,
            "created_at": now,
        }
        await db.transactions.insert_one(charges_txn)
        transaction_ids.append(charges_txn_id)

    # Update statement status and link transactions
    await db.demat_statements.update_one(
        {"statement_id": statement_id},
        {"$set": {"status": "approved", "approved_at": now, "transaction_ids": transaction_ids}}
    )

    # Recalculate account balance
    await recalculate_account_balance(user_id, account_id)

    return {
        "statement_id": statement_id,
        "transaction_ids": transaction_ids,
        "message": "Statement approved — transactions posted to ledger",
    }


@app.post("/api/demat/reject-statement/{statement_id}")
async def reject_demat_statement(statement_id: str, user: dict = Depends(get_current_user)):
    """Reject a parsed demat statement — no transactions are created."""
    stmt = await db.demat_statements.find_one(
        {"statement_id": statement_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    if stmt.get("status") != "pending_approval":
        raise HTTPException(status_code=400, detail=f"Statement already {stmt.get('status', 'processed')}")

    await db.demat_statements.update_one(
        {"statement_id": statement_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc)}}
    )

    return {"statement_id": statement_id, "message": "Statement rejected"}


# ─── Receipt / Bill Upload ───────────────────────────────────────────

@app.post("/api/receipts/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a receipt/bill image or PDF. Returns receipt_id and metadata."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    allowed = ("jpg", "jpeg", "png", "webp", "pdf", "heic")
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed)}")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    receipt_id = f"rcpt_{uuid.uuid4().hex[:12]}"
    file_path = os.path.join(RECEIPT_UPLOAD_DIR, f"{receipt_id}.{ext}")
    with open(file_path, "wb") as f:
        f.write(content)

    # Durable copy in GridFS
    has_stored_bytes = False
    try:
        await receipt_fs.upload_from_stream_with_id(
            receipt_id, f"{receipt_id}.{ext}", content,
            metadata={"user_id": user["user_id"], "file_ext": ext, "filename": file.filename},
        )
        has_stored_bytes = True
    except Exception as e:
        logger.error(f"GridFS store failed for receipt {receipt_id}: {e}")

    # Determine MIME type for preview
    mime_map = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "webp": "image/webp", "pdf": "application/pdf", "heic": "image/heic",
    }

    receipt_doc = {
        "receipt_id": receipt_id,
        "user_id": user["user_id"],
        "filename": file.filename,
        "file_ext": ext,
        "file_path": file_path,
        "file_size": len(content),
        "mime_type": mime_map.get(ext, "application/octet-stream"),
        "has_stored_bytes": has_stored_bytes,
        "transaction_id": None,
        "parsed_data": None,
        "uploaded_at": datetime.now(timezone.utc),
    }
    await db.receipts.insert_one(receipt_doc)
    del receipt_doc["_id"]

    # Convert datetime for JSON
    receipt_doc["uploaded_at"] = receipt_doc["uploaded_at"].isoformat()

    return receipt_doc


@app.post("/api/receipts/{receipt_id}/parse")
async def parse_receipt(receipt_id: str, user: dict = Depends(get_current_user)):
    """Use AI (GPT-4o) to extract transaction details from a receipt image/PDF."""
    receipt = await db.receipts.find_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    if not async_openai_client:
        raise HTTPException(status_code=500, detail="AI service not configured")

    # Read file bytes — try disk first, then GridFS
    file_path = receipt.get("file_path", "")
    content = None
    if os.path.isfile(file_path):
        with open(file_path, "rb") as f:
            content = f.read()
    else:
        try:
            grid_out = await receipt_fs.open_download_stream(receipt_id)
            content = await grid_out.read()
        except Exception:
            raise HTTPException(status_code=404, detail="Receipt file not found")

    ext = receipt.get("file_ext", "")
    mime = receipt.get("mime_type", "application/octet-stream")

    # Fetch user's categories and accounts for better AI matching
    user_categories = await db.categories.find(
        {"user_id": user["user_id"]}, {"_id": 0, "category_id": 1, "name": 1, "category_type": 1, "parent_id": 1}
    ).to_list(500)
    expense_cats = [c for c in user_categories if c.get("category_type") == "expense" and not c.get("parent_id")]
    cat_names = ", ".join([c["name"] for c in expense_cats]) if expense_cats else "No categories set up yet"

    user_accounts = await db.accounts.find(
        {"user_id": user["user_id"]}, {"_id": 0, "account_id": 1, "name": 1}
    ).to_list(100)
    acc_names = ", ".join([a["name"] for a in user_accounts]) if user_accounts else "No accounts set up yet"

    # Build the AI prompt
    system_prompt = f"""You are a receipt/bill parser for an Indian personal finance app.
Extract transaction details from the receipt image or PDF.

The user has these expense categories: {cat_names}
The user has these accounts: {acc_names}

Return a JSON object with these fields (use null for anything you can't determine with confidence):
{{
  "amount": <number or null>,
  "date": "<YYYY-MM-DD or null>",
  "description": "<vendor/merchant name and brief description or null>",
  "category_name": "<best matching category from user's list or a suggested new one or null>",
  "payment_method": "<upi|credit_card|debit_card|net_banking|cash|wallet|cheque|neft|rtgs|imps|other or null>",
  "vendor": "<merchant/vendor name or null>",
  "items": ["{{"item": "name", "qty": 1, "amount": 100}}"] or null
}}

Only return the JSON object, no extra text. Be conservative — only fill fields you're confident about."""

    # Build message with image
    if ext == "pdf":
        # For PDFs, encode as base64 data URL
        import base64 as b64mod
        b64_content = b64mod.b64encode(content).decode("utf-8")
        user_message = [
            {"type": "text", "text": "Parse this receipt/bill and extract the transaction details:"},
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64_content}"}
            }
        ]
    else:
        import base64 as b64mod
        b64_content = b64mod.b64encode(content).decode("utf-8")
        user_message = [
            {"type": "text", "text": "Parse this receipt/bill and extract the transaction details:"},
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64_content}"}
            }
        ]

    try:
        response = await async_openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=1000,
            temperature=0.1,
        )

        raw_text = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        import json
        parsed = json.loads(raw_text)

        # Try to match category_name to actual category_id
        matched_category_id = None
        matched_category_name = parsed.get("category_name")
        if matched_category_name:
            for c in expense_cats:
                if c["name"].lower() == matched_category_name.lower():
                    matched_category_id = c["category_id"]
                    break
            # Fuzzy: check if category name is contained
            if not matched_category_id:
                for c in expense_cats:
                    if matched_category_name.lower() in c["name"].lower() or c["name"].lower() in matched_category_name.lower():
                        matched_category_id = c["category_id"]
                        matched_category_name = c["name"]
                        break

        parsed["category_id"] = matched_category_id
        parsed["category_name"] = matched_category_name

        # Save parsed data to receipt doc
        await db.receipts.update_one(
            {"receipt_id": receipt_id},
            {"$set": {"parsed_data": parsed, "parsed_at": datetime.now(timezone.utc)}}
        )

        return {"receipt_id": receipt_id, "parsed_data": parsed}

    except json.JSONDecodeError:
        return {"receipt_id": receipt_id, "parsed_data": None, "error": "AI could not parse the receipt clearly. Please fill in details manually."}
    except Exception as e:
        logger.error(f"Receipt parse error for {receipt_id}: {e}")
        return {"receipt_id": receipt_id, "parsed_data": None, "error": "Failed to parse receipt. Please fill in details manually."}


@app.post("/api/bills/parse-upload")
async def parse_bill_upload(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a purchase invoice / bill image or PDF and extract structured data via AI."""
    if not async_openai_client:
        raise HTTPException(status_code=500, detail="AI service not configured")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    mime = file.content_type or "application/octet-stream"
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""

    import base64 as b64mod
    b64_content = b64mod.b64encode(content).decode("utf-8")

    # Fetch user's vendors for better matching
    user_vendors = await db.vendors.find(
        {"user_id": user["user_id"]}, {"_id": 0, "vendor_id": 1, "name": 1, "gstin": 1}
    ).to_list(500)
    vendor_names = ", ".join([v["name"] for v in user_vendors]) if user_vendors else "No vendors set up yet"

    system_prompt = f"""You are a purchase invoice / bill parser for an accounting app.
Extract all details from this purchase bill / vendor invoice image or PDF.

The user has these vendors: {vendor_names}

Return a JSON object with these fields (use null for anything you can't determine):
{{
  "vendor_name": "<vendor/supplier company name or null>",
  "vendor_gstin": "<vendor GSTIN if visible or null>",
  "bill_date": "<YYYY-MM-DD or null>",
  "due_date": "<YYYY-MM-DD or null>",
  "bill_reference": "<invoice number / reference on the bill or null>",
  "bill_type": "<'gst' if GST/tax details are present, otherwise 'simple'>",
  "place_of_supply": "<state name if visible or null>",
  "line_items": [
    {{
      "description": "<item name/description>",
      "hsn_sac": "<HSN/SAC code if visible or null>",
      "quantity": <number>,
      "rate": <unit price number>,
      "discount_percent": <discount percentage or 0>,
      "tax_rate": <GST rate percentage or 0>
    }}
  ],
  "subtotal": <number or null>,
  "tax_total": <number or null>,
  "grand_total": <total amount number or null>,
  "notes": "<any additional notes visible or null>"
}}

Only return the JSON object, no extra text. Be thorough — extract every line item visible.
If the document has GST details (CGST, SGST, IGST, GSTIN), set bill_type to 'gst'.
For tax_rate, use the per-item GST rate (e.g. 5, 12, 18, 28), not the total tax amount."""

    user_message = [
        {"type": "text", "text": "Parse this purchase invoice / bill and extract all details:"},
        {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64_content}"}
        }
    ]

    try:
        response = await async_openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=2000,
            temperature=0.1,
        )

        raw_text = response.choices[0].message.content.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        import json
        parsed = json.loads(raw_text)

        # Try to match vendor_name to an existing vendor
        matched_vendor = None
        vendor_name = parsed.get("vendor_name")
        if vendor_name:
            for v in user_vendors:
                if v["name"].lower() == vendor_name.lower():
                    matched_vendor = v
                    break
            if not matched_vendor:
                for v in user_vendors:
                    if vendor_name.lower() in v["name"].lower() or v["name"].lower() in vendor_name.lower():
                        matched_vendor = v
                        break
            # Also try matching by GSTIN
            if not matched_vendor and parsed.get("vendor_gstin"):
                for v in user_vendors:
                    if v.get("gstin") and v["gstin"].upper() == parsed["vendor_gstin"].upper():
                        matched_vendor = v
                        break

        if matched_vendor:
            parsed["matched_vendor_id"] = matched_vendor["vendor_id"]
            parsed["matched_vendor_name"] = matched_vendor["name"]

        return {"parsed_data": parsed}

    except json.JSONDecodeError:
        return {"parsed_data": None, "error": "AI could not parse the bill clearly. Please fill in details manually."}
    except Exception as e:
        logger.error(f"Bill parse-upload error: {e}")
        return {"parsed_data": None, "error": "Failed to parse bill. Please fill in details manually."}


@app.get("/api/receipts/{receipt_id}/download")
async def download_receipt(receipt_id: str, user: dict = Depends(get_current_user)):
    """Download a receipt file."""
    receipt = await db.receipts.find_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Try disk first, then GridFS
    file_path = receipt.get("file_path", "")
    content = None
    if os.path.isfile(file_path):
        with open(file_path, "rb") as f:
            content = f.read()
    else:
        try:
            grid_out = await receipt_fs.open_download_stream(receipt_id)
            content = await grid_out.read()
        except Exception:
            raise HTTPException(status_code=404, detail="Receipt file not found")

    return Response(
        content=content,
        media_type=receipt.get("mime_type", "application/octet-stream"),
        headers={"Content-Disposition": f'inline; filename="{receipt["filename"]}"'},
    )


@app.get("/api/receipts/by-transaction/{transaction_id}")
async def get_receipt_by_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    """Get receipt linked to a specific transaction."""
    receipt = await db.receipts.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]},
        {"_id": 0, "file_path": 0}
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="No receipt found for this transaction")
    if isinstance(receipt.get("uploaded_at"), datetime):
        receipt["uploaded_at"] = receipt["uploaded_at"].isoformat()
    if isinstance(receipt.get("parsed_at"), datetime):
        receipt["parsed_at"] = receipt["parsed_at"].isoformat()
    if isinstance(receipt.get("linked_at"), datetime):
        receipt["linked_at"] = receipt["linked_at"].isoformat()
    return receipt


@app.get("/api/receipts")
async def list_receipts(
    user: dict = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0,
):
    """List all receipts for the user (for Records section)."""
    receipts = await db.receipts.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "file_path": 0}
    ).sort("uploaded_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.receipts.count_documents({"user_id": user["user_id"]})

    for r in receipts:
        if isinstance(r.get("uploaded_at"), datetime):
            r["uploaded_at"] = r["uploaded_at"].isoformat()
        if isinstance(r.get("parsed_at"), datetime):
            r["parsed_at"] = r["parsed_at"].isoformat()
        if isinstance(r.get("linked_at"), datetime):
            r["linked_at"] = r["linked_at"].isoformat()

    return {"receipts": receipts, "total": total}



@app.get("/api/receipts/{receipt_id}")
async def get_receipt(receipt_id: str, user: dict = Depends(get_current_user)):
    """Get a single receipt by ID."""
    receipt = await db.receipts.find_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]},
        {"_id": 0, "file_path": 0}
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if isinstance(receipt.get("uploaded_at"), datetime):
        receipt["uploaded_at"] = receipt["uploaded_at"].isoformat()
    if isinstance(receipt.get("parsed_at"), datetime):
        receipt["parsed_at"] = receipt["parsed_at"].isoformat()
    if isinstance(receipt.get("linked_at"), datetime):
        receipt["linked_at"] = receipt["linked_at"].isoformat()
    return receipt


# --- Endpoint 6.10: DELETE /api/receipts/{receipt_id} ---

@app.delete("/api/receipts/{receipt_id}")
async def delete_receipt(receipt_id: str, user: dict = Depends(get_current_user)):
    """Delete a receipt."""
    receipt = await db.receipts.find_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Delete from GridFS
    try:
        await receipt_fs.delete(receipt_id)
    except Exception:
        pass

    # Delete local file
    file_path = receipt.get("file_path", "")
    if file_path and os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    await db.receipts.delete_one({"receipt_id": receipt_id, "user_id": user["user_id"]})
    return {"message": "Receipt deleted"}


# --- Endpoint 6.11: POST /api/receipts/{receipt_id}/link ---

@app.post("/api/receipts/{receipt_id}/link")
async def link_receipt_to_transaction(receipt_id: str, body: dict = Body(...), user: dict = Depends(get_current_user)):
    """Link a receipt to a transaction."""
    receipt = await db.receipts.find_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    transaction_id = body.get("transaction_id")
    if not transaction_id:
        raise HTTPException(status_code=400, detail="transaction_id is required")

    txn = await db.transactions.find_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    now = datetime.now(timezone.utc)
    await db.receipts.update_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]},
        {"$set": {"transaction_id": transaction_id, "linked_at": now}},
    )
    await db.transactions.update_one(
        {"transaction_id": transaction_id, "user_id": user["user_id"]},
        {"$set": {"receipt_id": receipt_id}},
    )

    return {"message": "Receipt linked to transaction", "receipt_id": receipt_id, "transaction_id": transaction_id}


# =====================================================================


# ─── Amount to Words (INR) Helper ────────────────────────────────────

def amount_to_words_inr(amount: float) -> str:
    """Convert a numeric amount to Indian Rupee words.
    E.g. 1234.50 -> 'One Thousand Two Hundred Thirty Four Rupees and Fifty Paise Only'
    """
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def two_digits(n):
        if n == 0:
            return ""
        if n < 20:
            return ones[n]
        return (tens[n // 10] + " " + ones[n % 10]).strip()

    def three_digits(n):
        if n == 0:
            return ""
        if n >= 100:
            return (ones[n // 100] + " Hundred " + two_digits(n % 100)).strip()
        return two_digits(n)

    if amount < 0:
        amount = abs(amount)

    rupees = int(amount)
    paise = round((amount - rupees) * 100)

    if rupees == 0 and paise == 0:
        return "Zero Rupees Only"

    # Indian numbering: last 3 digits, then groups of 2
    parts = []
    if rupees >= 10000000:
        parts.append(two_digits(rupees // 10000000) + " Crore")
        rupees %= 10000000
    if rupees >= 100000:
        parts.append(two_digits(rupees // 100000) + " Lakh")
        rupees %= 100000
    if rupees >= 1000:
        parts.append(two_digits(rupees // 1000) + " Thousand")
        rupees %= 1000
    if rupees > 0:
        parts.append(three_digits(rupees))

    result = " ".join(p for p in parts if p)
    if result:
        result += " Rupees"
    if paise > 0:
        if result:
            result += " and "
        result += two_digits(paise) + " Paise"
    result += " Only"
    return result


# ─── Customers CRUD ──────────────────────────────────────────────────

@app.post("/api/customers", status_code=201)
async def create_customer(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    now = datetime.now(timezone.utc)
    customer = {
        "customer_id": uuid.uuid4().hex[:16],
        "user_id": user["user_id"],
        "name": body.get("name", ""),
        "gstin": body.get("gstin"),
        "pan": body.get("pan"),
        "phone": body.get("phone"),
        "email": body.get("email"),
        "billing_address": body.get("billing_address"),
        "shipping_address": body.get("shipping_address"),
        "city": body.get("city"),
        "state": body.get("state"),
        "pincode": body.get("pincode"),
        "notes": body.get("notes"),
        "created_at": now,
        "updated_at": now,
    }
    if not customer["name"]:
        raise HTTPException(status_code=400, detail="Customer name is required")
    await db.customers.insert_one(customer)
    del customer["_id"]
    return customer


@app.get("/api/customers")
async def list_customers(
    request: Request,
    user: dict = Depends(get_current_user),
    q: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    query: dict = {"user_id": user["user_id"]}
    if q:
        regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"name": regex},
            {"email": regex},
            {"phone": regex},
            {"gstin": regex},
        ]
    customers = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.customers.count_documents(query)

    # Enrich each customer with aggregated invoice totals
    for cust in customers:
        cid = cust.get("customer_id") or cust.get("customerId")
        if cid:
            pipeline = [
                {"$match": {"customer_id": cid, "user_id": user["user_id"]}},
                {"$group": {
                    "_id": None,
                    "total_invoiced": {"$sum": {"$ifNull": ["$grand_total", 0]}},
                    "total_paid": {"$sum": {"$ifNull": ["$amount_paid", 0]}},
                }},
            ]
            agg = await db.invoices.aggregate(pipeline).to_list(1)
            if agg:
                cust["total_invoiced"] = agg[0].get("total_invoiced", 0)
                cust["total_paid"] = agg[0].get("total_paid", 0)
                cust["outstanding"] = cust["total_invoiced"] - cust["total_paid"]
            else:
                cust["total_invoiced"] = 0
                cust["total_paid"] = 0
                cust["outstanding"] = 0

    return {"items": customers, "total": total}


@app.get("/api/customers/{customer_id}")
async def get_customer(customer_id: str, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one(
        {"customer_id": customer_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@app.put("/api/customers/{customer_id}")
async def update_customer(customer_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    customer = await db.customers.find_one(
        {"customer_id": customer_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    allowed = ["name", "gstin", "pan", "phone", "email", "billing_address", "shipping_address", "city", "state", "pincode", "notes"]
    update_fields = {k: body[k] for k in allowed if k in body}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_fields["updated_at"] = datetime.now(timezone.utc)

    await db.customers.update_one(
        {"customer_id": customer_id, "user_id": user["user_id"]},
        {"$set": update_fields},
    )
    updated = await db.customers.find_one(
        {"customer_id": customer_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return updated


@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(get_current_user)):
    result = await db.customers.delete_one(
        {"customer_id": customer_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"detail": "Customer deleted"}



@app.get("/api/customers/{customer_id}/invoices")
async def get_customer_invoices(
    customer_id: str,
    user: dict = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0,
):
    """Get all invoices for a specific customer."""
    customer = await db.customers.find_one(
        {"customer_id": customer_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    invoices = await db.invoices.find(
        {"customer_id": customer_id, "user_id": user["user_id"]}, {"_id": 0}
    ).sort("invoice_date", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.invoices.count_documents(
        {"customer_id": customer_id, "user_id": user["user_id"]}
    )

    return {"items": camelise(invoices), "total": total, "customer_name": customer.get("name")}


# =====================================================================


# ─── Invoices ─────────────────────────────────────────────────────────

async def _get_next_invoice_number(user_id: str) -> str:
    """Generate the next invoice number from user settings (prefix + auto-increment)."""
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    prefix = (settings or {}).get("invoice_prefix", "INV")
    next_num = (settings or {}).get("invoice_next_number", 1)
    inv_number = f"{prefix}-{next_num:04d}"
    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": {"invoice_next_number": next_num + 1}},
        upsert=True,
    )
    return inv_number


def _calculate_line_items(line_items: list, invoice_type: str, is_same_state: bool) -> list:
    """Recalculate tax fields for each line item."""
    calculated = []
    for item in line_items:
        qty = float(item.get("quantity", 0))
        rate = float(item.get("rate", 0))
        discount_pct = float(item.get("discount_percent", 0))
        taxable = round(qty * rate * (1 - discount_pct / 100), 2)
        # Accept both gst_rate (web) and tax_percent (iOS) as input
        gst_rate = float(item.get("gst_rate", 0) or item.get("tax_percent", 0)) if invoice_type == "gst" else 0

        if invoice_type == "gst" and gst_rate > 0:
            if is_same_state:
                cgst = round(taxable * (gst_rate / 2) / 100, 2)
                sgst = round(taxable * (gst_rate / 2) / 100, 2)
                igst = 0.0
            else:
                cgst = 0.0
                sgst = 0.0
                igst = round(taxable * gst_rate / 100, 2)
        else:
            cgst = 0.0
            sgst = 0.0
            igst = 0.0

        total = round(taxable + cgst + sgst + igst, 2)

        calculated.append({
            "description": item.get("description", ""),
            "hsn_sac": item.get("hsn_sac"),
            "quantity": qty,
            "unit": item.get("unit", "pcs"),
            "rate": rate,
            "discount_percent": discount_pct,
            "taxable_amount": taxable,
            "gst_rate": gst_rate,
            "tax_percent": gst_rate,       # iOS alias
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total": total,
            "amount": total,               # iOS alias
        })
    return calculated


def _calculate_invoice_totals(line_items: list, grand_total_override: float | None = None) -> dict:
    """Aggregate totals from calculated line items."""
    subtotal = sum(i["quantity"] * i["rate"] for i in line_items)
    total_discount = sum(i["quantity"] * i["rate"] - i["taxable_amount"] for i in line_items)
    taxable_value = sum(i["taxable_amount"] for i in line_items)
    total_cgst = sum(i["cgst"] for i in line_items)
    total_sgst = sum(i["sgst"] for i in line_items)
    total_igst = sum(i["igst"] for i in line_items)
    raw_total = taxable_value + total_cgst + total_sgst + total_igst
    grand_total = round(raw_total)
    round_off = round(grand_total - raw_total, 2)

    return {
        "subtotal": round(subtotal, 2),
        "total_discount": round(total_discount, 2),
        "taxable_value": round(taxable_value, 2),
        "total_cgst": round(total_cgst, 2),
        "total_sgst": round(total_sgst, 2),
        "total_igst": round(total_igst, 2),
        "round_off": round_off,
        "grand_total": float(grand_total),
    }


async def _auto_post_invoice_transaction(user_id: str, invoice: dict, amount: float) -> str | None:
    """Create an income transaction for an invoice payment. Returns the transaction_id."""
    if amount <= 0:
        return None

    txn_id = f"txn_{uuid.uuid4().hex[:12]}"
    txn = {
        "transaction_id": txn_id,
        "user_id": user_id,
        "transaction_type": "income",
        "amount": amount,
        "date": invoice.get("payment_date") or invoice["invoice_date"],
        "account_id": invoice.get("payment_account_id", ""),
        "to_account_id": None,
        "category_id": None,
        "subcategory_id": None,
        "description": f"Invoice {invoice['invoice_number']} - {invoice.get('customer_name', '')}",
        "payment_method": invoice.get("payment_method"),
        "is_recurring": False,
        "recurring_frequency": None,
        "source": "invoice",
        "status": "approved",
        "receipt_id": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.transactions.insert_one(txn)
    # Apply to balances
    if txn["account_id"]:
        await apply_transaction_to_balances(user_id, txn)
    return txn_id


@app.get("/api/invoices/count")
async def get_invoice_count(user: dict = Depends(get_current_user)):
    count = await db.invoices.count_documents({"user_id": user["user_id"]})
    return {"count": count}


@app.get("/api/invoices/debtors")
async def get_debtors(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["user_id"], "payment_status": {"$in": ["unpaid", "partial"]}}},
        {"$group": {
            "_id": "$customer_id",
            "customer_name": {"$first": "$customer_name"},
            "total_outstanding": {"$sum": {"$subtract": ["$grand_total", "$amount_paid"]}},
            "invoice_count": {"$sum": 1},
            "oldest_date": {"$min": "$invoice_date"},
        }},
        {"$project": {
            "_id": 0,
            "customer_id": "$_id",
            "customer_name": 1,
            "total_outstanding": 1,
            "invoice_count": 1,
            "oldest_date": 1,
        }},
        {"$sort": {"total_outstanding": -1}},
    ]
    results = await db.invoices.aggregate(pipeline).to_list(1000)
    return results


@app.get("/api/invoices/aging")
async def get_aging(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    invoices = await db.invoices.find(
        {"user_id": user["user_id"], "payment_status": {"$in": ["unpaid", "partial"]}},
        {"_id": 0},
    ).to_list(10000)

    buckets = {
        "current": {"amount": 0, "count": 0, "invoices": []},
        "1_30": {"amount": 0, "count": 0, "invoices": []},
        "31_60": {"amount": 0, "count": 0, "invoices": []},
        "61_90": {"amount": 0, "count": 0, "invoices": []},
        "90_plus": {"amount": 0, "count": 0, "invoices": []},
    }

    for inv in invoices:
        due = inv.get("due_date") or inv.get("invoice_date", today)
        try:
            due_dt = datetime.strptime(due[:10], "%Y-%m-%d")
            today_dt = datetime.strptime(today, "%Y-%m-%d")
            days = (today_dt - due_dt).days
        except Exception:
            days = 0

        outstanding = inv.get("grand_total", 0) - inv.get("amount_paid", 0)
        summary = {
            "invoice_id": inv["invoice_id"],
            "invoice_number": inv.get("invoice_number"),
            "customer_name": inv.get("customer_name"),
            "outstanding": outstanding,
            "due_date": due,
            "days_overdue": max(days, 0),
        }

        if days <= 0:
            bucket = "current"
        elif days <= 30:
            bucket = "1_30"
        elif days <= 60:
            bucket = "31_60"
        elif days <= 90:
            bucket = "61_90"
        else:
            bucket = "90_plus"

        buckets[bucket]["amount"] += outstanding
        buckets[bucket]["count"] += 1
        buckets[bucket]["invoices"].append(summary)

    # Round amounts
    for b in buckets.values():
        b["amount"] = round(b["amount"], 2)

    # Convert dict to array with label field for iOS compatibility
    label_map = {
        "current": "Current",
        "1_30": "1-30 Days",
        "31_60": "31-60 Days",
        "61_90": "61-90 Days",
        "90_plus": "90+ Days",
    }
    result = []
    for key, data in buckets.items():
        result.append({
            "label": label_map.get(key, key),
            "amount": data["amount"],
            "count": data["count"],
            "invoices": data["invoices"],
        })
    return result


@app.get("/api/invoices/sales-by-customer")
async def get_sales_by_customer(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {
            "_id": "$customer_id",
            "customer_name": {"$first": "$customer_name"},
            "total_sales": {"$sum": "$grand_total"},
            "invoice_count": {"$sum": 1},
            "last_invoice_date": {"$max": "$invoice_date"},
        }},
        {"$project": {
            "_id": 0,
            "customer_id": "$_id",
            "customer_name": 1,
            "total_sales": 1,
            "invoice_count": 1,
            "last_invoice_date": 1,
        }},
        {"$sort": {"total_sales": -1}},
    ]
    results = await db.invoices.aggregate(pipeline).to_list(1000)
    return {"items": results, "total": len(results)}


@app.post("/api/invoices", status_code=201)
async def create_invoice(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    now = datetime.now(timezone.utc)

    # Determine same-state for GST
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    firm_state = (settings or {}).get("firm_state", "")
    customer_state = body.get("customer_state") or body.get("place_of_supply") or ""
    is_same_state = firm_state.strip().lower() == customer_state.strip().lower() if firm_state and customer_state else True

    invoice_type = body.get("invoice_type", "simple")
    raw_items = body.get("line_items", [])
    if not raw_items:
        raise HTTPException(status_code=400, detail="At least one line item is required")

    line_items = _calculate_line_items(raw_items, invoice_type, is_same_state)
    totals = _calculate_invoice_totals(line_items)

    invoice_number = await _get_next_invoice_number(user["user_id"])

    payment_status = body.get("payment_status", "unpaid")
    amount_paid = float(body.get("amount_paid", 0))
    if payment_status == "paid":
        amount_paid = totals["grand_total"]

    invoice = {
        "invoice_id": uuid.uuid4().hex[:16],
        "user_id": user["user_id"],
        "invoice_number": invoice_number,
        "invoice_type": invoice_type,
        "invoice_date": body.get("invoice_date", now.strftime("%Y-%m-%d")),
        "due_date": body.get("due_date"),
        "payment_terms": body.get("payment_terms"),
        "customer_id": body.get("customer_id", ""),
        "customer_name": body.get("customer_name", ""),
        "customer_gstin": body.get("customer_gstin"),
        "customer_address": body.get("customer_address"),
        "customer_state": customer_state,
        "place_of_supply": body.get("place_of_supply"),
        "line_items": line_items,
        **totals,
        "amount_in_words": amount_to_words_inr(totals["grand_total"]),
        "payment_status": payment_status,
        "amount_paid": amount_paid,
        "payment_account_id": body.get("payment_account_id"),
        "payment_method": body.get("payment_method"),
        "payment_date": body.get("payment_date"),
        "transaction_id": None,
        "po_number": body.get("po_number"),
        "notes": body.get("notes"),
        "terms_conditions": body.get("terms_conditions", (settings or {}).get("invoice_terms")),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    # Auto-post transaction for paid / partial
    if payment_status == "paid":
        txn_id = await _auto_post_invoice_transaction(user["user_id"], invoice, totals["grand_total"])
        invoice["transaction_id"] = txn_id
    elif payment_status == "partial" and amount_paid > 0:
        txn_id = await _auto_post_invoice_transaction(user["user_id"], invoice, amount_paid)
        invoice["transaction_id"] = txn_id

    await db.invoices.insert_one(invoice)
    del invoice["_id"]
    return camelise(invoice)


@app.get("/api/invoices")
async def list_invoices(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    query: dict = {"user_id": user["user_id"]}
    if status:
        query["payment_status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    if from_date:
        query.setdefault("invoice_date", {})["$gte"] = from_date
    if to_date:
        query.setdefault("invoice_date", {})["$lte"] = to_date

    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.invoices.count_documents(query)
    return {"items": camelise(invoices), "total": total}

@app.get("/api/invoices/next-number")
async def get_next_invoice_number(user: dict = Depends(get_current_user)):
    """Preview the next invoice number without consuming it."""
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    prefix = (settings or {}).get("invoice_prefix", "INV")
    next_num = (settings or {}).get("invoice_next_number", 1)
    return {"next_number": f"{prefix}-{next_num:04d}"}

@app.get("/api/invoices/stats")
async def invoice_stats(user: dict = Depends(get_current_user)):
    """Get invoice statistics for the user."""
    user_id = user["user_id"]
    total = await db.invoices.count_documents({"user_id": user_id})
    paid = await db.invoices.count_documents({"user_id": user_id, "payment_status": "paid"})
    unpaid = await db.invoices.count_documents({"user_id": user_id, "payment_status": "unpaid"})
    partial = await db.invoices.count_documents({"user_id": user_id, "payment_status": "partial"})

    invoices = await db.invoices.find(
        {"user_id": user_id}, {"_id": 0, "grand_total": 1, "amount_paid": 1, "payment_status": 1}
    ).to_list(10000)

    total_invoiced = sum(i.get("grand_total", 0) for i in invoices)
    total_paid = sum(i.get("amount_paid", 0) for i in invoices)
    total_outstanding = total_invoiced - total_paid

    # Calculate total overdue: outstanding amounts for invoices past due date
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    overdue_invoices = await db.invoices.find(
        {
            "user_id": user_id,
            "payment_status": {"$in": ["unpaid", "partial"]},
            "due_date": {"$lt": today_str},
        },
        {"_id": 0, "grand_total": 1, "amount_paid": 1},
    ).to_list(10000)
    total_overdue = sum(
        i.get("grand_total", 0) - i.get("amount_paid", 0) for i in overdue_invoices
    )

    return camelise({
        "total": total,
        "paid": paid,
        "unpaid": unpaid,
        "partial": partial,
        "total_invoiced": round(total_invoiced, 2),
        "total_paid": round(total_paid, 2),
        "total_outstanding": round(total_outstanding, 2),
        "total_overdue": round(total_overdue, 2),
    })





@app.get("/api/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return camelise(invoice)


@app.put("/api/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_fields: dict = {}

    # Recalculate line items if provided
    if "line_items" in body:
        settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
        firm_state = (settings or {}).get("firm_state", "")
        customer_state = body.get("customer_state", invoice.get("customer_state", ""))
        is_same_state = firm_state.strip().lower() == customer_state.strip().lower() if firm_state and customer_state else True
        invoice_type = body.get("invoice_type", invoice.get("invoice_type", "simple"))

        line_items = _calculate_line_items(body["line_items"], invoice_type, is_same_state)
        totals = _calculate_invoice_totals(line_items)
        update_fields["line_items"] = line_items
        update_fields.update(totals)
        update_fields["amount_in_words"] = amount_to_words_inr(totals["grand_total"])

    # Copy simple fields
    simple_keys = [
        "invoice_type", "invoice_date", "due_date", "payment_terms",
        "customer_id", "customer_name", "customer_gstin", "customer_address",
        "customer_state", "place_of_supply", "payment_status", "amount_paid",
        "payment_account_id", "payment_method", "payment_date",
        "po_number", "notes", "terms_conditions",
    ]
    for k in simple_keys:
        if k in body:
            update_fields[k] = body[k]

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.invoices.update_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]},
        {"$set": update_fields},
    )
    updated = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return camelise(updated)


@app.delete("/api/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Delete linked transaction if any
    if invoice.get("transaction_id"):
        await db.transactions.delete_one(
            {"transaction_id": invoice["transaction_id"], "user_id": user["user_id"]}
        )
        # Recalculate balance for the account
        if invoice.get("payment_account_id"):
            await recalculate_account_balance(user["user_id"], invoice["payment_account_id"])

    await db.invoices.delete_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}
    )
    return {"detail": "Invoice deleted"}


@app.post("/api/invoices/{invoice_id}/record-payment")
async def record_payment(invoice_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pay_amount = float(body.get("amount", 0))
    if pay_amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    new_paid = invoice.get("amount_paid", 0) + pay_amount
    grand_total = invoice.get("grand_total", 0)

    if new_paid >= grand_total:
        new_status = "paid"
        new_paid = grand_total
    else:
        new_status = "partial"

    payment_info = {
        "payment_account_id": body.get("account_id", invoice.get("payment_account_id")),
        "payment_method": body.get("payment_method") or body.get("method", invoice.get("payment_method")),
        "payment_date": body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
    }

    # Build payment history entry
    payment_entry = {
        "amount": pay_amount,
        "date": payment_info["payment_date"],
        "method": payment_info["payment_method"],
        "account_id": payment_info["payment_account_id"],
        "note": body.get("note"),
    }

    # Create or update transaction
    existing_txn_id = invoice.get("transaction_id")
    if existing_txn_id:
        # Update existing transaction amount
        await db.transactions.update_one(
            {"transaction_id": existing_txn_id, "user_id": user["user_id"]},
            {"$set": {
                "amount": new_paid,
                "date": payment_info["payment_date"],
                "account_id": payment_info["payment_account_id"] or "",
                "payment_method": payment_info["payment_method"],
            }},
        )
        # Recalculate balances
        if payment_info["payment_account_id"]:
            await recalculate_account_balance(user["user_id"], payment_info["payment_account_id"])
        txn_id = existing_txn_id
    else:
        # Create new transaction
        inv_for_txn = {**invoice, **payment_info, "payment_account_id": payment_info["payment_account_id"]}
        txn_id = await _auto_post_invoice_transaction(user["user_id"], inv_for_txn, new_paid)

    await db.invoices.update_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]},
        {
            "$set": {
                "payment_status": new_status,
                "amount_paid": new_paid,
                "transaction_id": txn_id,
                **payment_info,
                "updated_at": datetime.now(timezone.utc),
            },
            "$push": {
                "payments": payment_entry,
            },
        },
    )

    updated = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return camelise(updated)


@app.get("/api/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str, user: dict = Depends(get_current_user)):
    """Generate a PDF for the invoice (returns HTML for now, clients render)."""
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}

    # Return invoice data with settings for client-side PDF generation
    return {
        "invoice": camelise(invoice),
        "settings": {
            "firm_name": settings.get("firm_name", ""),
            "firm_address": settings.get("firm_address", ""),
            "firm_city": settings.get("firm_city", ""),
            "firm_state": settings.get("firm_state", ""),
            "firm_pincode": settings.get("firm_pincode", ""),
            "firm_gstin": settings.get("firm_gstin", ""),
            "firm_pan": settings.get("firm_pan", ""),
            "firm_phone": settings.get("firm_phone", ""),
            "firm_email": settings.get("firm_email", ""),
            "invoice_bank_name": settings.get("invoice_bank_name", ""),
            "invoice_bank_account_no": settings.get("invoice_bank_account_no", ""),
            "invoice_bank_ifsc": settings.get("invoice_bank_ifsc", ""),
            "invoice_bank_branch": settings.get("invoice_bank_branch", ""),
            "logo_url": settings.get("logo_url"),
            "signature_url": settings.get("signature_url"),
        },
    }


@app.post("/api/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(invoice_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Mark an invoice as fully paid."""
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")

    body = await request.json() if request.headers.get("content-length", "0") != "0" else {}
    now = datetime.now(timezone.utc)
    grand_total = invoice.get("grand_total", 0)

    payment_info = {
        "payment_status": "paid",
        "amount_paid": grand_total,
        "payment_account_id": body.get("account_id", invoice.get("payment_account_id")),
        "payment_method": body.get("payment_method", invoice.get("payment_method")),
        "payment_date": body.get("date", now.strftime("%Y-%m-%d")),
        "updated_at": now,
    }

    # Create transaction if not exists
    if not invoice.get("transaction_id") and payment_info["payment_account_id"]:
        inv_for_txn = {**invoice, **payment_info}
        txn_id = await _auto_post_invoice_transaction(user["user_id"], inv_for_txn, grand_total)
        payment_info["transaction_id"] = txn_id

    await db.invoices.update_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]},
        {"$set": payment_info},
    )

    updated = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return camelise(updated)


@app.post("/api/invoices/{invoice_id}/duplicate")
async def duplicate_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    """Create a duplicate of an existing invoice with a new number."""
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    now = datetime.now(timezone.utc)
    new_number = await _get_next_invoice_number(user["user_id"])

    new_invoice = {**invoice}
    new_invoice["invoice_id"] = uuid.uuid4().hex[:16]
    new_invoice["invoice_number"] = new_number
    new_invoice["invoice_date"] = now.strftime("%Y-%m-%d")
    new_invoice["payment_status"] = "unpaid"
    new_invoice["amount_paid"] = 0
    new_invoice["transaction_id"] = None
    new_invoice["created_at"] = now
    new_invoice["updated_at"] = now

    await db.invoices.insert_one(new_invoice)
    del new_invoice["_id"]
    return camelise(new_invoice)


# =============================================================================


# ─── Vendors CRUD ──────────────────────────────────────────────────

@app.post("/api/vendors", status_code=201)
async def create_vendor(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    now = datetime.now(timezone.utc)
    vendor = {
        "vendor_id": uuid.uuid4().hex[:16],
        "user_id": user["user_id"],
        "name": body.get("name", ""),
        "gstin": body.get("gstin"),
        "pan": body.get("pan"),
        "phone": body.get("phone"),
        "email": body.get("email"),
        "billing_address": body.get("billing_address"),
        "city": body.get("city"),
        "state": body.get("state"),
        "pincode": body.get("pincode"),
        "notes": body.get("notes"),
        "created_at": now,
        "updated_at": now,
    }
    if not vendor["name"]:
        raise HTTPException(status_code=400, detail="Vendor name is required")
    await db.vendors.insert_one(vendor)
    del vendor["_id"]
    return vendor


@app.get("/api/vendors")
async def list_vendors(
    request: Request,
    user: dict = Depends(get_current_user),
    q: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    query: dict = {"user_id": user["user_id"]}
    if q:
        regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"name": regex},
            {"email": regex},
            {"phone": regex},
            {"gstin": regex},
        ]
    vendors = await db.vendors.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.vendors.count_documents(query)
    return {"items": vendors, "total": total}


@app.get("/api/vendors/{vendor_id}")
async def get_vendor(vendor_id: str, user: dict = Depends(get_current_user)):
    vendor = await db.vendors.find_one(
        {"vendor_id": vendor_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@app.put("/api/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    vendor = await db.vendors.find_one(
        {"vendor_id": vendor_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    allowed = ["name", "gstin", "pan", "phone", "email", "billing_address", "city", "state", "pincode", "notes"]
    update_fields = {k: body[k] for k in allowed if k in body}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_fields["updated_at"] = datetime.now(timezone.utc)

    await db.vendors.update_one(
        {"vendor_id": vendor_id, "user_id": user["user_id"]},
        {"$set": update_fields},
    )
    updated = await db.vendors.find_one(
        {"vendor_id": vendor_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return updated


@app.delete("/api/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, user: dict = Depends(get_current_user)):
    result = await db.vendors.delete_one(
        {"vendor_id": vendor_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"detail": "Vendor deleted"}



@app.get("/api/vendors/{vendor_id}/bills")
async def get_vendor_bills(
    vendor_id: str,
    user: dict = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0,
):
    """Get all bills for a specific vendor."""
    vendor = await db.vendors.find_one(
        {"vendor_id": vendor_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    bills = await db.bills.find(
        {"vendor_id": vendor_id, "user_id": user["user_id"]}, {"_id": 0}
    ).sort("bill_date", -1).skip(skip).limit(limit).to_list(limit)

    total = await db.bills.count_documents(
        {"vendor_id": vendor_id, "user_id": user["user_id"]}
    )

    return {"items": bills, "total": total, "vendor_name": vendor.get("name")}


# ─── Purchase Bills ─────────────────────────────────────────────────

async def _get_next_bill_number(user_id: str) -> str:
    """Generate the next bill number from user settings (prefix + auto-increment)."""
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    prefix = (settings or {}).get("bill_prefix", "BILL")
    next_num = (settings or {}).get("bill_next_number", 1)
    bill_number = f"{prefix}-{next_num:04d}"
    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": {"bill_next_number": next_num + 1}},
        upsert=True,
    )
    return bill_number


async def _auto_post_bill_transaction(user_id: str, bill: dict, amount: float) -> str | None:
    """Create an expense transaction for a bill payment. Returns the transaction_id."""
    if amount <= 0:
        return None

    txn_id = f"txn_{uuid.uuid4().hex[:12]}"
    txn = {
        "transaction_id": txn_id,
        "user_id": user_id,
        "transaction_type": "expense",
        "amount": amount,
        "date": bill.get("payment_date") or bill["bill_date"],
        "account_id": bill.get("payment_account_id", ""),
        "to_account_id": None,
        "category_id": None,
        "subcategory_id": None,
        "description": f"Bill {bill['bill_number']} - {bill.get('vendor_name', '')}",
        "payment_method": bill.get("payment_method"),
        "is_recurring": False,
        "recurring_frequency": None,
        "source": "bill",
        "status": "approved",
        "receipt_id": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.transactions.insert_one(txn)
    # Apply to balances
    if txn["account_id"]:
        await apply_transaction_to_balances(user_id, txn)
    return txn_id


@app.get("/api/bills/count")
async def get_bill_count(user: dict = Depends(get_current_user)):
    count = await db.bills.count_documents({"user_id": user["user_id"]})
    return {"count": count}


@app.get("/api/bills/creditors")
async def get_creditors(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["user_id"], "payment_status": {"$in": ["unpaid", "partial"]}}},
        {"$group": {
            "_id": "$vendor_id",
            "vendor_name": {"$first": "$vendor_name"},
            "total_outstanding": {"$sum": {"$subtract": ["$grand_total", "$amount_paid"]}},
            "bill_count": {"$sum": 1},
            "oldest_date": {"$min": "$bill_date"},
        }},
        {"$project": {
            "_id": 0,
            "vendor_id": "$_id",
            "vendor_name": 1,
            "total_outstanding": 1,
            "bill_count": 1,
            "oldest_date": 1,
        }},
        {"$sort": {"total_outstanding": -1}},
    ]
    results = await db.bills.aggregate(pipeline).to_list(1000)
    return {"items": results, "total": len(results)}


@app.get("/api/bills/aging")
async def get_bill_aging(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bills = await db.bills.find(
        {"user_id": user["user_id"], "payment_status": {"$in": ["unpaid", "partial"]}},
        {"_id": 0},
    ).to_list(10000)

    buckets = {
        "current": {"amount": 0, "count": 0, "bills": []},
        "1_30": {"amount": 0, "count": 0, "bills": []},
        "31_60": {"amount": 0, "count": 0, "bills": []},
        "61_90": {"amount": 0, "count": 0, "bills": []},
        "90_plus": {"amount": 0, "count": 0, "bills": []},
    }

    for bill in bills:
        due = bill.get("due_date") or bill.get("bill_date", today)
        try:
            due_dt = datetime.strptime(due[:10], "%Y-%m-%d")
            today_dt = datetime.strptime(today, "%Y-%m-%d")
            days = (today_dt - due_dt).days
        except Exception:
            days = 0

        outstanding = bill.get("grand_total", 0) - bill.get("amount_paid", 0)
        summary = {
            "bill_id": bill["bill_id"],
            "bill_number": bill.get("bill_number"),
            "vendor_name": bill.get("vendor_name"),
            "outstanding": outstanding,
            "due_date": due,
            "days_overdue": max(days, 0),
        }

        if days <= 0:
            bucket = "current"
        elif days <= 30:
            bucket = "1_30"
        elif days <= 60:
            bucket = "31_60"
        elif days <= 90:
            bucket = "61_90"
        else:
            bucket = "90_plus"

        buckets[bucket]["amount"] += outstanding
        buckets[bucket]["count"] += 1
        buckets[bucket]["bills"].append(summary)

    # Round amounts
    for b in buckets.values():
        b["amount"] = round(b["amount"], 2)

    # Convert dict to array with label field for iOS compatibility
    label_map = {
        "current": "Current",
        "1_30": "1-30 Days",
        "31_60": "31-60 Days",
        "61_90": "61-90 Days",
        "90_plus": "90+ Days",
    }
    result = []
    for key, data in buckets.items():
        result.append({
            "label": label_map.get(key, key),
            "amount": data["amount"],
            "count": data["count"],
            "bills": data["bills"],
        })
    return result


@app.get("/api/bills/purchases-by-vendor")
async def get_purchases_by_vendor(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {
            "_id": "$vendor_id",
            "vendor_name": {"$first": "$vendor_name"},
            "total_purchases": {"$sum": "$grand_total"},
            "bill_count": {"$sum": 1},
            "last_bill_date": {"$max": "$bill_date"},
        }},
        {"$project": {
            "_id": 0,
            "vendor_id": "$_id",
            "vendor_name": 1,
            "total_purchases": 1,
            "bill_count": 1,
            "last_bill_date": 1,
        }},
        {"$sort": {"total_purchases": -1}},
    ]
    results = await db.bills.aggregate(pipeline).to_list(1000)
    return {"items": results, "total": len(results)}


@app.post("/api/bills", status_code=201)
async def create_bill(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    now = datetime.now(timezone.utc)

    # Determine same-state for GST
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    firm_state = (settings or {}).get("firm_state", "")
    vendor_state = body.get("vendor_state") or body.get("place_of_supply") or ""
    is_same_state = firm_state.strip().lower() == vendor_state.strip().lower() if firm_state and vendor_state else True

    bill_type = body.get("bill_type", "simple")
    raw_items = body.get("line_items", [])
    if not raw_items:
        raise HTTPException(status_code=400, detail="At least one line item is required")

    line_items = _calculate_line_items(raw_items, bill_type, is_same_state)
    totals = _calculate_invoice_totals(line_items)

    bill_number = await _get_next_bill_number(user["user_id"])

    payment_status = body.get("payment_status", "unpaid")
    amount_paid = float(body.get("amount_paid", 0))
    if payment_status == "paid":
        amount_paid = totals["grand_total"]

    bill = {
        "bill_id": uuid.uuid4().hex[:16],
        "user_id": user["user_id"],
        "bill_number": bill_number,
        "bill_type": bill_type,
        "bill_date": body.get("bill_date", now.strftime("%Y-%m-%d")),
        "due_date": body.get("due_date"),
        "payment_terms": body.get("payment_terms"),
        "vendor_id": body.get("vendor_id", ""),
        "vendor_name": body.get("vendor_name", ""),
        "vendor_gstin": body.get("vendor_gstin"),
        "vendor_address": body.get("vendor_address"),
        "vendor_state": vendor_state,
        "place_of_supply": body.get("place_of_supply"),
        "line_items": line_items,
        **totals,
        "amount_in_words": amount_to_words_inr(totals["grand_total"]),
        "payment_status": payment_status,
        "amount_paid": amount_paid,
        "payment_account_id": body.get("payment_account_id"),
        "payment_method": body.get("payment_method"),
        "payment_date": body.get("payment_date"),
        "transaction_id": None,
        "bill_reference": body.get("bill_reference"),
        "po_number": body.get("po_number"),
        "notes": body.get("notes"),
        "terms_conditions": body.get("terms_conditions", (settings or {}).get("bill_terms")),
        "created_at": now,
        "updated_at": now,
    }

    # Auto-post transaction for paid / partial
    if payment_status == "paid":
        txn_id = await _auto_post_bill_transaction(user["user_id"], bill, totals["grand_total"])
        bill["transaction_id"] = txn_id
    elif payment_status == "partial" and amount_paid > 0:
        txn_id = await _auto_post_bill_transaction(user["user_id"], bill, amount_paid)
        bill["transaction_id"] = txn_id

    await db.bills.insert_one(bill)
    del bill["_id"]
    return bill


@app.get("/api/bills")
async def list_bills(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    query: dict = {"user_id": user["user_id"]}
    if status:
        query["payment_status"] = status
    if vendor_id:
        query["vendor_id"] = vendor_id
    if from_date:
        query.setdefault("bill_date", {})["$gte"] = from_date
    if to_date:
        query.setdefault("bill_date", {})["$lte"] = to_date

    bills = await db.bills.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.bills.count_documents(query)
    return {"items": bills, "total": total}

@app.get("/api/bills/next-number")
async def get_next_bill_number(user: dict = Depends(get_current_user)):
    """Preview the next bill number without consuming it."""
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    prefix = (settings or {}).get("bill_prefix", "BILL")
    next_num = (settings or {}).get("bill_next_number", 1)
    return {"next_number": f"{prefix}-{next_num:04d}"}

@app.get("/api/bills/stats")
async def bill_stats(user: dict = Depends(get_current_user)):
    """Get bill statistics for the user."""
    user_id = user["user_id"]
    total = await db.bills.count_documents({"user_id": user_id})
    paid = await db.bills.count_documents({"user_id": user_id, "payment_status": "paid"})
    unpaid = await db.bills.count_documents({"user_id": user_id, "payment_status": "unpaid"})
    partial = await db.bills.count_documents({"user_id": user_id, "payment_status": "partial"})

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    bills = await db.bills.find(
        {"user_id": user_id}, {"_id": 0, "grand_total": 1, "amount_paid": 1, "payment_status": 1, "due_date": 1}
    ).to_list(10000)

    total_billed = sum(b.get("grand_total", 0) for b in bills)
    total_paid = sum(b.get("amount_paid", 0) for b in bills)
    total_outstanding = total_billed - total_paid

    total_overdue = sum(
        b.get("grand_total", 0) - b.get("amount_paid", 0)
        for b in bills
        if b.get("payment_status") != "paid"
        and b.get("due_date", "") < today
        and b.get("due_date", "") != ""
    )

    return {
        "total": total,
        "paid": paid,
        "unpaid": unpaid,
        "partial": partial,
        "total_billed": round(total_billed, 2),
        "total_paid": round(total_paid, 2),
        "total_outstanding": round(total_outstanding, 2),
        "total_overdue": round(total_overdue, 2),
    }





@app.get("/api/bills/{bill_id}")
async def get_bill(bill_id: str, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@app.put("/api/bills/{bill_id}")
async def update_bill(bill_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    bill = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    update_fields: dict = {}

    # Recalculate line items if provided
    if "line_items" in body:
        settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
        firm_state = (settings or {}).get("firm_state", "")
        vendor_state = body.get("vendor_state", bill.get("vendor_state", ""))
        is_same_state = firm_state.strip().lower() == vendor_state.strip().lower() if firm_state and vendor_state else True
        bill_type = body.get("bill_type", bill.get("bill_type", "simple"))

        line_items = _calculate_line_items(body["line_items"], bill_type, is_same_state)
        totals = _calculate_invoice_totals(line_items)
        update_fields["line_items"] = line_items
        update_fields.update(totals)
        update_fields["amount_in_words"] = amount_to_words_inr(totals["grand_total"])

    # Copy simple fields
    simple_keys = [
        "bill_type", "bill_date", "due_date", "payment_terms",
        "vendor_id", "vendor_name", "vendor_gstin", "vendor_address",
        "vendor_state", "place_of_supply", "payment_status", "amount_paid",
        "payment_account_id", "payment_method", "payment_date",
        "bill_reference", "po_number", "notes", "terms_conditions",
    ]
    for k in simple_keys:
        if k in body:
            update_fields[k] = body[k]

    update_fields["updated_at"] = datetime.now(timezone.utc)

    await db.bills.update_one(
        {"bill_id": bill_id, "user_id": user["user_id"]},
        {"$set": update_fields},
    )
    updated = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return updated


@app.delete("/api/bills/{bill_id}")
async def delete_bill(bill_id: str, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    # Delete linked transaction if any
    if bill.get("transaction_id"):
        await db.transactions.delete_one(
            {"transaction_id": bill["transaction_id"], "user_id": user["user_id"]}
        )
        # Recalculate balance for the account
        if bill.get("payment_account_id"):
            await recalculate_account_balance(user["user_id"], bill["payment_account_id"])

    await db.bills.delete_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}
    )
    return {"detail": "Bill deleted"}


@app.post("/api/bills/{bill_id}/record-payment")
async def record_bill_payment(bill_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    bill = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    pay_amount = float(body.get("amount", 0))
    if pay_amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    new_paid = bill.get("amount_paid", 0) + pay_amount
    grand_total = bill.get("grand_total", 0)

    if new_paid >= grand_total:
        new_status = "paid"
        new_paid = grand_total
    else:
        new_status = "partial"

    payment_info = {
        "payment_account_id": body.get("account_id", bill.get("payment_account_id")),
        "payment_method": body.get("payment_method", bill.get("payment_method")),
        "payment_date": body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
    }

    # Create or update transaction
    existing_txn_id = bill.get("transaction_id")
    if existing_txn_id:
        # Update existing transaction amount
        await db.transactions.update_one(
            {"transaction_id": existing_txn_id, "user_id": user["user_id"]},
            {"$set": {
                "amount": new_paid,
                "date": payment_info["payment_date"],
                "account_id": payment_info["payment_account_id"] or "",
                "payment_method": payment_info["payment_method"],
            }},
        )
        # Recalculate balances
        if payment_info["payment_account_id"]:
            await recalculate_account_balance(user["user_id"], payment_info["payment_account_id"])
        txn_id = existing_txn_id
    else:
        # Create new transaction
        bill_for_txn = {**bill, **payment_info, "payment_account_id": payment_info["payment_account_id"]}
        txn_id = await _auto_post_bill_transaction(user["user_id"], bill_for_txn, new_paid)

    await db.bills.update_one(
        {"bill_id": bill_id, "user_id": user["user_id"]},
        {"$set": {
            "payment_status": new_status,
            "amount_paid": new_paid,
            "transaction_id": txn_id,
            **payment_info,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    updated = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return updated


@app.get("/api/bills/{bill_id}/pdf")
async def get_bill_pdf(bill_id: str, user: dict = Depends(get_current_user)):
    """Return bill data with settings for client-side PDF generation."""
    bill = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}

    return {
        "bill": bill,
        "settings": {
            "firm_name": settings.get("firm_name", ""),
            "firm_address": settings.get("firm_address", ""),
            "firm_city": settings.get("firm_city", ""),
            "firm_state": settings.get("firm_state", ""),
            "firm_pincode": settings.get("firm_pincode", ""),
            "firm_gstin": settings.get("firm_gstin", ""),
            "firm_pan": settings.get("firm_pan", ""),
            "logo_url": settings.get("logo_url"),
        },
    }


@app.post("/api/bills/{bill_id}/mark-paid")
async def mark_bill_paid(bill_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Mark a bill as fully paid."""
    bill = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Bill already paid")

    body = await request.json() if request.headers.get("content-length", "0") != "0" else {}
    now = datetime.now(timezone.utc)
    grand_total = bill.get("grand_total", 0)

    payment_info = {
        "payment_status": "paid",
        "amount_paid": grand_total,
        "payment_account_id": body.get("account_id", bill.get("payment_account_id")),
        "payment_method": body.get("payment_method", bill.get("payment_method")),
        "payment_date": body.get("date", now.strftime("%Y-%m-%d")),
        "updated_at": now,
    }

    # Create transaction if not exists
    if not bill.get("transaction_id") and payment_info["payment_account_id"]:
        bill_for_txn = {**bill, **payment_info}
        txn_id = await _auto_post_bill_transaction(user["user_id"], bill_for_txn, grand_total)
        payment_info["transaction_id"] = txn_id

    await db.bills.update_one(
        {"bill_id": bill_id, "user_id": user["user_id"]},
        {"$set": payment_info},
    )

    updated = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return updated


@app.post("/api/bills/{bill_id}/duplicate")
async def duplicate_bill(bill_id: str, user: dict = Depends(get_current_user)):
    """Create a duplicate of an existing bill with a new number."""
    bill = await db.bills.find_one(
        {"bill_id": bill_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    now = datetime.now(timezone.utc)
    new_number = await _get_next_bill_number(user["user_id"])

    new_bill = {**bill}
    new_bill["bill_id"] = uuid.uuid4().hex[:16]
    new_bill["bill_number"] = new_number
    new_bill["bill_date"] = now.strftime("%Y-%m-%d")
    new_bill["payment_status"] = "unpaid"
    new_bill["amount_paid"] = 0
    new_bill["transaction_id"] = None
    new_bill["created_at"] = now
    new_bill["updated_at"] = now

    await db.bills.insert_one(new_bill)
    del new_bill["_id"]
    return new_bill


# ─── Health Check ────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SpentyAI API"}
