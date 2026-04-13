# SpentyAI - Product Requirements Document

## Original Problem Statement
SpentyAI is a subscription-based full-stack autonomous accounting software with AI at its core. Double-entry bookkeeping, AI-powered email/SMS transaction detection, bank reconciliation, reports, and cross-platform sync.

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Vite (Botanical Finance design)
- **Auth**: Google OAuth + Session cookies
- **AI**: OpenAI (configured via OPENAI_API_KEY env var)
- **Email Service**: Resend (configured via RESEND_API_KEY and SENDER_EMAIL env vars)

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

## All API Endpoints
- Auth: session, me, logout, verify-email, resend-verification
- Core: accounts, categories, transactions CRUD
- Dashboard: summary
- Email: gmail/outlook connect/sync
- SMS: upload, stats
- Cash Flow: recurring, projection
- Reconciliation: statements upload/reconcile
- Reports: summary, by-period, by-category

## Prioritized Backlog

### P1 (In Progress)
- Frontend component splitting
- Backend modularization

### P2 (Next)
- Stripe + Razorpay + PayPal payment integration

### P3 (Future)
- React Native mobile app
- Exportable PDF reports
