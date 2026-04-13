# LedgerAI Supabase Backend/Auth Setup

This setup defines the real production auth/data backend for LedgerAI using Supabase Auth + Postgres + RLS.

## 1) Create Supabase project

1. Create a new Supabase project.
2. Copy:
   - Project URL
   - publishable / client-safe key
   - `service_role` key (server-only, never in client)

## 2) Enable email auth

In Supabase Dashboard:

1. Go to `Authentication -> Providers -> Email`.
2. Enable Email/Password auth.
3. Enable email confirmations (recommended for production).
4. Configure password reset redirect URLs:
   - local web example: `http://localhost:3000`
   - prod web example: `https://accounts.niprasha.com`
   - add the mobile auth targets you plan to use for Expo/native testing
5. Customize the confirmation email in the dashboard using [Supabase Auth Confirmation Email Template](/Users/akshaychouhan/ledgerai/docs/supabase-auth-confirm-signup-template.md).

Notes:

- The app code triggers sign-up, but Supabase Dashboard sends the verification email.
- Web sign-up already passes the current browser origin as `emailRedirectTo`.
- Mobile confirmation-required sign-up still needs manual verification against the real deployed mobile auth redirects before launch.

## 3) Configure app environment

Use values in `/Users/akshaychouhan/ledgerai/.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use values in `/Users/akshaychouhan/ledgerai/apps/mobile/.env.example`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_TENANT_ID`

Server-only keys remain server-only. Do not expose `service_role` in web or mobile clients.

## 3c) AI worker hardening

Before using the Cloudflare AI worker in any public environment, set:

- `LEDGERAI_SHARED_KEY`
- `ALLOWED_ORIGIN=https://accounts.niprasha.com`

The worker now fails closed if either of these is missing.

## 3b) Mobile redirect / provider setup

Add these redirect targets before testing mobile auth/provider flows:

- Supabase password reset redirect: `ledgerai://auth/recovery`
- Microsoft mobile redirect: `ledgerai://auth/provider-callback/microsoft`
- Google mobile redirect: `com.ledgerai.mobile:/oauthredirect`

Google requires native iOS / Android OAuth client IDs for the mobile app. Microsoft requires a public client app configuration that allows the mobile redirect above.

## 4) Run migration

From `/Users/akshaychouhan/ledgerai`:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Or run the SQL manually in Supabase SQL Editor:

- `/Users/akshaychouhan/ledgerai/supabase/migrations/20260317201500_ledgerai_auth_foundation.sql`

## 5) Security model

- Every `ledger_*` table has `user_id uuid not null references auth.users(id)`.
- RLS is enabled and forced on every `ledger_*` table.
- Policies allow access only when `auth.uid() = user_id`.
- Insert policy enforces that rows cannot be created under another user.
- Trigger blocks ownership change (`user_id`) on update.

Result: even if client filtering is bypassed, user A cannot read/write user B rows.

## 6) Helper SQL APIs included

- `public.ledger_upsert_app_setting(...)`
- `public.ledger_get_base_currency()`
- `public.ledger_set_base_currency(...)`

These functions are `security invoker` and respect RLS/account isolation.

## 7) Notes

- This is a fresh account-backed launch model:
  - authenticated cloud storage is the primary product mode
  - the web auth shell starts empty accounts in a clean workspace
  - there is no user-facing migration/import onboarding flow
- Compatibility choices retained for the current app implementation:
  - typed columns for common query/report fields
  - `payload jsonb` on each domain table to preserve current `App.jsx` shapes without data loss
  - `client_id` columns to keep stable app-side IDs during upsert/sync

## 8) Required manual verification before launch

- Web sign up works with a brand-new email address.
- Web sign in works after sign up.
- Web sign out works.
- Forgot-password email is sent and reset-password completion works.
- Refreshing the browser preserves the session.
- A brand-new signed-in user lands in a clean cloud-backed workspace with no migration/import prompt.
- Mobile sign in works with the same account.
- Mobile forgot-password link returns to the app and password update completes.
- Mobile session persists after app restart.
- Mobile Gmail / Outlook connect works with the configured native provider client IDs.
- User A cannot read or mutate User B rows.

This workspace currently does not contain real hosted Supabase env values, so those live checks still need to be completed manually against the real project.
