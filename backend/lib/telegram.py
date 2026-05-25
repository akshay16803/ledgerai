"""Telegram notifier — fire-and-forget alerts to a private chat.

Configuration via env vars:
  TELEGRAM_BOT_TOKEN  — from @BotFather on Telegram
  TELEGRAM_CHAT_ID    — your personal chat id with the bot (numeric)

If either var is unset, every send is a silent no-op so a missing config
NEVER breaks production traffic. Errors are logged but never raised.

Public API:
  send(message: str, parse_mode="HTML") → None         (fire-and-forget)
  notify_signup(user, platform, method) → None
  notify_subscription(user, plan, price, platform, action) → None
  notify_critical(title, detail) → None
  send_daily_summary(stats: dict) → None
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
_ENABLED   = bool(_BOT_TOKEN and _CHAT_ID)

if not _ENABLED:
    logger.info(
        "[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — all "
        "notifications will be no-ops. See SETUP_ANALYTICS.md."
    )


async def _post(message: str, parse_mode: str = "HTML") -> None:
    """Internal — actually hit the Telegram Bot API."""
    if not _ENABLED:
        return
    url = f"https://api.telegram.org/bot{_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": _CHAT_ID,
        "text": message,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(url, json=payload)
            if r.status_code >= 400:
                logger.warning(
                    "[telegram] non-200 from Bot API: %s %s", r.status_code, r.text[:200]
                )
    except Exception as exc:  # pragma: no cover  — never break callers
        logger.warning("[telegram] send failed: %s", exc)


def send(message: str, parse_mode: str = "HTML") -> None:
    """Schedule a Telegram message — fire-and-forget."""
    if not _ENABLED:
        return
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(_post(message, parse_mode))
        else:
            loop.run_until_complete(_post(message, parse_mode))
    except RuntimeError:
        # No event loop — spin up a new one (rare, e.g. sync context)
        asyncio.run(_post(message, parse_mode))


# ── Formatted helpers — wrap common event types in nice HTML cards ─────

def _escape(s: Any) -> str:
    """Minimal HTML escape so user-supplied names don't break Telegram parse."""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def notify_signup(user: dict, platform: str = "unknown", method: str = "unknown") -> None:
    """Fire on every new user creation.

    Args:
        user:     The freshly-inserted user document from `db.users`.
        platform: "ios" | "android" | "web" | "demo" | "unknown".
        method:   "google" | "apple" | "demo" | "email" | "promo".
    """
    email = _escape(user.get("email", "(no email)"))
    name  = _escape(user.get("name") or "—")
    uid   = _escape(user.get("id") or user.get("_id") or "—")
    msg = (
        "🎉 <b>New signup</b>\n"
        f"<b>Email:</b> {email}\n"
        f"<b>Name:</b> {name}\n"
        f"<b>Platform:</b> {_escape(platform)}\n"
        f"<b>Method:</b> {_escape(method)}\n"
        f"<b>User ID:</b> <code>{uid}</code>"
    )
    send(msg)


def notify_subscription(
    user: dict,
    plan: str,
    price: float | int | str,
    platform: str = "unknown",
    action: str = "purchase",
    provider: str = "unknown",
) -> None:
    """Fire on subscription state change.

    action ∈ {"purchase", "renewal", "cancel", "refund", "grace_period",
              "expired"}.
    provider ∈ {"apple", "google", "payu", "promo"}.
    """
    email = _escape(user.get("email", "(no email)"))
    uid   = _escape(user.get("id") or user.get("_id") or "—")

    emoji = {
        "purchase":     "💰",
        "renewal":      "🔁",
        "cancel":       "🛑",
        "refund":       "↩️",
        "grace_period": "⚠️",
        "expired":      "⌛",
    }.get(action, "🔔")

    msg = (
        f"{emoji} <b>Subscription — {_escape(action)}</b>\n"
        f"<b>Email:</b> {email}\n"
        f"<b>Plan:</b> {_escape(plan)}\n"
        f"<b>Price:</b> ₹{_escape(price)}\n"
        f"<b>Platform:</b> {_escape(platform)}\n"
        f"<b>Provider:</b> {_escape(provider)}\n"
        f"<b>User ID:</b> <code>{uid}</code>"
    )
    send(msg)


def notify_critical(title: str, detail: str = "", user_id: str | None = None) -> None:
    """Use for backend errors / 500s / unexpected states you want to know NOW."""
    msg = f"🚨 <b>{_escape(title)}</b>"
    if user_id:
        msg += f"\n<b>User:</b> <code>{_escape(user_id)}</code>"
    if detail:
        # Truncate so a giant stack trace doesn't blow past Telegram's 4096-char limit.
        msg += f"\n<pre>{_escape(detail[:1200])}</pre>"
    send(msg)


def send_daily_summary(stats: dict) -> None:
    """Cron-style daily roll-up. Schedule from your scheduler / cron.

    Expected `stats` shape (all keys optional, gracefully handled):
      total_users, signups_today, signups_week
      active_subs, churned_today, mrr
      top_endpoints (list of {path, count})
      errors_today
    """
    lines = ["📊 <b>SpentyAI — daily summary</b>"]
    if "total_users" in stats:
        lines.append(f"<b>Total users:</b> {stats['total_users']}")
    if "signups_today" in stats:
        lines.append(f"<b>Signups today:</b> {stats['signups_today']}")
    if "signups_week" in stats:
        lines.append(f"<b>Signups (7d):</b> {stats['signups_week']}")
    if "active_subs" in stats:
        lines.append(f"<b>Active subscribers:</b> {stats['active_subs']}")
    if "churned_today" in stats:
        lines.append(f"<b>Churned today:</b> {stats['churned_today']}")
    if "mrr" in stats:
        lines.append(f"<b>MRR:</b> ₹{stats['mrr']:,}")
    if stats.get("errors_today") is not None:
        lines.append(f"<b>Backend errors today:</b> {stats['errors_today']}")
    if stats.get("top_endpoints"):
        top = "\n".join(
            f"  • <code>{_escape(e['path'])}</code> — {e['count']}"
            for e in stats["top_endpoints"][:5]
        )
        lines.append(f"<b>Top endpoints:</b>\n{top}")
    send("\n".join(lines))


def is_enabled() -> bool:
    """Public — used by /admin to surface whether Telegram is configured."""
    return _ENABLED
