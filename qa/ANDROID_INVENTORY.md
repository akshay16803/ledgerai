# Android App Inventory
Generated: 2026-05-01 (read-only audit)
Source: `/sessions/vibrant-elegant-turing/ledgerai/android-native/app/src/main/java/com/spentyai/app/`

Counts:
- `*Screen.kt` files: 48 (composable screen entry points)
- `*Sheet.kt` standalone files: 1 (`MonthlyCalendarSheet.kt`)
- Top-level `@Composable fun *Screen` declarations: ~50 (some files host more than one screen — e.g. `RecordsScreen.kt` declares both `RecordsScreen` and `RecordPreviewScreen`; `ReconciliationScreen.kt` declares `ReconciliationScreen` and `StatementDetailScreen`; `EmailSyncScreen.kt` declares `EmailSyncScreen` and `PendingReviewScreen`).

---

## Bottom Nav (root)

Defined in `navigation/Screen.kt` (`enum class BottomNavTab`) and rendered by `navigation/BottomNavBar.kt`. Order:

1. **Dashboard** -> `Screen.Dashboard` ("dashboard") — `DashboardScreen`
2. **Transactions** -> `Screen.Transactions` ("transactions") — `TransactionListScreen`
3. **Accounts** -> `Screen.Accounts` ("accounts") — `AccountListScreen`
4. **Reports** -> `Screen.Reports` ("reports") — `ReportsScreen`
5. **More** -> `Screen.More` ("more") — `MoreMenuScreen`

The bottom bar is hidden on these routes (per `AppNavigation.kt`): `transaction/{id}`, `account/{id}`, `invoice/{id}`, `bill/{id}`, `customer/{id}`, `vendor/{id}`, `ai_chat`, `subscription_paywall`.

---

## More Menu (`features/more/MoreMenuScreen.kt`)

Sectioned list. Section -> rows (label -> route):

**Finance**
- Cash Flow -> `cash_flow` (alias of `Screen.Mandates` -> `CashFlowScreen`)
- Invoices -> `invoices` -> `InvoiceListScreen`
- Purchases -> `bills` -> `PurchaseListScreen`
- Categories -> `categories` -> `CategoryListScreen`

**People**
- Customers -> `customers` -> `CustomerListScreen`
- Vendors -> `vendors` -> `VendorListScreen`

**Data**
- Reconciliation -> `reconciliation` (alias) -> `ReconciliationScreen`
- Email Sync -> `email_sync` -> `EmailSyncScreen`
- SMS Sync -> `sms_sync` -> placeholder ("SMS Sync — Coming Soon")
- Records -> `records` -> `RecordsScreen`
- Past Insights -> `past_insights` -> `PastInsightsScreen`

**Tools**
- AI Chat -> `ai_chat` -> `AIChatScreen`
- Feature Requests -> `feature_requests` -> `FeatureRequestsScreen`
- Support -> `support` -> `SupportScreen`

**Account**
- Settings -> `settings` -> `SettingsScreen`
- Billing -> `billing` -> `BillingScreen`

Routes referenced from nav graph but NOT shown in MoreMenuScreen: `Screen.PaymentPlans` (`payment_plans`), `Screen.TaxSummary` (`tax_summary`), `Screen.Statements` (`statements`), `Screen.Subscription` (`subscription`), `Screen.SubscriptionPaywall` (`subscription_paywall`), `Screen.Profile` (`profile`).

---

## Modal Flows / Bottom Sheets / Full-screen Routes

- **Subscription paywall** — full-screen route `subscription_paywall` (`SubscriptionPaywallScreen`); also reachable via `subscription`. Bottom bar hidden.
- **AI Chat** — full-screen route `ai_chat`. Bottom bar hidden.
- **All detail screens** — `transaction/{id}`, `account/{id}`, `invoice/{id}`, `bill/{id}`, `customer/{id}`, `vendor/{id}`, `past_insight/{id}`, `record_preview/{id}`, `statement_detail/{id}`, `pending_review` — bottom bar hidden for the first six only.
- **Bottom sheets (`ModalBottomSheet`):** `TransactionFormScreen`, `AccountFormScreen`, `MonthlyCalendarSheet` (cash flow drill-down), `CashFlowDrillDownSheet`, `ReceiptUploadSheet` (records), `StatementUploadSheet` (reconciliation), `UnlockSheet` and `BulkCategorizeSheet` (reconciliation), `EditTransactionSheet` and `ViewSourceSheet` (email sync), and the create flow inside `PastInsightsScreen`.

---

## Screens (alphabetical by feature folder)

### features/accounts

#### AccountListScreen
- Path: `features/accounts/AccountListScreen.kt`
- Purpose: Displays the user's financial accounts (bank, credit card, cash, demat, loan, etc.) with balances; entry point to add and manage accounts.
- Navigated from: Bottom nav "Accounts" tab.
- Presents: `AccountFormScreen` (modal bottom sheet via `viewModel.showForm()`), navigates to `AccountDetailScreen` on tap, navigates to `SubTypeManagerScreen` via the gear icon.
- Interactive controls: Settings/sub-types `IconButton` (top bar), `+` add `IconButton` (top bar), FAB `+` "Add Account", row click -> account detail, error `ErrorBanner` dismiss.
- API endpoints called (via `AccountRepository`): `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/{id}`, `DELETE /api/accounts/{id}`.
- States: empty (`EmptyStateView` with "Add Account" CTA), loading (`LoadingView`), error (`ErrorBanner`).

