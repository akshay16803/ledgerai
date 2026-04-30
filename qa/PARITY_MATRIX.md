# SpentyAI iOS Android Parity Matrix
Generated: 2026-05-01

Sources:
- iOS inventory: `/sessions/vibrant-elegant-turing/ledgerai/qa/IOS_INVENTORY.md`
- Android inventory: `/sessions/vibrant-elegant-turing/ledgerai/qa/ANDROID_INVENTORY.md`

Status legend:
- MATCH — same screen exists, same functionality, same controls
- DIFFERENT — exists on Android but with a meaningful difference (specifics in Notes)
- MISSING — does not exist on Android at all
- iOS-ONLY-BY-PLATFORM — Apple-platform requirement, expected gap (do not count as defect)
- ANDROID-ONLY-BY-PLATFORM — Google-platform requirement, expected gap

---

## Executive Summary

- Total iOS screens catalogued: ~70 distinct view structs (per IOS_INVENTORY tally)
- Total Android screens catalogued: ~50 composable screens (per ANDROID_INVENTORY tally)
- MATCH rows: 27
- DIFFERENT rows (must reconcile): 28
- MISSING on Android (must build): 16
- iOS-only-by-platform: 2 (Sign in with Apple, Siri Intents/AppShortcuts, plus iPad/Mac Sidebar)
- Android-only-by-platform: 1 (Google Play Billing flow)
- Critical defects on Android: 7 (see CRITICAL DEFECTS section)

Top headline gaps that drive most of the "missing" count: SMS Sync, Mandates UI, Localization (Hindi), Help Center link, Restore Purchases, Lifetime Offer flow, ShareSheet/QuickLook for PDF + EML, swipe actions, pull-to-refresh, list-stats cards (invoices/purchases), in-form camera capture, drill-down sheets on Reports + Dashboard, Onboarding slider, Demo-account button.

---

## Navigation

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `SpentyAIApp.swift` (`@main`) hosting `AppRouter` (`ios/.../SpentyAIApp.swift`) | `MainActivity.kt` + `navigation/AppNavigation.kt` (`android-native/.../navigation/AppNavigation.kt`) | DIFFERENT | Both gate root by auth + onboarding state. **iOS additionally gates on `hasActiveSubscription` and routes to `SubscriptionPaywall` before MainTab; Android does not auto-gate** — user reaches main app then can manually open paywall via Billing. P0. |
| `Navigation/MainTabView.swift` 5-tab bar | `navigation/BottomNavBar.kt` 5-tab bar | MATCH | Same tabs in same order: Dashboard, Transactions, Accounts, Reports, More. |
| `Navigation/SidebarView.swift` (iPad/Mac NavigationSplitView) | — | iOS-ONLY-BY-PLATFORM | Sidebar is the iPadOS/macOS variant. Android phones don't need it; tablet layout is a future project. |
| Deep link `spentyai://nav/<dashboard|transactions|accounts|reports>` (in `MainTabView.onOpenURL`) | OAuth scheme `com.spentyai.app://oauth2redirect` only | MISSING | Android has no equivalent `spentyai://nav/<tab>` handler. Used by simulator automation; needs Android equivalent for QA harness parity. |
| `MoreMenuView` (Finance / People / Obligations / Data / Tools / Account, 20 destinations) | `features/more/MoreMenuScreen.kt` (Finance / People / Data / Tools / Account, ~15 destinations) | DIFFERENT | iOS has separate "Obligations" section containing Mandates. Android has no Mandates row in More menu. Routes that exist in Android nav graph but are unreachable from MoreMenu: `payment_plans`, `tax_summary`, `statements`, `subscription`, `subscription_paywall`, `profile`. |
| Tab-bar hide on detail screens (`NavigationStack` default) | `bottomBar` hidden on `transaction/{id}`, `account/{id}`, `invoice/{id}`, `bill/{id}`, `customer/{id}`, `vendor/{id}`, `ai_chat`, `subscription_paywall` | DIFFERENT | `past_insight/{id}`, `record_preview/{id}`, `statement_detail/{id}`, `pending_review` are NOT in Android's hide list — bottom bar is visible on those detail screens. Minor UX inconsistency. |

---

## Auth

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `Features/Auth/LoginView.swift` (Sign in with Apple + Google + Demo Account + ToS/Privacy) | `features/auth/LoginScreen.kt` (Google + DEBUG-only Dev Login + ToS/Privacy) | DIFFERENT | Android missing Sign in with Apple (platform), Demo Account button (P0), and dev-bypass is hidden in release. |
| Sign in with Apple (`POST /api/auth/apple/mobile`) | — | iOS-ONLY-BY-PLATFORM | Required on iOS by App Store Guideline 4.8; not required on Android. `ApiEndpoints.appleSignIn` declared on Android but unused. |
| Google Sign-In (`POST /api/auth/google/mobile`) | `POST /api/auth/google` via `GoogleSignIn` ActivityResult in `MainActivity` | DIFFERENT | Endpoint paths differ: iOS `/api/auth/google/mobile` vs Android `/api/auth/google`. Verify backend accepts both or align. |
| Demo Account button (`POST /api/auth/demo-login`) | — | MISSING | Required for Google Play store reviewer flow. Android only has DEBUG-only `/api/auth/dev/simulator-login`, hidden in release. |
| Simulator auto-login (DEBUG, `SIMULATOR_AUTOLOGIN` env, `/api/auth/dev/simulator-login`) | DEBUG-only "Dev Login" button (`/api/auth/dev/simulator-login`) | DIFFERENT | iOS auto-runs in simulator; Android requires manual tap. QA-harness diff. |
| `AuthManager` (Keychain + `.userSessionExpired` notification on 401) | `core/auth/AuthManager.kt` (EncryptedSharedPreferences) | MATCH | Both persist token securely, both react to 401 logout. |
| `GET /api/auth/me` | `GET /api/auth/session` | DIFFERENT | Endpoint path differs. Likely same backend route — verify alignment. |
| `POST /api/auth/logout` | `POST /api/auth/logout` | MATCH | |
| `DELETE /api/auth/delete-account` | `DELETE /api/auth/account` | DIFFERENT | Endpoint path differs. |
| `OnboardingSliderView` (8 slides, segmented progress, persisted `spenty_onboarding_slider_seen_v1`) | — | MISSING | No onboarding slider catalogued on Android. First-run UX is unstyled. P0. |
| `SubscriptionPaywall` enforced gate after login | `SubscriptionPaywallScreen` exists but not auto-gated | DIFFERENT | See Billing section. P0. |

