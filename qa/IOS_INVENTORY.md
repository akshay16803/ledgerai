# iOS App Inventory

Generated: 2026-05-01
Source root: `ios/SpentyAI/SpentyAI/`
Total Swift files under `Features/`: 112
Total screen-level View structs catalogued: 70 (see "Screen Tally" at bottom).

This is a static read-only catalog. Where a screen has many sub-features, primary controls are listed and a `[needs follow-up]` flag indicates a deep-dive deferred for time.

---

## Root & App Entry

### `SpentyAIApp.swift` (`@main`)
- Hosts a single `WindowGroup` containing `AppRouter`.
- Injects `AuthManager` and `LocalizationManager.shared` into the environment.
- On launch calls `authManager.checkSession()`.

### `Navigation/AppRouter.swift`
- Routing decision tree (in order):
  1. `LoadingView` while `authManager.isLoading`.
  2. `OnboardingSliderView` if `OnboardingManager.shared.hasSeenOnboarding == false`.
  3. `LoginView` if not authenticated.
  4. `SubscriptionPaywall` if user has no `hasActiveSubscription`.
  5. `MainTabView` (the post-paywall app shell).
- Animated transitions on each branch flip.

---

## Tab Bar (root `MainTabView`)

`Navigation/MainTabView.swift` defines a 5-tab `TabView`. Order:

| Idx | Tab | Icon | Destination |
|-----|-----|------|-------------|
| 0 | Dashboard     | `house.fill`             | `DashboardView` |
| 1 | Transactions  | `arrow.left.arrow.right` | `TransactionListView` |
| 2 | Accounts      | `building.columns.fill`  | `AccountListView` |
| 3 | Reports       | `chart.pie.fill`         | `ReportsView` |
| 4 | More          | `ellipsis.circle.fill`   | `MoreMenuView` |

Deep links: `spentyai://nav/<dashboard|transactions|accounts|reports>` switch tabs (used by simulator automation).

## More Menu (`MoreMenuView` inside `MainTabView.swift`)

Sectioned `List`:

- **Finance**: Cash Flow → `CashFlowView`, Invoices → `InvoiceListView`, Purchases → `PurchaseListView`, Categories → `CategoryListView`.
- **People**: Customers → `CustomerListView`, Vendors → `VendorListView`.
- **Obligations**: Mandates → `MandatesListView` (preloads via shared `CashFlowViewModel`).
- **Data**: Reconciliation → `ReconciliationView`, Email Sync → `EmailSyncView`, SMS Sync → `SMSSyncView`, Records → `RecordsView`, Past Insights → `PastInsightsView`.
- **Tools**: AI Chat (Button → presents `AIChatView` as sheet), Feature Requests → `FeatureRequestsView`, Support → `SupportView`.
- **Account**: Settings → `SettingsView`, Billing → `BillingView`.

## Sidebar (`Navigation/SidebarView.swift`)

Alternative iPad/Mac layout — `NavigationSplitView` with the same 20 destinations grouped (Main / Finance / People / Data / Tools / Account). Not used on phone; mirror of MoreMenu list. AI Chat opened via sheet here too.

---

## Cross-cutting Authentication & Onboarding flows

| Stage | File | Endpoint(s) | Notes |
|-------|------|-------------|-------|
| Onboarding slider (8 slides) | `Features/Onboarding/OnboardingSliderView.swift`, `OnboardingSlide.swift` | none | Stories-style segmented progress, Skip button, Next / Get Started CTA. Persists `spenty_onboarding_slider_seen_v1` in `UserDefaults` via `OnboardingManager`. DEBUG-only `reset()` helper. |
| Login | `Features/Auth/LoginView.swift` | `POST /api/auth/google/mobile`, `POST /api/auth/apple/mobile`, `POST /api/auth/demo-login` | Sign in with Apple (placed first per Guideline 4.8), Google Sign-In, low-profile "View Demo Account" button, ToS/Privacy links. Inline error banner + alert. |
| Subscription paywall | `Features/Onboarding/SubscriptionPaywall.swift` | StoreKit + `POST /api/payments/apple/verify` | Plan selector (monthly/quarterly/yearly/lifetime), Subscribe button, Restore Purchases, Promo code section, Lifetime offer sheet. |
| AuthManager | `Core/Auth/AuthManager.swift` | `GET /api/auth/me`, `POST /api/auth/logout`, `DELETE /api/auth/delete-account`, `POST /api/auth/dev/simulator-login` | Session-token persistence in Keychain (`KeychainHelper`). DEBUG/`#if targetEnvironment(simulator)` simulator-bypass auto-login gated by `SIMULATOR_AUTOLOGIN` env var. Listens for `.userSessionExpired` notifications. |

---

## Screens (alphabetical by feature folder)

### Features/AIChat

#### AIChatView
- Path: `Features/AIChat/AIChatView.swift`
- Purpose: Conversational AI assistant. Shows message list, inline transaction/invoice/bill cards, voice mode, and microphone-driven input.
- Pushed from: Dashboard toolbar "AI" button (sheet), MoreMenu "AI Chat" button (sheet), SidebarView (sheet).
- Presents: confirmation dialog "Clear chat history?", error alert.
- Interactive controls:
  - Toolbar: Close (dismiss), Voice Mode toggle (`waveform.circle`), Speaker toggle (`speaker.wave.2.fill` ↔ `speaker.slash.fill`), Menu → "Clear History" destructive.
  - Input bar: Microphone button (toggles `SpeechManager` listening), multi-line `TextField "Ask SpentyAI"` (1...5 lines), Send button (disabled until `canSend`).
  - Voice mode pulsing mic with Listening / Speaking / Thinking / "Tap to speak" states; live transcription preview; markdown-rendered last assistant response (scrollable, max 260pt).
  - Suggestions chips load on appear.
- API endpoints called (via `AIChatRepository`):
  - `POST /api/ai/chat`
  - `GET  /api/ai/chat/history`
  - `DELETE /api/ai/chat/history/clear`
  - `GET  /api/ai/chat/suggestions`
- States: empty (suggestion chips when no messages), loading (typing indicator), error (alert).
- Platform gating: `Speech`/`AVFoundation` permissions handled by `Core/Services/SpeechManager.swift`.

#### Supporting views
- `ChatBubble.swift` — message bubble.
- `MarkdownText` — Markdown renderer (also used in voice-mode response).
- `TypingIndicator` — three-dot animation.
- `TransactionCard`, `InvoiceCard`, `BillCard` — inline structured-data cards rendered for AI tool-call results.