#### AccountDetailScreen
- Path: `features/accounts/AccountDetailScreen.kt`
- Purpose: Shows a single account's details, balance, account number / broker / sub-type metadata, and account-scoped transaction history; supports inline balance edit and amortization view for loans.
- Navigated from: `AccountListScreen`, `DashboardScreen` (account card click).
- Presents: Inline edit form (no separate sheet), `AccountFormScreen` (via edit icon), `DematUploadScreen` for demat sub-type accounts, `ConfirmDialog` for delete.
- Interactive controls: Back, edit `IconButton`, balance edit / save / cancel buttons, `OutlinedTextField` for new balance, recalculate button (calls `recalculateAccount`), filter chips for txn list, transaction row click.
- API endpoints (via `AccountRepository`): `GET /api/accounts/{id}`, `PUT /api/accounts/{id}`, `POST /api/accounts/{id}/recalculate`, `GET /api/accounts/{id}/amortization`, `GET /api/accounts/{id}/transactions`, `GET /api/accounts/{id}/od-interest`.
- States: loading (`LoadingView`), error (`ErrorBanner`).

#### AccountFormScreen
- Path: `features/accounts/AccountFormScreen.kt`
- Purpose: `ModalBottomSheet` form to create or edit an account (name, sub-type, currency, account number, description, broker for demat).
- Navigated from: `AccountListScreen`, `AccountDetailScreen` (as bottom sheet).
- Presents: Sub-type dropdown (uses sub-types loaded by `AccountsViewModel`), currency dropdown.
- Interactive controls: Close `IconButton`, Save `TextButton` (gated by `isFormValid` = name not empty), name `OutlinedTextField`, sub-type dropdown, account-number / description / broker text fields, currency picker. Validation: shows error if name empty.
- API endpoints: `POST /api/accounts` / `PUT /api/accounts/{id}` (via parent VM).
- States: validation error inline, no separate loading.

#### DematUploadScreen
- Path: `features/accounts/DematUploadScreen.kt`
- Purpose: Lists demat statements (pending and historical) for a demat account; lets user upload a new statement and approve/reject pending ones.
- Navigated from: `AccountDetailScreen` (when account sub-type is demat).
- Presents: `ConfirmDialog` for approve/reject confirmation.
- Interactive controls: Back, upload card, per-row Approve / Reject `IconButton`s.
- API endpoints (via `AccountRepository`): `POST /api/demat/upload-statement`, `GET /api/demat/statements/{accountId}`, `POST /api/demat/approve-statement/{id}`, `POST /api/demat/reject-statement/{id}`.
- States: loading, empty.

#### SubTypeManagerScreen
- Path: `features/accounts/SubTypeManagerScreen.kt`
- Purpose: CRUD for user-defined account sub-types (e.g. "HDFC Savings").
- Navigated from: `AccountListScreen` (gear icon).
- Presents: `ConfirmDialog` for delete.
- Interactive controls: Back, search field, new-name `OutlinedTextField`, add `IconButton` (gated by non-empty), per-row inline edit / save / cancel / delete.
- API endpoints (via `AccountRepository`): `GET /api/account-sub-types`, `POST /api/account-sub-types`, `PUT /api/account-sub-types/{id}`, `DELETE /api/account-sub-types/{id}`.
- States: loading, empty (filtered), error banner.

### features/aichat

#### AIChatScreen
- Path: `features/aichat/AIChatScreen.kt`
- Purpose: Conversational AI assistant — user sends text or voice; assistant replies in chat bubbles (`ChatBubble`).
- Navigated from: `DashboardScreen` (AI sparkle button), MoreMenu -> AI Chat.
- Presents: Overflow menu (`DropdownMenu`), TTS toggle, optional confirmation `AlertDialog`s.
- Interactive controls: Close `IconButton`, mic `IconButton` (with `RECORD_AUDIO` runtime permission via `rememberLauncherForActivityResult` / `RequestPermission`), voice mute/unmute toggle (`Icons.Filled.VolumeUp` / `VolumeOff`), send button, message `OutlinedTextField`, suggestion chips (`LazyRow`), overflow menu (`Icons.Filled.MoreVert`).
- API endpoints (via `AIChatRepository`): `POST /api/chat`, `GET /api/chat/history`.
- Voice: `AndroidSpeechManager` (uses `android.speech.SpeechRecognizer`); requires `RECORD_AUDIO` permission (declared in manifest).
- States: typing indicator, error.

### features/auth

#### LoginScreen
- Path: `features/auth/LoginScreen.kt`
- Purpose: Sign-in screen; only sign-in method is Google. No Sign-In with Apple. No email/password. DEBUG-only "Dev Login" button.
- Navigated from: Root (shown when `!isAuthenticated` in `AppNavigation`).
- Presents: Animated error banner; uses `LocalUriHandler` to open Terms / Privacy URLs.
- Interactive controls: "Sign in with Google" button (drives `GoogleSignIn` ActivityResult in `MainActivity`), `ClickableText` Terms & Privacy links, error `IconButton` dismiss, **DEBUG-only** "Dev Login (Debug Only)" button gated on `BuildConfig.DEBUG` -> `viewModel.devSignIn()`.
- API endpoints (via `AuthManager` / `AuthViewModel`): `POST /api/auth/google`, `GET /api/auth/session`, `POST /api/auth/dev/simulator-login` (debug only).
- States: loading (`CircularProgressIndicator`), error banner.
- DEBUG / platform gating: dev-login button hidden in release.

### features/billing

#### BillingScreen
- Path: `features/billing/BillingScreen.kt`
- Purpose: Subscription management — current status, plan list, promo-code entry, link to payment history, cancel button.
- Navigated from: MoreMenu -> Billing.
- Presents: Error `AlertDialog`, cancel-confirmation `AlertDialog`, navigates to `PaymentHistoryScreen`.
- Interactive controls: Back, plan cards (selectable), promo `OutlinedTextField` + Validate / Activate `Button`s, Cancel-subscription button, "Payment History" navigation row.
- API endpoints (via `BillingRepository`): `GET /api/payment-plans`, `GET /api/subscription/status`. `POST /api/subscription/verify` is declared but invoked indirectly via `BillingViewModel`. Promo validate / activate / cancel are STUBBED in repository (return hard-coded "not yet available on Android").
- States: loading, error.

