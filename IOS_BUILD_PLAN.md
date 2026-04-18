# SpentyAI iOS App — Master Build Plan

> Generated 2026-04-18. This plan covers every feature in the SpentyAI web app and defines one builder-agent task per feature.

---

## A. App Architecture

| Attribute | Value |
|---|---|
| Bundle ID | `com.spentyai.app` |
| Minimum iOS | 17.0 |
| Language | Swift 5.10+, SwiftUI |
| State Management | `@Observable` (Observation framework) |
| Networking | `URLSession` + `async/await` |
| Auth | Google Sign-In via `ASWebAuthenticationSession` → backend returns Bearer token |
| Subscriptions | StoreKit 2 (no Razorpay) |
| Backend base URL | Configurable via `Config.plist` or environment; same FastAPI backend as web |
| Cross-platform subscription | Backend checks both Razorpay and Apple subscription status |
| Persistent storage (local) | SwiftData for offline cache; Keychain for session token |

### Auth Flow (iOS-specific)
1. User taps "Sign in with Google".
2. App opens `ASWebAuthenticationSession` targeting the Google OAuth consent screen (using the same `GOOGLE_CLIENT_ID`).
3. On success, Google returns an `id_token`.
4. App sends `POST /api/auth/google/mobile` with `{ "id_token": "<token>" }`.
5. Backend verifies with Google, creates/updates user, returns `{ "session_token": "...", "user": {...} }`.
6. App stores `session_token` in Keychain and uses it as `Authorization: Bearer <session_token>` on all subsequent requests.

### Subscription Flow (iOS-specific)
1. App shows plans using StoreKit 2 product IDs: `com.spentyai.monthly`, `com.spentyai.quarterly`, `com.spentyai.yearly`, `com.spentyai.lifetime`.
2. User purchases via Apple IAP.
3. App sends `POST /api/payments/apple/verify` with `{ "receipt_data": "...", "product_id": "..." }`.
4. Backend verifies receipt with Apple servers, activates subscription with `subscription_provider: "apple"`.
5. App refreshes user status via `GET /api/payments/status`.

---

## B. Folder Structure

```
ios/SpentyAI/
├── SpentyAIApp.swift                   # @main entry point, root navigation
├── Config.plist                         # Base URL, Google Client ID
│
├── Core/
│   ├── Networking/
│   │   ├── APIClient.swift              # URLSession wrapper, Bearer token, request/response
│   │   ├── APIEndpoints.swift           # All API path constants
│   │   └── APIError.swift               # Error types
│   ├── Auth/
│   │   ├── AuthManager.swift            # @Observable — login, logout, session, user state
│   │   ├── KeychainHelper.swift         # Secure token storage
│   │   └── GoogleSignInHelper.swift     # ASWebAuthenticationSession wrapper
│   ├── Models/
│   │   ├── User.swift                   # User, subscription info
│   │   ├── Account.swift                # Account, AccountSubType
│   │   ├── Transaction.swift            # Transaction (income/expense/transfer)
│   │   ├── Category.swift               # Category (parent/child tree)
│   │   ├── Invoice.swift                # Sales invoice, line items, payments
│   │   ├── Bill.swift                   # Purchase bill, line items, payments
│   │   ├── Customer.swift               # Customer
│   │   ├── Vendor.swift                 # Vendor
│   │   ├── Statement.swift              # Uploaded statement, parsed entries, reconciliation
│   │   ├── Mandate.swift                # Auto-debit mandate
│   │   ├── CashFlowProjection.swift     # Monthly projection data
│   │   ├── Report.swift                 # Report summary, period, category breakdown
│   │   ├── EmailSyncStatus.swift        # Gmail/Outlook account status, stats
│   │   ├── Record.swift                 # Archived email/receipt record
│   │   ├── TaxSummary.swift             # Past insights / tax summary
│   │   ├── FeatureRequest.swift         # Feature request
│   │   ├── SupportTicket.swift          # Support ticket
│   │   ├── Settings.swift               # User settings (firm, currency, etc.)
│   │   ├── ChatMessage.swift            # AI chat message
│   │   └── PaymentPlan.swift            # Subscription plan, payment order
│   ├── Theme/
│   │   ├── SpentyColors.swift           # Brand colors matching web CSS variables
│   │   ├── SpentyFonts.swift            # Typography scale
│   │   └── SpentyStyle.swift            # Button styles, card styles, input styles
│   └── Components/
│       ├── LoadingView.swift            # Full-screen spinner
│       ├── EmptyStateView.swift         # Icon + message + optional CTA
│       ├── ErrorBanner.swift            # Dismissible error banner
│       ├── StatCard.swift               # Dashboard stat card
│       ├── CurrencyText.swift           # Formatted currency display (locale-aware)
│       ├── StatusBadge.swift            # Colored status pill (approved, pending, etc.)
│       ├── FilterBar.swift              # Reusable filter strip (type, account, date)
│       ├── ConfirmDialog.swift          # Destructive action confirmation
│       └── SearchBar.swift              # Debounced search input
│
├── Features/
│   ├── Auth/
│   │   ├── LoginView.swift
│   │   └── AuthViewModel.swift
│   ├── Onboarding/
│   │   └── SubscriptionPaywall.swift    # StoreKit 2 paywall (shown if no active sub)
│   ├── Dashboard/
│   │   ├── DashboardView.swift
│   │   └── DashboardViewModel.swift
│   ├── AIChat/
│   │   ├── AIChatView.swift             # Floating panel / sheet
│   │   ├── AIChatViewModel.swift
│   │   └── ChatBubble.swift
│   ├── Transactions/
│   │   ├── TransactionListView.swift
│   │   ├── TransactionLedgerView.swift
│   │   ├── TransactionFormView.swift    # Create/edit modal
│   │   └── TransactionsViewModel.swift
│   ├── Accounts/
│   │   ├── AccountListView.swift
│   │   ├── AccountFormView.swift        # Create/edit sheet
│   │   ├── AccountDetailView.swift      # Balance, amortization, OD interest
│   │   ├── SubTypeManagerView.swift
│   │   ├── DematUploadView.swift
│   │   └── AccountsViewModel.swift
│   ├── Categories/
│   │   ├── CategoryListView.swift       # Tree with expand/collapse
│   │   ├── CategoryFormView.swift
│   │   └── CategoriesViewModel.swift
│   ├── CashFlow/
│   │   ├── CashFlowView.swift           # Summary cards + chart + tables
│   │   ├── CashFlowChartView.swift      # 24-month bar chart (Swift Charts)
│   │   ├── MandatesListView.swift
│   │   ├── RecurringListView.swift
│   │   └── CashFlowViewModel.swift
│   ├── Reports/
│   │   ├── ReportsView.swift            # Period filters + summary + charts
│   │   ├── PeriodChartView.swift        # Income vs Expense bar chart
│   │   ├── DonutChartView.swift         # Category breakdown
│   │   └── ReportsViewModel.swift
│   ├── Reconciliation/
│   │   ├── ReconciliationView.swift     # Upload + statement list
│   │   ├── StatementDetailView.swift    # Parsed entries + reconciliation results
│   │   ├── StatementUploadView.swift    # File picker + account/period selection
│   │   └── ReconciliationViewModel.swift
│   ├── EmailSync/
│   │   ├── EmailSyncView.swift          # Gmail/Outlook accounts + SMS stats
│   │   ├── PendingReviewView.swift      # Approve/reject AI-detected transactions
│   │   └── EmailSyncViewModel.swift
│   ├── SMSSync/
│   │   ├── SMSSyncView.swift            # Upload SMS from device
│   │   └── SMSSyncViewModel.swift
│   ├── Records/
│   │   ├── RecordsView.swift            # Email archive list + receipt tab
│   │   ├── RecordPreviewView.swift      # Email body preview
│   │   ├── ReceiptUploadView.swift      # Camera/gallery receipt capture
│   │   └── RecordsViewModel.swift
│   ├── PastInsights/
│   │   ├── PastInsightsView.swift       # Tax summary list
│   │   ├── PastInsightDetailView.swift  # Transactions + export
│   │   └── PastInsightsViewModel.swift
│   ├── Invoices/
│   │   ├── InvoiceListView.swift        # List + stats (debtors, aging)
│   │   ├── InvoiceFormView.swift        # Create/edit invoice
│   │   ├── InvoicePreviewView.swift     # PDF preview
│   │   ├── RecordPaymentView.swift      # Record partial/full payment
│   │   └── InvoicesViewModel.swift
│   ├── Customers/
│   │   ├── CustomerListView.swift
│   │   ├── CustomerDetailView.swift     # Customer invoices
│   │   ├── CustomerFormView.swift
│   │   └── CustomersViewModel.swift
│   ├── Purchases/
│   │   ├── PurchaseListView.swift       # Purchase bills list + stats
│   │   ├── PurchaseFormView.swift       # Create/edit bill
│   │   ├── PurchasePreviewView.swift    # PDF preview
│   │   ├── RecordBillPaymentView.swift
│   │   └── PurchasesViewModel.swift
│   ├── Vendors/
│   │   ├── VendorListView.swift
│   │   ├── VendorDetailView.swift       # Vendor bills
│   │   ├── VendorFormView.swift
│   │   └── VendorsViewModel.swift
│   ├── FeatureRequests/
│   │   ├── FeatureRequestsView.swift
│   │   ├── FeatureRequestFormView.swift
│   │   └── FeatureRequestsViewModel.swift
│   ├── Support/
│   │   ├── SupportView.swift            # Ticket form + FAQ
│   │   └── SupportViewModel.swift
│   ├── Settings/
│   │   ├── SettingsView.swift           # All settings sections
│   │   ├── BusinessProfileView.swift    # Firm name, GSTIN, logo, signature
│   │   ├── CurrencySettingsView.swift
│   │   └── SettingsViewModel.swift
│   └── Billing/
│       ├── BillingView.swift            # Plans + StoreKit purchase + promo code
│       ├── PaymentHistoryView.swift
│       └── BillingViewModel.swift
│
├── Navigation/
│   ├── MainTabView.swift                # Tab bar or sidebar navigation
│   ├── AppRouter.swift                  # Subscription gate + auth gate
│   └── SidebarView.swift                # iPad sidebar (matches web layout)
│
└── Resources/
    ├── Assets.xcassets/                 # App icon, brand colors, images
    ├── LaunchScreen.storyboard
    └── Info.plist
```

