# LedgerAI

LedgerAI is a bookkeeping and finance workflow product for Indian traders and similar users. The platform includes native SMS scanning, email integration, and real-time multi-device synchronization.

This repo now contains:

- the existing React + Vite web app
- a real Expo / React Native mobile app
- a Supabase auth + cloud data layer with row-level security
- the existing Cloudflare AI worker for AI extraction, FX conversion, and retry workloads
- native SMS scanning and analysis (mobile)
- real-time WebSocket sync + polling fallback

## Product areas preserved

- Dashboard
- Ledger
- Inbox
- Email sync visibility
- **SMS sync visibility** (NEW - Feature 18)
- Accounts
- Reconciliation
- Reports
- Settings
- AI extraction / retry
- base currency / FX behavior
- OneDrive backup/export path

## New Features (Feature 18 - Testing & Documentation)

### SMS Scanning & Analysis
- **Android**: Direct SMS access with permission control
- **iOS**: SMS forwarding tutorial + manual input option
- Automatic extraction of amounts, vendors, and dates
- Indian banking SMS format support (HDFC, ICICI, SBI, Axis, UPI, etc.)
- Transaction-level deduplication between SMS and email sources

### Real-Time Sync
- Changes made on web instantly visible on mobile (via WebSocket subscriptions)
- Offline support: Mobile app queues edits, syncs when reconnected
- Conflict resolution: Last-modified-wins strategy with audit trail
- Polling fallback: 30-minute check interval for background updates

## Current launch state

LedgerAI is now a fresh account-backed product with mobile SMS integration and real-time sync.

- Web: authenticated cloud-backed launch path is implemented with email sync
- Mobile: authenticated native app with dashboard, ledger, inbox, accounts, reports, reconciliation, settings, Gmail/Outlook email sync, and **native SMS scanning (Android) / SMS forwarding (iOS)**
- Real-time sync: WebSocket subscriptions sync changes <1 second across all devices
- Offline support: Mobile queues transactions offline, syncs when online
- There is no user-facing legacy migration/import launch flow

## Architecture

- Web shell: `/Users/akshaychouhan/ledgerai/src/RootApp.jsx`
- Existing web product monolith: `/Users/akshaychouhan/ledgerai/src/App.jsx`
- Shared domain helpers: `/Users/akshaychouhan/ledgerai/packages/ledgerai-core`
- Mobile app: `/Users/akshaychouhan/ledgerai/apps/mobile`
- Supabase schema: `/Users/akshaychouhan/ledgerai/supabase/migrations/20260317201500_ledgerai_auth_foundation.sql`
- AI worker: `/Users/akshaychouhan/ledgerai/scripts/cloudflare-ai-worker.js`

Full architecture notes:

- [Architecture Overview](/docs/architecture-overview.md)
- [Backend/Auth Setup](/docs/backend-auth-setup.md)
- [Backend Schema Overview](/docs/backend-schema-overview.md)
- [Internal Compatibility Notes](/docs/internal-compatibility-notes.md)
- [Web Development](/docs/web-development.md)
- [Mobile Development](/docs/mobile-development.md)
- [Launch Checklist](/docs/launch-checklist.md)
- [Feature 18: Testing & Documentation](/docs/feature-18-testing-documentation.md)
- [Feature 18: Code Review](/docs/FEATURE_18_CODE_REVIEW.md)

## Local web setup

1. Create `.env` from `/Users/akshaychouhan/ledgerai/.env.example`
2. Set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_MICROSOFT_CLIENT_ID` if Outlook / OneDrive defaults should be prefilled
3. Install and run:

```bash
cd /Users/akshaychouhan/ledgerai
npm install
npm run dev
```

## Supabase setup

Apply:

- `/Users/akshaychouhan/ledgerai/supabase/migrations/20260317201500_ledgerai_auth_foundation.sql`

Then enable:

- Supabase Email/Password auth
- password reset redirect back to your LedgerAI web URL

Security model:

- every `ledger_*` row belongs to one `auth.users` user
- RLS is enabled and forced
- clients can only read/write their own rows
- `user_id` ownership cannot be reassigned after insert

## Mobile setup

```bash
cp /Users/akshaychouhan/ledgerai/apps/mobile/.env.example /Users/akshaychouhan/ledgerai/apps/mobile/.env
```

Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`
- `EXPO_PUBLIC_MICROSOFT_TENANT_ID`

Run:

```bash
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile install
npm --prefix /Users/akshaychouhan/ledgerai/apps/mobile run start
```

Useful commands:

```bash
npm run mobile:typecheck
npm run mobile:android
npm run mobile:ios
npm test                  # Run web tests
npm test -- --watch      # Watch mode
```

## SMS Features (Feature 18)