#### PaymentHistoryScreen
- Path: `features/billing/PaymentHistoryScreen.kt`
- Purpose: List of past `PaymentOrder`s. Currently fed an empty list (`getHistory()` returns empty in repository).
- Navigated from: `BillingScreen`.
- Interactive controls: Back; rows are display-only.
- API endpoints: none directly — relies on data already in `BillingViewModel.uiState.paymentHistory` (currently always empty).
- States: empty.

### features/cashflow

#### CashFlowScreen
- Path: `features/cashflow/CashFlowScreen.kt`
- Purpose: Forward-looking cash-flow projection — multi-month chart, drill-downs by income/expense/OD-interest/EMI, recurring item list.
- Navigated from: MoreMenu -> Cash Flow (and Dashboard projection card via `Screen.Mandates`).
- Presents: `MonthlyCalendarSheet` (modal), `CashFlowDrillDownSheet` (modal), error `ErrorBanner`.
- Interactive controls: Top bar, "Next month" button (opens calendar sheet), drill-down buttons (4 categories), legend, recurring items list.
- API endpoints (via `CashFlowRepository`): `GET /api/cashflow/projection`, `GET /api/cashflow/history`, `GET /api/mandates/list`, `GET /api/mandates/upcoming`, `POST /api/mandates/create`, `PATCH /api/mandates/{id}`, `DELETE /api/mandates/{id}/delete`, `POST /api/mandates/detect`, `GET /api/recurring/list`, `POST /api/transactions/{id}/toggle-recurring`.
- States: loading, error banner, empty (no projection months / no recurring items).

#### MonthlyCalendarSheet (`features/cashflow/MonthlyCalendarSheet.kt`)
- A `ModalBottomSheet` showing a per-day calendar of expected inflows/outflows for a selected month. Read-only.

### features/categories

#### CategoryListScreen
- Path: `features/categories/CategoryListScreen.kt`
- Purpose: Hierarchical category tree (parent + children), tabs for Income / Expense / Transfer types, add / edit / delete categories.
- Navigated from: MoreMenu -> Categories.
- Presents: `CategoryFormScreen` (likely as inline form / sheet via VM), error `AlertDialog`.
- Interactive controls: Top bar `+` add `IconButton`, FAB `+`, type-tab row, expand/collapse rows, add-child / edit / delete per-row `IconButton`s.
- API endpoints (via `CategoryRepository`): `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/{id}`, `DELETE /api/categories/{id}`, `GET /api/categories/defaults`, `POST /api/categories/merge`.
- States: empty, loading, error dialog.

#### CategoryFormScreen
- Path: `features/categories/CategoryFormScreen.kt`
- Purpose: Form to add or edit a category (name, type, icon, parent).
- Navigated from: invoked from `CategoryListScreen` via `CategoriesViewModel` (uses VM-controlled visibility).
- Interactive controls: name field, type selector, parent dropdown, save / cancel buttons.

### features/customers

#### CustomerListScreen
- Path: `features/customers/CustomerListScreen.kt`
- Purpose: Searchable list of customers; tap to view detail, FAB to create.
- Navigated from: MoreMenu -> Customers.
- Presents: navigates to `CustomerDetailScreen`; opens `CustomerFormScreen` (via VM).
- Interactive controls: Top bar, FAB `+`, search text, row click.
- API endpoints (via `CustomerRepository`): `GET /api/customers`.
- States: empty (with "Add Customer" CTA), loading.

#### CustomerDetailScreen
- Path: `features/customers/CustomerDetailScreen.kt`
- Purpose: Customer profile + outstanding balances + that customer's invoices.
- Navigated from: `CustomerListScreen`.
- Interactive controls: Back, edit, delete (via VM), invoice row click.
- API endpoints: `GET /api/customers/{id}`, `DELETE /api/customers/{id}`, `GET /api/invoices?customer_id=...`.

#### CustomerFormScreen
- Path: `features/customers/CustomerFormScreen.kt`
- Purpose: Add/edit customer — name, email, phone, GSTIN, billing address.
- API endpoints: `POST /api/customers`, `PUT /api/customers/{id}`.

### features/dashboard

#### DashboardScreen
- Path: `features/dashboard/DashboardScreen.kt`
- Purpose: Home tab — net worth, account cards (horizontal), recent transactions, pending review count, AI chat shortcut, cash-flow projection card.
- Navigated from: Bottom nav (root start destination).
- Presents: navigates to `AccountDetail`, `TransactionDetail`, `Transactions` (new), `AiChat`, `Mandates` (cash-flow projection).
- Interactive controls: AI sparkle `Icons.Filled.AutoAwesome` icon, `LargeTopAppBar` collapsing scroll, account cards (clickable), txn rows, FAB `+` (`onNewTransactionClick`), expandable sections (rotating chevron), pending-review banner.
- API endpoints (via `DashboardRepository`): `GET /api/dashboard/summary`, `GET /api/email/pending-review` (count), `GET /api/cashflow/projection`.
- States: loading (`LoadingView` "Loading your dashboard..."), error banner.

### features/emailsync

