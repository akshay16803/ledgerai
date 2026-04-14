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

## Prioritized Backlog

### P1 (Next)
- Frontend component splitting (EmailSync, Reconciliation, Transactions)
- Backend modularization (break server.py monolith)

### P2 (Future)
- Stripe + Razorpay + PayPal payment integration

### P3 (Backlog)
- React Native mobile app
- Exportable PDF reports
