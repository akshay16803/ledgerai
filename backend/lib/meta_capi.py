"""Meta Conversions API (CAPI) — server-side event helper.

Fire-and-forget wrapper around Meta's /events Graph API endpoint. Used to
forward server-confirmed conversion events (Purchase, CompleteRegistration,
etc.) to Meta so that browser-side Pixel events can be deduplicated against
trustworthy server signals.

Design rules:
  * NEVER block a user-facing request. The public entry point schedules the
    HTTP call as an asyncio background task and returns immediately.
  * NEVER raise. Every failure path logs and silently continues so a CAPI
    outage cannot break webhooks or signup.
  * NEVER send raw PII. Email, phone, and user_id are sha256-hashed
    (lowercased, trimmed) before leaving this module.
  * Deterministic event_id matches the frontend Pixel format so Meta dedupes
    browser+server events (e.g. "purchase_<txnid>").
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import time
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────
META_PIXEL_ID = (os.environ.get("META_PIXEL_ID") or "").strip()
META_CAPI_ACCESS_TOKEN = (os.environ.get("META_CAPI_ACCESS_TOKEN") or "").strip()
# Meta App ID, used only for diagnostics/logging today; payload-side it is
# implicit in the Pixel/Dataset endpoint we POST to. Required for app-source
# events to be properly attributed once the Meta App is linked to the dataset.
META_APP_ID = (os.environ.get("META_APP_ID") or "").strip()
# Optional Meta Test Events code — set per environment to land events in the
# Test Events tab in Events Manager instead of production.
META_CAPI_TEST_EVENT_CODE = (os.environ.get("META_CAPI_TEST_EVENT_CODE") or "").strip()

GRAPH_API_VERSION = os.environ.get("META_CAPI_GRAPH_VERSION", "v19.0").strip() or "v19.0"
PARTNER_AGENT = "spentyai-capi-v1"

# Bundle id for both iOS + Android (same id used in App Store + Play Store).
# Used to build the app_data.extinfo array for action_source="app" events.
SPENTYAI_BUNDLE_ID = "com.spentyai.app"

# Module-level enabled flag. If credentials are missing we no-op so that
# dev environments without the keys don't crash on import or call.
_CAPI_ENABLED = bool(META_PIXEL_ID and META_CAPI_ACCESS_TOKEN)
if not _CAPI_ENABLED:
    logger.warning(
        "[CAPI] META_PIXEL_ID or META_CAPI_ACCESS_TOKEN missing — "
        "send_capi_event() will no-op. Set both env vars to enable."
    )


# ── Hashing helpers ──────────────────────────────────────────────────

def _hash_pii(value: Optional[str]) -> Optional[str]:
    """Lowercase, strip, sha256-hexdigest. Returns None for None/empty input."""
    if value is None:
        return None
    s = str(value).strip().lower()
    if not s:
        return None
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


_NON_DIGITS = re.compile(r"\D+")


def _format_phone(phone: Optional[str]) -> Optional[str]:
    """Normalise an India-leaning phone number, then sha256-hash.

      * strip non-digit characters
      * strip leading "00" (international prefix)
      * if 10 digits remain, prepend "91" (India country code)
      * drop any leading "+" (Meta wants digits-only before hashing)

    Returns the hashed value, or None if the input is empty / unusable.
    """
    if not phone:
        return None
    raw = str(phone).strip()
    if not raw:
        return None
    # Remove leading "+" before stripping non-digits (regex would drop it anyway).
    raw = raw.lstrip("+")
    digits = _NON_DIGITS.sub("", raw)
    if not digits:
        return None
    # Strip leading "00" international prefix (e.g. "00919812345678" -> "919812345678").
    if digits.startswith("00"):
        digits = digits[2:]
    # India default: a bare 10-digit number gets +91.
    if len(digits) == 10:
        digits = "91" + digits
    if not digits:
        return None
    return hashlib.sha256(digits.encode("utf-8")).hexdigest()


# ── Public API ───────────────────────────────────────────────────────

async def send_capi_event(
    event_name: str,
    event_id: str,
    user_email: Optional[str] = None,
    user_phone: Optional[str] = None,
    user_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    client_user_agent: Optional[str] = None,
    fbp: Optional[str] = None,
    fbc: Optional[str] = None,
    event_time: Optional[int] = None,
    action_source: str = "website",
    value: Optional[float] = None,
    currency: str = "INR",
    content_name: Optional[str] = None,
    content_ids: Optional[List[str]] = None,
    order_id: Optional[str] = None,
    test_event_code: Optional[str] = None,
) -> None:
    """Fire-and-forget Meta CAPI event.

    Returns immediately. The actual HTTP POST runs as an asyncio background
    task. Errors are logged; this function never raises.
    """
    if not _CAPI_ENABLED:
        return

    try:
        # Build user_data with hashed PII. Meta accepts these keys:
        # em (email), ph (phone), external_id (user id), client_ip_address,
        # client_user_agent, fbp, fbc.
        user_data: dict = {}
        em = _hash_pii(user_email)
        if em:
            user_data["em"] = em
        ph = _format_phone(user_phone)
        if ph:
            user_data["ph"] = ph
        ext_id = _hash_pii(user_id)
        if ext_id:
            user_data["external_id"] = ext_id
        if client_ip:
            user_data["client_ip_address"] = client_ip
        if client_user_agent:
            user_data["client_user_agent"] = client_user_agent
        if fbp:
            user_data["fbp"] = fbp
        if fbc:
            user_data["fbc"] = fbc

        custom_data: dict = {}
        if value is not None:
            try:
                custom_data["value"] = float(value)
                custom_data["currency"] = currency or "INR"
            except (TypeError, ValueError):
                pass
        if content_name:
            custom_data["content_name"] = content_name
        if content_ids:
            custom_data["content_ids"] = list(content_ids)
            # content_type=product is the conventional value for SKU-style ids.
            custom_data.setdefault("content_type", "product")
        if order_id:
            custom_data["order_id"] = order_id

        event = {
            "event_name": event_name,
            "event_time": int(event_time) if event_time is not None else int(time.time()),
            "event_id": event_id,
            "action_source": action_source,
            "user_data": user_data,
        }
        if custom_data:
            event["custom_data"] = custom_data

        # App-source events (iOS / Android subscription webhooks) get an
        # app_data block so Meta can attribute them properly. The fields here
        # are the ones the backend can know without an installed Meta SDK.
        # Meta's extinfo is a 16-slot array. Empirically Meta REJECTS the
        # event (error_subcode 2804043) if "OS version" (index 4) is empty,
        # so we fill it with a generic placeholder that satisfies validation
        # for both iOS and Android (Meta does not strictly format-check it).
        # Other slots can be empty — Meta tolerates that.
        if action_source == "app":
            extinfo = [
                "a2",                  # extinfo schema version literal
                SPENTYAI_BUNDLE_ID,    # bundle id / package name
                "",                    # bundle long version
                "",                    # bundle short version
                "16.0",                # OS version (non-empty REQUIRED by Meta)
                "",                    # device model
                "en_IN",               # locale (India default)
                "",                    # tz abbrev
                "",                    # carrier
                "",                    # screen width
                "",                    # screen height
                "",                    # screen density
                "",                    # cpu cores
                "",                    # total disk space
                "",                    # free disk space
                "Asia/Kolkata",        # tz name
            ]
            event["app_data"] = {
                "advertiser_tracking_enabled": 1,
                "application_tracking_enabled": 1,
                "extinfo": extinfo,
            }

        body: dict = {
            "data": [event],
            "partner_agent": PARTNER_AGENT,
        }
        code = (test_event_code or META_CAPI_TEST_EVENT_CODE or "").strip()
        if code:
            body["test_event_code"] = code

        # Schedule background HTTP call. We deliberately do NOT await the task
        # so the caller (webhook / signup) returns immediately.
        asyncio.create_task(_post_event(body, event_name, event_id))
    except Exception as e:  # pragma: no cover — defensive, must never raise
        logger.warning(f"[CAPI] failed to enqueue {event_name} event_id={event_id}: {e}")


async def _post_event(body: dict, event_name: str, event_id: str) -> None:
    """Background task: POST to Meta. Catches everything; never raises."""
    url = (
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/{META_PIXEL_ID}/events"
        f"?access_token={META_CAPI_ACCESS_TOKEN}"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=body)
        status = resp.status_code
        if 200 <= status < 300:
            logger.info(f"[CAPI] sent {event_name} event_id={event_id} status={status}")
        else:
            # Truncate response body to keep logs tidy.
            snippet = (resp.text or "")[:500]
            logger.warning(
                f"[CAPI] non-2xx for {event_name} event_id={event_id} "
                f"status={status} body={snippet}"
            )
    except Exception as e:
        logger.warning(f"[CAPI] post failed {event_name} event_id={event_id}: {e}")