#### EmailSyncScreen
- Path: `features/emailsync/EmailSyncScreen.kt`
- Purpose: Connect/disconnect Gmail and Outlook accounts, kick off sync, view sync stats, navigate to pending review.
- Navigated from: MoreMenu -> Email Sync, Dashboard pending-review banner (indirect).
- Presents: navigates to `PendingReviewScreen`; modal sheets for editing transactions and viewing email source within `PendingReviewScreen` (`EditTransactionSheet`, `ViewSourceSheet`).
- Interactive controls: Connect Gmail `Button`, Connect Outlook `Button`, per-account disconnect / sync-now / retry-pending buttons, error banner dismiss.
- API endpoints (via `EmailSyncRepository`): `GET /api/email/gmail/connect`, `GET /api/email/gmail/status`, `POST /api/email/gmail/disconnect`, `GET /api/email/outlook/connect`, `GET /api/email/outlook/status`, `POST /api/email/outlook/disconnect`, `POST /api/email/start-sync`, `POST /api/email/retry-pending`, `GET /api/email/sync-stats`, `GET /api/sms/stats`.
- OAuth: uses an external `RedirectUriReceiverActivity` (declared in manifest) with scheme `com.spentyai.app://oauth2redirect`.
- States: loading (`LoadingView` "Loading sync status..."), error banner, empty (no accounts connected).

#### PendingReviewScreen
- Path: `features/emailsync/EmailSyncScreen.kt` (line 764) — declared in same file.
- Purpose: List of email-derived "pending review" transactions awaiting user approve/reject; supports edit, bulk approve/reject, view raw source.
- Navigated from: `EmailSyncScreen` -> "Pending Review" link.
- Presents: `EditTransactionSheet` (`ModalBottomSheet`), `ViewSourceSheet` (`ModalBottomSheet`).
- Interactive controls: Back, multi-select checkboxes, bulk-approve / bulk-reject buttons, per-row approve / reject / edit / view-source.
- API endpoints (via `EmailSyncRepository`): `GET /api/email/pending-review`, `POST /api/transactions/{id}/approve`, `POST /api/transactions/{id}/reject`, `POST /api/transactions/bulk-approve`, `POST /api/transactions/bulk-reject`, `PATCH /api/transactions/{id}`, `GET /api/email/source/{id}`, `GET /api/accounts`, `GET /api/categories`.

### features/featurerequests

#### FeatureRequestsScreen
- Path: `features/featurerequests/FeatureRequestsScreen.kt`
- Purpose: List of in-app feature requests with vote counts.
- Navigated from: MoreMenu -> Feature Requests.
- Presents: navigates to `FeatureRequestFormScreen`, error `AlertDialog`.
- Interactive controls: Back, top-bar `+` add, FAB `+`, per-row vote button.
- API endpoints (via `FeatureRequestsRepository`): `GET /api/feature-requests`, `POST /api/feature-requests/{id}/vote`.
- States: empty, loading.

#### FeatureRequestFormScreen
- Path: `features/featurerequests/FeatureRequestFormScreen.kt`
- Purpose: Submit a new feature request (title, description, category).
- API endpoints: `POST /api/feature-requests`.

### features/invoices

#### InvoiceListScreen
- Path: `features/invoices/InvoiceListScreen.kt`
- Purpose: All invoices with status filter, debtors summary, aging buckets; create / preview / record-payment entry points.
- Navigated from: MoreMenu -> Invoices.
- Presents: `InvoiceFormScreen` (full screen), `InvoicePreviewScreen`, `RecordPaymentScreen` (handled internally by VM).
- Interactive controls: Top bar, FAB `+`, status filter chips, row click -> preview.
- API endpoints (via `InvoiceRepository`): `GET /api/invoices`, `GET /api/customers`, `GET /api/accounts`.
- States: loading, empty (with "Create Invoice" CTA).

#### InvoicePreviewScreen
- Path: `features/invoices/InvoicePreviewScreen.kt`
- Purpose: Read-only invoice preview with line items, totals, status, send / mark-paid actions.
- Navigated from: `InvoiceListScreen`, deep-link route `invoice/{id}`.
- API endpoints: `GET /api/invoices/{id}`, `POST /api/invoices/{id}/send`, `POST /api/invoices/{id}/mark-paid`, `DELETE /api/invoices/{id}`.

#### InvoiceFormScreen
- Path: `features/invoices/InvoiceFormScreen.kt`
- Purpose: Create/edit invoice — customer, issue date, due date, line items, taxes, notes.
- Presents: `DatePickerDialog` for issue / due dates.
- Interactive controls: Save `TextButton`, customer picker, dates, add/remove line item buttons.
- API endpoints: `POST /api/invoices`, `PUT /api/invoices/{id}`.

#### RecordPaymentScreen
- Path: `features/invoices/RecordPaymentScreen.kt`
- Purpose: Record a payment against an invoice (amount, account, date).
- API endpoints: `POST /api/invoices/{id}/mark-paid`.

### features/more

#### MoreMenuScreen
See "More Menu" section above.

### features/onboarding

#### SubscriptionPaywallScreen
- Path: `features/onboarding/SubscriptionPaywallScreen.kt`
- Purpose: Subscription paywall — pick a plan and purchase via Google Play Billing.
- Navigated from: route `subscription_paywall` and `subscription`. (No automatic gating call site found in nav graph — currently appears to be a manually-navigated route.)
- Presents: error `AlertDialog`, promo expandable section.
- Interactive controls: Close `IconButton`, plan cards (selectable; default `spenty_yearly`), Subscribe button (calls `BillingViewModel.purchaseSubscription` -> launches Play Billing flow), promo `OutlinedTextField` + Validate / Activate buttons (currently stubbed in repo).
- API endpoints: `GET /api/payment-plans`, `GET /api/subscription/status`, `POST /api/subscription/verify`. **Google Play Billing is real** (see Cross-Cutting summary) — purchases are launched via `BillingClient.launchBillingFlow` and acknowledged via `BillingClient.acknowledgePurchase`.
- States: loading, error, "subscribed" auto-dismiss.

### features/pastinsights

