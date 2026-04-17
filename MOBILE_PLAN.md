# SpentyAI / LedgerAI — Mobile Roadmap

Last updated: 2026-04-17
Owner: Ricky (akshaychouhan16803)
Working branch: `emergent`

This is the roadmap for bringing the React Native Expo app in `apps/mobile/` to full
parity with the core money workflows of the web app at `src/`. It is deliberately
phased so each phase ships something working instead of a giant rewrite.

## Current state (as of this document)

**What exists in `apps/mobile/`:**
- Expo SDK 53, React Native 0.79, React 19, TypeScript
- iOS and Android native folders already prebuilt (ready to build via EAS)
- Tab navigation (`app/navigation/AppTabs.tsx`) and auth stack (`AuthStack.tsx`)
- Auth screens: Sign In, Sign Up, Forgot Password, Reset Password
- Feature screens already implemented:
  - Dashboard, Inbox (SMS), Ledger, Accounts, Email, Reconciliation, Reports, Settings
- Supabase client with offline queue, delta sync, realtime subscriptions
- Cloudflare AI Worker integration for email/SMS analysis
- SMS native module for Android with deduplication and signature hashing
- Design system: `design/theme.ts`, `layout.ts`, `responsive.ts`
- Shared components: `AppBackground`, `AppCard`, `PrimaryButton`, `SectionHeader`, `StatCard`, `TextField`
- Integration tests: `authFlow.integration.test.ts`, `smsAnalysisFlow.integration.test.ts`, `realtimeSyncFlow.integration.test.ts`
- Shared business logic in `packages/ledgerai-core` (accounting, auth, money, reconciliation)

**Web pages that still have no mobile equivalent** (the real parity gap):
- `Categories` — category CRUD and rules
- `CashFlow` — cashflow projection and runway view
- `Records` — raw transaction records browser
- `TaxSummary` — period-based tax breakdown
- `FeatureRequests` — in-app roadmap / upvotes
- `Support` — help + contact form

**Web pages intentionally excluded from mobile parity** (per user decision):
- `Landing`, `Pricing` — marketing pages, not relevant once the user has the app
- `Privacy`, `Terms` — link out to web
- `VerifyEmail` — email verification deep link, already handled by Expo auth session
- `Login` — mobile has its own auth stack; no need to mirror the web login page

## Known P0 bugs as of 2026-04-17

1. **"Retry AI Pending" button hangs for 2 minutes and never processes anything.**
   - Root cause: `callCloudQueueEndpoint()` in `apps/mobile/src/lib/email/emailProcessing.ts:373`
     uses `CLOUD_PULL_TIMEOUT_MS = 120_000` (`apps/mobile/src/lib/constants.ts:85`) as the
     `AbortController` timeout for `/retry/pull`. When the cloud queue has nothing to return
     (because the worker's cron `*/5 * * * *` hasn't drained jobs yet), the fetch sits for
     the full 2 minutes before falling through to direct AI analysis — which is the path
     that actually produces ledger entries (`createLedgerRepository.ts:2321+`).
   - Fix (Phase 1): shorten `CLOUD_PULL_TIMEOUT_MS` to 15 s and, when the user explicitly
     taps the button (`opts.force === true`), skip the cloud pull entirely and go
     straight to direct AI analysis.

2. **Cloudflare AI Worker returns 401 when the mobile app calls it.**
   - The worker accepts two auth modes (`scripts/cloudflare-ai-worker.js:400-418`):
     shared key via `x-ledgerai-key` header, OR Supabase JWT via `Authorization: Bearer`.
   - The mobile app already sends one of these (`emailProcessing.ts:228-239`) — Bearer JWT
     if an active session is available, shared key otherwise.
   - A raw curl against the worker produces a valid 401 (no auth header) — that part of
     the investigation was a red herring.
   - The likely real cause when 401 happens in production is one of:
     - `LEDGERAI_SHARED_KEY` not set as a Cloudflare Worker secret, AND the user's Supabase
       JWT audience/issuer does not match `SUPABASE_URL` / `SUPABASE_JWT_AUDIENCE` in
       `wrangler.toml`
     - The cached `aiConfig.bearerToken` in `ledger_app_settings` is stale (expired JWT)
     - The user signed in to a different Supabase project
   - Fix (Phase 1): improve error surfacing so the UI distinguishes "no auth configured",
     "bearer expired", and "shared key rejected". Do NOT change the auth contract.