---

## C. Feature List — One Feature Per Builder Agent

---

### C.1 Feature: Auth

**What it does:** Handles Google Sign-In via `ASWebAuthenticationSession`, sends the `id_token` to the backend mobile auth endpoint, stores the returned session token in Keychain, and manages login/logout state across the app.

**Views:**
- `LoginView.swift` — Logo, "Sign in with Google" button, loading state

**ViewModel:**
- `AuthViewModel.swift` (@Observable) — `isAuthenticated`, `user`, `isLoading`, `login()`, `logout()`, `checkSession()`

**Repository:**
- Uses `AuthManager` in Core (not a separate repo) — wraps `POST /api/auth/google/mobile` and `POST /api/auth/logout`

**Models:**
- `User` (user_id, email, name, picture, subscription_plan, subscription_status, subscription_expiry)

**API endpoints:**
- `POST /api/auth/google/mobile` — `{ "id_token": "..." }` → `{ "session_token", "user" }`
- `GET /api/auth/me` — validate session, get current user
- `POST /api/auth/logout` — invalidate session
- `DELETE /api/auth/delete-account` — delete user account and all data

**Dependencies:** None (this is the root dependency).

---

### C.2 Feature: Billing (Subscription & Paywall)

**What it does:** Shows subscription plans using StoreKit 2, handles Apple IAP purchases, sends receipts to backend for verification, shows payment history, and supports promo code activation. This is the paywall gate — users without active subscriptions are redirected here.

**Views:**
- `BillingView.swift` — Plan cards (monthly $199, quarterly $449, yearly $1499, lifetime $4999), purchase buttons, promo code input
- `PaymentHistoryView.swift` — List of past payment orders
- `SubscriptionPaywall.swift` (in Onboarding/) — Simplified paywall shown on first launch

**ViewModel:**
- `BillingViewModel.swift` (@Observable) — `plans`, `currentPlan`, `isActive`, `purchasePlan(productId)`, `validatePromo(code)`, `activatePromo(code)`, `loadHistory()`, `cancelSubscription()`

**Repository:**
- `BillingRepository.swift` — wraps StoreKit 2 `Product.products(for:)`, `product.purchase()`, and backend calls

**Models:**
- `PaymentPlan` (key, name, price, period, badge, highlighted)
- `PaymentOrder` (order_id, plan, amount, status, paid_at, payment_provider)
- `SubscriptionStatus` (plan, status, expiry, provider, is_active)

**API endpoints:**
- `GET /api/payments/plans` — available plans
- `GET /api/payments/status` — current subscription status
- `POST /api/payments/apple/verify` — `{ "receipt_data", "product_id" }` → activate subscription
- `GET /api/payments/history` — past payments
- `POST /api/payments/cancel` — cancel subscription
- `POST /api/promo/validate` — `{ "code" }` → `{ "valid", "description" }`
- `POST /api/promo/activate` — `{ "code" }` → activate lifetime

**Dependencies:** Auth feature (needs authenticated user).

**StoreKit 2 Product IDs:**
- `com.spentyai.monthly`
- `com.spentyai.quarterly`
- `com.spentyai.yearly`
- `com.spentyai.lifetime`

---

### C.3 Feature: Dashboard

**What it does:** Shows a financial overview with four stat cards (Net Worth, Income This Month, Expenses This Month, Pending Review), an accounts summary list, and a recent transactions list. Includes a "New Transaction" button that opens the transaction form. Links to other sections.

**Views:**
- `DashboardView.swift` — Stat cards grid, accounts list, recent transactions list, "New Transaction" button

**ViewModel:**
- `DashboardViewModel.swift` (@Observable) — `summary` (net_worth, income_this_month, expense_this_month, pending_review, accounts[], recent_transactions[]), `isLoading`, `loadSummary()`

**Repository:**
- `DashboardRepository.swift` — fetches from backend

**Models:**
- `DashboardSummary` (net_worth, income_this_month, expense_this_month, pending_review, accounts: [AccountSummary], recent_transactions: [TransactionSummary])

**API endpoints:**
- `GET /api/dashboard/summary`

**Dependencies:** Account model, Transaction model (from shared Core/Models).

---

### C.4 Feature: AI Chat

**What it does:** A floating chat panel (presented as a sheet on iOS) where users can ask questions about their finances in natural language. The AI can analyze spending, answer queries, and even post transactions, create invoices, or record bills on behalf of the user. Shows quick-prompt chips for common questions.

**Views:**
- `AIChatView.swift` — Chat message list, input field, send button, quick prompt chips
- `ChatBubble.swift` — User/assistant message bubble with optional transaction/invoice/bill confirmation card

**ViewModel:**
- `AIChatViewModel.swift` (@Observable) — `messages`, `input`, `isSending`, `sendMessage()`, `loadHistory()`, `clearHistory()`

**Repository:**
- `AIChatRepository.swift`