---

## Dashboard

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `Features/Dashboard/DashboardView.swift` (1825 LOC) | `features/dashboard/DashboardScreen.kt` | DIFFERENT | Same overall layout (net worth, accounts row, recent txns, pending banner, projection card, FAB) but missing several iOS controls below. |
| Hindi/English toolbar toggle (`lang.toggle()`) | — | MISSING | No language toggle (Hindi not implemented at all — see Localization). |
| AI sparkles toolbar -> `AIChatView` sheet | AI sparkle (`Icons.Filled.AutoAwesome`) -> `ai_chat` route | DIFFERENT | iOS opens AI Chat as a *sheet*. Android opens it as a *full-screen route*. Functional parity, UX differs. |
| 4 stat cards (Net Worth, Total Balance, Income, Expenses) tappable -> drill-down sheets | Net worth card + accounts row visible; drill-downs not confirmed | DIFFERENT | Android does not surface tap-through stat-card drill-downs. |
| Collapsible sections with chevron rotation | "expandable sections (rotating chevron)" | MATCH | |
| `DashboardAccountsListView` (sheet of all accounts) | — | MISSING | No "all accounts list" sheet from Dashboard balance card. |
| `DashboardFilteredTransactionsView` (income/expense filtered list sheet) | — | MISSING | No equivalent on Android. |
| `DashboardAllPendingView` (full pending list sheet) | Pending banner navigates to `PendingReviewScreen` (full-screen route) | DIFFERENT | iOS uses sheet, Android uses route. Acceptable. |
| `PendingTransactionDetailSheet` (per-row pending approval form on dashboard) | Pending row tap -> opens approval flow inside `PendingReviewScreen` | DIFFERENT | iOS allows inline approval directly from Dashboard; Android requires navigating to PendingReview. Minor UX gap. |
| FAB `+` opens new-transaction sheet | FAB `+` opens `TransactionFormScreen` bottom sheet | MATCH | |
| Pull-to-refresh on main scroll | not confirmed in inventory | DIFFERENT | Pull-to-refresh not explicitly listed for DashboardScreen. |

---

## Transactions

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `TransactionListView` | `TransactionListScreen` | DIFFERENT | Most controls match (search, type filter chips, account picker, date range, view-mode toggle, bulk-delete, FAB +). Differences below. |
| Segmented Picker view-mode (List / Ledger) | view-mode toggle (LIST / LEDGER) | MATCH | |
| Search bar (debounced + on-commit) | search bar (debounced) | MATCH | |
| Filter chip bar (All / Income / Expense / Transfer) | type-filter chips | MATCH | |
| Date Range popover with from/to DatePicker + Apply | Date-filter dialog | DIFFERENT | iOS popover, Android dialog. Functionally equivalent. |
| Long-press to enter selection mode + swipe Delete/Edit per row | `combinedClickable` long-press only; **no swipe actions** | DIFFERENT | iOS has both swipe AND long-press; Android only long-press. Swipe-to-delete and swipe-to-edit MISSING on Android. P1. |
| Bulk-bar with Delete + Select All / Cancel | bulk-action bar + Select All / Cancel TextButtons | MATCH | |
| Pagination via `onAppear` of last row -> `loadMore()` | visible in `TransactionLedgerScreen`; main-list pagination not explicitly called out | DIFFERENT | Verify infinite scroll on the main list. |
| `UnifiedTransactionForm` 3 modes (`.create`/`.edit`/`.approve`) with inline-create alerts (new account/category/subcategory), camera capture, recurring section, attachment | `TransactionFormScreen` ModalBottomSheet (create/edit only) | DIFFERENT | Android missing: (a) approve mode (handled separately), (b) inline +New Account / Category / Subcategory, (c) camera capture, (d) PhotosPicker attachment + receipt upload, (e) recurring date field. P0 (inline creation), P1 (camera, recurring). |
| Camera capture via `CameraCaptureView` from form | — | MISSING | Android transaction form has no in-form camera capture. |
| `TransactionDetailView` (source-document expansion via `GET /api/source/{id}`, attachments QuickLook, approve/reject, delete) | `TransactionDetailScreen` (read-only with edit/delete/approve/reject) | DIFFERENT | Android missing source-document expansion and attachment list with download. |
| `TransactionLedgerView` | `TransactionLedgerScreen` | MATCH | |
| Toggle recurring (`POST /api/transactions/{id}/toggle-recurring`) | same endpoint | MATCH | |
| `GET /api/transactions/search?q=&skip=&limit=&status=approved` | `GET /api/transactions/search` (no `status` filter) | DIFFERENT | **Android may surface pending transactions in main lists**, violating [Pending txns excluded from calcs](feedback_pending_transactions.md). P0. |

---