### Features/Accounts

#### AccountListView
- Path: `Features/Accounts/AccountListView.swift`
- Purpose: Grouped accounts list with running total balance.
- Pushed from: MainTabView (Accounts tab), Sidebar.
- Presents: `AccountFormView` (sheet), error banner, `AccountDetailView` via `navigationDestination(for: String.self)`.
- Interactive controls: `searchable`, toolbar `+` (new account), pull-to-refresh, `NavigationLink` per account, swipe-trailing Delete (destructive) + Edit.
- API endpoints (via `AccountRepository`): `GET /api/accounts`, `DELETE /api/accounts/{id}`, `GET /api/account-sub-types`.
- States: loading (full-screen `LoadingView`), empty (no accounts → "Add Account" CTA), no-search-match empty state, error banner.

#### AccountDetailView
- Path: `Features/Accounts/AccountDetailView.swift`
- Purpose: Account info card + tab-switched details (Transactions / Amortization / OD Interest / Demat).
- Pushed from: AccountListView, DashboardView (`navigationDestination(for: String.self)`), DashboardAccountsListView.
- Presents: `AccountFormView` (edit sheet), `UnifiedTransactionForm` (edit txn sheet).
- Interactive controls:
  - Toolbar pencil → edit account.
  - Opening Balance editor: `TextField` amount, `DatePicker` as-of, Save & Recalculate button.
  - Tab pills built dynamically (`Transactions`, `Amortization` if liability, `OD Interest` if OD, `Demat` if investment-demat).
  - Transactions tab: clear-filters button, date range, category `Picker`, paginated transaction rows.
  - OD Interest tab: from-date / to-date pickers, amount totals.
  - Amortization table.
  - Demat tab embeds `DematUploadView`.
- API endpoints: `GET /api/accounts/{id}`, `POST /api/accounts/{id}/recalculate`, `GET /api/accounts/{id}/amortization`, `GET /api/accounts/{id}/od-interest?month=`, `GET /api/accounts/{id}/transactions?status=approved`, `GET /api/categories`.
- States: loading, error banner.

#### AccountFormView
- Path: `Features/Accounts/AccountFormView.swift`
- Purpose: Create/edit account.
- Interactive: `TextField` name, sub-type picker, `TextField` account number, opening balance amount + date, broker name (demat), description, type picker. Toolbar Cancel / Add or Save.
- API: `POST /api/accounts`, `PUT /api/accounts/{id}`.

#### DematUploadView
- Path: `Features/Accounts/DematUploadView.swift`
- Purpose: Upload demat broker statement (PDF/CSV) and approve/reject parsed statements.
- Interactive: `fileImporter` (PDF/CSV), confirm-action alert (Approve/Reject), per-statement Approve/Reject buttons.
- API: `POST /api/demat/upload-statement`, `GET /api/demat/statements/{accountId}`, `POST /api/demat/approve-statement/{id}`, `POST /api/demat/reject-statement/{id}`.
- States: loading, error.

#### SubTypeManagerView
- Path: `Features/Accounts/SubTypeManagerView.swift`
- Purpose: Manage user-defined account sub-types.
- Interactive: `TextField` "New sub-type", Add button, swipe-trailing Edit/Delete, edit-inline TextField + Save/Cancel, delete confirm alert.
- API: `GET/POST/PUT/DELETE /api/account-sub-types`.

### Features/AIChat — see above.

### Features/Auth

#### LoginView
- See "Cross-cutting Authentication & Onboarding flows" above.

### Features/Billing

#### BillingView
- Path: `Features/Billing/BillingView.swift`
- Purpose: Subscription status, plan picker, promo codes, payment history, cancel.
- Pushed from: MoreMenu (Account section), Sidebar.
- Presents: `LifetimeOfferSheet` (sheet), error alert, cancel-subscription alert (Keep Plan / Cancel Plan destructive), `PaymentHistoryView` (NavigationLink "See all").
- Interactive controls:
  - Plan cards (Monthly, Quarterly, Yearly w/ "Popular" badge, Lifetime w/ "Best Value") each with Subscribe button → triggers StoreKit purchase or Lifetime offer interceptor when buying Monthly while offer active.
  - Promo code: `TextField` (uppercase, no autocorrect), Apply button.
  - Cancel section: Apple subscribers see external `Link` to `apps.apple.com/account/subscriptions` (Guideline 3.1.2); web subscribers see destructive Cancel button.
- API endpoints (via `BillingRepository`): `GET /api/payments/plans`, `GET /api/payments/status`, `GET /api/payments/history`, `POST /api/payments/apple/verify`, `POST /api/payments/cancel`, `POST /api/promo/validate`, `POST /api/promo/activate`. Plus StoreKit 2 product loading.
- States: loading overlay, error alert, "Active subscription" header.

#### LifetimeOfferSheet
- Path: `Features/Billing/LifetimeOfferSheet.swift`
- Purpose: Limited-time lifetime offer modal with countdown timer (when `showTimer`), Accept / Decline buttons. Surfaced from BillingView and SubscriptionPaywall.

#### LifetimeOfferManager
- Path: `Features/Billing/LifetimeOfferManager.swift`
- Singleton tracking offer activation (similar pattern to OnboardingManager).

#### PaymentHistoryView
- Path: `Features/Billing/PaymentHistoryView.swift`
- Pushed from: BillingView (NavigationLink). Lists past orders.

### Features/CashFlow

#### CashFlowView
- Path: `Features/CashFlow/CashFlowView.swift`
- Purpose: 24-month projection with summary cards, recurring list, monthly breakdown table.
- Pushed from: MoreMenu (Finance), Sidebar.
- Presents: `CashFlowDrillDownSheet` (income/expense/odInterest/emi via enum), `MonthlyCalendarView` (next-month calendar sheet).
- Interactive: 4 stat cards (each opens drill-down sheet), Next-month projection button, `RecurringListView` embedded, monthly breakdown table.
- Pull-to-refresh. Error banner.
- API endpoints (via `CashFlowRepository`): `GET /api/cashflow/projection`, `GET /api/cashflow/history`, `GET /api/mandates`, `GET /api/mandates/upcoming`, `POST /api/mandates/detect`, `GET /api/recurring/list`.

#### CashFlowChartView
- Path: `Features/CashFlow/CashFlowChartView.swift`
- 24-month line/area chart using SwiftUI Charts.

