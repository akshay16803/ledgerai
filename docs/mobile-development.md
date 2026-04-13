# LedgerAI Mobile Development

## App path

- `/Users/akshaychouhan/ledgerai/apps/mobile`

## Run locally

```bash
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile install
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile run start
```

Platform commands:

```bash
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile run android
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile run ios
```

Typecheck:

```bash
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile run typecheck
```

## Environment

Set mobile Supabase values in either:

- Expo env variables:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
  - `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`
  - `EXPO_PUBLIC_MICROSOFT_TENANT_ID`
- or Expo `extra` config values

If they are missing, the mobile app intentionally blocks boot with a setup screen instead of showing a fake working auth flow.

## Current mobile state

Implemented and usable:

- native Expo/React Native app
- auth stack
- password reset return-to-app flow
- secure session storage
- premium tabbed navigation
- dashboard summary
- ledger list, search, filters, add, edit, and delete
- inbox list, edit, approve, and discard
- accounts list, add, and edit
- reports summary with 3M / 6M / 12M ranges
- reconciliation run summary, unresolved item review, edit, and resolve
- reconciliation run creation from pasted text or a picked statement file
- settings summary, managed AI-access status, and sign out
- Gmail / Outlook connect, reconnect, manual sync, disconnect, and AI retry using native auth sessions plus secure local provider-token storage

Intentionally gated:

- live hosted Supabase auth/RLS verification with real env values from this workspace

## External setup needed before launch

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_TENANT_ID`
- hosted Supabase Auth redirect/password-reset URLs
- Google redirect URI: `com.ledgerai.mobile:/oauthredirect`
- Microsoft redirect URI: `ledgerai://auth/provider-callback/microsoft`
- Supabase password reset redirect URI: `ledgerai://auth/recovery`
- managed LedgerAI AI worker endpoint available in the app build (AI auth uses the signed-in Supabase session by default)
- Expo runtime plus Android Studio / Xcode tooling as needed for device testing
- Use a development build or release build for provider OAuth testing; do not treat plain Expo Go as launch validation for Gmail / Outlook.

## Manual QA suggestions

- sign in with a real hosted Supabase account
- restart the app and confirm the session persists
- run a forgot-password flow and confirm the reset link opens the app
- create/edit/delete a transaction
- approve/discard an inbox item
- add/edit an account
- confirm email sync/reconciliation run using signed-in session auth with no per-device AI key setup
- resolve a reconciliation item
- connect Gmail and Outlook, sync, then retry any AI-pending email items
- compare mobile changes with the same signed-in account on web