## Accounts

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `AccountListView` (`searchable`, +, pull-to-refresh, swipe Delete + Edit) | `AccountListScreen` (gear + add IconButton + FAB + row click + ErrorBanner) | DIFFERENT | Android missing: search field, swipe actions, pull-to-refresh. |
| `AccountDetailView` (info card + dynamic tabs: Transactions / Amortization / OD Interest / Demat) | `AccountDetailScreen` (detail + amortization + transaction history) | DIFFERENT | Android missing: OD Interest tab with from/to date pickers (endpoint `GET /api/accounts/{id}/od-interest` is wired but UI not exposed); Demat tab is via separate `DematUploadScreen` route, not embedded. iOS surfaces Opening Balance editor with Save & Recalculate inline. |
| `AccountFormView` (full create/edit: name, sub-type picker, account number, opening balance amount + as-of date, broker, description, type picker) | `AccountFormScreen` ModalBottomSheet (name, sub-type, currency, account number, description, broker) | DIFFERENT | Android missing: opening balance amount + as-of date, explicit Type vs Sub-type distinction. |
| `DematUploadView` (upload + approve/reject demat statements) | `DematUploadScreen` | MATCH | Same endpoints, same approve/reject flow. |
| `SubTypeManagerView` (CRUD user-defined sub-types) | `SubTypeManagerScreen` | MATCH | Both have search/add/edit/delete + ConfirmDialog. |

---

## CashFlow

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `CashFlowView` | `CashFlowScreen` | MATCH | Both have 4 drill-down stat cards, Next-month calendar button, recurring list, error banner. |
| `CashFlowDrillDownSheet` (income/expense/odInterest/EMI) | `CashFlowDrillDownSheet` | MATCH | |
| `CashFlowChartView` (24-month line/area, SwiftUI Charts) | not named explicitly; "multi-month chart" referenced | DIFFERENT | iOS has dedicated chart component; Android shape needs visual verification. |
| `MonthlyCalendarView` | `MonthlyCalendarSheet` | MATCH | |
| `MandatesListView` (top-level Obligations entry, Detect-mandates button, swipe Delete/Edit, source-document and edit sheets) | — | MISSING | **No standalone Mandates screen on Android.** Mandate APIs are wired into `CashFlowRepository` (`GET /api/mandates/list`, `POST /api/mandates/create`, etc.) but no UI exposes them. The "Detect Mandates" action has no Android home. P1. |
| `RecurringListView` (toggle recurring per-row) | "recurring items list" inside CashFlowScreen | MATCH | Embedded sub-component on both. |
| `POST /api/mandates/detect` button | — | MISSING | |

---

## Reports

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `ReportsView` | `ReportsScreen` | DIFFERENT | iOS has horizontal preset chips, custom date pickers when preset == .custom, 4 stat-card buttons with drill-downs, donut + period chart, expandable category table, Export CSV + Export PDF, pull-to-refresh, drill-down sheet `ReportTransactionsView`. Android missing: custom date pickers, 4 tappable stat-card drill-downs, drill-down sheet, explicit Export CSV/PDF UI buttons, pull-to-refresh. |
| `ReportTransactionsView` (drill-down sheet on category tap) | — | MISSING | No drill-down sheet on Android. |
| `DonutChartView`, `PeriodChartView` | `DonutChartView`, `PeriodChartView` | MATCH | |
| Export CSV, Export PDF buttons | endpoints in `ReportsRepository`, UI buttons not confirmed | DIFFERENT | `GET /api/reports/export/csv` and `/api/reports/export/pdf` declared but no UI exposure confirmed. |

---

## Customers

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `CustomerListView` (`searchable`, +, pull-to-refresh, NavLink to detail, `onDelete` swipe) | `CustomerListScreen` (search field, FAB +, row click) | DIFFERENT | Android missing swipe-to-delete and pull-to-refresh. |
| `CustomerDetailView` (info + invoices) | `CustomerDetailScreen` (profile + invoices + outstanding) | MATCH | Android additionally calls out outstanding-balances summary. |
| `CustomerFormView` (name/email/phone/address) | `CustomerFormScreen` (name/email/phone/GSTIN/billing address) | DIFFERENT | Android adds GSTIN; iOS doesn't have it on the customer form. Minor diff — Android richer here. |

---

## Vendors

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `VendorListView` (`searchable`, +, NavLink, `onDelete`) | `VendorListScreen` (mirror of CustomerListScreen) | DIFFERENT | Same gaps as Customers — no swipe-to-delete on Android. |
| `VendorDetailView` (info + bills) | `VendorDetailScreen` | MATCH | |
| `VendorFormView` | `VendorFormScreen` | MATCH | |

---

## Invoices

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `InvoiceListView` (stats cards, debtors and aging sections, status filter chips, searchable, pull-to-refresh, swipe Delete/Edit, swipe Mark Paid/Duplicate, status filter pills) | `InvoiceListScreen` (status filter chips, FAB +, row -> preview) | DIFFERENT | Android missing: stats cards (totals/outstanding/aging), debtors and aging sections, search, pull-to-refresh, swipe actions. Endpoints `/api/invoices/{stats,count,debtors,aging,sales-by-customer}` not consumed by `InvoiceRepository`. P1. |
| `InvoiceFormView` (sheet) | `InvoiceFormScreen` (full-screen route) | DIFFERENT | iOS sheet vs Android full-screen. Functional parity OK. |
| `InvoicePreviewView` (PDFKit preview, ShareSheet, edit, mark-paid, delete; `GET /api/invoices/{id}/pdf`) | `InvoicePreviewScreen` (read-only preview, send / mark-paid actions) | DIFFERENT | Android missing PDF preview rendering, ShareSheet, Duplicate, Record Payment from preview. Android additionally has `POST /api/invoices/{id}/send` (email send) which iOS lacks. P1. |
| `RecordPaymentView` (amount, date, account picker, partial/full; `POST /api/invoices/{id}/record-payment`) | `RecordPaymentScreen` (`POST /api/invoices/{id}/mark-paid`) | DIFFERENT | **Endpoint mismatch — iOS records partial payments, Android only marks fully paid.** P0. |
| `POST /api/invoices/{id}/duplicate` | — | MISSING | No "Duplicate Invoice" action on Android. |
| `GET /api/invoices/next-number` | — | MISSING | Auto-numbering not wired on Android. |