**Models:**
- `ChatMessage` (role: user/assistant, content, transaction?, invoice?, bill?)

**API endpoints:**
- `POST /api/ai/chat` — `{ "message", "conversation" }` → `{ "reply", "transaction_posted?", "transaction?", "invoice_created?", "invoice?", "bill_created?", "bill?" }`
- `GET /api/ai/chat/history` — previous messages
- `DELETE /api/ai/chat/history/clear` — clear chat
- `GET /api/ai/chat/suggestions` — suggested prompts

**Dependencies:** Transaction model, Invoice model, Bill model.

---

### C.5 Feature: Transactions

**What it does:** Full transaction management with two view modes: List view (table with type, description, account, category, amount, status, actions) and Ledger view (debit/credit columns with running balance when filtered by account). Supports filtering by type (income/expense/transfer), account, and date range. Users can create, edit, approve, reject, and delete transactions. Shows receipt links for transactions that have attached receipts.

**Views:**
- `TransactionListView.swift` — List/Ledger toggle, filter bar, transaction rows
- `TransactionLedgerView.swift` — Debit/Credit/Balance table
- `TransactionFormView.swift` — Create/edit form (sheet) with fields: type, amount, date, account, to_account (for transfer), category, subcategory, description, payment_method, receipt attachment. Includes "Switch to Invoice" option.

**ViewModel:**
- `TransactionsViewModel.swift` (@Observable) — `transactions`, `total`, `accounts`, `categories`, `filters` (type, account, dateFrom, dateTo), `viewMode` (list/ledger), `loadData()`, `createTransaction()`, `updateTransaction()`, `deleteTransaction()`, `approveTransaction()`, `rejectTransaction()`

**Repository:**
- `TransactionRepository.swift`

**Models:**
- `Transaction` (transaction_id, transaction_type, amount, date, account_id, to_account_id?, category_id?, subcategory_id?, description?, payment_method?, status, is_recurring, recurring_frequency?, source, receipt_id?, original_currency?, original_amount?, exchange_rate?, is_estimated_rate?)

**API endpoints:**
- `GET /api/transactions?transaction_type=&account_id=&from_date=&to_date=&status=&limit=`
- `POST /api/transactions` — create
- `PUT /api/transactions/{id}` — update
- `DELETE /api/transactions/{id}` — delete
- `POST /api/transactions/{id}/approve`
- `POST /api/transactions/{id}/reject`
- `POST /api/transactions/bulk-approve`
- `POST /api/transactions/bulk-reject`
- `POST /api/transactions/bulk-delete`
- `POST /api/transactions/bulk-update`
- `GET /api/transactions/pending`
- `GET /api/transactions/search`
- `POST /api/transactions/{id}/toggle-recurring`

**Dependencies:** Account model, Category model.

---

### C.6 Feature: Accounts

**What it does:** Manage financial accounts (bank, cash, credit card, wallet, loan, demat, etc.). Each account has a type (asset/liability/equity/investment), a sub-type, opening balance, and optional loan-specific or demat-specific fields. Users can create, edit, delete accounts, view amortization schedules for loans, and manage custom sub-types. Supports demat statement upload for brokerage accounts.

**Views:**
- `AccountListView.swift` — Grouped by type, showing name, sub-type, balance
- `AccountFormView.swift` — Create/edit sheet with all fields including loan-specific (interest rate, tenure, EMI, sanctioned amount) and demat-specific (broker name)
- `AccountDetailView.swift` — Balance history, amortization schedule for loans, OD interest calculator
- `SubTypeManagerView.swift` — CRUD for custom account sub-types
- `DematUploadView.swift` — Upload demat/CDSL statements

**ViewModel:**
- `AccountsViewModel.swift` (@Observable) — `accounts`, `subTypesMap`, `loadAccounts()`, `createAccount()`, `updateAccount()`, `deleteAccount()`, `recalculateBalance()`, `getAmortization()`, `getODInterest()`

**Repository:**
- `AccountRepository.swift`

**Models:**
- `Account` (account_id, name, account_type, sub_type?, account_number?, opening_balance, balance_as_of_date?, balance, currency, description?, loan_interest_rate?, loan_tenure_months?, loan_emi_amount?, loan_emi_day?, loan_sanctioned_amount?, broker_name?)
- `AccountSubType` (sub_type_id, name, account_type, icon?)
- `AmortizationEntry` (month, emi, principal, interest, balance)

**API endpoints:**
- `GET /api/accounts`
- `POST /api/accounts`
- `PUT /api/accounts/{id}`
- `DELETE /api/accounts/{id}`
- `POST /api/accounts/{id}/recalculate`
- `GET /api/accounts/{id}/amortization`
- `GET /api/accounts/{id}/balance`
- `GET /api/accounts/{id}/transactions`
- `GET /api/accounts/{id}/od-interest`
- `POST /api/accounts/{id}/od-interest`
- `GET /api/account-sub-types`
- `POST /api/account-sub-types`
- `PUT /api/account-sub-types/{id}`
- `DELETE /api/account-sub-types/{id}`
- `POST /api/demat/upload-statement`
- `POST /api/demat/manual-entry`
- `GET /api/demat/statements/{account_id}`
- `POST /api/demat/approve-statement/{id}`
- `POST /api/demat/reject-statement/{id}`

**Dependencies:** None (provides Account model used by many features).

---

### C.7 Feature: Categories

**What it does:** Manage income and expense categories in a two-level tree (parent categories and subcategories). Users switch between Income and Expense tabs. They can create top-level categories, create subcategories under a parent, and delete categories. Categories are used throughout the app for transaction classification.

**Views:**
- `CategoryListView.swift` — Tab bar (Expense/Income), tree list with expand/collapse, add/delete buttons
- `CategoryFormView.swift` — Create form (name, optional parent selection)

**ViewModel:**
- `CategoriesViewModel.swift` (@Observable) — `categories`, `activeTab` (expense/income), `createCategory()`, `deleteCategory()`, `mergeCategories()`

**Repository:**
- `CategoryRepository.swift`

**Models:**
- `Category` (category_id, name, category_type, parent_id?)

