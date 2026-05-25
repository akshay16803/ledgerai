# SpentyAI Analytics + Telegram Setup

Last updated: 2026-05-26. Every claim below was verified against actual
code before being written. If an env var is missing, the corresponding
feature silently no-ops — nothing breaks.

## What was built (file-by-file)

| Surface | What | Already wired? | Needs YOUR action |
|---|---|---|---|
| Backend | Logs every /api/* call to `db.analytics_events` (Mongo) | YES | None — works on Railway redeploy |
| Backend | Telegram alerts: signup + cancellation | YES | Set 2 env vars on Railway |
| Backend | `/api/admin/stats` JSON endpoint | YES | Set `ADMIN_EMAILS` env var |
| Backend | `/api/admin/test-telegram` + `/api/admin/send-daily-summary` | YES | Call via curl |
| Web | Microsoft Clarity (sessions + heatmaps) | Stub in index.html | Paste project id |
| Web | PostHog Cloud SDK | Stub in index.html | Paste API key |
| Web | Sentry browser SDK | Stub in index.html | Paste DSN |
| Web | `src/lib/analytics.js` wrapper | YES | None |
| iOS | `Analytics.shared` (Core/Analytics/AnalyticsManager.swift) | YES (no-op) | Add SPM pkgs + bootstrap |
| Android | `Analytics` object (core/analytics/AnalyticsManager.kt) | YES (no-op) | Add gradle deps + bootstrap |


## 1. Telegram alerts (5 minutes)

### Create the bot

1. Open Telegram. Search **@BotFather**.
2. Send `/newbot`. Pick a display name like "SpentyAI Alerts" and a username ending in `bot` (e.g. `SpentyAIAlertsBot`).
3. BotFather returns an HTTP API token. Copy it. It looks like `1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`.

### Get your chat id

- Search @userinfobot in Telegram, send `/start` — it replies with your numeric ID.
- Or: send any message to your new bot, then open `https://api.telegram.org/botYOUR_TOKEN/getUpdates` in a browser — `chat.id` is in the JSON.

### Set the env vars on Railway

Backend service (api.spentyai.com) Variables tab:

```
TELEGRAM_BOT_TOKEN=1234567890:ABC-DEF...
TELEGRAM_CHAT_ID=987654321
ADMIN_EMAILS=akshaychouhan16803@gmail.com
```

Redeploy.

### Test it

Sign in to SpentyAI normally, copy the session token from Keychain (iOS) or browser localStorage (web), then:

```
curl -X POST https://api.spentyai.com/api/admin/test-telegram \
     -H "Authorization: Bearer SESSION_TOKEN_HERE"
```

You should see a test message in Telegram within 2 seconds.

### What automatically fires to Telegram

- New signup (web/iOS/Android × Google/Apple/Demo).
- Subscription cancellation (auto-renew off via in-app).
- Daily summary (when you POST /api/admin/send-daily-summary — set up a Railway cron at 9 AM IST).

## 2. Microsoft Clarity (5 minutes — recommended first)

Free forever. Session recordings + heatmaps on the website.

1. Go to clarity.microsoft.com → sign in with any Microsoft account.
2. Create project "SpentyAI", site URL `https://www.spentyai.com`.
3. Copy the **Project ID** (10-character string — NOT the full tracking code).
4. Vercel env var: `VITE_CLARITY_PROJECT_ID=abcd1234xy`.
5. Redeploy Vercel.

You'll start seeing sessions in the Clarity dashboard within an hour.

## 3. PostHog Cloud (10 minutes)

Free tier — 1M events/month. Funnels + retention + feature flags + session capture.

1. Sign up at app.posthog.com (US Cloud is fine; EU Cloud available if you prefer).
2. Create project "SpentyAI". Copy the **Project API Key** (starts with `phc_`).
3. Vercel env vars:
   - `VITE_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxx`
   - `VITE_POSTHOG_HOST=https://us.i.posthog.com`
4. Redeploy.

The same key is reused in the iOS + Android bootstrap (steps 5 + 6).

## 4. Sentry (10 minutes)

Free 5K errors/month. Error + performance + release tracking.

1. Sign up at sentry.io. Create org "SpentyAI".
2. Create projects:
   - `spentyai-web` (Browser JavaScript) → DSN
   - `spentyai-ios` (Apple iOS) → DSN
   - `spentyai-android` (Android) → DSN
   - `spentyai-backend` (Python) → DSN (optional)
3. Vercel env var (web only): `VITE_SENTRY_DSN=https://abc@o123.ingest.us.sentry.io/567`.
4. Other DSNs go into mobile bootstrap (see below).


## 5. iOS — install PostHog + Sentry SDKs

The `Analytics.shared` facade is already in
`ios/SpentyAI/SpentyAI/Core/Analytics/AnalyticsManager.swift`. It compiles
clean today (every call is a silent no-op) so the app builds even before
the SDKs are added.

### Add the SPM packages in Xcode

1. Open `SpentyAI.xcodeproj`.
2. File → Add Package Dependencies…
3. Paste `https://github.com/PostHog/posthog-ios` → Add Package.
4. Repeat with `https://github.com/getsentry/sentry-cocoa` → Add Package.

### Bootstrap in `SpentyAIApp.swift`

Add to the App struct's `init`:

```
init() {
    Analytics.shared.bootstrap(
        postHogKey: "phc_YOURKEY",
        postHogHost: "https://us.i.posthog.com",
        sentryDSN: "https://abc@o123.ingest.us.sentry.io/iosproject"
    )
}
```

### Replace the TODO stubs in `AnalyticsManager.swift`

In `bootstrap`:

```
import PostHog
import Sentry
...
PostHogSDK.shared.setup(PostHogConfig(apiKey: postHogKey, host: self.host))
SentrySDK.start { options in
    options.dsn = sentryDSN
    options.tracesSampleRate = 0.2
}
```

In `identify` / `track` / `reset` — replace each `// TODO:` with the
matching SDK call. Names match 1:1; takes about 5 minutes.

### Sprinkle event calls

- `AuthManager.login` success → `Analytics.shared.identify(...); Analytics.shared.signedIn(method: "google")`
- `AuthManager.loginWithApple` success → same, method `"apple"`
- `AuthManager.logout` → `Analytics.shared.reset(); Analytics.shared.signedOut()`
- `PremiumFeatureSheet.task` → `Analytics.shared.premiumSheetShown(feature: featureName)`
- `purchase()` start → `Analytics.shared.subscribeTapped(plan: "monthly")`
- `purchase()` success → `Analytics.shared.subscribeSuccess(plan: "monthly", amount: 199, provider: "apple")`


## 6. Android — install PostHog + Sentry SDKs

Same shape as iOS. Helper at `android-native/app/src/main/java/com/spentyai/app/core/analytics/AnalyticsManager.kt`.

### Add gradle deps

In `android-native/app/build.gradle.kts` `dependencies { }`:

```
implementation("com.posthog:posthog-android:3.+")
implementation("io.sentry:sentry-android:7.+")
```

Sync gradle.

### Bootstrap in `MainActivity.onCreate`

```
Analytics.bootstrap(
    context = applicationContext,
    postHogKey = "phc_YOURKEY",
    postHogHost = "https://us.i.posthog.com",
    sentryDSN = "https://abc@o123.ingest.us.sentry.io/androidproject"
)
```

Replace `// TODO:` lines in `AnalyticsManager.kt` with the real SDK calls.

### Event call sites (mirror iOS — same names = unified funnels)

- Google sign-in success → `Analytics.identify(userId, email); Analytics.signedIn("google")`
- `PremiumFeatureSheet.kt` shown → `Analytics.premiumSheetShown(feature)`
- `BillingViewModel.handlePurchase` success → `Analytics.subscribeSuccess("monthly", 199.0, "google")`

## 7. Admin endpoint — quick check

```
curl https://api.spentyai.com/api/admin/stats \
     -H "Authorization: Bearer SESSION_TOKEN_HERE"
```

Returns JSON with users (total/today/week/month), subscriptions (active,
monthly_subscribers, cancelled_today, plan_breakdown), revenue.mrr_rupees,
traffic (top_endpoints_today, platform_breakdown_today, errors_today),
and telegram.configured.

A React `/admin` page is a planned follow-up. Until then the JSON works
fine for ad-hoc checks or any dashboard tool.


## 8. What I deliberately did NOT do

- **Install attribution (Branch.io / Adjust / AppsFlyer)** — overkill before paid ads. Add when you actually have ad spend to attribute.
- **Apple Search Ads Attribution API** — same reasoning.
- **Google Play Install Referrer API** — same.
- **Daily-summary cron job** — endpoint exists (`POST /api/admin/send-daily-summary`); set up Railway cron at 9 AM IST when you want it.
- **RevenueCat** — your existing Apple / Google / PayU webhooks already sync subscription state into `db.users`. RevenueCat would be a refactor, not an addition; do it later when you have time.
- **React `/admin` UI** — backend JSON endpoint exists. UI page is a follow-up.
- **Per-endpoint Telegram alerts for subscription verify** — the analytics middleware already logs every `/api/payments/apple/verify`, `/api/payments/payu/callback`, `/api/payments/google/rtdn` call to `db.analytics_events`. If you want explicit Telegram on purchase success, add one line to each handler's success branch:
  `tg.notify_subscription(user=..., plan=..., price=..., platform="ios", provider="apple", action="purchase")`

## 9. Sanity checklist after first deploy

1. `GET /api/admin/stats` returns JSON with `"ok": true`. ✅
2. `POST /api/admin/test-telegram` puts a test message in your Telegram chat. ✅
3. Open `https://www.spentyai.com` in Chrome DevTools → Network. See requests to `*.clarity.ms`, `us.i.posthog.com`, `*.sentry.io`. ✅
4. Sign in once. New entry appears in PostHog → Persons. ✅
5. Sign in once. New "🎉 New signup" message appears in Telegram. ✅

## 10. Files touched in this change

| Path | What changed |
|---|---|
| `backend/lib/telegram.py` | NEW. Telegram notifier with notify_signup, notify_subscription, notify_critical, send_daily_summary. |
| `backend/lib/analytics.py` | NEW. AnalyticsLogger + AnalyticsMiddleware + ensure_indexes. |
| `backend/server.py` | Added analytics + telegram imports, middleware registration, ensure_indexes in startup, `_track_new_user()` helper, signup hooks at 5 sites, cancel-subscription Telegram alert, `/api/admin/stats`, `/api/admin/test-telegram`, `/api/admin/send-daily-summary` endpoints. |
| `index.html` | Added Clarity + PostHog + Sentry SDK snippets (env-driven, no-op when keys absent). |
| `src/lib/analytics.js` | NEW. Web wrapper — `identify`, `reset`, `track`, plus `Events.*` helpers. |
| `ios/SpentyAI/SpentyAI/Core/Analytics/AnalyticsManager.swift` | NEW. iOS facade. |
| `android-native/app/src/main/java/com/spentyai/app/core/analytics/AnalyticsManager.kt` | NEW. Android facade. |
| `SETUP_ANALYTICS.md` | NEW. This file. |