---

## Purchases (Bills)

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `PurchaseListView` (stats, creditors, aging, searchable, pull-to-refresh, swipe Delete/Edit, swipe Mark Paid/Duplicate, top toolbar 2 buttons: upload-parse + +) | `PurchaseListScreen` (status filter chips, top-bar upload IconButton, FAB +) | DIFFERENT | Android missing: stats / creditors / aging cards, search, pull-to-refresh, swipe actions, Duplicate. Endpoints `/api/bills/{stats,creditors,aging,purchases-by-vendor}` not in repo. P1. |
| `PurchaseFormView` | `PurchaseFormScreen` | MATCH | |
| `PurchasePreviewView` (PDF preview via `GET /api/bills/{id}/pdf`) | `PurchasePreviewScreen` | DIFFERENT | Android missing PDF render, ShareSheet, Record Payment from preview. P1. |
| `RecordBillPaymentView` (`POST /api/bills/{id}/record-payment`) | `RecordBillPaymentScreen` (`POST /api/bills/{id}/mark-paid`) | DIFFERENT | Same partial-payment endpoint mismatch as Invoices. P0. |
| `BillUploadParserView` (PDF/image, AI-parse via `POST /api/bills/parse-upload`) | `BillUploadScreen` (PDF/image upload) | DIFFERENT | Android upload exists but `POST /api/bills/parse-upload` consumption not confirmed in inventory. Verify; if not called, AI parsing doesn't run. P1. |
| `POST /api/bills/{id}/duplicate` | — | MISSING | |
| `GET /api/bills/next-number` | — | MISSING | |

---

## Records / Receipts

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `RecordsView` (segmented Emails/Receipts tabs, search, date range, amount range, "Download zip", swipe Delete) | `RecordsScreen` (search field, date filter dialog, amount filter dialog, upload IconButton, row click) | DIFFERENT | Android missing: segmented Emails/Receipts tabs (combined view), "Download zip" button (`POST /api/records/download-zip` is wired in repo), swipe-to-delete, pull-to-refresh per tab. P1. |
| `RecordPreviewView` (HTML email view via `WKWebView` `HTMLView`, attachments, share .eml, delete) | `RecordPreviewScreen` (preview email body / receipt image, attachments, link-to-transaction, download) | DIFFERENT | Both render content; verify Android uses real WebView for HTML email rendering. iOS supports share-sheet `.eml` export; Android only "download". Minor. |
| `ReceiptUploadView` (`PhotosPicker`, parse, link-to-transaction picker) | `ReceiptUploadSheet` (ModalBottomSheet) | MATCH | Both upload + parse + link. |

---

## Reconciliation

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `ReconciliationView` (list, +, swipe Delete, processing progress per row, pull-to-refresh) | `ReconciliationScreen` (top-bar upload IconButton, row click, delete via dialog) | DIFFERENT | Android missing swipe-to-delete, pull-to-refresh; processing progress per row not explicit. |
| `StatementUploadView` (sub-type Menu, account Menu, period dates, file picker .pdf/.csv, Upload) | `StatementUploadSheet` (ModalBottomSheet) | MATCH | Verify Android file picker accepts CSV in addition to PDF. |
| `StatementDetailView` (workflow stepper, per-entry category picker, bulk-categorize, Reconcile, Re-audit, Add Missing, Approve, Reject, unlock) | `StatementDetailScreen` (entries, edit, bulk-categorize, reconcile, reaudit, unlock, approve, reject) | MATCH | All major actions present. |
| `BulkCategorizeSheet` | `BulkCategorizeSheet` | MATCH | |
| `UnlockSheet` | `UnlockSheet` | MATCH | |

---

## EmailSync / SMS / OAuth

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `EmailSyncView` (Connect Gmail, Connect Outlook, Add another Gmail, per-account Disconnect with confirm dialog, Retry Failed Emails, sync progress phases, success animated overlay, success toast, pull-to-refresh, polling lifecycle stop on disappear, NavLink to PendingReview) | `EmailSyncScreen` (Connect Gmail, Connect Outlook, per-account disconnect/sync-now/retry-pending, error banner, navigates to PendingReview) | DIFFERENT | Android missing: "Add another Gmail" (multi-account UX), animated connection success overlay, success toast, sync progress phase indicator (idle/syncing/complete/failed), pull-to-refresh, polling lifecycle stop on screen exit, `SyncDatePickerSheet`. P1. |
| Connect URLs `?platform=ios` | platform query absent; endpoint paths differ | DIFFERENT | iOS appends `?platform=ios`. Android calls `GET /api/email/gmail/connect` — endpoint path differs (`/api/email/gmail/connect` vs `/api/gmail/connect`) and platform query absent. P0 backend alignment. |
| `PendingReviewView` (multi-select, bulk approve/reject, per-row approve/reject/edit/view-source, source-content sheet, **inline create-account/category/subcategory alerts**) | `PendingReviewScreen` (multi-select, bulk approve/reject, per-row approve/reject/edit/view-source, `EditTransactionSheet`, `ViewSourceSheet`) | DIFFERENT | **Android does not surface inline create-account / category / subcategory alerts during approval.** Forces user to bail out if a category is missing. P0. |
| `SyncDatePickerSheet` (large detent, per-account sync-from date) | — | MISSING | |
| `SMSSyncView` (paste SMS text, parse, retry, detect mandates) | `Screen.More` "SMS Sync" -> `PlaceholderScreen("SMS Sync — Coming Soon")` | MISSING | iOS does not require `READ_SMS` (paste-based). Android could replicate same paste-based flow. P1. |
| Endpoint mismatches | | DIFFERENT | iOS: `/api/gmail/...`, `/api/outlook/...`. Android: `/api/email/gmail/...`, `/api/email/outlook/...`. Backend alignment required. |
| OAuth redirect handler — Custom URL Scheme + `ASWebAuthenticationSession` (server returns auth URL) | `RedirectUriReceiverActivity` declared in manifest; **`net.openid.appauth` library NOT in `build.gradle.kts`** | DIFFERENT | Manifest references appauth class but dependency missing — may not compile or relies on transitive resolution. P0 verify. |