#### CashFlowDrillDownSheet (in CashFlowView.swift)
- List of income/expense/od-interest/EMI items for the current month.

#### MandatesListView
- Path: `Features/CashFlow/MandatesListView.swift`
- Pushed from: MoreMenu Obligations. Lists detected auto-debit mandates.
- Interactive: Detect-mandates button (top), per-row swipe Delete + Edit (inline `TextField` Amount), source-document and edit sheets, delete-confirm alert.
- API: `GET/POST/PATCH/DELETE /api/mandates`, `POST /api/mandates/detect`.

#### MonthlyCalendarView
- Path: `Features/CashFlow/MonthlyCalendarView.swift`
- Calendar of upcoming mandates/recurring transactions for next month.

#### RecurringListView
- Path: `Features/CashFlow/RecurringListView.swift`
- List of recurring transactions on `CashFlowView`.
- API: `POST /api/transactions/{id}/toggle-recurring`.

### Features/Categories

#### CategoryListView
- Path: `Features/Categories/CategoryListView.swift`
- Purpose: Two-tab (Expense/Income) hierarchical category browser.
- Pushed from: MoreMenu (Finance), Sidebar.
- Presents: `CategoryFormView` (sheet), error alert.
- Interactive: segmented Picker (Expense/Income), toolbar `+`, `DisclosureGroup` parent/children, "Add Subcategory" inline button, swipe-trailing Delete + Edit, swipe-leading Add Child, pull-to-refresh.
- API (via `CategoryRepository`): `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/{id}`, `DELETE /api/categories/{id}`, `GET /api/categories/defaults`, `POST /api/categories/merge`.

#### CategoryFormView
- Path: `Features/Categories/CategoryFormView.swift`
- TextField for name, type & parent context. Toolbar Cancel / Add or Save.

### Features/Customers

#### CustomerListView
- Path: `Features/Customers/CustomerListView.swift`
- Pushed from: MoreMenu (People), Sidebar.
- Interactive: `searchable`, toolbar `+`, pull-to-refresh, NavigationLink per row → `CustomerDetailView`, swipe-to-delete via `onDelete`.
- API: `GET /api/customers`, `POST /api/customers`, `DELETE /api/customers/{id}`.

#### CustomerDetailView
- Path: `Features/Customers/CustomerDetailView.swift`
- Pushed from: CustomerListView. Shows customer info + their invoices.
- Presents: `CustomerFormView` (edit sheet).
- API: `GET /api/customers/{id}/invoices`.

#### CustomerFormView
- Path: `Features/Customers/CustomerFormView.swift`
- Create/edit customer. Form fields: name, email, phone, address.
- API: `POST /api/customers`, `PUT /api/customers/{id}`.

### Features/Dashboard

#### DashboardView
- Path: `Features/Dashboard/DashboardView.swift`  (1825 lines — `[needs follow-up]` for full enumeration)
- Purpose: Main home screen — net worth / income / expense stat cards, accounts section, recent transactions, pending approval section, next-month projection tile, FAB to add transaction.
- Pushed from: MainTabView root.
- Presents (sheets): UnifiedTransactionForm (new/edit/approve), AIChatView, `DashboardAccountsListView`, `DashboardFilteredTransactionsView` (income / expense), `DashboardAllPendingView`, `MonthlyCalendarView` (calendar projection), `PendingTransactionDetailSheet`. Plus alerts for "New Account", "New Category", "New Subcategory" (created inline from approval flow).
- Interactive controls:
  - Toolbar: Hindi/English toggle (`lang.toggle()`), AI sparkles button → opens AIChatView sheet.
  - Stat cards (Net Worth, Total Balance, Income This Month, Expenses This Month) → tappable → drill-down sheets.
  - Collapsible section headers (Accounts / Recent / Pending) with chevron rotation.
  - NavigationLink per account → AccountDetailView.
  - FAB (`plus` circle, bottom-trailing) opens new-transaction sheet.
  - Pending approval rows: tap to open `PendingTransactionDetailSheet` for individual approve/reject/edit (sheet contains its own form mirroring `TransactionFormView`).
- Pull-to-refresh on main scroll.
- API (via `DashboardRepository`): `GET /api/dashboard/summary`. Approval flows reuse `/api/transactions/...` endpoints from `EmailSyncRepository`/`TransactionRepository`.
- States: full-screen LoadingView while initial load with no data, error banner.

#### DashboardAccountsListView
- All accounts list (from balance card tap).

#### DashboardFilteredTransactionsView
- Filtered list of income or expense transactions for the current month.

#### DashboardAllPendingView
- Full pending-review list embedded in a sheet.

#### PendingTransactionDetailSheet
- Inline approval/rejection form mirroring `TransactionFormView` for a single pending txn.

### Features/EmailSync

#### EmailSyncView
- Path: `Features/EmailSync/EmailSyncView.swift`
- Purpose: Connect / disconnect Gmail and Outlook accounts, view sync stats and progress, retry failed emails, jump to pending review.
- Pushed from: MoreMenu (Data), Sidebar.
- Presents: `SyncDatePickerSheet` (large detent), confirm-disconnect dialog, NavigationLink to `PendingReviewView`.
- Interactive controls:
  - Connect Gmail button (also "Add another Gmail").
  - Connect Outlook button (full or compact "Add Outlook" row depending on connected state).
  - Per-account row Disconnect button → confirmation dialog.
  - Retry Failed Emails button.
  - Connection success animated overlay.
  - Sync progress indicator with phases (idle / syncing / complete / failed).
  - Auto-dismissing toast (success).
- Pull-to-refresh.
- Polling lifecycle: `onDisappear { viewModel.stopPolling() }`.
- API endpoints (via `EmailSyncRepository`): `GET /api/gmail/connect?platform=ios`, `GET /api/gmail/status`, `POST /api/gmail/disconnect`, `GET /api/outlook/connect?platform=ios`, `GET /api/outlook/status`, `POST /api/outlook/disconnect`, `POST /api/email/start-sync`, `POST /api/outlook/start-sync`, `POST /api/email/retry-pending`, `POST /api/outlook/retry-pending`, `GET /api/email/sync-stats`, `GET /api/email/pending-review`, `POST /api/transactions/{id}/approve`, `POST /api/transactions/{id}/reject`, `POST /api/transactions/bulk-approve`, `POST /api/transactions/bulk-reject`, `PATCH /api/transactions/{id}`, `GET /api/sms/stats`, `GET /api/source/{id}`.
- States: loading overlay, empty (no Gmail/Outlook accounts), error banner, success toast.

