# SpentyAI - Product Requirements Document

## Original Problem Statement
SpentyAI is a subscription-based full-stack autonomous accounting software with AI at its core. Double-entry bookkeeping, AI-powered email/SMS transaction detection, bank reconciliation, reports, and cross-platform sync.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Vite (Botanical Finance design)
- **Auth**: Self-hosted Google OAuth 2.0 + Session cookies (replaced Emergent-managed auth)
- **AI**: OpenAI (configured via OPENAI_API_KEY env var)
- **Email Service**: Resend (configured via RESEND_API_KEY and SENDER_EMAIL env vars)
- **Hosting**: Railway (external) + MongoDB Atlas
- **Custom Domains**: www.spentyai.com

## Implemented Phases

### Phase 1 - Foundation
Landing Page, Google OAuth, Dashboard, Double-Entry Accounting, Accounts/Categories CRUD, Ledger, Transactions, Pricing, Feature Requests

### Phase 2 - Gmail Email Processing
Gmail OAuth, email sync, AI parsing, pending review, auto-retry 15 min, duplicate detection

### Phase 3 - Outlook Integration
Microsoft Graph API OAuth, email sync, same AI pipeline

### Phase 4 - SMS Processing
SMS upload API, AI SMS analysis, cross-source duplicate detection

### Phase 5 - Cash Flow & Recurring
Recurring from evidence/manual only, 24-month projection with frequency multipliers

### Phase 6 - Statement Reconciliation
CSV/PDF upload, auto-parsing, fuzzy reconciliation engine, add missing entries

### Phase 7 - Reports Dashboard
- Summary, By Period, By Category views
- Filters: Period presets + custom date range

### Phase 8 - Welcome Email & Email Verification
- Verification email on signup
- Welcome email after verification
- Unverified user banner

### Phase 9 - External Deployment & Auth Migration (Feb 2026)
- Migrated from Emergent platform to Railway + MongoDB Atlas
- Rebranded Ledger AI to SpentyAI
- Removed all Emergent proprietary auth dependencies (auth.emergentagent.com)
- Implemented self-hosted Google OAuth 2.0 flow:
  - `GET /api/auth/google` — initiates OAuth, redirects to Google
  - `GET /api/auth/google/callback` — exchanges code, creates user/session, sets cookie, redirects to frontend
- Added `FRONTEND_URL` and `BACKEND_URL` env vars for configurable redirects
- Cleaned `.env` files and removed leaked secrets for GitHub push
- Removed `emergentintegrations` package dependency
- Fixed PKCE code_verifier for Gmail OAuth
- Fixed Gmail/Outlook callback redirects to frontend
- Privacy Policy and Terms of Service pages
- New Google Cloud Console project under domain owner account

### Phase 10 - Email Sync Improvements & Records Archive (Apr 2026)
- Smarter AI email parsing: ignores credit card bills, trading/algo notifications, newsletters
- Processing lock prevents duplicate parallel processing tasks
- Startup cleanup resets stuck "processing" emails on deploy
- Auto-resume processing within 10 seconds of deploy (was 15 minutes)
- Live counter polling (3s) during active processing
- Renamed stat labels for clarity (Total Emails, Transactions Found, Skipped, In Queue, etc.)
- In-memory data caching for instant tab switching across all pages
- **Records tab**: Archived transaction emails with search, filters, .eml and ZIP downloads
- **Tax Summary tab**: Isolated email analysis for any past period
  - Create multiple summaries (FY 2024-25, Q1 2025, etc.)
  - Uses existing connected Gmail/Outlook accounts
  - AI scans emails in date range, finds transactions
  - Shows income/expenses/net summary card
  - Click to view full editable transaction list
  - Completely isolated — does NOT affect main ledger or accounts
  - Export to CSV
  - Real-time progress during analysis