---

## Settings / More menu

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `SettingsView` Sections: Business Profile / Currency & Locale / Invoice Customization (logo + signature PhotosPickers) / Legal & Support (6 external Links: About, Help, Contact Support mailto, Privacy, Terms, Refund + App Version row) / Account (Sign Out, Reset Data 2-step + RESET-typed confirm, Delete Account) | `SettingsScreen` Sections: Business Profile / Currency & Locale / Invoice Customization (Upload Logo placeholder, Upload Signature placeholder) / Account (Sign Out, Reset Data 3-step, Delete Account) | DIFFERENT | **Entire Legal & Support section MISSING on Android** — no About, Help, Contact Support mailto, Privacy, Terms, Refund, App Version row. Logo + Signature uploads are PLACEHOLDERS (no real `POST /api/settings/logo` / `/signature`). P1. |
| Reset Data flow (warning -> RESET-typed confirm -> success) | Reset Data 3-step flow | MATCH | |
| Delete Account confirmationDialog (`DELETE /api/auth/delete-account`) | Delete Account confirm (`DELETE /api/auth/account`) | DIFFERENT | Endpoint path mismatch. |
| Sign Out button | Sign Out row | MATCH | |
| `BusinessProfileView` (firm name, GSTIN, PAN, address, country picker 10+ countries, Indian-state picker) | `BusinessProfileScreen` (firm name, GSTIN, PAN, state, country, address) | DIFFERENT | Country picker depth on Android not confirmed (iOS hard-codes 10+). |
| `CurrencySettingsView` (`GET /api/settings/currencies`, `GET /api/settings/date-formats`) | `CurrencySettingsScreen` relies on `GET /api/settings` | DIFFERENT | iOS calls separate currency + date-format endpoints; Android does not consume `/api/settings/currencies` or `/api/settings/date-formats`. |
| `POST /api/settings/logo`, `DELETE /api/settings/logo`, `POST /api/settings/signature`, `DELETE /api/settings/signature` | — | MISSING | UI is placeholder; no PhotosPicker wiring. P1. |
| `POST /api/settings/reset-data` | reset endpoint not confirmed (uses `PUT /api/settings`?) | DIFFERENT | Verify reset-data endpoint is called on Android. |

---

## Billing / Paywall / IAP

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `BillingView` (plan cards Monthly/Quarterly/Yearly with Popular/Lifetime with Best Value, Subscribe per card, Promo TextField + Apply, Apple subscribers external Link to apps.apple.com, web subscribers destructive Cancel button, Active subscription header, error alert) | `BillingScreen` (current status, plan list, promo TextField + Validate / Activate, Cancel-subscription button, Payment History row) | DIFFERENT | Multiple gaps below (5 critical defects). |
| Subscribe via StoreKit 2 (`com.spentyai.{monthly,quarterly,yearly,lifetime,lifetime_offer}`) | Google Play Billing — but **SKU-naming mismatch** between fallback plans (`com.spentyai.*`) and `queryProductDetails` (`spenty_monthly`, `spenty_yearly`) | DIFFERENT | **CRITICAL DEFECT 1.** Paywall calls `purchasePlan(productId)` with `com.spentyai.*` IDs, queries populated only with `spenty_monthly`/`spenty_yearly`, lookup fails -> purchase doesn't launch. Quarterly + Lifetime never queried. P0. |
| `POST /api/payments/apple/verify` after StoreKit purchase | `POST /api/subscription/verify` declared but **never called** — `BillingViewModel.handlePurchase` only acknowledges + refreshes status | DIFFERENT | **CRITICAL DEFECT 2.** Server has no record of the purchase. Refund / dispute / restore flows break. P0. |
| `POST /api/payments/cancel` (web) / external apps.apple.com link (Apple) | `BillingRepository.cancelSubscription` returns `Success(Unit)` without hitting any endpoint | DIFFERENT | **CRITICAL DEFECT 3.** Cancel button does nothing on backend. Also no external link to `play.google.com/store/account/subscriptions` for Play subscribers. P0. |
| `POST /api/promo/validate`, `POST /api/promo/activate` | `BillingRepository.validatePromo` / `activatePromo` return hard-coded "not yet available on Android" | DIFFERENT | **CRITICAL DEFECT 4.** Promo TextField + buttons exist in BillingScreen + SubscriptionPaywallScreen but are non-functional. P0. |
| `GET /api/payments/plans`, `GET /api/payments/status`, `GET /api/payments/history` | `GET /api/payment-plans`, `GET /api/subscription/status`, no history call | DIFFERENT | Endpoint paths differ; history endpoint not implemented. P0. |
| `LifetimeOfferSheet` (countdown timer, Accept/Decline) + `LifetimeOfferManager` singleton | — | MISSING | Lifetime offer flow has no Android equivalent. |
| `PaymentHistoryView` (`GET /api/payments/history`) | `PaymentHistoryScreen` — always empty (`getHistory()` returns `Success(emptyList())`) | DIFFERENT | **CRITICAL DEFECT 5.** P0. |
| `SubscriptionPaywall` Restore Purchases button (alert + showRestoreResult) | — | MISSING | No user-driven Restore Purchases on Android paywall. `queryPurchasesAsync` runs on init but Play UX requires explicit restore for support cases. P0. |
| StoreKit 2 product loading | (iOS-only) | iOS-ONLY-BY-PLATFORM | |
| Google Play Billing wiring (`launchBillingFlow`, `queryPurchasesAsync`, `AcknowledgePurchaseParams`) | (Android-only) | ANDROID-ONLY-BY-PLATFORM | Required on Android. Wiring is real and complete; the bugs are SKU naming, missing verify call, stubbed promo/cancel/history. |
| Subscription gating in nav router (paywall enforced before MainTab) | Paywall reachable but not enforced | DIFFERENT | **CRITICAL DEFECT 6.** P0. Android user can use the full app without paying. |