#### PendingReviewView
- Path: `Features/EmailSync/PendingReviewView.swift`
- Purpose: AI-detected pending transactions awaiting approval.
- Pushed from: EmailSyncView.
- Presents: `UnifiedTransactionForm` (mode `.approve`), source-content sheet (raw email view), inline create-account / create-category / create-subcategory alerts.
- Interactive controls: Per-row selection toggle, Select-All / Deselect-All menu, Approve All / Reject All bulk buttons, per-row Approve / Reject / Edit (opens approve form), View source button.
- Pull-to-refresh.
- API: see EmailSyncView (shared repo).
- States: loading, empty ("All caught up"), error banner.

### Features/FeatureRequests

#### FeatureRequestsView
- Path: `Features/FeatureRequests/FeatureRequestsView.swift`
- Purpose: Browse / vote on community feature requests.
- Pushed from: MoreMenu (Tools), Sidebar.
- Presents: `FeatureRequestFormView` (sheet), error alert.
- Interactive: toolbar `+`, vote button per row, pull-to-refresh.
- API: `GET /api/feature-requests`, `POST /api/feature-requests`, `POST /api/feature-requests/{id}/vote`.

#### FeatureRequestFormView
- Path: `Features/FeatureRequests/FeatureRequestFormView.swift`
- TextField title, description editor, submit. Title: "New Request".
- API: `POST /api/feature-requests`.

### Features/Invoices

#### InvoiceListView
- Path: `Features/Invoices/InvoiceListView.swift`
- Purpose: Invoices list with stats cards (totals/outstanding/aging), debtors and aging sections, filter chip bar.
- Pushed from: MoreMenu (Finance), Sidebar.
- Presents: `InvoiceFormView` (sheet), `RecordPaymentView` (sheet), error alert.
- Interactive: `searchable`, toolbar `+`, pull-to-refresh, NavigationLink per invoice → `InvoicePreviewView`, swipe-trailing Delete + Edit, swipe-leading Mark Paid (if not paid) + Duplicate, status filter pills.
- API (via `InvoiceRepository`): `GET /api/invoices`, `POST /api/invoices`, `PUT /api/invoices/{id}`, `DELETE /api/invoices/{id}`, `POST /api/invoices/{id}/record-payment`, `POST /api/invoices/{id}/mark-paid`, `POST /api/invoices/{id}/duplicate`, `GET /api/invoices/next-number`, `/api/invoices/stats`, `/api/invoices/count`, `/api/invoices/debtors`, `/api/invoices/aging`, `/api/invoices/sales-by-customer`, `GET /api/customers`, `GET /api/accounts`.
- States: loading, empty state, error alert.

#### InvoiceFormView
- Path: `Features/Invoices/InvoiceFormView.swift`
- Purpose: Create/edit invoice (line items, customer, dates, totals).
- Presents: `Customer Picker` sheet (NavigationStack title "Select Customer").
- Title: "New Invoice" / "Edit Invoice".

#### InvoicePreviewView
- Path: `Features/Invoices/InvoicePreviewView.swift`
- Purpose: Render PDF preview with `PDFKitView`, share, edit, mark-paid, delete.
- Presents: `ShareSheet`, `InvoiceFormView` (edit sheet), Delete confirmationDialog.
- API: `GET /api/invoices/{id}/pdf`.

#### RecordPaymentView
- Path: `Features/Invoices/RecordPaymentView.swift`
- TextField amount, payment date, account picker, mark partial/full. Title: "Record Payment".
- API: `POST /api/invoices/{id}/record-payment`.

### Features/Onboarding

#### OnboardingSliderView
- Path: `Features/Onboarding/OnboardingSliderView.swift`
- 8-slide TabView with paged style, segmented progress, Skip button, dot indicators, gradient Get Started CTA on last slide.
- States: visited flag persisted.

#### OnboardingSlideCardView
- Path: `Features/Onboarding/OnboardingSlideCardView.swift`
- Renders an individual slide (gradient + asset image + stat pills + title/description).

#### SubscriptionPaywall
- Path: `Features/Onboarding/SubscriptionPaywall.swift`
- See "Cross-cutting flows". Hero, plan picker (default = Yearly), Subscribe button, Promo section, Restore Purchases (alert with result), Lifetime offer sheet.
- Note: includes `isRestoring` and `showRestoreResult` — Restore button present here but **not** in `BillingView`. Parity flag.

### Features/PastInsights

#### PastInsightsView
- Path: `Features/PastInsights/PastInsightsView.swift`
- Purpose: Browse and create custom date-range tax/expense insight summaries.
- Pushed from: MoreMenu (Data), Sidebar.
- Presents: create-form sheet (`new_insight` title), error alert.
- Interactive: toolbar `+`, NavigationLink per insight → `PastInsightDetailView`, pull-to-refresh.
- API (via `PastInsightsRepository`): `GET /api/tax-summary`, `POST /api/tax-summary`, `POST /api/tax-summary/generate?date_from=&date_to=`, `DELETE /api/tax-summary/{id}`, `GET /api/tax-summary/available-emails`.

#### PastInsightDetailView
- Path: `Features/PastInsights/PastInsightDetailView.swift`
- Title: insight name. Tabs / sections for transactions, breakdown.
- Presents: Add/Edit Transaction sheet (DatePicker, type Picker, amount), share sheet.
- Interactive: per-row swipe Edit/Delete, delete-warning destructive button, share/export.
- API: `GET /api/tax-summary/{id}`, `GET /api/tax-summary/{id}/transactions`, `POST/PUT/DELETE /api/tax-summary/{id}/transactions[/...]`, `GET /api/tax-summary/{id}/export`, `GET /api/tax-summary/{id}/download`.

### Features/Purchases (Bills)