**API endpoints:**
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/{id}`
- `DELETE /api/categories/{id}`
- `GET /api/categories/defaults`
- `POST /api/categories/merge`

**Dependencies:** None (provides Category model used by many features).

---

### C.8 Feature: Cash Flow

**What it does:** Shows a 24-month cash flow projection based on recurring transactions and mandates (auto-debits). Displays summary cards (Monthly Income, Monthly Expense, Monthly Mandates, OD Interest, Monthly Net), a projection bar chart, a recurring transactions table (with ability to change frequency or remove), a mandates table (with pause/resume/delete/edit amount), and an "Add Recurring" section to mark existing transactions as recurring. Shows monthly breakdown table.

**Views:**
- `CashFlowView.swift` — Summary cards, chart, recurring list, mandates, monthly breakdown
- `CashFlowChartView.swift` — 24-month income vs expense bar chart (Swift Charts)
- `MandatesListView.swift` — Mandates table with inline edit
- `RecurringListView.swift` — Recurring transactions + mark-as-recurring picker

**ViewModel:**
- `CashFlowViewModel.swift` (@Observable) — `projection`, `mandates`, `recurringItems`, `allTransactions`, `toggleRecurring()`, `toggleMandateStatus()`, `deleteMandate()`, `updateMandateAmount()`

**Repository:**
- `CashFlowRepository.swift`

**Models:**
- `CashFlowProjection` (monthly_recurring_income, monthly_recurring_expense, monthly_mandate_expense, monthly_od_interest, monthly_net, recurring_items[], projection[], od_interest_items[])
- `ProjectionMonth` (label, projected_income, projected_expense, mandate_expense, od_interest, net)
- `Mandate` (mandate_id, merchant, mandate_type, amount, frequency, start_date, status, source, source_email_subject?)

**API endpoints:**
- `GET /api/cashflow/projection`
- `GET /api/cashflow/history`
- `GET /api/mandates`
- `POST /api/mandates`
- `PATCH /api/mandates/{id}`
- `DELETE /api/mandates/{id}`
- `POST /api/mandates/detect`
- `GET /api/mandates/upcoming`
- `GET /api/recurring/list`
- `POST /api/transactions/{id}/toggle-recurring`

**Dependencies:** Transaction model, Account model, Category model.

---

### C.9 Feature: Reports

**What it does:** Financial reports with period filtering (This Month, Last 3/6 Months, This Year, All Time, custom date range). Shows summary cards (Total Income, Total Expense, Net, Transaction Count), an income vs expense bar chart by month, a donut chart for category breakdown (switchable between expense/income), a category table with subcategory drill-down, and a monthly details table.

**Views:**
- `ReportsView.swift` — Period filter chips, summary cards, charts, tables
- `PeriodChartView.swift` — Income vs Expense monthly bar chart (Swift Charts)
- `DonutChartView.swift` — Category donut chart with legend

**ViewModel:**
- `ReportsViewModel.swift` (@Observable) — `summary`, `periods`, `categories`, `activePreset`, `startDate`, `endDate`, `catType`, `loadData()`

**Repository:**
- `ReportsRepository.swift`

**Models:**
- `ReportSummary` (total_income, total_expense, net, transaction_count)
- `ReportPeriod` (month, income, expense, net, count)
- `ReportCategory` (category_id, category_name, income, expense, count, subcategories[])

**API endpoints:**
- `GET /api/reports/summary?start_date=&end_date=`
- `GET /api/reports/by-period?start_date=&end_date=`
- `GET /api/reports/by-category?start_date=&end_date=&transaction_type=`
- `GET /api/reports/account`
- `GET /api/reports/income-expense`
- `GET /api/reports/export/csv`
- `GET /api/reports/export/pdf`

**Dependencies:** None.

---

### C.10 Feature: Reconciliation

**What it does:** Bank/credit card statement reconciliation. Users select an account sub-type and account, specify a statement period, and upload a CSV or PDF file. The backend parses the statement using AI, showing parsed entries with editable categories. Users can reconcile the statement against their ledger, view matched/missing/conflict entries, and add missing transactions to the ledger. Supports password-protected PDFs (unlock flow), re-audit, and bulk categorization.

**Views:**
- `ReconciliationView.swift` — Upload form, statement history list
- `StatementUploadView.swift` — Sub-type picker, account picker, period dates, file picker (DocumentPicker)
- `StatementDetailView.swift` — Parsed entries table with editable category/subcategory selects, audit status banner, reconcile button, reconciliation results (matched, missing from ledger, missing from statement, conflicts)

**ViewModel:**
- `ReconciliationViewModel.swift` (@Observable) — `statements`, `accounts`, `categories`, `activeStatement`, `uploading`, `uploadStatement()`, `viewStatement()`, `reconcile()`, `reaudit()`, `unlockStatement()`, `updateEntryCategory()`, `addMissingToLedger()`, `deleteStatement()`

**Repository:**
- `ReconciliationRepository.swift`

**Models:**
- `Statement` (statement_id, filename, account_id, account_name, statement_type, status, entry_count, period_from, period_to, uploaded_at, parsed_entries[], reconciliation?, audit_status, processing_progress, processing_stage_label)
- `ParsedEntry` (date, transaction_type, description, amount, balance?, category_id?, subcategory_id?)
- `ReconciliationResult` (summary: {matched, missing_from_ledger, missing_from_statement, conflicts}, matched[], missing_from_ledger[], missing_from_statement[], conflicts[])

**API endpoints:**
- `POST /api/statements/upload` — multipart form (file, account_id, statement_type, period_from, period_to)
- `GET /api/statements/list`
- `GET /api/statements/{id}`
- `POST /api/statements/{id}/reconcile`
- `POST /api/statements/{id}/add-missing`
- `DELETE /api/statements/{id}`
- `POST /api/statements/{id}/reaudit`
- `POST /api/statements/{id}/approve`
- `POST /api/statements/{id}/reject`
- `GET /api/statements/{id}/entries`
- `POST /api/statements/{id}/bulk-categorize`
- `PATCH /api/statements/{id}/entries/{entry_index}`
- `POST /api/statements/{id}/unlock`

**Dependencies:** Account model, Category model.

---

### C.11 Feature: Email & SMS Sync

**What it does:** Connect Gmail and Outlook accounts via OAuth to auto-detect financial transactions from emails. Supports SMS sync (uploaded from mobile device). Shows connected accounts with sync stats (total emails, transactions found, skipped, in queue, failed, needs review), sync date configuration, reconnect flow for expired tokens, and a pending review section where users can approve/reject/edit AI-detected transactions.

**Views:**
- `EmailSyncView.swift` — Connected accounts list (Gmail/Outlook), SMS stats card, connect buttons, pending review section
- `PendingReviewView.swift` — Transaction table with approve/reject/edit actions per row

**ViewModel:**
- `EmailSyncViewModel.swift` (@Observable) — `gmailAccounts`, `outlookAccounts`, `smsStats`, `pendingTransactions`, `connectGmail()`, `connectOutlook()`, `startSync()`, `retryPending()`, `disconnectAccount()`, `approveTransaction()`, `rejectTransaction()`

**Repository:**
- `EmailSyncRepository.swift`

**Models:**
- `EmailAccount` (email, provider, connected_at, sync_from_date?, syncing, needs_reconnect, stats: SyncStats)
- `SyncStats` (total_synced, transactions_created, no_transaction, ai_pending, ai_failed, pending_review, processed_by_ai, is_processing)

**API endpoints:**
- `GET /api/gmail/connect` → `{ "auth_url" }` (open in ASWebAuthenticationSession)
- `GET /api/gmail/callback` (handled by OAuth redirect)
- `GET /api/gmail/status`
- `POST /api/gmail/disconnect`
- `GET /api/outlook/connect` → `{ "auth_url" }`
- `GET /api/outlook/callback`
- `GET /api/outlook/status`
- `POST /api/outlook/disconnect`
- `POST /api/outlook/start-sync`
- `POST /api/outlook/retry-pending`
- `POST /api/email/start-sync`
- `POST /api/email/retry-pending`
- `GET /api/email/sync-stats`
- `GET /api/email/pending-review`
- `POST /api/sms/upload` — `{ "messages": [...] }`
- `GET /api/sms/stats`
- `POST /api/sms/retry-pending`

**Dependencies:** Transaction model, Account model, Category model.

**iOS-specific note:** Gmail/Outlook OAuth connect flows should use `ASWebAuthenticationSession` to open the auth URL and intercept the callback redirect.

---

### C.12 Feature: SMS Sync (Mobile-Native)

**What it does:** Reads SMS messages from the device (with user permission), filters for financial transaction SMS (banks, UPI, wallets), and uploads them to the backend for AI parsing. This is an iOS-exclusive feature that the web app cannot do.

**Views:**
- `SMSSyncView.swift` — Permission request, sync button, stats display

**ViewModel:**
- `SMSSyncViewModel.swift` (@Observable) — `smsMessages`, `uploading`, `syncStats`, `requestPermission()`, `readAndUploadSMS()`

**Repository:**
- `SMSSyncRepository.swift`

**Models:**
- `SmsMessage` (sender, body, timestamp, phone_number?)

**API endpoints:**
- `POST /api/sms/upload`
- `GET /api/sms/stats`
- `POST /api/sms/retry-pending`
- `POST /api/sms/parse`
- `POST /api/sms/bulk-parse`
- `POST /api/sms/detect-mandates`

**Dependencies:** None.

**Note:** iOS restricts SMS reading. Use `MessageFilterExtension` or prompt users to manually share/forward SMS. Consider using the Messages framework or a share extension approach.

---

### C.13 Feature: Records (Email Archive & Receipts)

**What it does:** Browse archived emails that were synced and processed, with search, date/amount filters, and the ability to download original EML files, view attachments, and preview email content. Also has a Receipts tab for viewing/uploading receipt images, linking receipts to transactions, and AI-parsing receipts for auto-fill.

**Views:**
- `RecordsView.swift` — Tab bar (Emails/Receipts), search bar, filter panel, records list
- `RecordPreviewView.swift` — Email body preview, attachment list, download buttons
- `ReceiptUploadView.swift` — Camera/photo picker for receipt capture, parsed data display

**ViewModel:**
- `RecordsViewModel.swift` (@Observable) — `records`, `receipts`, `search`, `filters`, `loadRecords()`, `loadReceipts()`, `uploadReceipt()`, `parseReceipt()`, `linkReceiptToTransaction()`, `deleteRecord()`, `downloadZip()`

**Repository:**
- `RecordsRepository.swift`

**Models:**
- `Record` (archive_id, subject, sender, received_date, source, amount?, transaction_type?, has_attachments, attachment_count)
- `Receipt` (receipt_id, filename, uploaded_at, parsed_data?, linked_transaction_id?)

**API endpoints:**
- `GET /api/records?search=&skip=&limit=&date_from=&date_to=&amount_min=&amount_max=`
- `GET /api/records/search?q=`
- `GET /api/records/{id}`
- `GET /api/records/{id}/preview`
- `GET /api/records/{id}/download-eml`
- `GET /api/records/{id}/attachments/{index}/download`
- `DELETE /api/records/{id}`
- `POST /api/records/download-zip`
- `POST /api/receipts/upload` — multipart (file, transaction_id?)
- `POST /api/receipts/{id}/parse`
- `GET /api/receipts/{id}/download`
- `GET /api/receipts/by-transaction/{transaction_id}`
- `GET /api/receipts`
- `GET /api/receipts/{id}`
- `DELETE /api/receipts/{id}`
- `POST /api/receipts/{id}/link`
- `POST /api/bills/parse-upload` — upload + AI-parse a bill/receipt

**Dependencies:** Transaction model.

---

### C.14 Feature: Past Insights (Tax Summary)

**What it does:** Generate financial summaries for a date range by scanning synced emails. Users select a connected email account, set a date range, and the system scans emails for financial transactions, generating a summary with income/expense breakdown. Users can view individual transactions, edit them, export to CSV, and download PDF reports.

**Views:**
- `PastInsightsView.swift` — Summary list, create form (name, date range, email account selection)
- `PastInsightDetailView.swift` — Summary stats, transaction list with edit/delete, export/download buttons

**ViewModel:**
- `PastInsightsViewModel.swift` (@Observable) — `summaries`, `availableEmails`, `createSummary()`, `deleteSummary()`, `loadDetail()`, `addTransaction()`, `updateTransaction()`, `deleteTransaction()`, `exportCSV()`, `downloadPDF()`

**Repository:**
- `PastInsightsRepository.swift`

**Models:**
- `TaxSummary` (summary_id, name, date_from, date_to, status, total_income, total_expense, net, transaction_count, email_address, provider)
- `TaxSummaryTransaction` (txn_id, date, description, amount, transaction_type, category)

**API endpoints:**
- `POST /api/tax-summary` — create
- `GET /api/tax-summary` — list
- `GET /api/tax-summary/available-emails`
- `GET /api/tax-summary/generate`
- `GET /api/tax-summary/{id}`
- `DELETE /api/tax-summary/{id}`
- `POST /api/tax-summary/{id}/transactions`
- `PUT /api/tax-summary/{id}/transactions/{txn_id}`
- `DELETE /api/tax-summary/{id}/transactions/{txn_id}`
- `GET /api/tax-summary/{id}/export` — CSV
- `GET /api/tax-summary/{id}/download` — PDF

**Dependencies:** None.

---

### C.15 Feature: Invoices (Sales)

**What it does:** Create, view, edit, and manage sales invoices. Shows invoice list with filters, stats cards (total invoiced, paid, outstanding, overdue), debtors report, aging analysis, and sales-by-customer breakdown. Users can create invoices with line items (with GST for Indian businesses or generic tax for international), record partial/full payments against invoices, mark as paid, duplicate invoices, and view/print PDF previews.

**Views:**
- `InvoiceListView.swift` — Invoice table, stats cards, action buttons
- `InvoiceFormView.swift` — Create/edit form with customer selection, line items (description, HSN/SAC, qty, rate, tax), payment terms, notes
- `InvoicePreviewView.swift` — PDF preview (rendered from backend or native)
- `RecordPaymentView.swift` — Record payment (amount, date, method, account)

**ViewModel:**
- `InvoicesViewModel.swift` (@Observable) — `invoices`, `stats`, `debtors`, `aging`, `salesByCustomer`, `createInvoice()`, `updateInvoice()`, `deleteInvoice()`, `recordPayment()`, `markPaid()`, `duplicateInvoice()`, `getNextNumber()`

**Repository:**
- `InvoiceRepository.swift`

**Models:**
- `Invoice` (invoice_id, invoice_number, customer_id, customer_name, date, due_date, line_items[], subtotal, tax_amount, grand_total, payment_status, amount_paid, payments[], notes, terms)
- `InvoiceLineItem` (description, hsn_sac?, quantity, rate, tax_rate, amount)
- `InvoicePayment` (amount, date, method, account_id, notes)

**API endpoints:**
- `POST /api/invoices`
- `GET /api/invoices`
- `GET /api/invoices/next-number`
- `GET /api/invoices/stats`
- `GET /api/invoices/count`
- `GET /api/invoices/debtors`
- `GET /api/invoices/aging`
- `GET /api/invoices/sales-by-customer`
- `GET /api/invoices/{id}`
- `GET /api/invoices/{id}/pdf`
- `PUT /api/invoices/{id}`
- `DELETE /api/invoices/{id}`
- `POST /api/invoices/{id}/record-payment`
- `POST /api/invoices/{id}/mark-paid`
- `POST /api/invoices/{id}/duplicate`

**Dependencies:** Customer model, Account model, Settings model (for firm details, GST config).

---

### C.16 Feature: Customers

**What it does:** Manage customers for invoicing. Shows a customer list with outstanding balance summary. Users can create, edit, and delete customers, and view all invoices for a specific customer.

**Views:**
- `CustomerListView.swift` — Customer table with name, total invoiced, paid, outstanding
- `CustomerDetailView.swift` — Customer info + invoices list
- `CustomerFormView.swift` — Create/edit form (name, email, phone, GSTIN, billing address, shipping address)

**ViewModel:**
- `CustomersViewModel.swift` (@Observable) — `customers`, `createCustomer()`, `updateCustomer()`, `deleteCustomer()`, `loadCustomerInvoices()`

**Repository:**
- `CustomerRepository.swift`

**Models:**
- `Customer` (customer_id, name, email?, phone?, gstin?, billing_address?, shipping_address?, total_invoiced, total_paid, outstanding)

**API endpoints:**
- `POST /api/customers`
- `GET /api/customers`
- `GET /api/customers/{id}`
- `PUT /api/customers/{id}`
- `DELETE /api/customers/{id}`
- `GET /api/customers/{id}/invoices`

**Dependencies:** None (provides Customer model used by Invoices feature).

---

### C.17 Feature: Purchases (Bills)

**What it does:** Create, view, edit, and manage purchase bills (expenses owed to vendors). Mirror of Invoices but for the payables side. Shows bill list, stats (total billed, paid, outstanding, overdue), creditors report, aging analysis, and purchases-by-vendor breakdown. Users can record payments, mark bills as paid, duplicate bills, and view PDF previews.

**Views:**
- `PurchaseListView.swift` — Bill table, stats cards
- `PurchaseFormView.swift` — Create/edit form with vendor selection, line items, tax
- `PurchasePreviewView.swift` — PDF preview
- `RecordBillPaymentView.swift` — Record payment against bill

**ViewModel:**
- `PurchasesViewModel.swift` (@Observable) — `bills`, `stats`, `creditors`, `aging`, `purchasesByVendor`, `createBill()`, `updateBill()`, `deleteBill()`, `recordPayment()`, `markPaid()`, `duplicateBill()`, `getNextNumber()`

**Repository:**
- `PurchaseRepository.swift`

**Models:**
- `Bill` (bill_id, bill_number, vendor_id, vendor_name, date, due_date, line_items[], subtotal, tax_amount, grand_total, payment_status, amount_paid, payments[], notes)
- `BillLineItem` (description, hsn_sac?, quantity, rate, tax_rate, amount)
- `BillPayment` (amount, date, method, account_id, notes)

**API endpoints:**
- `POST /api/bills`
- `GET /api/bills`
- `GET /api/bills/next-number`
- `GET /api/bills/stats`
- `GET /api/bills/count`
- `GET /api/bills/creditors`
- `GET /api/bills/aging`
- `GET /api/bills/purchases-by-vendor`
- `GET /api/bills/{id}`
- `GET /api/bills/{id}/pdf`
- `PUT /api/bills/{id}`
- `DELETE /api/bills/{id}`
- `POST /api/bills/{id}/record-payment`
- `POST /api/bills/{id}/mark-paid`
- `POST /api/bills/{id}/duplicate`

**Dependencies:** Vendor model, Account model, Settings model.

---

### C.18 Feature: Vendors

**What it does:** Manage vendors for purchase bills. Shows a vendor list with outstanding balance summary. Users can create, edit, and delete vendors, and view all bills for a specific vendor.

**Views:**
- `VendorListView.swift` — Vendor table with name, total billed, paid, outstanding
- `VendorDetailView.swift` — Vendor info + bills list
- `VendorFormView.swift` — Create/edit form (name, email, phone, GSTIN, address)

**ViewModel:**
- `VendorsViewModel.swift` (@Observable) — `vendors`, `createVendor()`, `updateVendor()`, `deleteVendor()`, `loadVendorBills()`

**Repository:**
- `VendorRepository.swift`

**Models:**
- `Vendor` (vendor_id, name, email?, phone?, gstin?, address?, total_billed, total_paid, outstanding)

**API endpoints:**
- `POST /api/vendors`
- `GET /api/vendors`
- `GET /api/vendors/{id}`
- `PUT /api/vendors/{id}`
- `DELETE /api/vendors/{id}`
- `GET /api/vendors/{id}/bills`

**Dependencies:** None (provides Vendor model used by Purchases feature).

---

### C.19 Feature: Feature Requests

**What it does:** Users can submit feature requests (title, description, category) and view existing requests. Shows a list of submitted requests with status (pending, in_progress, completed) and vote counts.

**Views:**
- `FeatureRequestsView.swift` — Request list + submit form
- `FeatureRequestFormView.swift` — Title, description, category picker

**ViewModel:**
- `FeatureRequestsViewModel.swift` (@Observable) — `requests`, `submitRequest()`, `voteForRequest()`, `loadRequests()`

**Repository:**
- `FeatureRequestsRepository.swift`

**Models:**
- `FeatureRequest` (request_id, title, description, category, status, votes, created_at)

**API endpoints:**
- `GET /api/feature-requests`
- `POST /api/feature-requests`
- `GET /api/feature-requests/{id}`
- `POST /api/feature-requests/{id}/vote`

**Dependencies:** None.

---

### C.20 Feature: Support

**What it does:** Users can submit support tickets with subject, category (bug, feature, billing, account, data, general), priority (low/medium/high), and detailed message. Shows FAQ section with common questions and answers. Ticket submission sends an email to the support team.

**Views:**
- `SupportView.swift` — Ticket form + FAQ accordion

**ViewModel:**
- `SupportViewModel.swift` (@Observable) — `form`, `isSubmitting`, `isSubmitted`, `submitTicket()`, `faqItems`

**Repository:**
- `SupportRepository.swift`

**Models:**
- `SupportTicket` (subject, category, priority, message)
- `FAQItem` (question, answer)

**API endpoints:**
- `POST /api/support/ticket`
- `GET /api/support/faq`

**Dependencies:** None.

---

### C.21 Feature: Settings

**What it does:** App-wide settings management. Sections include: business profile (firm name, GSTIN, PAN, state, address, country), currency & locale (default currency, date format), invoice customization (logo upload, signature upload), and account management (delete account). Settings affect invoice generation, currency formatting, and GST calculations.

**Views:**
- `SettingsView.swift` — Scrollable form with sections
- `BusinessProfileView.swift` — Firm name, GSTIN, PAN, state selector, address, country
- `CurrencySettingsView.swift` — Default currency picker, date format picker

**ViewModel:**
- `SettingsViewModel.swift` (@Observable) — `settings`, `loadSettings()`, `saveSettings()`, `uploadLogo()`, `deleteLogo()`, `uploadSignature()`, `deleteSignature()`

**Repository:**
- `SettingsRepository.swift`

**Models:**
- `AppSettings` (firm_name?, gstin?, pan?, state?, address?, business_country, default_currency, date_format, logo_url?, signature_url?)

**API endpoints:**
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/settings/currencies`
- `GET /api/settings/date-formats`
- `POST /api/settings/logo` — multipart upload
- `DELETE /api/settings/logo`
- `POST /api/settings/signature` — multipart upload
- `DELETE /api/settings/signature`