---

## Help / Support

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| Settings -> Help Center external Link `https://www.spentyai.com/help` | — | MISSING | Android has no Help Center link anywhere. 108 screenshots / 32 articles already live at `/help`; surfacing the URL is a one-line add. P1. |
| Settings -> Contact Support `mailto:` | `SupportScreen` ticket form (`POST /api/support/tickets`) | DIFFERENT | iOS provides both mailto: and ticket form; Android only ticket form. |
| `SupportView` — FAQ accordions (`GET /api/support/faq`) + ticket form | `SupportScreen` — ticket only | DIFFERENT | Android missing FAQ accordions. Endpoint exists; UI does not consume it. P1. |

---

## Localization

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| `LocalizationManager.shared` (`@Observable`, en/hi toggle) + `AppStrings.swift` dictionary | English-only, hard-coded strings in Kotlin (no `values-hi/strings.xml`) | MISSING | **Hindi is not implemented on Android.** No string resource extraction, no language toggle. P1. |
| Hindi/English toolbar toggle in Dashboard | — | MISSING | See Dashboard row. |
| `formatCurrency` lakh/crore formatting (`1.5L`, `2.3Cr`) | not confirmed | DIFFERENT | Verify Android currency formatting matches lakh/crore presentation. |

---

## Deep links / Push notifications / OS integrations

| iOS | Android | Status | Notes |
|-----|---------|--------|-------|
| Custom URL scheme `spentyai://nav/<tab>` | OAuth scheme `com.spentyai.app://oauth2redirect` only | MISSING | No tab-level deep link on Android. P2 (QA-harness). |
| Push notifications | Not implemented (no FCM, no firebase-messaging, no `POST_NOTIFICATIONS`, no `google-services.json`) | MATCH | Both platforms have zero push implementation. Equal gap. |
| Siri Intents — `RecordExpenseIntent`, `RecordIncomeIntent`, `CheckBalanceIntent` (`AppShortcuts: AppShortcutsProvider`) | — | iOS-ONLY-BY-PLATFORM | Android equivalent would be Google Assistant App Actions. Not implemented. P2. |
| Speech / Voice input via `SpeechManager` (AVFoundation + Speech) | `core/services/AndroidSpeechManager.kt` (`android.speech.SpeechRecognizer`, `RECORD_AUDIO`) | MATCH | Both wired in AI Chat. Android TTS engine not traced — `[needs follow-up]`. |
| Receipt camera capture via `UIImagePickerController` from `UnifiedTransactionForm` | Camera entry only via `BillUploadScreen` and `ReceiptUploadSheet`; not from txn form | DIFFERENT | P1. |
| QuickLook attachment preview (`AttachmentPreviewView` via `fullScreenCover`) | — | MISSING | No attachment preview on Android `TransactionDetailScreen`. |
| ShareSheet (`UIActivityViewController`) for invoice/bill PDFs and `.eml` files | — | MISSING | No `Intent.ACTION_SEND` wiring. P1. |
| External `mailto:` and HTTPS links via `Link` / `UIApplication.shared.open` (6 in Settings) | `LocalUriHandler` for Terms/Privacy on LoginScreen only | DIFFERENT | |

---

## CRITICAL DEFECTS (must fix before launch)

These are blockers — the app will mis-bill the user, mis-route them, or quietly drop their money / data.