#### PurchaseListView
- Path: `Features/Purchases/PurchaseListView.swift`
- Purpose: Vendor bills list (mirror of invoices).
- Pushed from: MoreMenu (Finance), Sidebar.
- Presents: `PurchaseFormView`, `RecordBillPaymentView`, `PurchasePreviewView`, `BillUploadParserView`, error/delete alerts.
- Interactive: `searchable`, toolbar 2 buttons (`doc.text.viewfinder` upload-parse + `+` create), pull-to-refresh, swipe Delete/Edit, swipe Mark Paid/Duplicate, StatusBadge.
- API (via `PurchaseRepository`): `GET /api/bills`, `POST /api/bills`, `PUT /api/bills/{id}`, `DELETE /api/bills/{id}`, `POST /api/bills/{id}/record-payment`, `POST /api/bills/{id}/mark-paid`, `POST /api/bills/{id}/duplicate`, `GET /api/bills/next-number`, `/api/bills/stats`, `/api/bills/creditors`, `/api/bills/aging`, `/api/bills/purchases-by-vendor`, `GET /api/bills/{id}/pdf`, `POST /api/bills/parse-upload`, `GET /api/vendors`, `GET /api/accounts`.

#### PurchaseFormView
- Path: `Features/Purchases/PurchaseFormView.swift`
- Title: "New Bill" / "Edit Bill".

#### PurchasePreviewView
- Path: `Features/Purchases/PurchasePreviewView.swift`
- Title: "Bill Preview". Renders bill PDF.

#### RecordBillPaymentView
- Path: `Features/Purchases/RecordBillPaymentView.swift`
- Title: "Record Payment".

#### BillUploadParserView
- Path: `Features/Purchases/BillUploadParserView.swift`
- Title: "Upload Bill". Lets user pick a PDF/image and AI-parse a bill.
- API: `POST /api/bills/parse-upload`.

### Features/Reconciliation

#### ReconciliationView
- Path: `Features/Reconciliation/ReconciliationView.swift`
- Purpose: List of uploaded bank statements with reconciliation status.
- Pushed from: MoreMenu (Data), Sidebar.
- Presents: `StatementUploadView` (sheet), Delete confirmationDialog, NavigationLink → `StatementDetailView`.
- Interactive: toolbar `+` plus.circle.fill, swipe-trailing Delete, pull-to-refresh, processing progress indicator per row.
- API (via `ReconciliationRepository`): `GET /api/statements/list`, `DELETE /api/statements/{id}`, `GET /api/accounts`, `GET /api/account-sub-types`, `GET /api/categories`.
- States: loading, empty (with "Upload Statement" CTA), error.

#### StatementUploadView
- Path: `Features/Reconciliation/StatementUploadView.swift`
- Purpose: Upload a PDF/CSV statement.
- Interactive: sub-type Menu picker, account Menu picker, period dates, file picker (`.pdf`/`.commaSeparatedText`), Upload button.
- API: `POST /api/statements/upload`.

#### StatementDetailView
- Path: `Features/Reconciliation/StatementDetailView.swift`
- Purpose: Workflow stepper (Upload → Parse → Review → Reconcile → Done) plus parsed entries with categorisation.
- Presents: unlock sheet, bulk-category picker, Approve confirmationDialog, Reject confirmationDialog (destructive).
- Interactive: per-entry category picker, bulk-categorize button, Reconcile button, Re-audit button, Approve / Reject buttons, Add Missing button.
- API: `GET /api/statements/{id}`, `GET /api/statements/{id}/entries`, `PATCH /api/statements/{id}/entries/{index}`, `POST /api/statements/{id}/bulk-categorize`, `POST /api/statements/{id}/reconcile`, `POST /api/statements/{id}/add-missing`, `POST /api/statements/{id}/reaudit`, `POST /api/statements/{id}/unlock`, `POST /api/statements/{id}/approve`, `POST /api/statements/{id}/reject`.
- States: loading, terminal-state banner (when approved/rejected), error.

### Features/Records

#### RecordsView
- Path: `Features/Records/RecordsView.swift`
- Purpose: Two-tab archive (Emails / Receipts) — synced email records and uploaded receipts.
- Pushed from: MoreMenu (Data), Sidebar.
- Presents: `RecordsShareSheet` (export), `ReceiptUploadView` (sheet), Delete-Record / Delete-Receipt confirmationDialogs.
- Interactive: segmented Picker tab, search bar (debounced), date range button, amount range button, "Download zip" button (Emails tab), per-row NavigationLink → `RecordPreviewView`, swipe-trailing Delete (full-swipe), swipe-leading Edit/etc., pull-to-refresh per tab.
- API (via `RecordsRepository`): `GET /api/records?...`, `GET /api/records/search?q=&skip=&limit=`, `GET /api/records/{id}/preview`, `GET /api/records/by-transaction/{txnId}`, `DELETE /api/records/{id}`, `GET /api/records/{id}/download-eml`, `GET /api/records/{id}/attachments/{idx}/download`, `POST /api/records/download-zip`, `GET /api/receipts?skip=&limit=`, `POST /api/receipts/upload`, `POST /api/receipts/{id}/parse`, `GET/DELETE /api/receipts/{id}`, `GET /api/receipts/{id}/download`, `GET /api/receipts/by-transaction/{id}`, `POST /api/receipts/{id}/link`.

#### RecordPreviewView
- Path: `Features/Records/RecordPreviewView.swift`
- Purpose: Email preview (HTML view via `WKWebView` wrapper `HTMLView`), download buttons, attachments list.
- Presents: share sheet, confirmationDialog (delete).
- Interactive: download attachments, share .eml, delete.

#### ReceiptUploadView
- Path: `Features/Records/ReceiptUploadView.swift`
- Purpose: Upload + parse receipt image, then optionally link to a transaction.
- Interactive: `PhotosPicker`, image preview, Parse, Link-to-transaction picker, Save buttons.
- Title: "Upload Receipt".
- API: `POST /api/receipts/upload`, `POST /api/receipts/{id}/parse`, `POST /api/receipts/{id}/link`.

### Features/Reports

#### ReportsView
- Path: `Features/Reports/ReportsView.swift`
- Purpose: Period filter chips, summary tiles, period chart, category donut + table, export.
- Pushed from: MainTabView (Reports tab), Sidebar.
- Presents: `ShareSheet` (after export), `ReportTransactionsView` (drill-down sheet) for income/expense/all and category/subcategory taps.
- Interactive controls:
  - Horizontal preset chips (`PeriodPreset.allCases`).
  - Custom date `DatePicker`s + reload button (when preset == .custom).
  - 4 stat-card buttons (Income, Expense, Net, plus All).
  - Donut chart (`DonutChartView`) + period chart (`PeriodChartView`).
  - Category-type Picker (Expense/Income).
  - Category table with expandable rows.
  - Export CSV button + Export PDF button.
