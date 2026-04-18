# LedgerAI Launch Checklist

Use this checklist before calling LedgerAI production-ready.

## Required setup

- Create and configure the hosted Supabase project.
- Apply `/Users/akshaychouhan/ledgerai/supabase/migrations/20260317201500_ledgerai_auth_foundation.sql`.
- Set web env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Set mobile env vars:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_TENANT_ID`
- Configure Supabase Auth redirect URLs and password reset URLs for the real web/mobile targets.
- Deploy the Cloudflare AI worker from `/Users/akshaychouhan/ledgerai/scripts/cloudflare-ai-worker.js`.
- Set required worker secrets/config before exposing the worker publicly:
  - `ALLOWED_ORIGIN=https://spentyai.com`
  - `SUPABASE_URL=<your supabase project url>`
  - optional fallback/admin-only `LEDGERAI_SHARED_KEY` (not required for normal signed-in users)
- Set `VITE_AI_ENDPOINT_DEFAULT` for web (or keep repo default) so normal users do not configure AI endpoint manually.
- Configure Google/Microsoft OAuth credentials for the web email flows you plan to launch.
- Configure mobile provider callback URLs:
  - Google: `com.ledgerai.mobile:/oauthredirect`
  - Microsoft: `ledgerai://auth/provider-callback/microsoft`
  - Supabase password reset: `ledgerai://auth/recovery`

## Required product checks

- Sign up works on web with a new email address.
- Sign in works on web with the same account.
- Forgot-password email is sent and reset-password completion works.
- Sign out works on web.
- Refreshing the browser preserves the authenticated session correctly.
- A brand-new signed-in user lands in a clean cloud-backed workspace with no migration/import prompt.
- User A cannot see or modify User B data.
- Gmail/Outlook web reconnect and sync still behave correctly with the configured provider credentials.
- AI retry queue behavior still works with the configured worker endpoint.
- Base currency behavior still shows and stores amounts correctly.
- Reconciliation runs/items still load and behave correctly on web.

## Mobile checks

- Expo starts successfully with the mobile env vars present.
- Sign in works on mobile with the same account used on web.
- Sign out works on mobile.
- Session persists after app restart.
- Forgot-password on mobile returns to the app and password update completes.
- Transactions created or edited on mobile appear on web for the same account.
- Inbox edits/approvals/discards on mobile appear on web for the same account.
- Accounts created or edited on mobile appear on web for the same account.
- A new reconciliation run can be created on mobile from pasted text or a picked statement file.
- Reconciliation items can be viewed, edited, and resolved on mobile.
- Reports, dashboard, and settings load without crashing.
- Gmail and Outlook can connect on mobile from a dev build or release build.
- Mobile email sync can queue inbox items from connected Gmail / Outlook accounts.
- Mobile AI retry can recover pending email items.
- Mobile email/reconciliation flows work using signed-in session auth without per-device AI secret entry.

## Launch blockers

Do not mark launch complete if any of these remain unresolved:

- Hosted Supabase auth/RLS has not been tested with real accounts.
- The AI worker is not deployed or worker auth vars (`SUPABASE_URL`, `ALLOWED_ORIGIN`) are missing.
- Provider OAuth credentials are missing for the web email flows you intend to offer.
- Mobile environment variables are missing.
- Android/iOS runtime testing has not been completed on at least one real device or simulator per platform.