1. **Subscription SKU naming mismatch (Billing).** `BillingRepository.fallbackPlans` exposes `com.spentyai.{monthly,quarterly,yearly,lifetime}` to the UI; `BillingViewModel.queryProductDetails` only queries `spenty_monthly` and `spenty_yearly`. When the user taps Subscribe on any plan, `purchasePlan(productId)` looks up a `productDetailsList` keyed on the SKU passed in, no match exists, and the Play Billing flow never launches. Fix: align both sides on one SKU set (recommend `com.spentyai.{monthly,quarterly,yearly,lifetime}` matching iOS) and query all four.
2. **Missing `POST /api/subscription/verify` after Play Billing purchase.** `BillingViewModel.handlePurchase` acknowledges via `BillingClient.acknowledgePurchase` and refreshes status, but never sends the purchase token to the server. Refunds, account-restore, fraud-check all break. iOS does call `POST /api/payments/apple/verify`. Fix: call the verify endpoint with purchase token + product ID before acknowledging.
3. **Cancel-subscription is a no-op.** `BillingRepository.cancelSubscription` returns `ApiResult.Success(Unit)` without hitting any endpoint. UI shows "cancelled" but server is unaware. Fix: either route to the Play subscriptions URL (`https://play.google.com/store/account/subscriptions?sku={SKU}&package={PACKAGE}`) for Play subscribers, or call a real backend cancel endpoint.
4. **Promo codes are stubs.** `validatePromo` and `activatePromo` return hard-coded "not yet available on Android" responses, while BillingScreen and SubscriptionPaywallScreen UI both show a fully wired promo TextField + Validate / Activate buttons. User input goes nowhere. Fix: call `POST /api/promo/validate` and `POST /api/promo/activate` (same endpoints as iOS) or hide the field.
5. **Payment history always empty.** `BillingRepository.getHistory` returns `Success(emptyList())`. `PaymentHistoryScreen` is reachable from BillingScreen but always shows empty. Fix: hit `GET /api/payments/history`.
6. **Subscription paywall not enforced in nav graph.** iOS routes unsubscribed users to `SubscriptionPaywall` before the main tab bar. Android nav graph reaches the main app without checking subscription status — anyone can use the full app without paying. Fix: gate the start destination on `subscriptionStatus.isActive`.
7. **Endpoint path mismatches (Auth + Billing + Email).** `iOS /api/auth/me` vs `Android /api/auth/session`, `iOS /api/auth/delete-account` vs `Android /api/auth/account`, `iOS /api/payments/{plans,status,history}` vs `Android /api/{payment-plans,subscription/status, no history}`, `iOS /api/gmail/...` vs `Android /api/email/gmail/...`, `iOS /api/invoices/{id}/record-payment` vs `Android /api/invoices/{id}/mark-paid` (loses partial payments), `iOS /api/transactions/search?status=approved` vs `Android` no `status` filter (may surface pending in approved lists). Either backend serves both or one platform 404s / mis-behaves. Fix: align Android endpoints to iOS or confirm dual-support on backend.

---

## GAP LIST — prioritized

### P0 (launch-blockers)

