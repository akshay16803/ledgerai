# LedgerAI Internal Compatibility Notes

LedgerAI now launches as a fresh authenticated cloud-backed product. There is no user-facing migration/import onboarding flow in the launch experience.

These notes only describe the internal compatibility adapter that still exists because `/Users/akshaychouhan/ledgerai/src/App.jsx` remains the primary product implementation.

## Why the adapter still exists

- The current web product still reads and writes a localStorage-shaped state model.
- `/Users/akshaychouhan/ledgerai/src/RootApp.jsx` now authenticates the user, loads that user's cloud snapshot, and replays it into the legacy localStorage shape before mounting `/Users/akshaychouhan/ledgerai/src/App.jsx`.
- The same adapter also captures debounced local state changes and persists them back into Supabase.

## What the adapter must preserve

- transactions
- inbox items
- email account metadata without raw OAuth tokens
- bookkeeping accounts
- activities
- categories
- recurring items
- app settings
- AI pending/retry items
- reconciliation runs/items
- base currency and FX cache metadata
- processed email cache metadata needed by the existing app

## What is intentionally not part of launch UX

- no import card for old browser-local users
- no onboarding prompt to import legacy data
- no cloud-empty decision screen

If future internal tooling ever needs to ingest historical local/OneDrive data, that should be implemented as an admin/support workflow rather than a launch requirement for end users.