## Phase 1 — Fix the two P0 bugs (this session)

Scope is strictly the bugs listed above. No new features. Goal: unblock email AI retry.

1. Shorten `CLOUD_PULL_TIMEOUT_MS` from 120 s to 15 s.
2. In `retryEmailPending`, when the caller passes `force: true` (the manual button),
   bypass `applyCloudEmailRetryJobs` and reset all cloud-queued rows immediately so the
   existing direct-AI loop processes them this render.
3. Improve error classification for worker 401s in `callAiWorker` and
   `callCloudQueueEndpoint` — surface a structured `authFailure` flag so the Email screen
   can show a clear "Sign out and back in" vs "Reconfigure AI backend" hint.
4. No UI changes other than the error message wording. Design tokens untouched.

**What Phase 1 will NOT touch:**
- Any screen outside EmailScreen's error toast
- Any file under `src/` (the web app)
- Any file under `packages/ledgerai-core`
- Supabase schema, worker code, or wrangler config
- Auth flow, sync flow, SMS flow, reconciliation flow

**Phase 1 verification:**
- `npm --prefix apps/mobile run typecheck` passes
- Existing integration tests pass
- Simulated retry in `createLedgerRepository.test.ts` (added unit test asserts that
  `retryEmailPending({ force: true })` does not call `pullCloudRetryJobs`)
- UI consistency: no new colors, fonts, or component styles introduced

## Phase 2 — Close the parity gap (next session)

Port the six missing screens in this order, one per PR, each self-contained:

| Order | Screen | Parity reference | Notes |
|-------|--------|------------------|-------|
| 1 | Categories | `src/pages/Categories.jsx` | CRUD + rule config; uses existing `ledger_categories` table |
| 2 | Records | `src/pages/Records.jsx` | Paginated transaction browser; reuse `TransactionEditorCard` |
| 3 | CashFlow | `src/pages/CashFlow.jsx` | Read-only projection view; reuse chart primitives if possible |
| 4 | TaxSummary | `src/pages/TaxSummary.jsx` | Period selector + aggregate view |
| 5 | FeatureRequests | `src/pages/FeatureRequests.jsx` | Simple list + upvote; optional offline queue |
| 6 | Support | `src/pages/Support.jsx` | Form + links; lowest priority |

For each screen:
- Reuse existing design tokens and shared components. No new theme colors.
- Wire through the existing Supabase client + offline queue in `createLedgerRepository`.
- Add a minimal integration test: render + fetch + empty state.
- Add the route to `AppTabs` or a dedicated `MoreStack` navigator (decision during Phase 2
  kickoff — tabs are at 5 today, adding 6 more requires a "More" tab or drawer).

## Phase 3 — Polish, performance, store prep (final session)

- Splash screen + app icon refresh from `public/` web assets
- Perceived performance: `react-native-reanimated` on common transitions, list
  virtualization audit, image caching for avatars
- Startup time profile: measure with Hermes profiler, defer non-critical providers
- Accessibility pass: dynamic type, focus order, VoiceOver labels
- Store listing metadata: iOS App Store Connect + Google Play Console drafts
- EAS production build for both platforms, internal TestFlight + internal Play track

## What is explicitly out of scope (all phases)

- Any change to the web app at `src/`, `public/`, `index.html`, `vite.config.js`
- Any change to the Cloudflare worker or `wrangler.toml` (that is a separate deploy
  concern that happens from the user's machine with the CF API token)
- Any change to Supabase schema or RLS policies
- Any change to the branch strategy (always `emergent`, never other branches)

## Rule 0 compliance

This roadmap respects the project's Rule 0: no feature, file, or UI element is
modified without an explicit user ask. Every phase lists what will NOT be touched.