#### PastInsightsScreen
- Path: `features/pastinsights/PastInsightsScreen.kt`
- Purpose: List of past tax / insight summaries; create new via bottom sheet.
- Navigated from: MoreMenu -> Past Insights, also `Screen.TaxSummary` route.
- Presents: `ModalBottomSheet` create form, error `AlertDialog`, navigates to `PastInsightDetailScreen`.
- Interactive controls: Back, top-bar `+`, FAB `+`, row click.
- API endpoints (via `PastInsightsRepository`): `GET /api/reports/tax-summary?year=...`.
- States: loading, empty, error.

#### PastInsightDetailScreen
- Path: `features/pastinsights/PastInsightDetailScreen.kt`
- Purpose: Detail view of a single insight / tax summary.
- API endpoints: same `getTaxSummary` call.

### features/paymentplans

#### PaymentPlansScreen
- Path: `features/paymentplans/PaymentPlansScreen.kt`
- Purpose: List of subscription / payment plans (read-mostly).
- Navigated from: nav route `payment_plans` (not currently linked from MoreMenu).
- API endpoints (via `PaymentPlansRepository`): `GET /api/payment-plans`.
- States: loading, empty.

### features/purchases

#### PurchaseListScreen
- Path: `features/purchases/PurchaseListScreen.kt`
- Purpose: All bills (purchases) with status filter; create / preview / record-payment / upload bill.
- Navigated from: MoreMenu -> Purchases.
- Presents: `PurchaseFormScreen`, `PurchasePreviewScreen`, `RecordBillPaymentScreen`, `BillUploadScreen` (via internal nav).
- Interactive controls: Top bar upload `IconButton`, FAB `+`, status filter chips.
- API endpoints (via `PurchaseRepository`): `GET /api/bills`, `GET /api/vendors`, `GET /api/accounts`.
- States: loading, empty.

#### PurchasePreviewScreen
- Path: `features/purchases/PurchasePreviewScreen.kt`
- API endpoints: `GET /api/bills/{id}`, `POST /api/bills/{id}/mark-paid`, `DELETE /api/bills/{id}`.

#### PurchaseFormScreen
- Path: `features/purchases/PurchaseFormScreen.kt`
- Purpose: Create/edit a bill (vendor, dates, line items, notes).
- API endpoints: `POST /api/bills`, `PUT /api/bills/{id}`.

#### RecordBillPaymentScreen
- Path: `features/purchases/RecordBillPaymentScreen.kt`
- Purpose: Record a payment against a bill.
- API endpoints: `POST /api/bills/{id}/mark-paid`.

#### BillUploadScreen
- Path: `features/purchases/BillUploadScreen.kt`
- Purpose: Upload a bill (PDF / image) for OCR / parsing.
- Permissions: relies on `CAMERA` / `READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` (declared in manifest).

### features/reconciliation

#### ReconciliationScreen
- Path: `features/reconciliation/ReconciliationScreen.kt`
- Purpose: Bank-statement reconciliation — list of uploaded statements, upload new, navigate to detail.
- Navigated from: MoreMenu -> Reconciliation, also `statements` route.
- Presents: `StatementUploadSheet` (`ModalBottomSheet`), delete-confirm `AlertDialog`.
- Interactive controls: Top-bar upload `IconButton`, statement-row click, delete.
- API endpoints (via `ReconciliationRepository`): `GET /api/statements/list`, `DELETE /api/statements/{id}/delete`.
- States: loading, empty (with upload CTA).

#### StatementDetailScreen
- Path: `features/reconciliation/ReconciliationScreen.kt` (line 219, same file).
- Purpose: Per-statement reconciliation workspace — review entries, edit, bulk-categorize, run reconcile, add missing, reaudit, unlock, approve / reject.
- Navigated from: `ReconciliationScreen`.
- Presents: `UnlockSheet`, `BulkCategorizeSheet`.
- Interactive controls: Back, action buttons (reconcile, reaudit, unlock, approve, reject), per-entry edit, bulk-categorize.
- API endpoints (via `ReconciliationRepository`): `GET /api/statements/{id}/detail`, `GET /api/statements/{id}/entries`, `PATCH /api/statements/{statementId}/entries/{index}`, `POST /api/statements/{id}/bulk-categorize`, `POST /api/statements/{id}/reconcile`, `POST /api/statements/{id}/add-missing`, `POST /api/statements/{id}/reaudit`, `POST /api/statements/{id}/unlock`, `POST /api/statements/{id}/approve`, `POST /api/statements/{id}/reject`, plus `GET /api/accounts`, `GET /api/accounts/sub-types`, `GET /api/categories`.
- States: loading, error.

### features/records

#### RecordsScreen
- Path: `features/records/RecordsScreen.kt`
- Purpose: Combined view of records + receipts — search, date filter, amount filter, list of email/receipt records and tap-through preview.
- Navigated from: MoreMenu -> Records.
- Presents: `ReceiptUploadSheet` (`ModalBottomSheet`), `DateFilterDialog`, `AmountFilterDialog`, navigates to `record_preview/{id}`.
- Interactive controls: Back, top-bar upload `IconButton`, search field with clear, date / amount filter chips, row click.
- API endpoints (via `RecordsRepository`): `GET /api/records/list`, `GET /api/records/search`, `GET /api/records/{id}/preview`, `GET /api/records/by-transaction/{id}`, `DELETE /api/records/{id}`, `GET /api/records/{id}/download-eml`, `GET /api/records/{id}/attachment/{index}`, `POST /api/records/download-zip`, `GET /api/receipts`, `GET /api/receipts/{id}`, `DELETE /api/receipts/{id}`, `GET /api/receipts/{id}/download`, `POST /api/receipts/{id}/parse`, `POST /api/receipts/{id}/link`, `GET /api/receipts/by-transaction/{id}`.
- States: loading, empty, error.

