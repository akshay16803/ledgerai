# LedgerAI Architecture Overview

LedgerAI now has three cooperating layers:

## 1. Web app

- Path: `/Users/akshaychouhan/ledgerai/src`
- Stack: React + Vite
- The existing product UI and bookkeeping logic still live mostly in `/Users/akshaychouhan/ledgerai/src/App.jsx`
- A new authenticated root shell in `/Users/akshaychouhan/ledgerai/src/RootApp.jsx` now sits above that monolith

The root shell is responsible for:

- Supabase email/password auth
- password reset flow entry
- loading the signed-in user's cloud snapshot
- replaying cloud state back into the old localStorage-shaped app before `App.jsx` mounts
- debounced persistence of app state back into the cloud

This keeps the existing LedgerAI behavior alive while moving the source of truth to a real per-user backend.

## 2. Cloud backend

- Path: `/Users/akshaychouhan/ledgerai/supabase/migrations/20260317201500_ledgerai_auth_foundation.sql`
- Stack: Supabase Auth + Postgres + Row Level Security

Key choices:

- `ledger_*` tables for each main LedgerAI domain
- `user_id` on every row
- forced RLS on every table
- typed columns for query/reporting paths
- `payload jsonb` for lossless compatibility with current `App.jsx` shapes

This gives LedgerAI a real account-backed ownership model instead of the old single-browser owner lock.

## 3. Mobile app

- Path: `/Users/akshaychouhan/ledgerai/apps/mobile`
- Stack: Expo + React Native + React Navigation + Supabase Auth

The mobile app is not a WebView wrapper.

It currently includes:

- secure auth shell
- secure session persistence
- premium navigation/design system
- bottom-tab information architecture
- dashboard summary
- ledger create/edit/delete flows
- inbox edit/approve/discard flows
- accounts add/edit flows
- reports summary filters
- reconciliation review/edit/resolve flows
- honest gated states for provider-dependent actions that are not safe to expose yet

## Shared logic

- Path: `/Users/akshaychouhan/ledgerai/packages/ledgerai-core`

This package holds extracted domain helpers for:

- constants/defaults
- money/base-currency helpers
- accounting validation helpers
- reconciliation helpers
- auth normalization helpers

## AI architecture

- Worker path: `/Users/akshaychouhan/ledgerai/scripts/cloudflare-ai-worker.js`
- Config path: `/Users/akshaychouhan/ledgerai/wrangler.toml`

The Cloudflare Worker remains in place.

It is still the right place for:

- AI proxying
- FX conversion endpoint
- background retry queue support

It is not the product data backend. Supabase is now the account/data system of record.

## Launch behavior

1. User signs in with Supabase email/password.
2. If cloud data already exists, LedgerAI hydrates from cloud.
3. If cloud data is empty, LedgerAI starts a clean account-backed workspace.
4. Existing OneDrive flows remain optional inside the product, but they are not part of launch onboarding.

## Current direction

- Web: account-backed and cloud-synced
- Mobile: native authenticated app with core cloud-backed bookkeeping actions plus explicit gating for provider/mobile-specific blockers
- OneDrive: optional backup/export path, not primary source of truth
- Cloudflare Worker: preserved for AI/FX/retry workloads
