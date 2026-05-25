"""Server-side event logging — writes structured events to Mongo.

This is the ground-truth analytics log. Even if a client-side analytics
SDK is blocked (ad-blocker, privacy mode, no SDK installed yet), every
authenticated API request is captured here.

Collections written:
  analytics_events  — one document per tracked event
  analytics_daily   — pre-aggregated daily roll-ups (written by daily cron)

Document shape for analytics_events:
  {
    _id: ObjectId,
    user_id: str | None,
    event:   str,                   # "api_call", "signup", "subscription", ...
    path:    str | None,
    method:  str | None,
    status:  int | None,
    duration_ms: int | None,
    platform: str | None,           # "ios" | "android" | "web" | "backend"
    properties: dict,               # arbitrary event-specific payload
    ts: datetime (UTC)
  }

All writes are non-blocking with respect to the user request — exceptions
are swallowed and logged so a broken analytics pipeline NEVER causes a
user-facing 500.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Paths we explicitly do NOT log — too noisy / not useful for analytics.
_SKIP_PATHS = {
    "/",
    "/healthz",
    "/api/auth/me",       # fires constantly on app foreground; skip noise
    "/openapi.json",
    "/docs",
    "/redoc",
}

# Auto-detect "client platform" from User-Agent. Best-effort heuristic.
def _platform_from_ua(ua: str | None) -> str:
    if not ua:
        return "unknown"
    s = ua.lower()
    if "spentyai-ios" in s or "ios/" in s:
        return "ios"
    if "spentyai-android" in s or "android" in s:
        return "android"
    if "mozilla" in s or "chrome" in s or "safari" in s:
        return "web"
    return "unknown"


# ────────────────────────────────────────────────────────────────────────
# Public API
# ────────────────────────────────────────────────────────────────────────

class AnalyticsLogger:
    """Holds a Motor (async Mongo) client handle. Inject `db` at startup.

    Usage in server.py:

        from lib.analytics import AnalyticsLogger, AnalyticsMiddleware
        analytics = AnalyticsLogger()
        analytics.init(db)               # call once at startup
        app.add_middleware(AnalyticsMiddleware, logger=analytics)

        # ad-hoc events from endpoint handlers:
        await analytics.log(
            user_id=user["id"],
            event="subscription_purchase",
            properties={"plan": "monthly", "amount": 199, "provider": "apple"},
            platform="ios",
        )
    """

    def __init__(self) -> None:
        self._db = None  # set by init()
        self._enabled = True

    def init(self, db_handle: Any) -> None:
        self._db = db_handle

    @property
    def collection(self):
        if self._db is None:
            return None
        return self._db.analytics_events

    async def log(
        self,
        event: str,
        *,
        user_id: str | None = None,
        path: str | None = None,
        method: str | None = None,
        status: int | None = None,
        duration_ms: int | None = None,
        platform: str | None = None,
        properties: dict | None = None,
    ) -> None:
        """Insert one event document. Never raises."""
        if not self._enabled or self.collection is None:
            return
        doc = {
            "event": event,
            "user_id": user_id,
            "path": path,
            "method": method,
            "status": status,
            "duration_ms": duration_ms,
            "platform": platform,
            "properties": properties or {},
            "ts": datetime.now(timezone.utc),
        }
        try:
            await self.collection.insert_one(doc)
        except Exception as exc:  # pragma: no cover
            logger.warning("[analytics] insert failed: %s", exc)


# ────────────────────────────────────────────────────────────────────────
# Middleware — captures every request automatically
# ────────────────────────────────────────────────────────────────────────

class AnalyticsMiddleware(BaseHTTPMiddleware):
    """Logs every API request to `analytics_events`.

    Behaviour:
      - Skips paths in _SKIP_PATHS (too noisy).
      - Skips OPTIONS preflight.
      - Skips static files (anything not under /api/).
      - Extracts user_id from request.state.user (set by your auth dependency)
        IF that pattern is already in use; otherwise user_id is None and we
        still log the request anonymously.
      - Records duration_ms for latency tracking.
      - Always swallows its own exceptions — analytics MUST NOT break traffic.
    """

    def __init__(self, app, logger: AnalyticsLogger):
        super().__init__(app)
        self._analytics = logger

    async def dispatch(self, request: Request, call_next):
        # Bypass conditions up front (no analytics overhead for skipped paths)
        path = request.url.path
        method = request.method
        if (
            method == "OPTIONS"
            or path in _SKIP_PATHS
            or not path.startswith("/api/")
        ):
            return await call_next(request)

        start = time.perf_counter()
        response: Response | None = None
        status = 0
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            try:
                duration_ms = int((time.perf_counter() - start) * 1000)
                # Pull user id from common places; None if unauthenticated.
                user_id = None
                if hasattr(request.state, "user") and isinstance(request.state.user, dict):
                    user_id = request.state.user.get("id")
                ua = request.headers.get("user-agent")
                await self._analytics.log(
                    event="api_call",
                    user_id=user_id,
                    path=path,
                    method=method,
                    status=status,
                    duration_ms=duration_ms,
                    platform=_platform_from_ua(ua),
                )
            except Exception as exc:  # pragma: no cover
                logger.warning("[analytics] middleware log failed: %s", exc)


# ────────────────────────────────────────────────────────────────────────
# Index creation — call once at startup
# ────────────────────────────────────────────────────────────────────────

async def ensure_indexes(db) -> None:
    """Create useful indexes on analytics_events for the /admin dashboard."""
    try:
        await db.analytics_events.create_index([("ts", -1)])
        await db.analytics_events.create_index([("event", 1), ("ts", -1)])
        await db.analytics_events.create_index([("user_id", 1), ("ts", -1)])
        await db.analytics_events.create_index([("path", 1), ("ts", -1)])
        logger.info("[analytics] indexes ensured")
    except Exception as exc:  # pragma: no cover
        logger.warning("[analytics] ensure_indexes failed: %s", exc)