#### RecordPreviewScreen
- Path: `features/records/RecordsScreen.kt` (line 754, same file).
- Purpose: Preview one record — email body / receipt image, attachments, link-to-transaction action, download.
- Navigated from: `RecordsScreen`.
- API endpoints: `GET /api/records/{id}/preview`, attachment / EML downloads, `POST /api/receipts/{id}/link`.

### features/reports

#### ReportsScreen
- Path: `features/reports/ReportsScreen.kt`
- Purpose: Period-based financial reports — income/expense summary, category breakdown (donut), period chart; CSV / PDF export.
- Navigated from: Bottom nav "Reports".
- Presents: `DonutChartView`, `PeriodChartView` (both in same package), error `AlertDialog`.
- Interactive controls: Date-range preset chips, refresh `IconButton`, expandable category sections.
- API endpoints (via `ReportsRepository`): `GET /api/reports/summary`, `GET /api/reports/by-period`, `GET /api/reports/by-category`, `GET /api/reports/income-expense`, `GET /api/reports/export/csv`, `GET /api/reports/export/pdf`.
- States: loading, error dialog.

### features/settings

#### SettingsScreen
- Path: `features/settings/SettingsScreen.kt`
- Purpose: Top-level settings — Business Profile, Currency & Locale, Logo / Signature uploads, Sign Out, Reset Data, Delete Account.
- Navigated from: MoreMenu -> Settings.
- Presents: many `AlertDialog`s — sign-out confirm, delete-account confirm, **3-step reset flow** (warning -> "type RESET" input -> success), error.
- Interactive controls (settings rows): "Business Profile" nav row, "Currency & Locale" nav row, Upload Logo placeholder, Upload Signature placeholder, "Sign Out" row, "Reset Data" row (orange), "Delete Account" row (red).
- API endpoints (via `SettingsRepository`): `GET /api/settings`, `PUT /api/settings`. Sign-out / delete-account go through `AuthManager` (`POST /api/auth/logout`, `DELETE /api/auth/account`).
- States: loading.

#### BusinessProfileScreen
- Path: `features/settings/BusinessProfileScreen.kt`
- Purpose: Business identity — firm name, GSTIN, PAN, state, country, address. Used by both `Screen.BusinessProfile` and `Screen.Profile` routes (same composable).
- Interactive controls: Back, Save `TextButton`, multiple `OutlinedTextField`s (`IconTextField` helper).
- API endpoints: `PUT /api/settings`.

#### CurrencySettingsScreen
- Path: `features/settings/CurrencySettingsScreen.kt`
- Purpose: Pick base currency, date format. Currency list loaded from settings response.
- Interactive controls: Back, Save, currency selector.
- API endpoints: `GET /api/settings`, `PUT /api/settings`.
- States: shows "Loading options..." while currency list empty.

### features/support

#### SupportScreen
- Path: `features/support/SupportScreen.kt`
- Purpose: Submit a support ticket (subject, message); shows success / error dialogs.
- Navigated from: MoreMenu -> Support.
- Interactive controls: Back, subject `OutlinedTextField`, message `OutlinedTextField`, Submit `Button`.
- API endpoints (via `SupportRepository`): `POST /api/support/tickets`.
- States: error / success dialogs.

### features/transactions

#### TransactionListScreen
- Path: `features/transactions/TransactionListScreen.kt`
- Purpose: All transactions with view-mode toggle (LIST / LEDGER), search, filter by type / account / date, multi-select with bulk-delete.
- Navigated from: Bottom nav "Transactions".
- Presents: `TransactionFormScreen` (`ModalBottomSheet`), date-filter dialog, delete `ConfirmDialog`, error `AlertDialog`, ledger sub-view (`TransactionLedgerScreen` for ledger mode).
- Interactive controls: Top-bar `+` add, "Select All" / "Cancel" `TextButton`s in selection mode, FAB `+`, search bar, view-mode toggle, type filter chips, account filter chips, date-filter button, bulk-action bar (delete), per-row click + long-press to enter selection mode (uses `combinedClickable`).
- API endpoints (via `TransactionRepository`): `GET /api/transactions`, `GET /api/transactions/search`, `GET /api/transactions/pending`, `POST /api/transactions`, `PUT /api/transactions/{id}`, `DELETE /api/transactions/{id}`, `POST /api/transactions/{id}/approve`, `POST /api/transactions/{id}/reject`, `POST /api/transactions/bulk-approve`, `POST /api/transactions/bulk-reject`, `POST /api/transactions/bulk-delete`, `POST /api/transactions/{id}/toggle-recurring`, plus `GET /api/accounts`, `GET /api/categories`.
- States: loading (`LoadingView`), empty (`EmptyStateView` with "Add Transaction" CTA), error (`AlertDialog`).

#### TransactionLedgerScreen
- Path: `features/transactions/TransactionLedgerScreen.kt`
- Purpose: Running-balance ledger view (account-scoped) — shown when list view-mode toggled to LEDGER.
- Navigated from: embedded inside `TransactionListScreen`.
- Interactive controls: account filter chip, infinite scroll (`isLoadingMore` flag visible).
- States: loading-more indicator.

#### TransactionDetailScreen
- Path: `features/transactions/TransactionDetailScreen.kt`
- Purpose: Read-only transaction details with edit / delete / approve / reject actions; status badge.
- Navigated from: `TransactionListScreen`, `DashboardScreen`.
- Presents: `ConfirmDialog` for delete, error `AlertDialog`.
- Interactive controls: Close `IconButton`, edit -> back to `Transactions`, delete -> confirm.
- API endpoints (uses `apiClient` directly): `GET /api/transactions/{id}`, `DELETE /api/transactions/{id}`.
- States: loading.