## Auth Flow (Current)
1. User clicks "Continue with Google" on Login page
2. Frontend redirects to `{BACKEND}/api/auth/google`
3. Backend constructs Google OAuth URL with state, redirects user to Google
4. Google authenticates user, redirects to `{BACKEND}/api/auth/google/callback`
5. Backend exchanges code for tokens, fetches user info, creates/updates user, creates session
6. Backend sets `session_token` cookie and redirects to `{FRONTEND}/dashboard`
7. Frontend `AuthContext` calls `/api/auth/me` with cookie → user is authenticated

## All API Endpoints
- Auth: `GET /api/auth/google`, `GET /api/auth/google/callback`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/auth/verify-email`, `POST /api/auth/resend-verification`
- Core: accounts, categories, transactions CRUD
- Dashboard: summary
- Email: gmail/outlook connect/sync
- SMS: upload, stats
- Cash Flow: recurring, projection
- Reconciliation: statements upload/reconcile
- Reports: summary, by-period, by-category
- Support: `POST /api/support/ticket`

### Phase 11 - UX Improvements & Mobile (Apr 2026)
- Broken email account reconnect prompt with one-click reconnect
- Edit Transaction Modal — reusable popup on Transactions, Ledger, and Email & SMS pages
- Quick-add for Category, Subcategory, Account inside the modal
- Multi-currency AI detection — detects currency from emails, converts using frankfurter.app
- Settings tab with default currency (46 currencies) and date format preferences
- Email preview modal in Records tab (view email body + download attachments)
- Collapsible sidebar with hamburger toggle
- Removed email verification banner (Google-only login)
- Full mobile-responsive design across all pages

### Phase 12 - Support Ticket System (Apr 2026)
- **Support tab**: New sidebar navigation item for user support requests
- Support ticket form with:
  - Subject (required)
  - Category dropdown (Bug Report, Feature Request, Billing Issue, Account Help, Data & Sync, General Inquiry)
  - Priority selector (Low, Medium, High)
  - Message textarea (required)
  - Auto-filled user info (name, email)
- Backend endpoint `POST /api/support/ticket`:
  - Validates required fields
  - Saves ticket to `support_tickets` MongoDB collection
  - Sends formatted HTML email via Resend to SUPPORT_EMAIL
  - Email includes ticket ID, priority badge, category, user contact info
  - Reply-to set to user's email for easy response
- Success confirmation screen with "Submit Another Request" option
- New env var: `SUPPORT_EMAIL` (falls back to SENDER_EMAIL)

### Phase 13 - Subcategories & AI Bank Detection (Apr 2026)
- **Subcategories**: One-level deep subcategory support already existed in Categories tab
  - Parent categories can have multiple subcategories
  - Subcategories are optional when recording transactions
  - UI shows hierarchical tree view with parent → subcategory structure
- **Payment Method field**: Added to all transaction forms
  - Options: UPI, Credit Card, Debit Card, Net Banking, Cash, Wallet, Cheque, NEFT, RTGS, IMPS, Other
  - Optional field - can be left empty
  - Stored in `payment_method` field on transactions
- **AI Bank Account Detection** (Email/SMS parsing enhanced):
  - AI prompt updated to detect specific bank account names from emails/SMS (e.g., "HDFC Savings XX1234")
  - Detects bank type (savings, current, credit_card, wallet)
  - Detects payment method from transaction text
  - **Auto-creates bank accounts**: If AI detects a bank not in user's accounts, creates it automatically
  - New accounts flagged with `needs_opening_balance: true` and `ai_created: true`
  - **"Unknown Bank" fallback**: If no bank detected, uses/creates "Unknown Bank" account
  - User can edit account and set opening balance during approval
- Backend changes:
  - `TransactionCreate` and `TransactionUpdate` models now include `payment_method`
  - `_create_transaction_from_ai_result` updated for bank auto-creation
  - `_process_sms_transaction` updated similarly
  - Account update endpoint clears `needs_opening_balance` when balance is set

### Phase 13.1 - Improved Bank Detection from Email/SMS Sender (Apr 2026)
- **Fallback bank detection from email sender/content**: If AI doesn't explicitly detect bank name:
  - Parses `from_email` address for bank keywords (e.g., `alerts@hdfcbank.net` → HDFC Bank)
  - Scans subject line and email body for bank mentions
  - Supports 20+ Indian banks: HDFC, ICICI, SBI, Axis, Kotak, IDFC, Yes Bank, IndusInd, PNB, BOB, Canara, Union, Federal, RBL, Citibank, Amex, SCB, HSBC
  - Supports wallets: Paytm, PhonePe, Google Pay, Amazon Pay
- **Smarter account matching**:
  - Extracts keywords from detected bank name (e.g., "HDFC" from "HDFC Bank Savings")
  - Searches user's existing accounts for keyword matches (not just prefix match)
  - If user has "My HDFC Savings" account and email is from HDFC, it will match correctly
- **Same improvements for SMS parsing**: Detects bank from SMS sender ID (e.g., "HDFCBK", "ICICIB")

### Phase 14 - Customizable Account Sub-types (Apr 2026)
- **Dynamic sub-type management**: Replaced hardcoded sub-type list with API-driven approach
- Backend endpoints: `GET/POST/PUT/DELETE /api/account-sub-types`
- Default sub-types (Bank, Cash, Wallet, Savings, Investment, Fixed Deposit, Credit Card, Loan, Mortgage, Capital, Retained Earnings) are read-only
- Users can create, rename, and delete custom sub-types per account category (asset/liability/equity)
- Sub-type Manager modal with tabbed UI (Asset/Liability/Equity)
- Inline editing and delete with confirmation for custom sub-types
- Account create/edit form dynamically fetches and displays available sub-types
- Delete protection: cannot delete sub-types in use by existing accounts
- Badge counter on "Sub-types" button shows custom sub-type count
- MongoDB collection: `account_sub_types` with fields: sub_type_id, user_id, name, account_type, icon, created_at

### Phase 15 - Balance Date (balance_as_of_date) Feature (Apr 2026)
- **Dated balance snapshots**: Every account now stores a `balance_as_of_date` alongside the opening balance
- Represents the "opening balance for the day" on that date — transactions on or after that date are NOT yet factored in and will affect the computed balance
- Transactions ON or AFTER the balance date affect the current balance; transactions before it do not
- Default date: today's date when creating a new account
- **Backend changes**:
  - `AccountCreate` and `AccountUpdate` models include `balance_as_of_date` field
  - `recalculate_account_balance()` helper: recomputes balance = opening_balance + sum(income after date) - sum(expenses after date) + transfers
  - `apply_transaction_to_balances()` and `reverse_transaction_balances()` now check `balance_as_of_date` before applying `$inc`
  - New endpoint: `POST /api/accounts/{id}/recalculate` — manually trigger recalculation
  - Updating `opening_balance` or `balance_as_of_date` auto-triggers recalculation
  - All AI-created accounts (email/SMS parsing) include `balance_as_of_date` set to today
  - Seed default accounts include `balance_as_of_date`
- **Frontend changes across all account creation/edit spots**:
  - Accounts page: New Account + Edit Account forms include "Balance as of (end of day)" date picker
  - Edit Transaction Modal: Quick-add account includes balance + date fields
  - Transactions page: Quick-add account includes balance + date fields
  - Warning banner on Accounts page for accounts missing `balance_as_of_date`
  - Account cards show "(as of YYYY-MM-DD)" text and "Set balance date" link for missing dates
  - Ledger running balance calculation respects `balance_as_of_date`

## Prioritized Backlog

### P1 (Next)
- Frontend component splitting (EmailSync, Reconciliation, Transactions)
- Backend modularization (break server.py monolith)

### P2 (Future)
- Stripe + Razorpay + PayPal payment integration
- Microsoft Azure app under professional email

### P3 (Backlog)
- React Native mobile app
- Exportable PDF reports
- Admin analytics dashboard (aggregated, non-personal metrics)
