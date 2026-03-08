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

### Phase 2 (Current Session) - March 8, 2026
- **Date Range Filter** - Filter all reports by From/To dates
- **Activity Filter** - Filter by specific business activity
- **Activity Analysis View** - P&L breakdown per activity with pie charts
- **Export Functionality** - CSV, Excel (XLS), PDF export
- **Recurring Expense Detection** - Auto-detect patterns, manual marking
- **Future Cashflow Tab** - 12-month projection based on recurring expenses
- **AI-Powered Recurring Detection** - During email sync, AI identifies subscriptions (Netflix, insurance, utilities, EMIs)

## Technical Stack
- **Frontend**: React + Vite
- **Storage**: localStorage + OneDrive cloud sync
- **AI**: Cloudflare Workers AI for email analysis

## Prioritized Backlog

### P0 (Critical)
- None - core functionality complete

### P1 (High Priority)
- Budget setting/alerts per category
- Expense comparison (month-over-month)
- SMS parsing for Indian bank alerts

### P2 (Nice to Have)
- Mobile responsive improvements
- Dark/Light theme toggle
- Recurring income tracking (salary, dividends)
- Investment portfolio tracking

## Next Tasks
1. Add SMS bank alert parsing
2. Implement budget tracking with alerts
3. Add expense comparison views

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