#### TransactionFormScreen
- Path: `features/transactions/TransactionFormScreen.kt`
- Purpose: `ModalBottomSheet` create/edit transaction — type (income / expense / transfer), amount, account, category, sub-category, date, description, payment method.
- Navigated from: opened by `TransactionsViewModel.beginCreate()` from list / dashboard FAB.
- Interactive controls: Cancel / Save `TextButton`s; amount field with regex validation `^\d*\.?\d{0,2}$`; transfer toggle (changes destination-account picker on); account picker, category picker, sub-category picker, date field, description, payment-method dropdown; inline error message.
- API endpoints: `POST /api/transactions`, `PUT /api/transactions/{id}`, `POST /api/transactions/{id}/categorize`.
- States: validation errors inline.

### features/vendors

#### VendorListScreen
- Path: `features/vendors/VendorListScreen.kt`
- Purpose: Searchable vendor list, mirror of `CustomerListScreen`.
- API endpoints (via `VendorRepository`): `GET /api/vendors`.

#### VendorDetailScreen
- Path: `features/vendors/VendorDetailScreen.kt`
- API endpoints: `GET /api/vendors/{id}`, `DELETE /api/vendors/{id}`, `GET /api/bills?vendor_id=...`.

#### VendorFormScreen
- Path: `features/vendors/VendorFormScreen.kt`
- API endpoints: `POST /api/vendors`, `PUT /api/vendors/{id}`.

---

## Cross-cutting features

### Authentication
- **Google Sign-In:** real, wired via `com.google.android.gms:play-services-auth:21.0.0`. ID token captured in `MainActivity` and exchanged at `POST /api/auth/google` by `AuthManager`.
- **Sign in with Apple:** **NOT IMPLEMENTED on Android.** `ApiEndpoints.appleSignIn` is declared but no caller anywhere in the Android codebase.
- **Demo / dev account:** `LoginScreen` shows a "Dev Login (Debug Only)" button gated on `BuildConfig.DEBUG`. It calls `AuthViewModel.devSignIn()` which hits `POST /api/auth/dev/simulator-login`. Hidden in release builds.
- **Sign-out:** `SettingsScreen` -> confirm dialog -> `AuthManager.logout()` -> `POST /api/auth/logout`.
- **Delete account:** `SettingsScreen` -> confirm dialog -> `DELETE /api/auth/account`.

### In-App Purchases / Paywall
- **Google Play Billing IS WIRED.** Dependency `com.android.billingclient:billing-ktx:7.0.0` is in `build.gradle.kts`. `BillingViewModel` (in `features/billing/BillingViewModel.kt`) builds a real `BillingClient`, connects on init, queries `ProductDetails` for SKUs `spenty_monthly` and `spenty_yearly` (subscription type), launches `BillingFlowParams` via `billingClient.launchBillingFlow(activity, ...)`, restores prior purchases via `queryPurchasesAsync`, and acknowledges purchases with `AcknowledgePurchaseParams`. Pending and user-cancelled flows are handled.
- **What's stubbed, NOT the billing client:**
  - `BillingRepository.validatePromo` / `activatePromo` return hard-coded "not yet available on Android" responses.
  - `BillingRepository.getHistory` returns `ApiResult.Success(emptyList())` (no real history endpoint hit).
  - `BillingRepository.cancelSubscription` returns `ApiResult.Success(Unit)` without calling any endpoint.
  - **Backend purchase verification is NOT called.** `ApiEndpoints.verifySubscription` (`POST /api/subscription/verify`) is declared but `BillingViewModel.handlePurchase` only acknowledges the purchase locally and refreshes status — there is no server-side receipt verification call after a successful purchase. This is a parity gap with iOS.
- **SKUs in the SubscriptionPaywallScreen UI:** `BillingRepository.fallbackPlans` lists Monthly / Quarterly / Yearly / Lifetime with INR pricing and product IDs `com.spentyai.monthly`, `com.spentyai.quarterly`, `com.spentyai.yearly`, `com.spentyai.lifetime` — but `BillingViewModel.queryProductDetails` only queries `spenty_monthly` and `spenty_yearly`. SKU-naming mismatch is a likely follow-up.

### Email Sync
- **Gmail OAuth:** real (via web OAuth — server returns auth URL from `GET /api/email/gmail/connect`, redirected back to `com.spentyai.app://oauth2redirect` and caught by `net.openid.appauth.RedirectUriReceiverActivity` declared in manifest).
- **Outlook OAuth:** wired identically (`GET /api/email/outlook/connect`).
- Sync-now / retry-pending / disconnect / per-account stats: all real API calls.

### SMS Sync
- **Not implemented.** `Screen.More` shows an "SMS Sync" row but its route resolves to a `PlaceholderScreen("SMS Sync — Coming Soon")` in `AppNavigation.kt`. No `READ_SMS` permission is declared in the manifest.
- `GET /api/sms/stats` is fetched in `EmailSyncRepository`, but no UI consumes it meaningfully on Android.

### Push notifications (FCM)
- **Not implemented.** No `FirebaseMessaging`, no `firebase-messaging` dependency, no `google-services.json`, no `MessagingService`, no `POST_NOTIFICATIONS` permission.

### Receipt scanning / camera
- `CAMERA`, `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` permissions are declared.
- Receipt and bill upload flows live in `RecordsScreen` (`ReceiptUploadSheet`) and `BillUploadScreen`, plus `DematUploadScreen`. The actual file picker / camera intent code is inside those screens (not deeply audited here — `[needs follow-up]` for which intents are used).

### Voice input (microphone)
- Real on Android.
- `core/services/AndroidSpeechManager.kt` uses Android's `android.speech.SpeechRecognizer`. Requires `RECORD_AUDIO` permission (declared).
- Used by `AIChatScreen` (mic toggle button), with runtime permission requested via `rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission)`.
- TTS: an `Icons.Filled.VolumeUp` / `VolumeOff` toggle exists in `AIChatScreen`; `[needs follow-up]` for which engine speaks responses.

