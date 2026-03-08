# LedgerAI - Product Requirements Document

## Original Problem Statement
LedgerAI is a personal finance/bookkeeping dashboard for Indian traders. Core objective is to account for every transaction and show correct assets, liabilities, income, and expenses. Special focus on expense tracking with detailed breakdowns.

## User Personas
1. **Indian Traders** - Track trading P&L across F&O, Equity
2. **Small Business Owners** - Monitor business expenses and personal drawings
3. **Personal Finance Users** - Track daily expenses, subscriptions, recurring payments

## Core Requirements (Static)
- Double-entry bookkeeping with automated journal entries
- Multi-activity tracking (Personal, Trading, Business)
- Email sync (Gmail/Outlook) with AI transaction extraction
- Cloud sync via OneDrive
- Account management (Assets/Liabilities)

## What's Been Implemented

### Phase 1 (Initial) - March 8, 2026
- Visual expense charts (pie charts for categories, activities, vendors)
- Monthly expense trend bar chart
- Expense drill-down modals with sorting
- Vendor analysis view with top 10 ranking

### Phase 2 - March 8, 2026
- **Date Range Filter** - Filter all reports by From/To dates
- **Activity Filter** - Filter by specific business activity
- **Activity Analysis View** - P&L breakdown per activity with pie charts
- **Export Functionality** - CSV, Excel (XLS), PDF export
- **Recurring Expense Detection** - Auto-detect patterns, manual marking
- **Future Cashflow Tab** - 12-month projection based on recurring expenses
- **AI-Powered Recurring Detection** - During email sync, AI identifies subscriptions

### Phase 3 - March 8, 2026
- **Month-over-Month Comparison** - Compare current vs previous month expenses
  - Overall total change with percentage
  - Category-wise changes (top movers)
  - Vendor-wise changes
  - 6-month trend chart
- **Removed Unused Tabs** - Simplified navigation (removed Journal, Day Review)
- **Duplicate Detection** - AI generates transaction signatures to prevent SMS/Email duplicates
- **Improved AI Retry** - Auto-refresh tokens before requiring reconnect
- **SMS Transaction Analysis** - Enhanced SMS parsing with duplicate filtering

### Phase 4 (Current) - March 8, 2026
- **Deployment Fix** - Fixed ESLint configuration blocker preventing production builds
  - Removed invalid `defineConfig` and `globalIgnores` imports from ESLint v9
  - Converted to proper ESLint flat config array format
  - Build now completes successfully for production deployment

## Technical Stack
- **Frontend**: React + Vite
- **Storage**: localStorage + OneDrive cloud sync
- **AI**: Cloudflare Workers AI for email/SMS analysis

## SMS Integration Approach
Due to browser security restrictions, SMS cannot be read directly. The solution:
1. Use free forwarder apps (MacroDroid for Android, Shortcuts for iOS)
2. These apps auto-forward bank SMS to connected Gmail
3. LedgerAI picks them up during email sync
4. AI analyzes and extracts transaction data
5. Duplicate detection filters out items already in ledger

## Prioritized Backlog

### P0 (Critical) - Fixed
- ✅ Email reconnection stability improved
- ✅ AI retry without forced reconnect

### P1 (High Priority)
- Direct SMS API integration (if native app developed)
- Budget tracking with alerts
- Investment portfolio tracking

### P2 (Nice to Have)
- Mobile app with native SMS reading
- Dark/Light theme toggle
- Recurring income tracking

## Navigation (Simplified)
- Dashboard
- Ledger
- Inbox
- Email
- Accounts
- Reports (with 5 views: Overview, Month Comparison, Expense Deep Dive, Activity Analysis, Vendor Analysis)
- Recurring
- Future Cashflow
- Settings

## Feature Summary
- ✅ Visual Charts (Pie, Bar)
- ✅ Expense Drill-Down
- ✅ Vendor Analysis
- ✅ Date Range Filters
- ✅ Activity Analysis
- ✅ Export (CSV/XLS/PDF)
- ✅ Recurring Detection
- ✅ Future Cashflow Projection
- ✅ AI Email Analysis with Recurring Detection
- ✅ Month-over-Month Comparison
- ✅ Duplicate Transaction Detection
- ✅ Improved AI Retry (no forced reconnect)