- Pull-to-refresh.
- API (via `ReportsRepository`): `GET /api/reports/summary`, `GET /api/reports/by-period`, `GET /api/reports/by-category`, `GET /api/reports/income-expense`, `GET /api/reports/account`, `GET /api/reports/export/csv`, `GET /api/reports/export/pdf`.
- States: loading overlay, error alert.

#### ReportTransactionsView (in ReportsView.swift)
- Drill-down sheet listing transactions for the chosen category / subcategory / type, with date range from the parent.

#### DonutChartView, PeriodChartView
- Charts components used by ReportsView (Apple Charts framework).

### Features/Settings

#### SettingsView
- Path: `Features/Settings/SettingsView.swift`
- Purpose: Top-level settings form.
- Pushed from: MoreMenu (Account), Sidebar.
- Sections (Form rows):
  - **Business Profile** → NavigationLink → `BusinessProfileView`.
  - **Currency & Locale** → NavigationLink → `CurrencySettingsView`.
  - **Invoice Customization**: business logo `PhotosPicker` (Replace/Remove), signature `PhotosPicker` (Replace/Remove). Async previews.
  - **Legal & Support**: 6 external Link buttons (About, Help Center, Contact Support `mailto:`, Privacy Policy, Terms of Service, Refund Policy) + read-only "App Version" row.
  - **Account**: Sign Out button, Reset Data destructive button (2-step warning + RESET-typed confirm + success alerts), Delete Account destructive button (confirmationDialog → API).
- Alerts/Confirmations: error, delete-account confirm, reset warning, reset-confirm-input (`TextField`), reset-success.
- API (via `SettingsRepository`): `GET /api/settings`, `PUT /api/settings`, `GET /api/settings/currencies`, `GET /api/settings/date-formats`, `POST /api/settings/logo`, `DELETE /api/settings/logo`, `POST /api/settings/signature`, `DELETE /api/settings/signature`, `POST /api/settings/reset-data`. Plus `AuthManager.logout()` and `deleteAccount()` (`DELETE /api/auth/delete-account`).

#### BusinessProfileView
- Path: `Features/Settings/BusinessProfileView.swift`
- Form: firm name, GSTIN, PAN, address, country picker (10+ countries via ISO map), Indian-state picker. Save button + saved-success alert.
- API: `PUT /api/settings`.

#### CurrencySettingsView
- Path: `Features/Settings/CurrencySettingsView.swift`
- Pickers for base currency and date format. Save success alert.
- API: `GET /api/settings/currencies`, `GET /api/settings/date-formats`, `PUT /api/settings`.

### Features/SMSSync

#### SMSSyncView
- Path: `Features/SMSSync/SMSSyncView.swift`
- Purpose: Paste SMS text, parse, view stats, retry, detect mandates.
- Pushed from: MoreMenu (Data), Sidebar.
- Interactive: `TextEditor` for SMS, message-count badge, Upload & Parse button (label changes "Uploading..." / "Parsing Transactions..."), Retry Pending Messages button, Detect Auto-Debit Mandates button, error banner, success result rows, stats grid.
- API (via `SMSSyncRepository`): `POST /api/sms/upload`, `POST /api/sms/parse`, `POST /api/sms/bulk-parse`, `POST /api/sms/retry-pending`, `POST /api/sms/detect-mandates`, `GET /api/sms/stats`.
- Note: text is pasted manually — no system SMS read permission.

### Features/Support

#### SupportView
- Path: `Features/Support/SupportView.swift`
- Purpose: FAQ list + submit support ticket.
- Pushed from: MoreMenu (Tools), Sidebar.
- Interactive: FAQ accordions, ticket form (subject / message / category buttons), Submit button.
- Alerts: error, "Ticket Submitted" success.
- API (via `SupportRepository`): `POST /api/support/ticket`, `GET /api/support/faq`.

### Features/Transactions

#### TransactionListView
- Path: `Features/Transactions/TransactionListView.swift`
- Purpose: Browse all approved transactions with list/ledger toggle, filters, bulk actions.
- Pushed from: MainTabView (Transactions tab), Sidebar.
- Presents: `UnifiedTransactionForm` (sheet, create/edit), edit-existing sheet, delete confirmationDialog, error alert.
- Interactive controls:
  - Segmented `Picker` view-mode (List / Ledger).
  - Search bar (debounced + on-commit).
  - Filter chip bar (All / Income / Expense / Transfer).
  - Account `Menu` picker, Date Range button → popover with from/to `DatePicker` and Apply.
  - Bulk-bar (when selecting): "N selected" + Delete; toolbar shows Select All / Cancel.
  - List rows: tap to edit, long-press to enter selection mode, swipe-trailing Delete + Edit.
  - Toolbar `+`.
  - Pull-to-refresh.
  - Pagination via `onAppear` of last row → `loadMore()`.
- API (via `TransactionRepository`): `GET /api/transactions`, `GET /api/transactions/pending`, `GET /api/transactions/search?q=&skip=&limit=&status=approved`, `POST /api/transactions`, `PUT /api/transactions/{id}`, `DELETE /api/transactions/{id}`, `POST /api/transactions/{id}/approve`, `POST /api/transactions/{id}/reject`, `POST /api/transactions/bulk-approve`, `POST /api/transactions/bulk-reject`, `POST /api/transactions/bulk-delete`, `POST /api/transactions/bulk-update`, `POST /api/transactions/{id}/toggle-recurring`, `GET /api/accounts`, `GET /api/categories`.
- States: loading (full), empty (no approved + pending hint), loadMore spinner, error alert.

#### TransactionLedgerView
- Path: `Features/Transactions/TransactionLedgerView.swift`
- Purpose: Tabular ledger view variant (debit/credit columns).
- Pushed from: TransactionListView (segmented picker mode = .ledger).
- Pull-to-refresh.

#### UnifiedTransactionForm
- Path: `Features/Transactions/UnifiedTransactionForm.swift`
- Purpose: Single form used in 3 modes — `.create`, `.edit(Transaction)`, `.approve(Transaction)` — for new, edit, and pending-review approval.
- Title varies: "New Transaction" / "Edit Transaction" / "Review Transaction"; confirm button "Create" / "Save".
- Interactive controls:
  - Amount hero `TextField` (decimalPad).
  - Type segmented buttons (income/expense/transfer).
  - Date `DatePicker`.
  - Account `Picker` + inline "+ New Account" button.
  - To-Account `Picker` for transfers.
  - Payment method `Picker`.
  - Category `Picker` + inline "+ New Category" button.
  - Subcategory `Picker` + inline "+ New Subcategory" button.
  - Description `TextField`.
  - Recurring section with `TextField` recurrence date (1–31).
  - Attachment section: `PhotosPicker`, Camera capture button (presents `CameraCaptureView` shared) → image data attached.
  - Approve/Reject buttons (when `.approve` mode).
  - Delete button (when not create mode) → confirmationDialog.
  - Save button disabled until amount + account (and category if not transfer) populated.