**Dependencies:** None.

---

## D. Shared Core — Built First

The following shared code must be implemented before any feature agent begins:

### D.1 APIClient (`Core/Networking/APIClient.swift`)
- Singleton with configurable `baseURL`
- Reads Bearer token from Keychain for every request
- Methods: `get<T>(_ path:) async throws -> T`, `post<T>(_ path:, body:) async throws -> T`, `put`, `patch`, `delete`
- `upload(_ path:, formData:) async throws -> T` for multipart file uploads
- Automatic JSON encoding/decoding with `JSONDecoder` (snake_case strategy)
- Error handling: parses `{ "detail": "..." }` from 4xx/5xx responses into `APIError`
- 401 response triggers logout

### D.2 APIEndpoints (`Core/Networking/APIEndpoints.swift`)
- Static constants for every API path (e.g., `static let accounts = "/api/accounts"`)
- Organized by feature group

### D.3 AuthManager (`Core/Auth/AuthManager.swift`)
- `@Observable` class, injected into environment
- Properties: `user: User?`, `isAuthenticated: Bool`, `isLoading: Bool`, `sessionToken: String?`
- Methods: `login(idToken:)`, `logout()`, `checkSession()`, `deleteAccount()`
- Stores/retrieves session token via `KeychainHelper`
- On app launch, calls `GET /api/auth/me` to validate stored session