1. Fix SKU naming mismatch in `BillingViewModel.queryProductDetails` and `BillingRepository.fallbackPlans` so plan IDs round-trip end-to-end. Query Quarterly and Lifetime in addition to Monthly/Yearly.
2. Call `POST /api/subscription/verify` from `BillingViewModel.handlePurchase` with the Google Play purchase token before acknowledging.
3. Implement real `cancelSubscription` (open Play subscriptions URL or call backend cancel) — current stub silently lies to the user.
4. Replace stubbed `validatePromo` / `activatePromo` with real `POST /api/promo/validate` and `POST /api/promo/activate`.
5. Implement `getHistory()` to hit `GET /api/payments/history`; remove empty-list stub.
6. Enforce subscription gate in `AppNavigation.kt` start destination — unsubscribed users must hit `SubscriptionPaywallScreen` before reaching MainTab.
7. Align Android endpoint paths to iOS (auth: `/api/auth/me`, `/api/auth/delete-account`; billing: `/api/payments/plans`, `/api/payments/status`, `/api/payments/history`; email connect: `/api/gmail/connect`, `/api/outlook/connect`; transactions search: include `status=approved`; invoice/bill record-payment: `/api/invoices/{id}/record-payment`, `/api/bills/{id}/record-payment`). Or document and confirm dual-support on backend.
8. Add Restore Purchases button to `SubscriptionPaywallScreen` (and ideally `BillingScreen`). Even though `queryPurchasesAsync` runs on init, user-driven restore is required by Play UX and for support cases.
9. Resolve `RedirectUriReceiverActivity` / `net.openid.appauth` dependency situation — manifest declares the receiver but `appauth` is not in `build.gradle.kts`. Either add the dependency or remove the manifest entry; OAuth flow may currently break.
10. Onboarding slider — Android has no `OnboardingSliderView` equivalent. Build an 8-slide first-run flow (or confirm Android isn't supposed to show it).
11. Add Demo Account button to `LoginScreen` (`POST /api/auth/demo-login`) — required for Google Play store reviewer access. Currently only DEBUG-only Dev Login exists, hidden in release.
12. `UnifiedTransactionForm` parity — Android `TransactionFormScreen` must add: inline +New Account / +New Category / +New Subcategory creation alerts, recurring-date field (1–31), attachment via PhotosPicker + camera capture button, and `.approve` mode (or merge approval into the same sheet so PendingReviewScreen can hand off cleanly).
13. Filter `GET /api/transactions/search` calls with `status=approved` on Android to comply with [Pending txns excluded from calcs](feedback_pending_transactions.md). Confirm pending transactions never appear in approved lists or dashboard totals.
14. Verify Dashboard `GET /api/dashboard/summary` excludes pending transactions on Android — same policy. Likely backend-enforced, but verify.
15. Inline create-account / category / subcategory escape hatches on `PendingReviewScreen` (currently absent — user must bail out if the email AI suggests an unknown category).

### P1 (important — degrades experience or hides features)

16. Stats / debtors / aging cards on `InvoiceListScreen` (endpoints `/api/invoices/{stats,count,debtors,aging,sales-by-customer}`).
17. Stats / creditors / aging cards on `PurchaseListScreen` (endpoints `/api/bills/{stats,creditors,aging,purchases-by-vendor}`).
18. PDF preview rendering on `InvoicePreviewScreen` and `PurchasePreviewScreen` (`GET /api/invoices/{id}/pdf`, `GET /api/bills/{id}/pdf`) — currently absent.
19. ShareSheet / `Intent.ACTION_SEND` for invoice / bill / record PDF and EML downloads.
20. Mark Paid + Duplicate row-action on Invoice + Purchase lists; Duplicate endpoints (`POST /api/invoices/{id}/duplicate`, `POST /api/bills/{id}/duplicate`).
21. `GET /api/invoices/next-number` and `GET /api/bills/next-number` (auto-numbering).
22. Mandates UI — `MandatesListScreen` equivalent of `MandatesListView`, with Detect Mandates button (`POST /api/mandates/detect`), per-row Edit / Delete. APIs exist in `CashFlowRepository`; UI doesn't consume them. Add an Obligations row in MoreMenu.
23. SMS Sync screen — paste-based, mirroring iOS `SMSSyncView` (no `READ_SMS` needed). Endpoints `POST /api/sms/upload`, `POST /api/sms/parse`, `POST /api/sms/bulk-parse`, `POST /api/sms/retry-pending`, `POST /api/sms/detect-mandates`, `GET /api/sms/stats`.
24. Reports drill-down sheet (`ReportTransactionsView` equivalent) on category / income / expense card tap.
25. Reports custom date pickers when "Custom" preset is selected.
26. Reports Export CSV / Export PDF buttons (`GET /api/reports/export/csv`, `GET /api/reports/export/pdf`).
27. Settings Legal & Support section — About, Help Center (`https://www.spentyai.com/help`), Privacy Policy, Terms of Service, Refund Policy, Contact Support `mailto:`, App Version row.
28. Settings Logo + Signature uploads — replace placeholder with real PhotosPicker that calls `POST /api/settings/logo`, `DELETE /api/settings/logo`, `POST /api/settings/signature`, `DELETE /api/settings/signature`.
29. SupportScreen FAQ accordions — `GET /api/support/faq` already exists in API surface; UI does not consume it.
30. Hindi localization — extract strings to `res/values/strings.xml`, add `values-hi/strings.xml`, surface a language toggle (Settings or Dashboard toolbar).
31. Lakh / crore currency formatting helper to match iOS presentation.
32. Email Sync UX — multi-account "Add another Gmail" flow, connection success animation overlay, sync progress phase indicator (idle/syncing/complete/failed), success toast, polling lifecycle stop on screen exit, `SyncDatePickerSheet` for initial-sync window.
33. Swipe actions on lists (TransactionListScreen, AccountListScreen, CategoryListScreen, CustomerListScreen, VendorListScreen, InvoiceListScreen, PurchaseListScreen, ReconciliationScreen, RecordsScreen) — Compose has `SwipeToDismiss`; today these lists only support tap or long-press.
34. Pull-to-refresh across screens that have it on iOS (Dashboard, AccountList, TransactionList, EmailSync, PastInsights, FeatureRequests, CategoryList, Reports, CashFlow, CustomerList, VendorList, InvoiceList, PurchaseList, RecordsView, ReconciliationView).
35. AccountDetailScreen — surface OD Interest tab and Demat tab inline when applicable; expose from/to date pickers for OD interest.
36. AccountFormScreen — add Opening Balance amount + as-of-date fields and Type vs Sub-type distinction.
37. Records — segmented Emails / Receipts tabs, "Download zip" action (`POST /api/records/download-zip`).
38. RecordPreviewScreen — verify HTML email rendering uses a real WebView; add share `.eml` action.
39. TransactionDetailScreen — source-document expansion (`GET /api/source/{id}`) and attachment list with download / preview.
40. AttachmentPreviewView equivalent for Android (open downloaded attachments via OS-native viewer).
41. Tab-bar hide list — add `past_insight/{id}`, `record_preview/{id}`, `statement_detail/{id}`, `pending_review` to the bottom-bar hide list to match iOS NavigationStack behaviour.
42. Bill Upload — confirm `POST /api/bills/parse-upload` is called by `BillUploadScreen` (it must, or AI parsing doesn't run).
43. Currency settings — call `GET /api/settings/currencies` and `GET /api/settings/date-formats` separately to populate dropdowns instead of relying on `GET /api/settings`.
44. Verify `POST /api/settings/reset-data` is invoked by Android Reset Data flow.
45. Lifetime offer experience — `LifetimeOfferSheet` + `LifetimeOfferManager` equivalents (countdown timer + Accept/Decline). Optional pre-launch but is a revenue lever.

### P2 (nice-to-have / parity polish)

46. Deep link `spentyai://nav/<tab>` for QA harness automation parity.
47. CashFlow chart parity — confirm a 24-month line/area chart renders (iOS `CashFlowChartView`).
48. Country picker depth on `BusinessProfileScreen` — match the 10+ countries iOS hard-codes.
49. Sidebar / NavigationSplitView — only relevant if Android tablet UI is in scope.
50. Google Assistant App Actions (`actions.xml`) for Record Expense / Record Income / Check Balance — only if voice on Android is desired (mirror of Siri Intents).
51. Push notifications (FCM) — both platforms lack it equally; not a parity item but on the roadmap.
52. Crashlytics / Sentry / analytics SDK — neither platform has it; out of scope.
53. PaymentPlansScreen — currently orphaned route (`payment_plans`) not linked from MoreMenu; either link or delete.
54. Profile route — `Screen.Profile` reuses BusinessProfileScreen composable; orphaned, link or delete.
55. CustomerFormScreen GSTIN field — iOS does not have it; align (either add to iOS or remove from Android) for consistency.

---

## Closing notes

- The Android codebase is structurally close to iOS — about ~50 of iOS's ~70 view structs are present, and the major feature folders all exist. The deficits are concentrated in: Billing (5 critical defects), Localization (Hindi missing), in-form camera capture, swipe actions, list-stats cards (invoices / purchases), Mandates UI, SMS Sync, Help Center link, and several endpoint path mismatches.
- The `[needs follow-up]` flags from the inventory still apply: TTS engine, `appauth` dependency resolution, exact camera intent path in BillUpload / ReceiptUpload, and which Android screens use pull-to-refresh.
- Recommend a P0 sprint focused entirely on Billing parity and the subscription gate before App Store / Play Store submission, then a P1 sweep for localization + list parity (stats cards, swipe actions, mandates).