### Help center (in-app)
- **Not present.** No `HelpCenter` / `Help` screen exists in `features/`. The Material `Icons.AutoMirrored.Filled.HelpCenter` icon is used in `MoreMenuScreen` for the "Support" row, which routes to `SupportScreen` (a ticket-submission form, not a docs browser). No web-view help center.

### Settings rows (full enumeration)
From `SettingsScreen`:
- Business -> Business Profile (firm name subtitle)
- Regional -> Currency & Locale (currency / date format subtitle)
- Invoice Customization -> Business Logo upload, Signature upload
- Account -> Sign Out, Reset Data (3-step), Delete Account

### Localization / i18n
- **English only.** `res/values/strings.xml` exists; no `values-*` (locale-qualified) directories are present. All UI strings are hard-coded in Kotlin (e.g. "Loading transactions...", "Add Transaction", "Type RESET to Confirm"). No string-resource extraction.
- iOS app has Hindi / English; Android does not have Hindi.

### DEBUG-only / BuildConfig gating
- `LoginScreen` "Dev Login" button — `if (BuildConfig.DEBUG)` only.
- `core/network/ApiClient.kt` toggles HTTP body-logging based on `BuildConfig.DEBUG`.
- `BuildConfig.API_BASE_URL` = `https://api.spentyai.com` (set in `build.gradle.kts`).
- Debug build keeps `applicationId = com.spentyai.app` (no `.debug` suffix) — required for Google OAuth client registration. Comment in `build.gradle.kts` confirms this.

---

## Build config snapshot (`android-native/app/build.gradle.kts`)

- **applicationId:** `com.spentyai.app`
- **versionCode:** `1`
- **versionName:** `1.0.0` (debug builds get `-debug` suffix)
- **minSdk:** `24` / **targetSdk:** `34` / **compileSdk:** `34`
- **JVM target:** `17`
- **Compose compiler:** `1.5.8`
- **API_BASE_URL:** `https://api.spentyai.com` (BuildConfig)
- **Cleartext traffic:** disabled (`android:usesCleartextTraffic="false"`)

### Signing
- **Debug:** default Android debug keystore (no override).
- **Release:** `signingConfigs.create("release")` reads from environment vars `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` (default `spentyai`), `KEY_PASSWORD`. Wired into `buildTypes.release`.

### Minification / shrinking
- **Release:** `isMinifyEnabled = true`, `isShrinkResources = true`, ProGuard rules at `proguard-android-optimize.txt` + `proguard-rules.pro`.
- **Debug:** `isMinifyEnabled = false`.

### Dependencies of interest
- **Compose BOM:** `androidx.compose:compose-bom:2024.02.00` + Material3 + material-icons-extended.
- **Navigation:** `androidx.navigation:navigation-compose:2.7.7`.
- **Networking:** `retrofit2:retrofit:2.9.0`, `okhttp3:okhttp:4.12.0`, `okhttp3:logging-interceptor:4.12.0`, `kotlinx-serialization-json:1.6.3`, `retrofit2-kotlinx-serialization-converter:1.0.0`.
- **Image loading:** `io.coil-kt:coil-compose:2.5.0`.
- **OAuth (Google Sign-In):** `com.google.android.gms:play-services-auth:21.0.0`.
- **Secure storage:** `androidx.security:security-crypto:1.1.0-alpha06` (encrypted SharedPreferences for token).
- **Billing:** `com.android.billingclient:billing-ktx:7.0.0`.
- **Coroutines:** `kotlinx-coroutines-android:1.8.0`.

### Dependencies that are NOT present (vs typical iOS parity)
- No `firebase-bom`, `firebase-messaging`, `firebase-analytics` — no FCM / Firebase Analytics.
- No `appauth` library dependency (despite `RedirectUriReceiverActivity` being referenced in manifest with `tools:node="replace"` — may rely on the receiver class being provided by the OAuth flow library on the server side, or this is a leftover. `[needs follow-up]`).
- No Sign-in-with-Apple SDK.
- No `mlkit` / camera-x / barcode dependencies — receipt scanning is presumably document-picker-based.
- No analytics SDK (Mixpanel, Amplitude, Segment, etc.).
- No Sentry / Crashlytics / Bugsnag.

### Permissions (from `AndroidManifest.xml`)
- `INTERNET`, `ACCESS_NETWORK_STATE`
- `RECORD_AUDIO` (voice input in AI chat)
- `CAMERA`, `READ_MEDIA_IMAGES` (receipt / bill upload)
- `READ_EXTERNAL_STORAGE` (maxSdkVersion 32)
- `WRITE_EXTERNAL_STORAGE` (maxSdkVersion 28)
- **No `READ_SMS`** -> SMS sync is not implementable on this build.
- **No `POST_NOTIFICATIONS`** -> push notifications not implemented.

---

## Known follow-ups
- Receipt-scanner intent path (camera vs document-picker) was not fully traced: `[needs follow-up]`.
- TTS engine in `AIChatScreen` (the `VolumeUp` toggle) was not traced to a concrete `TextToSpeech` instance: `[needs follow-up]`.
- `RedirectUriReceiverActivity` from `net.openid.appauth` is declared in manifest but no `appauth` dependency is in `build.gradle.kts` — verify how this resolves at build time: `[needs follow-up]`.
- Plan SKU mismatch: `BillingRepository.fallbackPlans` uses `com.spentyai.{monthly,quarterly,yearly,lifetime}` while `BillingViewModel.queryProductDetails` queries `spenty_monthly` / `spenty_yearly`. The actual paywall calls `purchasePlan(productId)` with the fallback IDs, which then look up `productDetailsList` and won't match — likely a real bug worth flagging in parity audit.
- No backend receipt-verification call after a successful Google Play purchase (`POST /api/subscription/verify` is declared but never called) — likely an iOS-parity gap.