- Toolbar Cancel / Confirm.
- Alerts for new-account / new-category / new-subcategory inline creation.
- `fullScreenCover` for receipt preview (Done button).
- API: `POST/PUT/DELETE /api/transactions`, `POST /api/transactions/{id}/approve`, `POST /api/transactions/{id}/reject`, `POST /api/accounts`, `POST /api/categories`, `POST /api/receipts/upload` (when attachment captured).

#### TransactionFormView
- Path: `Features/Transactions/TransactionFormView.swift`
- Purpose: Older / alternative transaction form (still referenced). Has the same inline-create alerts (`new_account` / `new_category` / `new_subcategory`). `[needs follow-up]` to confirm if still used vs replaced by UnifiedTransactionForm.

#### TransactionDetailView
- Path: `Features/Transactions/TransactionDetailView.swift`
- Purpose: Show a single transaction with source-document expansion, archive/attachments list, edit/approve/reject/delete.
- Presents: edit sheet (`UnifiedTransactionForm`), receipt sheet, `fullScreenCover` for QuickLook preview (`AttachmentPreviewView` UIViewControllerRepresentable), Delete alert.
- Interactive controls: Edit Transaction button, Approve / Reject buttons (pending), Delete Transaction destructive button, expand source-document section, per-attachment download buttons → ShareSheet.
- API: `GET /api/transactions/{id}`, `POST /api/transactions/{id}/approve`, `POST /api/transactions/{id}/reject`, `DELETE /api/transactions/{id}`, `GET /api/source/{id}` (raw email), `GET /api/records/by-transaction/{txnId}`, `GET /api/records/{id}/attachments/{index}/download`.

#### CameraCaptureView (`Features/Transactions/`)
- Path: `Features/Transactions/CameraCaptureView.swift`
- Identical UIImagePickerController-camera wrapper as the Shared one. Two copies exist (`Features/Shared/CameraCaptureView.swift` and `Features/Transactions/CameraCaptureView.swift`). `[needs follow-up]` (likely duplication to clean up).

### Features/Vendors

#### VendorListView
- Path: `Features/Vendors/VendorListView.swift`
- Pushed from: MoreMenu (People), Sidebar.
- Interactive: `searchable`, toolbar `+`, NavigationLink → `VendorDetailView`, `onDelete`.
- API: `GET /api/vendors`, `POST /api/vendors`, `DELETE /api/vendors/{id}`.

#### VendorDetailView
- Path: `Features/Vendors/VendorDetailView.swift`
- Shows vendor info + their bills.
- Presents: `VendorFormView` (edit sheet).
- API: `GET /api/vendors/{id}/bills`.

#### VendorFormView
- Path: `Features/Vendors/VendorFormView.swift`
- Title: "New Vendor" / "Edit Vendor". Form fields name/email/phone/address.
- API: `POST /api/vendors`, `PUT /api/vendors/{id}`.

### Features/SiriIntents (App Intents — non-UI)

- `RecordExpenseIntent` — Siri phrase "Record/Add/Log expense in SpentyAI". Parameters: amount, expenseDescription, optional category, optional account. Calls `POST /api/transactions`. Auth check via `KeychainHelper`.
- `RecordIncomeIntent` — same pattern for income.
- `CheckBalanceIntent` — Siri phrase "What's my balance / Check my balance". Calls `GET /api/dashboard/summary`.
- `AppShortcuts` (`SpentyAIShortcuts: AppShortcutsProvider`) registers all three with phrases and SF Symbols.
- All 3 intents short-circuit with a "Please open SpentyAI and sign in first" dialog if no session token present.

---

## Cross-cutting Components (Core/)

- `Core/Auth/AuthManager.swift` — session, login, simulator-bypass (DEBUG only).
- `Core/Auth/GoogleSignInHelper.swift` — Google Sign-In wrapper.
- `Core/Auth/KeychainHelper.swift` — Keychain reads/writes; key `KeychainHelper.sessionTokenKey`.
- `Core/Networking/APIClient.swift`, `APIEndpoints.swift`, `APIError.swift`, `EmptyResponse.swift` — central HTTP layer; emits `.userSessionExpired` notification on 401.
- `Core/Services/SpeechManager.swift` — STT + TTS for voice mode.
- `Core/Localization/LocalizationManager.swift` — `@Observable` toggle between `en` and `hi`. `AppStrings.swift` is the dictionary.
- `Core/Components/` — `ConfirmDialog`, `CurrencyText`, `EmptyStateView`, `ErrorBanner`, `FilterBar`, `LoadingView`, `SearchBar`, `StatCard`, `StatusBadge`.
- `Core/Theme/SpentyColors.swift`, `SpentyFonts.swift`, `SpentyStyle.swift` — colour tokens (spentyPrimary/Success/Error/etc.), typography scale, primary/secondary button styles, `cardStyle()`.

---

## Cross-cutting Features (span multiple screens)