### Android: Native SMS Access
- Permission request on first app launch (or in Settings)
- User can toggle SMS access in Settings → SMS → Request Permission
- Automatic analysis of recent SMS messages
- Deduplication against email transactions

### iOS: SMS Forwarding & Manual Input
- No direct SMS access (Apple privacy model)
- **Option 1 (Recommended)**: Set up SMS forwarding via Mail rule
  - Mail rule: Forward SMS to an email address you control
  - LedgerAI analyzes forwarded SMS via email pipeline
- **Option 2**: Manually paste SMS text in app's SMS input screen

### Deduplication
When SMS and email contain same transaction:
- **Exact match** (100% confidence): Auto-merged, shows as confirmed
- **Fuzzy match** (90-99% confidence): Shown as "pending review"
- **No match**: Both displayed separately in inbox

Confidence scoring considers:
- Amount (with ±0.01% tolerance)
- Date (±1 day tolerance)
- Vendor name (substring and word matching)

### Supported Formats
LedgerAI recognizes Indian banking SMS formats:
- **Bank alerts**: HDFC, ICICI, SBI, Axis, Kotak, etc.
- **UPI payments**: Google Pay, PhonePe, Paytm, WhatsApp Pay
- **Amount formats**: ₹1,000 / Rs. 500 / 100 INR / $50 USD
- **Date formats**: 31-Mar-2026 / 31/03/2026 / 31-Mar

## Real-Time Sync (Feature 18)

### Web ↔ Mobile Synchronization
- Transaction edited on web appears on mobile within <1 second
- Offline support: Mobile app queues edits, syncs when reconnected
- Conflict resolution: Server version wins if newer, local wins if edited more recently
- Polling fallback: 30-minute check if WebSocket unavailable

### Offline Workflow
1. User creates/edits transaction while offline
2. "(offline)" badge shown next to item
3. User reconnects to internet
4. Transaction automatically syncs to server
5. Badge removed, item now synced

## Testing (Feature 18)

### Run Tests
```bash
# All tests
npm test

# Mobile type checking
npm run mobile:typecheck

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

### Test Files Created
- Unit tests: SMS processing, signatures, deduplication, repository
- Integration tests: Auth flow, SMS analysis, real-time sync
- Coverage: 80%+ critical paths

See [Feature 18 Testing Documentation](/docs/feature-18-testing-documentation.md) for details.

## Production deploy

Frontend:

```bash
cd /Users/akshaychouhan/ledgerai
npm run deploy
```

Worker:

Deploy separately with Wrangler using `/Users/akshaychouhan/ledgerai/wrangler.toml`.

Before treating production as launch-ready, complete:

- [Launch Checklist](/docs/launch-checklist.md)
- [Feature 18 Testing & Documentation](/docs/feature-18-testing-documentation.md)
- [Feature 18 Code Review Checklist](/docs/FEATURE_18_CODE_REVIEW.md)

## Fresh cloud launch behavior

When a user signs in:

1. LedgerAI checks their authenticated cloud data.
2. If cloud data exists, it hydrates the app from cloud.
3. If cloud data is empty, LedgerAI starts the user in a clean account-backed workspace.
4. OneDrive remains an optional backup/export path inside the product, not a launch-time migration requirement.

## External setup still required before launch

- A hosted Supabase project must be configured for both web and mobile envs.
- Supabase Auth redirect URLs and password-reset URLs must include the real web/mobile targets you plan to use.
- The Cloudflare AI worker must be deployed with `ALLOWED_ORIGIN` and `SUPABASE_URL` configured so signed-in session auth works at the worker boundary.
- Google/Microsoft OAuth credentials must be configured for the web email flows you intend to launch.
- Mobile provider client IDs and callback URLs must be configured:
  - Google: `com.ledgerai.mobile:/oauthredirect`
  - Microsoft: `ledgerai://auth/provider-callback/microsoft`
  - Supabase password reset: `ledgerai://auth/recovery`
  - Use a development build or release build when validating mobile provider auth.

## Validation status

- `npm test` passes in this repo
- `npm run build` passes in this repo
- `npm run mobile:typecheck` passes in this repo
- Live hosted Supabase sign-up/sign-in/reset/RLS has not been verified from this workspace because real env values are not present here
- Device/simulator launch depends on local Android Studio / Xcode / Expo runtime availability

## Current limitations

- The web app still relies on the large `src/App.jsx` monolith internally; the new root shell wraps it rather than replacing it.
- Provider OAuth tokens remain device-local for Gmail/Outlook/OneDrive. Cloud stores connector metadata, not raw provider secrets.
- Mobile reconciliation now supports creating new runs from pasted text or picked statement files, but it still works best with CSV, text, and text-based PDFs rather than image-only scans.
- OneDrive remains optional backup/export. Supabase is now the intended primary account-backed source of truth.
