# LedgerAI Backend Schema Overview

Migration file:

- `/Users/akshaychouhan/ledgerai/supabase/migrations/20260317201500_ledgerai_auth_foundation.sql`

## Design principles

- `ledger_*` table naming for product domain clarity.
- `user_id` ownership on all domain tables.
- `payload jsonb` on all domain tables for forward/backward compatibility with current object shapes.
- typed columns for core reporting, filtering, reconciliation, and validation paths.
- `client_id` columns to preserve existing local IDs from App objects.

## Core tables

1. `ledger_transactions`
   - Approved ledger transactions.
   - Includes transaction typing, account references, FX/base-currency fields, vendor/subcategory, email-source metadata, and `journal_entries`.

2. `ledger_inbox_items`
   - Pending/approved/discarded review queue rows.
   - Mirrors transaction-like fields with queue metadata.

3. `ledger_email_accounts`
   - Gmail/Outlook connector metadata (provider, sync/query settings, reconnect flags, last sync/error).
   - Stores metadata, not provider OAuth secrets.

4. `ledger_bookkeeping_accounts`
   - Chart/account records (asset/liability/etc), opening/current balances, and FX-converted balance fields.

5. `ledger_activities`
   - Business activities (e.g., Personal, Equity Trading).

6. `ledger_categories`
   - Activity-scoped categories.

7. `ledger_recurring_items`
   - Recurring schedule-ready items to support recurring/projection workflows.

8. `ledger_app_settings`
   - Per-user settings as key/value with optional typed scalar columns plus `payload`.
   - Intended for AI config, cloud connector config, auth config, diagnostics preferences, etc.

9. `ledger_ai_pending_items`
   - AI pending/retry queue state for email extraction recovery.
   - Supports cloud queued flags/job IDs and retry timestamps.

10. `ledger_reconciliation_runs`
    - Reconciliation execution metadata (period, account, counts, status).

11. `ledger_reconciliation_items`
    - Reconciliation artifacts/issues (matched, statement-only, ledger-only, mismatches, hidden flags).

12. `ledger_currency_settings`
    - Per-user base currency and FX behavior.

13. `ledger_fx_rates`
    - Per-user cached FX rate snapshots by date/currency pair.

## Constraints and indexing highlights

- Partial unique indexes for `(user_id, client_id)` on importable tables.
- Uniques for high-value business keys:
  - activities by `(user_id, lower(name))`
  - categories by `(user_id, lower(activity_name), lower(name))`
  - AI pending by `(user_id, account_client_id, msg_id)`
  - FX rates by `(user_id, from_currency_code, to_currency_code, rate_date)`
- Query indexes for date/status/vendor/reconciliation paths.

## RLS model

- RLS enabled and forced on all `ledger_*` tables.
- Policies:
  - `select`: own rows only
  - `insert`: only with `user_id = auth.uid()`
  - `update`: own rows only + ownership unchanged
  - `delete`: own rows only
- Trigger-level ownership lock prevents `user_id` mutation.

## Readiness note

The schema provides first-class persistence for the current LedgerAI domains. UI/runtime readiness still depends on the specific web or mobile client flow and external setup such as Supabase envs, AI worker configuration, and provider OAuth credentials.