- **Authentication**: Sign in with Apple (LoginView), Google Sign-In (LoginView), Demo account button (LoginView, calls `POST /api/auth/demo-login`), simulator auto-login (DEBUG-only, env var `SIMULATOR_AUTOLOGIN`), Sign out (SettingsView), Delete account (SettingsView), Account-deleted state via `.userSessionExpired` notification → `AuthManager.logout()`.
- **In-App Purchases / Paywall**: `SubscriptionPaywall` (gating screen) + `BillingView` (post-paywall management). Both use `BillingViewModel` and StoreKit 2 product IDs `com.spentyai.monthly|quarterly|yearly|lifetime|lifetime_offer`. `LifetimeOfferSheet` shared. `LifetimeOfferManager` singleton tracks countdown. Note: **Restore Purchases** appears in `SubscriptionPaywall` but **not** `BillingView` (parity check candidate).
- **Email Sync (Gmail + Outlook OAuth)**: `EmailSyncView`, `PendingReviewView`. Connect URLs include `?platform=ios`. Polling lifecycle on `onDisappear`. Re-used `transactions/{id}/approve|reject` endpoints.
- **SMS Sync**: `SMSSyncView`. iOS pastes SMS manually (no system SMS API). Stats card shared.
- **Push notifications**: No `UNUserNotificationCenter` / push code visible in `Features/`. **No iOS push notification implementation found.**
- **Receipt scanning / camera**: `Shared/CameraCaptureView.swift` (UIImagePickerController) + duplicate in `Transactions/CameraCaptureView.swift`. Used by `UnifiedTransactionForm` attachment flow. Receipt OCR via `POST /api/receipts/{id}/parse` from `ReceiptUploadView`.
- **Voice input (microphone)**: `SpeechManager` powering `AIChatView` voice mode and microphone-button input. AVFoundation + Speech framework.
- **Help center (in-app)**: SettingsView "Help Center" row opens external URL `https://www.spentyai.com/help` (no in-app help center screen).
- **Localization (i18n)**: `LocalizationManager` toggles between English (`en`) and Hindi (`hi`). Toggled via the Hi/En button in DashboardView toolbar. Strings centralised in `AppStrings.swift`.
- **Pending review badge / approval workflow**: Pending count shown on Dashboard pending section, EmailSyncView `pendingReviewCard`, TransactionListView empty-state subtitle. Single-row approval via `TransactionDetailView` or `PendingTransactionDetailSheet`; bulk approval via `PendingReviewView`. **All "Pending Review" items are excluded from approved transaction lists** (`?status=approved` query) — matches the [Pending txns excluded from calcs](feedback_pending_transactions.md) policy.
- **Pull-to-refresh**: present on Dashboard, AccountList, TransactionList, EmailSync, PastInsights, FeatureRequests, CategoryList, Reports, CashFlow, CustomerList, VendorList, InvoiceList, PurchaseList, RecordsView, ReconciliationView, MandatesList (via parent), TransactionLedger.
- **Infinite scroll / pagination**: TransactionListView (last-row `onAppear` → `loadMore`), RecordsView (skip/limit pagination on emails/receipts).
- **Swipe actions**: TransactionListView (Delete + Edit), AccountListView (Delete + Edit), CategoryListView (Delete + Edit + Add Child), CustomerListView (`onDelete`), VendorListView (`onDelete`), InvoiceListView (Delete/Edit + Mark Paid/Duplicate), PurchaseListView (Delete/Edit + Mark Paid/Duplicate), MandatesListView (Delete + Edit), PastInsightDetailView (Edit/Delete), ReconciliationView (Delete), RecordsView (Delete full-swipe), SubTypeManagerView (Delete + Edit).
- **Long-press**: TransactionListView (enters bulk-selection mode).
- **Bulk actions**: TransactionListView (delete bulk), PendingReviewView (approve all / reject all), StatementDetailView (bulk-categorize entries), DashboardAllPendingView.
- **Inline create alerts**: "New Account" / "New Category" / "New Subcategory" alerts repeated across `UnifiedTransactionForm`, `TransactionFormView`, `DashboardView`, `PendingReviewView`.
- **External links** (`UIApplication.shared.open`): SettingsView legal rows (About, Help, Privacy, Terms, Refund), BillingView "Manage Subscription" → apps.apple.com.
- **DEBUG-only / simulator-only code**:
  - `AuthManager.simulatorAutoLogin()` (`#if targetEnvironment(simulator)` + `SIMULATOR_AUTOLOGIN` env var).
  - `OnboardingManager.reset()` (`#if DEBUG`).
  - Multiple `#if DEBUG print(...)` statements in AuthManager.
- **Deep links**: Custom URL scheme `spentyai://nav/<tab>` handled in `MainTabView.onOpenURL` for Dashboard / Transactions / Accounts / Reports.
- **Currency / formatting**: `CurrencyText` component, INR-default formatting; `formatCurrency` helpers in DashboardView and ReportsView use lakh/crore formatting (`1.5L`, `2.3Cr`).

---

## Screen Tally (View structs counted in this inventory)

Tab-bar/Navigation roots: 5 (Dashboard, Transactions, Accounts, Reports, MoreMenu) + Sidebar (1) + AppRouter (1).
Onboarding/Auth/Paywall: OnboardingSliderView, OnboardingSlideCardView, LoginView, SubscriptionPaywall = 4.
Dashboard family: DashboardView, DashboardAccountsListView, DashboardFilteredTransactionsView, DashboardAllPendingView, PendingTransactionDetailSheet = 5.
Transactions: TransactionListView, TransactionLedgerView, TransactionDetailView, TransactionFormView, UnifiedTransactionForm, CameraCaptureView (Transactions), AttachmentPreviewView = 7.
Accounts: AccountListView, AccountDetailView, AccountFormView, DematUploadView, SubTypeManagerView = 5.
Reports: ReportsView, ReportTransactionsView, DonutChartView, PeriodChartView, ShareSheet = 5.
Cash Flow: CashFlowView, CashFlowDrillDownSheet, CashFlowChartView, MandatesListView, MonthlyCalendarView, RecurringListView = 6.
Invoices: InvoiceListView, InvoiceFormView, InvoicePreviewView, PDFKitView, RecordPaymentView = 5.
Purchases: PurchaseListView, PurchaseFormView, PurchasePreviewView, RecordBillPaymentView, BillUploadParserView = 5.
Customers: CustomerListView, CustomerDetailView, CustomerFormView = 3.
Vendors: VendorListView, VendorDetailView, VendorFormView = 3.
Categories: CategoryListView, CategoryFormView = 2.
EmailSync: EmailSyncView, PendingReviewView, SyncDatePickerSheet = 3.
SMSSync: SMSSyncView = 1.
Records: RecordsView, RecordPreviewView, ReceiptUploadView, HTMLView = 4.
Reconciliation: ReconciliationView, StatementUploadView, StatementDetailView = 3.
Past Insights: PastInsightsView, PastInsightDetailView = 2.
AI Chat: AIChatView, ChatBubble, MarkdownText, TypingIndicator, TransactionCard, InvoiceCard, BillCard = 7.
Settings: SettingsView, BusinessProfileView, CurrencySettingsView = 3.
Billing: BillingView, LifetimeOfferSheet, PaymentHistoryView = 3.
FeatureRequests: FeatureRequestsView, FeatureRequestFormView = 2.
Support: SupportView = 1.
Shared: CameraCaptureView (Shared) = 1.

**Approximate distinct screen-level views: ~70.** Sub-component View structs (chart helpers, rows) not counted individually.

