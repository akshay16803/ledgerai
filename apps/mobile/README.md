# LedgerAI Mobile (Expo / React Native)

Native LedgerAI mobile app built with Expo and React Native.  
This app is not a WebView wrapper and connects to the same authenticated cloud-backed data model as the web app.

## What currently works

- Email/password auth with secure session persistence (`expo-secure-store`)
- Password reset return-to-app flow via native deep link
- Dashboard summary tied to the signed-in user's cloud data
- Ledger list, search, filters, add, edit, and delete
- Inbox review queue with edit, approve, and discard
- Accounts list with add/edit
- Reports with 3M / 6M / 12M cloud-backed summaries
- Reconciliation run creation from pasted text or picked statement files, plus unresolved item review, edit, and resolve
- Settings summary, managed AI-access status, and sign out
- Gmail / Outlook connect, reconnect, manual sync, disconnect, and AI retry using native auth sessions plus device-local provider token storage

## Prerequisites

- Node 18+
- npm 9+
- Xcode (for iOS simulator) / Android Studio (for Android emulator) as needed

## Environment setup

1. Copy env template:

```bash
cp /Users/akshaychouhan/ledgerai/apps/mobile/.env.example /Users/akshaychouhan/ledgerai/apps/mobile/.env
```

2. Fill:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_TENANT_ID` if you are not using `consumers`

If these values are missing, the mobile app intentionally blocks boot and explains what must be configured. It does not fake a working auth shell.

Provider OAuth callback assumptions:

- Google native redirect URI: `com.ledgerai.mobile:/oauthredirect`
- Microsoft native redirect URI: `ledgerai://auth/provider-callback/microsoft`
- Supabase password reset redirect URI: `ledgerai://auth/recovery`

For Gmail / Outlook provider testing, use a development build or release build. Plain Expo Go is not the target launch runtime for these native redirect flows.

## Run locally

Install and start:

```bash
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile install
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile start
```

Platform targets:

```bash
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile ios
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile android
```

Type check:

```bash
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile run typecheck
```

## Still gated by external setup

- Live hosted Supabase auth/RLS still needs verification with real env values.
- Gmail / Outlook flows require the provider client IDs and dashboard redirect URIs above.
- Mobile email sync, AI retry, and reconciliation import depend on the managed LedgerAI AI worker endpoint being available and the user having an active signed-in LedgerAI session.
- Statement import works best with CSV, text, or text-based PDF statements.

## Recommended manual checks

- Sign in on mobile with a real hosted Supabase project.
- Trigger a password reset email and confirm the reset link returns to the app.
- Create or edit a transaction and verify it appears on web.
- Approve and discard inbox items and verify the same account reflects the change on web.
- Add or edit an account and verify the balance/class updates on web.
- Confirm email sync, AI retry, and reconciliation import work without any per-device AI shared-key entry.
- Create a reconciliation run from pasted text or a picked statement file, then edit an item and mark one resolved.
- Connect Gmail and Outlook on a dev build or release build, then run manual sync and AI retry.