### D.4 KeychainHelper (`Core/Auth/KeychainHelper.swift`)
- `save(key:, value:)`, `read(key:) -> String?`, `delete(key:)`
- Keys: `sessionToken`

### D.5 Shared Models (`Core/Models/`)
All Codable structs listed in the feature specs above. Models used by multiple features:
- `User` — Auth, Dashboard, Settings
- `Account` — Dashboard, Transactions, CashFlow, Reconciliation, EmailSync, Invoices, Purchases
- `Category` — Transactions, CashFlow, Reports, Reconciliation, EmailSync
- `Transaction` — Dashboard, Transactions, CashFlow, EmailSync

### D.6 Theme (`Core/Theme/`)
- `SpentyColors` — brand-primary (#3A5C4A), bg-primary (#F8F6F3), success (#3A5C4A), error (#96453A), warning (#C28C3C), info (#4A6E7D), accent-1 (#C26D5C), accent-3 (#4A6E7D)
- `SpentyFonts` — heading (system serif or custom), body (system), mono (system monospaced)
- `SpentyStyle` — reusable ViewModifiers for buttons (primary, secondary, destructive), cards, inputs

### D.7 Reusable Components (`Core/Components/`)
- `LoadingView` — Centered ProgressView with optional message
- `EmptyStateView` — SF Symbol icon + title + subtitle + optional CTA button
- `ErrorBanner` — Dismissible red banner
- `StatCard` — Label, value, icon, color (used in Dashboard, CashFlow, Reports)
- `CurrencyText` — Formats number using user's currency setting
- `StatusBadge` — Colored pill for status strings
- `FilterBar` — Horizontal scroll of filter controls
- `ConfirmDialog` — `.confirmationDialog` wrapper for destructive actions
- `SearchBar` — TextField with debounce

---

## E. Build Order

### Phase 0: Core Infrastructure (must complete first)
1. `Core/Networking/` — APIClient, APIEndpoints, APIError
2. `Core/Auth/` — AuthManager, KeychainHelper, GoogleSignInHelper
3. `Core/Models/` — All shared model structs
4. `Core/Theme/` — Colors, fonts, styles
5. `Core/Components/` — All reusable components
6. `Navigation/` — AppRouter (auth gate + subscription gate), MainTabView, SidebarView

### Phase 1: Independent features (can build in parallel)
These features have no inter-feature dependencies:
- **Auth** (C.1)
- **Billing** (C.2) — depends only on Auth
- **Categories** (C.7) — standalone
- **Customers** (C.16) — standalone
- **Vendors** (C.18) — standalone
- **Feature Requests** (C.19) — standalone
- **Support** (C.20) — standalone
- **Settings** (C.21) — standalone

### Phase 2: Features depending on Phase 1 models (can build in parallel)
- **Accounts** (C.6) — standalone but large
- **Dashboard** (C.3) — needs Account, Transaction models
- **Transactions** (C.5) — needs Account, Category models
- **Reports** (C.9) — standalone
- **Past Insights** (C.14) — standalone
- **SMS Sync** (C.12) — standalone
- **AI Chat** (C.4) — needs Transaction, Invoice, Bill models

### Phase 3: Features depending on Phase 2 (can build in parallel)
- **Cash Flow** (C.8) — needs Transactions, Accounts, Mandates
- **Reconciliation** (C.10) — needs Accounts, Categories, Statements
- **Email Sync** (C.11) — needs Transactions, Accounts, Categories
- **Records** (C.13) — needs Transactions
- **Invoices** (C.15) — needs Customers, Accounts, Settings
- **Purchases** (C.17) — needs Vendors, Accounts, Settings

### Phase 4: Integration & Polish
- Wire up navigation between all features
- Tab bar / sidebar finalization
- Deep link support
- Push notification setup (optional)
- App Store submission preparation

---

## F. Cross-Platform Subscription Logic

### Problem
Users can subscribe via:
1. **Web** — Razorpay (Indian payment gateway: UPI, cards, net banking)
2. **iOS** — Apple In-App Purchase (StoreKit 2)

A user who subscribes on web must get access on iOS, and vice versa.

### Backend Implementation (already in place)

The backend stores subscription state on the `users` collection:
```
{
  "subscription_plan": "yearly",        // monthly | quarterly | yearly | lifetime
  "subscription_status": "active",      // active | cancelled | expired
  "subscription_expiry": "2027-04-18T...",
  "subscription_provider": "apple"      // "razorpay" or "apple"
}
```

**Key endpoints:**

| Endpoint | Purpose |
|---|---|
| `GET /api/payments/status` | Returns current subscription status regardless of provider |
| `POST /api/payments/verify` | Verify Razorpay payment (web) |
| `POST /api/payments/apple/verify` | Verify Apple IAP receipt (iOS) |
| `POST /api/payments/apple/webhook` | Apple server-to-server notifications |
| `GET /api/auth/me` | Returns user with `subscription_status` field |

**How it works:**
1. `GET /api/auth/me` and `GET /api/payments/status` return `subscription_status` regardless of which provider was used.
2. The iOS app checks `user.subscription_status == "active"` to determine access — it does NOT need to know which provider was used.
3. If a user subscribes on web via Razorpay, their `subscription_status` is set to `"active"` with `subscription_provider: "razorpay"`. The iOS app sees `"active"` and grants access.
4. If a user subscribes on iOS via Apple IAP, the app sends the receipt to `POST /api/payments/apple/verify`, which sets `subscription_provider: "apple"` and `subscription_status: "active"`. The web app sees `"active"` and grants access.

**iOS app logic:**
```swift
// On app launch and after any purchase:
let status = try await apiClient.get("/api/payments/status")
if status.is_active {
    // Grant full access — regardless of whether they paid via Razorpay or Apple
    navigateToDashboard()
} else {
    // Show paywall with StoreKit 2 products
    showPaywall()
}
```

**Edge cases handled:**
- User cancels Apple subscription: Apple webhook hits `POST /api/payments/apple/webhook` with `CANCEL` notification → backend sets `subscription_status: "cancelled"`
- User's Razorpay subscription expires: Backend cron (or on-access check) compares `subscription_expiry` with current time
- Promo codes: `POST /api/promo/activate` grants lifetime access with `subscription_provider: "promo"` — works on both platforms

### StoreKit 2 Configuration (App Store Connect)

Create these auto-renewable subscription products:
| Product ID | Type | Duration |
|---|---|---|
| `com.spentyai.monthly` | Auto-renewable | 1 month |
| `com.spentyai.quarterly` | Auto-renewable | 3 months |
| `com.spentyai.yearly` | Auto-renewable | 1 year |
| `com.spentyai.lifetime` | Non-consumable | Lifetime |

Subscription group: `com.spentyai.premium`

Configure App Store Server Notifications v2 to point to: `POST {BACKEND_URL}/api/payments/apple/webhook`

---

## G. Complete API Surface Reference

Below is the full list of backend endpoints the iOS app must support, grouped by feature:

### Auth
- `POST /api/auth/google/mobile`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `DELETE /api/auth/delete-account`
- `GET /api/auth/verify-email`
- `POST /api/auth/resend-verification`

### Accounts
- `GET /api/accounts`
- `POST /api/accounts`
- `PUT /api/accounts/{id}`
- `DELETE /api/accounts/{id}`
- `POST /api/accounts/{id}/recalculate`
- `GET /api/accounts/{id}/amortization`
- `GET /api/accounts/{id}/balance`
- `GET /api/accounts/{id}/transactions`
- `GET /api/accounts/{id}/od-interest`
- `POST /api/accounts/{id}/od-interest`
- `GET /api/account-sub-types`
- `POST /api/account-sub-types`
- `PUT /api/account-sub-types/{id}`
- `DELETE /api/account-sub-types/{id}`

### Categories
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/{id}`
- `DELETE /api/categories/{id}`
- `GET /api/categories/defaults`
- `POST /api/categories/merge`

### Transactions
- `GET /api/transactions`
- `POST /api/transactions`
- `PUT /api/transactions/{id}`
- `DELETE /api/transactions/{id}`
- `POST /api/transactions/{id}/approve`
- `POST /api/transactions/{id}/reject`
- `POST /api/transactions/bulk-approve`
- `POST /api/transactions/bulk-reject`
- `POST /api/transactions/bulk-delete`
- `POST /api/transactions/bulk-update`
- `GET /api/transactions/pending`
- `GET /api/transactions/search`
- `GET /api/recurring/list`
- `POST /api/transactions/{id}/toggle-recurring`

### Mandates
- `GET /api/mandates`
- `POST /api/mandates`
- `PATCH /api/mandates/{id}`
- `DELETE /api/mandates/{id}`
- `POST /api/mandates/detect`
- `GET /api/mandates/upcoming`

### Cash Flow
- `GET /api/cashflow/projection`
- `GET /api/cashflow/history`

### Dashboard
- `GET /api/dashboard/summary`
- `GET /api/dashboard/trends`
- `GET /api/dashboard/monthly-comparison`

### Reports
- `GET /api/reports/summary`
- `GET /api/reports/by-period`
- `GET /api/reports/by-category`
- `GET /api/reports/account`
- `GET /api/reports/income-expense`
- `GET /api/reports/export/csv`
- `GET /api/reports/export/pdf`

### Statements / Reconciliation
- `POST /api/statements/upload`
- `GET /api/statements/list`
- `GET /api/statements/{id}`
- `POST /api/statements/{id}/reconcile`
- `POST /api/statements/{id}/add-missing`
- `DELETE /api/statements/{id}`
- `POST /api/statements/{id}/reaudit`
- `POST /api/statements/{id}/approve`
- `POST /api/statements/{id}/reject`
- `GET /api/statements/{id}/entries`
- `POST /api/statements/{id}/bulk-categorize`
- `PATCH /api/statements/{id}/entries/{entry_index}`
- `POST /api/statements/{id}/unlock`

### Email Sync
- `GET /api/gmail/connect`
- `GET /api/gmail/callback`
- `GET /api/gmail/status`
- `POST /api/gmail/disconnect`
- `GET /api/outlook/connect`
- `GET /api/outlook/callback`
- `GET /api/outlook/status`
- `POST /api/outlook/disconnect`
- `POST /api/outlook/start-sync`
- `POST /api/outlook/retry-pending`
- `POST /api/email/start-sync`
- `POST /api/email/retry-pending`
- `GET /api/email/sync-stats`
- `GET /api/email/pending-review`

### SMS
- `POST /api/sms/upload`
- `GET /api/sms/stats`
- `POST /api/sms/retry-pending`
- `POST /api/sms/parse`
- `POST /api/sms/bulk-parse`
- `POST /api/sms/detect-mandates`

### Records / Receipts
- `GET /api/records`
- `GET /api/records/search`
- `GET /api/records/{id}`
- `GET /api/records/{id}/preview`
- `GET /api/records/{id}/download-eml`
- `GET /api/records/{id}/attachments/{index}/download`
- `DELETE /api/records/{id}`
- `POST /api/records/download-zip`
- `POST /api/receipts/upload`
- `POST /api/receipts/{id}/parse`
- `GET /api/receipts/{id}/download`
- `GET /api/receipts/by-transaction/{id}`
- `GET /api/receipts`
- `GET /api/receipts/{id}`
- `DELETE /api/receipts/{id}`
- `POST /api/receipts/{id}/link`
- `POST /api/bills/parse-upload`

### Tax Summary / Past Insights
- `POST /api/tax-summary`
- `GET /api/tax-summary`
- `GET /api/tax-summary/available-emails`
- `GET /api/tax-summary/generate`
- `GET /api/tax-summary/{id}`
- `DELETE /api/tax-summary/{id}`
- `POST /api/tax-summary/{id}/transactions`
- `PUT /api/tax-summary/{id}/transactions/{txn_id}`
- `DELETE /api/tax-summary/{id}/transactions/{txn_id}`
- `GET /api/tax-summary/{id}/export`
- `GET /api/tax-summary/{id}/download`

### Settings
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/settings/currencies`
- `GET /api/settings/date-formats`
- `POST /api/settings/logo`
- `DELETE /api/settings/logo`
- `POST /api/settings/signature`
- `DELETE /api/settings/signature`

### Support
- `POST /api/support/ticket`
- `GET /api/support/faq`

### Feature Requests
- `GET /api/feature-requests`
- `POST /api/feature-requests`
- `GET /api/feature-requests/{id}`
- `POST /api/feature-requests/{id}/vote`

### AI Chat
- `POST /api/ai/chat`
- `GET /api/ai/chat/history`
- `DELETE /api/ai/chat/history/clear`
- `GET /api/ai/chat/suggestions`

### Payments / Subscription
- `POST /api/payments/create-order` (web/Razorpay — not used on iOS)
- `POST /api/payments/verify` (web/Razorpay — not used on iOS)
- `GET /api/payments/history`
- `GET /api/payments/plans`
- `POST /api/payments/apple/verify` (iOS only)
- `POST /api/payments/apple/webhook` (server-to-server)
- `GET /api/payments/status`
- `POST /api/payments/cancel`
- `POST /api/promo/validate`
- `POST /api/promo/activate`

### Demat
- `POST /api/demat/upload-statement`
- `POST /api/demat/manual-entry`
- `GET /api/demat/statements/{account_id}`
- `POST /api/demat/approve-statement/{id}`
- `POST /api/demat/reject-statement/{id}`

### Invoices
- `POST /api/invoices`
- `GET /api/invoices`
- `GET /api/invoices/next-number`
- `GET /api/invoices/stats`
- `GET /api/invoices/count`
- `GET /api/invoices/debtors`
- `GET /api/invoices/aging`
- `GET /api/invoices/sales-by-customer`
- `GET /api/invoices/{id}`
- `GET /api/invoices/{id}/pdf`
- `PUT /api/invoices/{id}`
- `DELETE /api/invoices/{id}`
- `POST /api/invoices/{id}/record-payment`
- `POST /api/invoices/{id}/mark-paid`
- `POST /api/invoices/{id}/duplicate`

### Customers
- `POST /api/customers`
- `GET /api/customers`
- `GET /api/customers/{id}`
- `PUT /api/customers/{id}`
- `DELETE /api/customers/{id}`
- `GET /api/customers/{id}/invoices`

### Bills (Purchases)
- `POST /api/bills`
- `GET /api/bills`
- `GET /api/bills/next-number`
- `GET /api/bills/stats`
- `GET /api/bills/count`
- `GET /api/bills/creditors`
- `GET /api/bills/aging`
- `GET /api/bills/purchases-by-vendor`
- `GET /api/bills/{id}`
- `GET /api/bills/{id}/pdf`
- `PUT /api/bills/{id}`
- `DELETE /api/bills/{id}`
- `POST /api/bills/{id}/record-payment`
- `POST /api/bills/{id}/mark-paid`
- `POST /api/bills/{id}/duplicate`

### Vendors
- `POST /api/vendors`
- `GET /api/vendors`
- `GET /api/vendors/{id}`
- `PUT /api/vendors/{id}`
- `DELETE /api/vendors/{id}`
- `GET /api/vendors/{id}/bills`

### Health
- `GET /api/health`
