# SpentyAI — Native iOS App: Full Implementation Plan

**Created:** 2026-04-18
**Owner:** Ricky (akshaychouhan16803)
**Working branch:** `emergent`
**New folder:** `ios/` (at repo root — completely from scratch, no code reuse from `apps/mobile/`)

---

## 1. Executive Summary

Build a production-ready native iOS app (Swift + SwiftUI) for SpentyAI that achieves **full feature parity** with the web app at `src/`. The app will:

- Share the **same FastAPI backend** (`backend/server.py`) — all 129 existing API endpoints
- Share a **single subscription** — purchase on web or iOS, valid everywhere
- Show the **same data** everywhere, updated in **real-time** via polling + push notifications
- Be distributed via **Apple TestFlight → App Store**

**Tech Stack:**
- **Language:** Swift 5.10+
- **UI Framework:** SwiftUI (iOS 17+ minimum deployment target)
- **Architecture:** MVVM + Repository pattern with async/await
- **Networking:** URLSession + Combine for streaming
- **Local storage:** SwiftData (for offline cache) + Keychain (for auth tokens)
- **Auth:** Google Sign-In SDK + ASWebAuthenticationSession fallback
- **Payments:** StoreKit 2 (Apple In-App Purchase) — Razorpay stays on web only
- **Push notifications:** APNs + backend integration
- **AI features:** Same backend endpoints (no on-device models)
- **File handling:** PhotosUI + UniformTypeIdentifiers for document/image picking

---

## 2. Project Structure

```
ios/
├── SpentyAI.xcodeproj/
├── SpentyAI/
│   ├── App/
│   │   ├── SpentyAIApp.swift              # @main entry, scene setup
│   │   ├── AppState.swift                 # Global observable: auth, subscription, connectivity
│   │   └── AppDelegate.swift              # Push notification registration, deep links
│   │
│   ├── Core/
│   │   ├── Networking/
│   │   │   ├── APIClient.swift            # URLSession wrapper, auth injection, error handling
│   │   │   ├── APIEndpoints.swift         # All 129 endpoint definitions (method, path, types)
│   │   │   ├── APIError.swift             # Typed error enum
│   │   │   ├── TokenManager.swift         # Keychain read/write for session_token cookie
│   │   │   └── MultipartUpload.swift      # FormData file upload helper
│   │   │
│   │   ├── StoreKit/
│   │   │   ├── SubscriptionManager.swift  # StoreKit 2 product loading, purchase, restore
│   │   │   ├── StoreKitProducts.swift     # Product ID constants + plan mapping
│   │   │   └── TransactionListener.swift  # Background listener for renewals/revocations
│   │   │
│   │   ├── Models/                        # All Codable data models (mirrors backend schemas)
│   │   │   ├── User.swift
│   │   │   ├── Account.swift
│   │   │   ├── Transaction.swift
│   │   │   ├── Category.swift
│   │   │   ├── Invoice.swift
│   │   │   ├── Bill.swift
│   │   │   ├── Customer.swift
│   │   │   ├── Vendor.swift
│   │   │   ├── Statement.swift
│   │   │   ├── Receipt.swift
│   │   │   ├── Record.swift
│   │   │   ├── Mandate.swift
│   │   │   ├── TaxSummary.swift
│   │   │   ├── DematStatement.swift
│   │   │   ├── Settings.swift
│   │   │   ├── Subscription.swift
│   │   │   ├── FeatureRequest.swift
│   │   │   ├── SupportTicket.swift
│   │   │   └── DashboardSummary.swift
│   │   │
│   │   ├── Repositories/                  # Data access layer (API + cache)
│   │   │   ├── AuthRepository.swift
│   │   │   ├── AccountRepository.swift
│   │   │   ├── TransactionRepository.swift
│   │   │   ├── CategoryRepository.swift
│   │   │   ├── InvoiceRepository.swift
│   │   │   ├── BillRepository.swift
│   │   │   ├── CustomerRepository.swift
│   │   │   ├── VendorRepository.swift
│   │   │   ├── ReconciliationRepository.swift
│   │   │   ├── EmailSyncRepository.swift
│   │   │   ├── RecordRepository.swift
│   │   │   ├── ReceiptRepository.swift
│   │   │   ├── CashFlowRepository.swift
│   │   │   ├── ReportRepository.swift
│   │   │   ├── SettingsRepository.swift
│   │   │   ├── SubscriptionRepository.swift
│   │   │   ├── TaxSummaryRepository.swift
│   │   │   ├── DematRepository.swift
│   │   │   └── AIChatRepository.swift
│   │   │
│   │   ├── Cache/
│   │   │   ├── SwiftDataStore.swift       # SwiftData container setup
│   │   │   ├── CachedTransaction.swift    # SwiftData @Model for offline viewing
│   │   │   ├── CachedAccount.swift
│   │   │   └── SyncManager.swift          # Pull-based sync: periodic refresh + manual pull-to-refresh
│   │   │
│   │   └── Utilities/
│   │       ├── CurrencyFormatter.swift    # Country-aware currency formatting (40+ currencies)
│   │       ├── DateFormatting.swift        # 5 date format presets from settings
│   │       ├── CountryConfig.swift         # Port of web countryConfig.js (20 countries)
│   │       ├── Haptics.swift              # Taptic feedback helper
│   │       └── Logger.swift               # os.Logger wrapper
│   │
│   ├── Design/
│   │   ├── Theme.swift                    # Colors, fonts, spacing, radius (matches web --brand-primary etc.)
│   │   ├── Components/
│   │   │   ├── StatCard.swift             # Reusable metric card
│   │   │   ├── SpentyCard.swift           # Standard card container
│   │   │   ├── PrimaryButton.swift        # Brand-colored CTA
│   │   │   ├── SecondaryButton.swift      # Outline/ghost button
│   │   │   ├── StatusBadge.swift          # Color-coded status pill
│   │   │   ├── EmptyState.swift           # Illustration + CTA for empty lists
│   │   │   ├── LoadingOverlay.swift        # Full-screen spinner
│   │   │   ├── SearchBar.swift            # Reusable search input
│   │   │   ├── FilterChip.swift           # Selectable filter pill
│   │   │   ├── MoneyText.swift            # Formatted currency display (green/red)
│   │   │   ├── SectionHeader.swift        # Consistent section title
│   │   │   ├── FormField.swift            # Labeled text field with validation
│   │   │   ├── SheetHeader.swift          # Standard sheet/modal header with close button
│   │   │   └── AIBadge.swift              # "AI" pill for AI-sourced items
│   │   └── Modifiers/
│   │       ├── CardStyle.swift            # .cardStyle() view modifier
│   │       └── ShimmerEffect.swift        # Loading shimmer animation
│   │
│   ├── Features/
│   │   ├── Auth/
│   │   │   ├── LoginView.swift            # Google Sign-In button + terms links
│   │   │   ├── LoginViewModel.swift       # Google OAuth → backend callback → store token
│   │   │   └── SubscriptionGate.swift     # Wraps app content; shows billing if no active sub
│   │   │
│   │   ├── Billing/
│   │   │   ├── BillingView.swift          # Plan cards + promo code + Razorpay
│   │   │   └── BillingViewModel.swift     # Order create → Razorpay SDK → verify → update state
│   │   │
│   │   ├── Dashboard/
│   │   │   ├── DashboardView.swift        # Stats grid, accounts, recent transactions, AI FAB
│   │   │   ├── DashboardViewModel.swift   # Fetch summary, accounts, recent txns
│   │   │   └── AIChatSheet.swift          # Floating AI chat panel (bottom sheet)
│   │   │
│   │   ├── Transactions/
│   │   │   ├── TransactionsView.swift     # List + filters + ledger toggle
│   │   │   ├── TransactionsViewModel.swift
│   │   │   ├── TransactionRow.swift       # Single transaction row
│   │   │   ├── LedgerView.swift           # Debit/Credit/Balance accounting view
│   │   │   ├── EditTransactionSheet.swift # Create/Edit modal with receipt upload
│   │   │   └── EditTransactionViewModel.swift
│   │   │
│   │   ├── Accounts/
│   │   │   ├── AccountsView.swift         # Grouped account cards
│   │   │   ├── AccountsViewModel.swift
│   │   │   ├── AccountFormSheet.swift     # Create/Edit account
│   │   │   ├── SubTypeManagerSheet.swift  # Manage sub-types
│   │   │   ├── AmortizationView.swift     # Loan amortization schedule
│   │   │   └── ODInterestView.swift       # OD daily interest breakdown
│   │   │
│   │   ├── Categories/
│   │   │   ├── CategoriesView.swift       # Tabbed expense/income tree
│   │   │   └── CategoriesViewModel.swift
│   │   │
│   │   ├── Invoices/
│   │   │   ├── InvoicesView.swift         # List + status filter
│   │   │   ├── InvoicesViewModel.swift
│   │   │   ├── SalesInvoiceSheet.swift    # India GST form
│   │   │   ├── InternationalInvoiceSheet.swift # Non-India invoice form
│   │   │   ├── InvoicePreviewView.swift   # Full invoice render (share as PDF)
│   │   │   └── RecordPaymentSheet.swift   # Partial/full payment recording
│   │   │
│   │   ├── Customers/
│   │   │   ├── CustomersView.swift        # Debtors, sales-by-customer, aging tables
│   │   │   └── CustomersViewModel.swift
│   │   │
│   │   ├── Purchases/
│   │   │   ├── PurchasesView.swift        # Bills list + status filter
│   │   │   ├── PurchasesViewModel.swift
│   │   │   ├── PurchaseBillSheet.swift    # India bill form + AI upload
│   │   │   ├── InternationalBillSheet.swift
│   │   │   ├── BillPreviewView.swift      # Full bill render (share as PDF)
│   │   │   └── BillUploadParser.swift     # Upload image/PDF → AI auto-fill
│   │   │
│   │   ├── Vendors/
│   │   │   ├── VendorsView.swift          # Creditors, purchases-by-vendor, aging
│   │   │   └── VendorsViewModel.swift
│   │   │
│   │   ├── CashFlow/
│   │   │   ├── CashFlowView.swift         # Stats + bar chart + recurring + mandates
│   │   │   ├── CashFlowViewModel.swift
│   │   │   ├── ProjectionChart.swift      # Swift Charts 24-month bar chart
│   │   │   └── MandateFormSheet.swift     # Add/edit mandate
│   │   │
│   │   ├── Reports/
│   │   │   ├── ReportsView.swift          # Period filter + stats + chart + category breakdown
│   │   │   ├── ReportsViewModel.swift
│   │   │   └── PeriodChart.swift          # Swift Charts income vs expense
│   │   │
│   │   ├── Reconciliation/
│   │   │   ├── ReconciliationView.swift   # Upload + statement list + parsed entries
│   │   │   ├── ReconciliationViewModel.swift
│   │   │   ├── StatementUploadSheet.swift # File picker + account + period
│   │   │   ├── ParsedEntriesView.swift    # Line-by-line with category assignment
│   │   │   └── ReconciliationResultView.swift # Matched/unmatched/conflicts
│   │   │
│   │   ├── EmailSync/
│   │   │   ├── EmailSyncView.swift        # Connected accounts + pending review
│   │   │   ├── EmailSyncViewModel.swift
│   │   │   ├── EmailAccountCard.swift     # Per-account status + actions
│   │   │   └── PendingReviewList.swift    # Approve/reject/edit AI transactions
│   │   │
│   │   ├── Records/
│   │   │   ├── RecordsView.swift          # Tabbed email records + receipts
│   │   │   ├── RecordsViewModel.swift
│   │   │   ├── EmailRecordRow.swift
│   │   │   └── EmailPreviewSheet.swift    # Subject, body, attachments
│   │   │
│   │   ├── PastInsights/
│   │   │   ├── PastInsightsView.swift     # Tax summary create + list
│   │   │   ├── PastInsightsViewModel.swift
│   │   │   └── InsightDetailView.swift    # Summary detail + transactions
│   │   │
│   │   ├── Demat/
│   │   │   ├── DematView.swift            # Statement upload + manual entry + list
│   │   │   └── DematViewModel.swift
│   │   │
│   │   ├── FeatureRequests/
│   │   │   ├── FeatureRequestsView.swift
│   │   │   └── FeatureRequestsViewModel.swift
│   │   │
│   │   ├── Support/
│   │   │   ├── SupportView.swift          # Ticket form with category + priority
│   │   │   └── SupportViewModel.swift
│   │   │
│   │   └── Settings/
│   │       ├── SettingsView.swift         # All settings sections
│   │       └── SettingsViewModel.swift
│   │
│   ├── Navigation/
│   │   ├── MainTabView.swift             # Tab bar (5 tabs + More)
│   │   ├── MoreMenuView.swift            # Overflow navigation list
│   │   └── Router.swift                  # NavigationPath-based routing
│   │
│   └── Resources/
│       ├── Assets.xcassets/              # App icon, colors, images
│       ├── LaunchScreen.storyboard       # Splash screen
│       └── Info.plist
│
├── SpentyAITests/
│   ├── NetworkingTests/
│   ├── RepositoryTests/
│   └── ViewModelTests/
│
├── SpentyAIUITests/
│   └── CriticalFlowTests.swift
│
└── README.md
```

---

## 3. Architecture Deep-Dive

### 3.1 MVVM + Repository Pattern

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
│   SwiftUI   │ ──> │  ViewModel   │ ──> │  Repository  │ ──> │ APIClient │
│   Views     │ <── │  @Observable │ <── │  (protocol)  │ <── │ URLSession│
└─────────────┘     └──────────────┘     └──────────────┘     └───────────┘
                                               │
                                               v
                                         ┌───────────┐
                                         │ SwiftData │
                                         │  (cache)  │
                                         └───────────┘
```

**Why this pattern:**
- Views are pure UI — no business logic, easy to preview
- ViewModels are `@Observable` classes — testable without UI
- Repositories abstract API vs cache — swap for mocks in tests
- APIClient is a single point for auth injection, retry, logging

### 3.2 Networking Layer (APIClient.swift)

```swift
// Core contract
actor APIClient {
    static let shared = APIClient()
    
    private let baseURL = URL(string: "https://accounts.niprasha.com")! // Production
    private let session: URLSession
    private let tokenManager: TokenManager
    
    // Every request automatically:
    // 1. Injects session_token cookie
    // 2. Sets Content-Type
    // 3. Decodes response or throws typed APIError
    // 4. Handles 401 → force re-login
    // 5. Handles network errors → queue for retry if offline
    
    func get<T: Decodable>(_ path: String, query: [String: String]? = nil) async throws -> T
    func post<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T
    func put<T: Decodable>(_ path: String, body: Encodable) async throws -> T
    func delete(_ path: String) async throws
    func upload<T: Decodable>(_ path: String, fileData: Data, fileName: String, mimeType: String) async throws -> T
}
```

**Auth flow:** The backend uses `session_token` as an HTTP-only cookie. On iOS, we store the token in Keychain and inject it as a cookie header (or Bearer token) on every request. After Google Sign-In, the backend redirects with the cookie set — we intercept and store it.

### 3.3 Real-Time Data Sync Strategy

Since all data lives on the same backend, real-time consistency is achieved through:

| Mechanism | When | How |
|-----------|------|-----|
| **Pull-to-refresh** | User gesture | Re-fetch current screen's data |
| **Background refresh** | Every 30s while app is foregrounded | Lightweight poll of `/api/dashboard/summary` + badge counts |
| **Post-mutation refresh** | After any create/update/delete | Immediately re-fetch the affected list |
| **Push notification** | Backend-triggered (Phase 5) | APNs badge + silent push to refresh specific data |
| **App foreground** | `scenePhase == .active` | Re-fetch current screen data |

**No Supabase realtime on iOS.** The web app uses the FastAPI backend directly (not Supabase realtime), so the iOS app follows the same pattern — all data flows through `backend/server.py` REST endpoints.

### 3.4 Offline Strategy

**Read-only offline access** (not offline writes):
- SwiftData caches the last-fetched state of: dashboard summary, accounts, recent transactions, categories, settings
- When offline, the app shows cached data with a "Last updated X ago" banner
- Create/edit/delete operations show an inline "You're offline" message and disable the submit button
- This keeps the architecture simple and avoids conflict resolution

**Why not offline writes:** SpentyAI is an accounting app where data integrity matters. Offline writes create merge conflicts (e.g., two devices edit the same transaction). The web app doesn't support offline writes either, so parity is maintained.

---

## 4. Subscription — Cross-Platform Model

### 4.1 How It Works

```
┌──────────┐        ┌──────────────────┐        ┌──────────┐
│  Web App │──pay──>│  Razorpay Server │──hook──>│ Backend  │
│  (JS)    │        │                  │         │ MongoDB  │
└──────────┘        └──────────────────┘         └────┬─────┘
                                                      │
                                                      v
                                            subscription_plan        <── single source of truth
                                            subscription_status
                                            subscription_expiry
                                            purchase_platform
                                                      ^
                                                      │
┌──────────┐        ┌──────────────────┐              │
│ iOS App  │──pay──>│  Apple App Store │──receipt─────>│
│ (Swift)  │        │  (StoreKit 2)    │              │
└──────────┘        └──────────────────┘
```

**Two payment gateways, one subscription record:**

| Platform | Payment Provider | How It Works |
|----------|-----------------|--------------|
| **Web** | Razorpay | Existing flow: create order → pay → verify signature → update MongoDB |
| **iOS** | Apple IAP (StoreKit 2) | New flow: purchase via App Store → send receipt to backend → backend verifies with Apple → update MongoDB |

**Single source of truth:** The `users` collection in MongoDB stores `subscription_plan`, `subscription_status`, `subscription_expiry`, and a new `purchase_platform` field (`"razorpay"` or `"apple"`). Both web and iOS check subscription status via `GET /api/auth/me`.

**Why Apple IAP on iOS, Razorpay on web:**
- Apple requires IAP for digital subscriptions purchased within iOS apps — no exceptions
- Razorpay continues to work on web where there are no platform restrictions
- The backend is the single gatekeeper: regardless of where the user pays, the subscription unlocks everywhere
- If a user buys on web (Razorpay), the iOS app sees `subscription_status == "active"` and unlocks immediately
- If a user buys on iOS (Apple), the web app sees the same status and unlocks immediately

### 4.2 Apple IAP Product Configuration

**Products to create in App Store Connect:**

| Product ID | Type | Price | Maps to Backend Plan |
|------------|------|-------|---------------------|
| `com.spentyai.monthly` | Auto-Renewable Subscription | ₹199/month | `monthly` |
| `com.spentyai.quarterly` | Auto-Renewable Subscription | ₹449/quarter | `quarterly` |
| `com.spentyai.yearly` | Auto-Renewable Subscription | ₹1499/year | `yearly` |
| `com.spentyai.lifetime` | Non-Consumable | ₹4999 one-time | `lifetime` |

All auto-renewable subscriptions belong to a single **Subscription Group** called "SpentyAI Pro" so users can upgrade/downgrade between monthly, quarterly, and yearly seamlessly.

### 4.3 iOS Payment Flow (StoreKit 2)

```
1. App launches → StoreKit 2 loads available products from App Store Connect
2. User taps a plan on BillingView
3. StoreKit 2 presents Apple's native payment sheet (Face ID / Touch ID / password)
4. Apple processes payment → returns signed Transaction (JWS)
5. iOS app sends the transaction's originalID + signedPayload to backend:
       POST /api/payments/apple/verify
6. Backend verifies the JWS with Apple's public key (local verification)
   OR calls Apple's App Store Server API v2 to validate
7. Backend extracts: productId, expiresDate, originalTransactionId
8. Backend maps productId → plan, updates user's subscription in MongoDB:
       subscription_plan = "yearly"
       subscription_status = "active"
       subscription_expiry = expiresDate
       purchase_platform = "apple"
       apple_original_transaction_id = "..."
9. Backend returns success → iOS app refreshes AppState → app unlocks
```

### 4.4 Renewal, Cancellation & Grace Period Handling

```swift
// StoreKit 2 handles renewals automatically. The app listens for updates:

// In SubscriptionManager.swift:
func listenForTransactionUpdates() {
    Task {
        for await result in Transaction.updates {
            if case .verified(let transaction) = result {
                // Send to backend for verification + status update
                await verifyWithBackend(transaction)
                await transaction.finish()
            }
        }
    }
}
```

**Backend handles Apple Server-to-Server Notifications v2:**

| Notification | Backend Action |
|-------------|----------------|
| `DID_RENEW` | Extend `subscription_expiry` to new period end |
| `DID_FAIL_TO_RENEW` | Set `subscription_status = "grace_period"` (Apple gives 16-day grace) |
| `EXPIRED` | Set `subscription_status = "expired"` |
| `DID_CHANGE_RENEWAL_INFO` | Update plan if user upgraded/downgraded |
| `REFUND` | Set `subscription_status = "expired"`, log refund |
| `REVOKE` | Immediately revoke access |

**Server notification endpoint:** `POST /api/payments/apple/webhook` — registered in App Store Connect under "App Store Server Notifications v2 URL".

### 4.5 Cross-Platform Subscription Resolution

When a user has BOTH a Razorpay and Apple subscription (edge case), the backend picks the one with the latest expiry:

```python
# In backend: resolve_subscription(user)
if user.razorpay_expiry and user.apple_expiry:
    # Use whichever expires later
    if user.apple_expiry > user.razorpay_expiry:
        active_plan = user.apple_plan
        active_expiry = user.apple_expiry
    else:
        active_plan = user.razorpay_plan
        active_expiry = user.razorpay_expiry
```

### 4.6 Subscription Gate

```swift
// SubscriptionGate.swift
struct SubscriptionGate<Content: View>: View {
    @Environment(AppState.self) var appState
    let content: () -> Content
    
    var body: some View {
        if appState.hasActiveSubscription {
            content()
        } else {
            BillingView()
        }
    }
}
```

Every protected screen is wrapped in `SubscriptionGate`. The gate checks `appState.user.subscription_status == "active"` and `subscription_expiry > now`.

### 4.7 Restore Purchases

StoreKit 2 automatically syncs purchases across devices. On login, the app calls:

```swift
// Check for existing Apple subscriptions on this Apple ID
func restorePurchases() async {
    for await result in Transaction.currentEntitlements {
        if case .verified(let transaction) = result {
            await verifyWithBackend(transaction)
        }
    }
}
```

This handles: new device, reinstall, family sharing, and "I bought on web but also have Apple subscription" scenarios.

### 4.8 Promo Codes

Promo codes (lifetime grants) continue to work via the existing backend endpoints (`POST /api/promo/validate`, `POST /api/promo/activate`). These bypass both Razorpay and Apple — they directly set `subscription_status = "active"` and `subscription_plan = "lifetime"` in MongoDB. The iOS BillingView includes a promo code field just like the web app.

---

## 5. Screen-by-Screen Specification

### 5.1 Navigation Structure

**Tab Bar (5 visible tabs):**

| Tab | Icon | Screen |
|-----|------|--------|
| Dashboard | `house.fill` | DashboardView |
| Transactions | `arrow.left.arrow.right` | TransactionsView |
| Accounts | `building.columns` | AccountsView |
| Reports | `chart.bar.fill` | ReportsView |
| More | `ellipsis` | MoreMenuView |

**More Menu items:**

| Item | Icon | Screen |
|------|------|--------|
| Sales Invoices | `doc.text` | InvoicesView |
| Customers | `person.2` | CustomersView |
| Purchase Bills | `shippingbox` | PurchasesView |
| Vendors | `storefront` | VendorsView |
| Categories | `tag` | CategoriesView |
| Cash Flow | `chart.line.uptrend.xyaxis` | CashFlowView |
| Reconciliation | `scale.3d` | ReconciliationView |
| Email & SMS | `envelope` | EmailSyncView |
| Records | `archivebox` | RecordsView |
| Past Insights | `lightbulb` | PastInsightsView |
| Demat/Trading | `chart.bar.doc.horizontal` | DematView |
| Feature Requests | `star.bubble` | FeatureRequestsView |
| Support | `headphones` | SupportView |
| Settings | `gearshape` | SettingsView |
| Sign Out | `rectangle.portrait.and.arrow.right` | — |

**Conditional visibility (mirrors web):** Sales Invoices + Customers only appear after first invoice is created. Purchase Bills + Vendors only appear after first bill is created. Check via `GET /api/invoices/count` and `GET /api/bills/count` on app launch.

### 5.2 Each Screen in Detail

---

#### **Login (LoginView)**
- Full-screen dark background with SpentyAI logo + tagline
- "Sign in with Google" button (Google Sign-In SDK)
- Links to Privacy Policy and Terms (open in SFSafariViewController)
- On success: store session token → navigate to Dashboard or Billing

**APIs:** `GET /api/auth/google` → Google OAuth → `GET /api/auth/google/callback` → `GET /api/auth/me`

---

#### **Billing (BillingView)**
- 4 plan cards loaded dynamically from App Store Connect via StoreKit 2: Monthly, Quarterly, Yearly, Lifetime
- Prices shown in user's local currency (Apple handles currency conversion automatically)
- Highlighted "Best Value" on Yearly
- Feature inclusion checklist
- "Subscribe" button triggers Apple's native payment sheet (Face ID / password)
- Promo code text field + "Apply" button (uses backend promo endpoints, NOT Apple promo codes)
- "Restore Purchases" button (calls `Transaction.currentEntitlements`)
- If user already has an active subscription (bought on web), this screen is never shown

**StoreKit Products:** `com.spentyai.monthly`, `com.spentyai.quarterly`, `com.spentyai.yearly`, `com.spentyai.lifetime`
**APIs:** `POST /api/payments/apple/verify`, `POST /api/promo/validate`, `POST /api/promo/activate`, `GET /api/payments/history`

---

#### **Dashboard (DashboardView)**
- 4 stat cards in 2×2 grid: Net Worth, Income This Month, Expense This Month, Pending Review
- "Accounts" section: horizontal scroll of account cards (name, type icon, balance)
- "Recent Transactions" section: last 5 transactions (type pill, description, amount, date)
- Floating AI chat button (bottom-right) → opens `AIChatSheet` as `.sheet`
- Pull-to-refresh on entire view
- "New Transaction" button in nav bar → opens EditTransactionSheet

**APIs:** `GET /api/dashboard/summary`, `GET /api/accounts`, `GET /api/transactions?limit=5`, `POST /api/ai/chat`

---

#### **AI Chat (AIChatSheet)**
- Bottom sheet with messages list + text input
- Quick prompt chips: "Add expense", "Show balance", "Create invoice"
- Each AI response can include embedded action cards (transaction posted, invoice created, bill created)
- Conversation history maintained in-memory for session

**APIs:** `POST /api/ai/chat` (with conversation array)

---

#### **Transactions (TransactionsView)**
- Segmented control: All / Income / Expense / Transfer
- Date range filter (date pickers)
- Account filter (picker)
- Toggle: List view / Ledger view
- **List view:** LazyVStack of transaction rows (date, type badge, description, account, category, amount with color, status badge). Swipe actions: Edit, Delete, Approve/Reject (for pending_review)
- **Ledger view:** Table-style with Debit/Credit/Balance columns (when account filtered)
- AI badge on AI-sourced transactions
- FAB: "+" button → EditTransactionSheet
- Pull-to-refresh

**APIs:** `GET /api/transactions` (with filters), `PUT /api/transactions/{id}`, `DELETE /api/transactions/{id}`, `POST /api/transactions/{id}/approve`, `POST /api/transactions/{id}/reject`

---

#### **Edit Transaction (EditTransactionSheet)**
- Segmented control: Income / Expense / Transfer
- Tab buttons at top: "Switch to Sales Invoice" / "Switch to Purchase Bill"
- Fields: Amount (large, prominent), Date, Account (picker), To Account (transfer), Category + Subcategory (pickers with quick-add), Description, Payment Method, Recurring toggle + frequency
- Receipt upload: Camera / Photo Library / Files picker → upload → AI auto-parse → pre-fill fields
- For pending_review: "Approve" button alongside "Save"

**APIs:** `POST /api/transactions`, `PUT /api/transactions/{id}`, `POST /api/receipts/upload`, `POST /api/receipts/{id}/parse`

---

#### **Accounts (AccountsView)**
- Grouped by type: Asset, Liability, Equity, Investment
- Each account card: icon, name, sub-type badge, balance (green/red)
- Tap card → AccountDetailView (transaction history for that account)
- "+" button → AccountFormSheet
- Long-press → Edit / Delete
- "Manage Sub-Types" button → SubTypeManagerSheet
- Loan accounts show: EMI, tenure, interest rate, outstanding
- OD accounts show: interest rate, calculate interest button → ODInterestView

**APIs:** `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/{id}`, `DELETE /api/accounts/{id}`, `GET /api/accounts/{id}/amortization`, `GET /api/accounts/{id}/od-interest`, `POST /api/accounts/{id}/od-interest`, `GET /api/account-sub-types`, `POST /api/account-sub-types`, `PUT /api/account-sub-types/{id}`, `DELETE /api/account-sub-types/{id}`

---

#### **Categories (CategoriesView)**
- Tab: Expense / Income
- Expandable tree: parent category → subcategories
- Swipe to delete
- "+" button at parent level and per-parent for subcategories
- Inline add form (text field + save button)

**APIs:** `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/{id}`, `DELETE /api/categories/{id}`

---

#### **Sales Invoices (InvoicesView)**
- Filter chips: All / Unpaid / Partial / Paid
- List of invoices: invoice number, customer name, date, amount, status badge
- Tap → InvoicePreviewView (full render with share-as-PDF)
- Swipe actions: Edit, Record Payment, Delete
- "+" button → SalesInvoiceSheet (India) or InternationalInvoiceSheet (other countries)
- Settings guard: if firm_name missing, redirect to SettingsView with setup=invoice param

**APIs:** `GET /api/invoices`, `POST /api/invoices`, `PUT /api/invoices/{id}`, `DELETE /api/invoices/{id}`, `POST /api/invoices/{id}/record-payment`, `GET /api/settings`

---

#### **Invoice Preview (InvoicePreviewView)**
- Full A4-style invoice render in ScrollView
- Firm header (name, address, GSTIN, PAN)
- "Bill To" customer block
- Line items table (description, HSN, qty, rate, amount)
- Tax breakdown: CGST/SGST (intra-state) or IGST (inter-state) for India; country-specific tax for international
- Grand total
- Bank details, terms & conditions
- Share button → generates PDF via UIGraphicsImageRenderer → UIActivityViewController
- Country-aware: uses CountryConfig for labels, tax ID field name, currency

**PDF Generation:** Render the SwiftUI view to PDF using `ImageRenderer` (iOS 16+) or a lightweight HTML → PDF approach via `WKWebView.createPDF()`.

---

#### **Customers (CustomersView)**
- 3 sections (each with a table):
  1. **Due from Customers (Debtors):** customer name, outstanding, invoice count
  2. **Sales per Customer:** customer name, total sales, count
  3. **Debtor Aging:** Current, 1-30, 31-60, 61-90, 90+ days

**APIs:** `GET /api/invoices/debtors`, `GET /api/invoices/sales-by-customer`, `GET /api/invoices/aging`

---

#### **Purchase Bills (PurchasesView)**
- Same pattern as InvoicesView but for bills
- AI upload zone: camera/files picker → upload → auto-fill bill form
- Filter chips: All / Unpaid / Partial / Paid

**APIs:** `GET /api/bills`, `POST /api/bills`, `PUT /api/bills/{id}`, `DELETE /api/bills/{id}`, `POST /api/bills/{id}/record-payment`, `POST /api/bills/parse-upload`

---

#### **Vendors (VendorsView)**
- Same pattern as CustomersView: Creditors, Purchases-by-Vendor, Aging

**APIs:** `GET /api/bills/creditors`, `GET /api/bills/purchases-by-vendor`, `GET /api/bills/aging`

---

#### **Cash Flow (CashFlowView)**
- 5 stat cards: Monthly Income, Monthly Expense, Monthly Mandates, OD Interest, Monthly Net
- **Swift Charts** grouped bar chart: 24-month projection (income green, expense red), horizontally scrollable
- Recurring items list with toggle recurring on/off
- Mandates list with pause/resume/delete actions
- "Add Mandate" button → MandateFormSheet

**APIs:** `GET /api/cashflow/projection`, `GET /api/recurring/list`, `GET /api/mandates`, `POST /api/mandates`, `PATCH /api/mandates/{id}`, `DELETE /api/mandates/{id}`, `POST /api/transactions/{id}/toggle-recurring`

---

#### **Reports (ReportsView)**
- Period presets: This Month, 3M, 6M, Year, All Time, Custom
- 4 stat cards: Income, Expenses, Net Savings, Count
- **Swift Charts** grouped bar chart: income vs expense per month
- Category breakdown: expandable rows with sub-category detail
- Each row: category name, color swatch, amount, percentage

**APIs:** `GET /api/reports/summary`, `GET /api/reports/by-period`, `GET /api/reports/by-category`

---

#### **Reconciliation (ReconciliationView)**
- Upload section: account picker, sub-type, period, file picker (PDF/CSV)
- Statement list: filename, account, period, status badge, progress bar (polling during parse)
- Tap statement → ParsedEntriesView (line items with category assignment)
- "Reconcile" button → ReconciliationResultView (matched/missing/conflicts)
- "Add Missing" bulk action
- Password unlock for encrypted PDFs

**APIs:** `POST /api/statements/upload`, `GET /api/statements/list`, `GET /api/statements/{id}`, `POST /api/statements/{id}/reconcile`, `POST /api/statements/{id}/add-missing`, `DELETE /api/statements/{id}`, `POST /api/statements/{id}/reaudit`, `PATCH /api/statements/{id}/entries/{idx}`, `POST /api/statements/{id}/unlock`

---

#### **Email & SMS Sync (EmailSyncView)**
- Connected accounts list (Gmail + Outlook) with status badges
- "Connect Gmail" / "Connect Outlook" buttons → `ASWebAuthenticationSession` for OAuth
- Per-account: sync date, stats (total, found, skipped, pending, failed), retry button, disconnect
- "Pending Review" section: AI-extracted transactions with approve/reject/edit actions
- Processing indicator with shimmer animation

**APIs:** `GET /api/gmail/connect`, `GET /api/gmail/status`, `POST /api/gmail/disconnect`, `POST /api/email/start-sync`, `POST /api/email/retry-pending`, `GET /api/email/sync-stats`, `GET /api/email/pending-review`, `GET /api/outlook/connect`, `GET /api/outlook/status`, `POST /api/outlook/disconnect`, `POST /api/outlook/start-sync`, `POST /api/outlook/retry-pending`

---

#### **Records (RecordsView)**
- Tab: Email Records / Receipts & Bills
- **Email Records:** search bar, date/amount filters, list with subject, date, amount, attachment count. Tap → EmailPreviewSheet. Select multiple → download ZIP.
- **Receipts:** grid of receipt thumbnails linked to transactions

**APIs:** `GET /api/records`, `GET /api/records/{id}/preview`, `GET /api/records/{id}/download-eml`, `POST /api/records/download-zip`, `GET /api/receipts`

---

#### **Past Insights (PastInsightsView)**
- Create form: name, date range, select email account
- List of summaries with status badge (processing/ready)
- Tap → InsightDetailView (breakdown + transaction list)
- Export button (share CSV)
- Polling while processing

**APIs:** `POST /api/tax-summary`, `GET /api/tax-summary`, `GET /api/tax-summary/{id}`, `DELETE /api/tax-summary/{id}`, `GET /api/tax-summary/{id}/export`, `GET /api/tax-summary/available-emails`

---

#### **Demat / Trading (DematView)**
- Statement upload: account picker, file picker, period
- Manual entry: account, date, net P&L, charges, description
- Statement list with approve/reject actions
- Parsed summary: buy/sell values, charges breakdown, net P&L

**APIs:** `POST /api/demat/upload-statement`, `POST /api/demat/manual-entry`, `GET /api/demat/statements/{account_id}`, `POST /api/demat/approve-statement/{id}`, `POST /api/demat/reject-statement/{id}`

---

#### **Feature Requests (FeatureRequestsView)**
- Submit form: title, description, category
- List of submitted requests with status badges (pending/completed)

**APIs:** `GET /api/feature-requests`, `POST /api/feature-requests`

---

#### **Support (SupportView)**
- Form: subject, category picker, priority picker, message
- Success confirmation view

**APIs:** `POST /api/support/ticket`

---

#### **Settings (SettingsView)**
- Grouped Form sections:
  1. **General:** Base currency (40+ picker), Date format (5 presets), Business country (20 countries)
  2. **Business Profile:** Firm name, address, city, state, pincode, GSTIN, PAN, phone, email
  3. **Invoice Settings:** Bank name, account no, IFSC, branch, invoice prefix, terms
  4. **Bill Settings:** Bill prefix, bill terms
- Auto-save on field change (debounced)
- Setup mode: when navigated with `setup` parameter, highlight required fields

**APIs:** `GET /api/settings`, `PUT /api/settings`

---

## 6. Design System

### 6.1 Color Palette (matches web CSS variables)

```swift
enum SpentyColors {
    // Brand
    static let brandPrimary = Color(hex: "#1B2A4A")     // --brand-primary
    static let brandAccent  = Color(hex: "#3B82F6")      // --accent-1
    
    // Backgrounds
    static let bgPrimary    = Color(hex: "#FAFBFD")      // --bg-primary (light mode)
    static let bgSecondary  = Color(hex: "#F1F5F9")      // --bg-secondary
    static let surface      = Color.white                 // --bg-card
    
    // Text
    static let textPrimary   = Color(hex: "#1E293B")     // --text-primary
    static let textSecondary = Color(hex: "#64748B")     // --text-secondary
    
    // Semantic
    static let success = Color(hex: "#22C55E")
    static let danger  = Color(hex: "#EF4444")
    static let warning = Color(hex: "#F59E0B")
    static let info    = Color(hex: "#3B82F6")
    
    // Borders
    static let borderSubtle = Color(hex: "#E2E8F0")
    static let borderStrong = Color(hex: "#CBD5E1")
}
```

### 6.2 Typography

```swift
enum SpentyFonts {
    static let heading = Font.system(.title2, design: .default, weight: .semibold)
    static let subheading = Font.system(.headline, design: .default, weight: .medium)
    static let body = Font.system(.body, design: .default)
    static let caption = Font.system(.caption, design: .default)
    static let mono = Font.system(.footnote, design: .monospaced, weight: .medium)
    static let stat = Font.system(size: 28, weight: .bold, design: .rounded)
}
```

### 6.3 Spacing & Radius

```swift
enum SpentySpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum SpentyRadius {
    static let sm: CGFloat = 4    // matches web border-radius: 2-4px
    static let md: CGFloat = 8
    static let lg: CGFloat = 12
    static let card: CGFloat = 2  // web uses border-radius: 2px for cards
}
```

---

## 7. Phased Delivery Plan

### Phase 1 — Foundation + Core Screens (Week 1-2)

**Goal:** A buildable app with auth, subscription, and the 3 most-used screens.

| Task | Files | Est. |
|------|-------|------|
| Xcode project setup, SwiftUI app scaffold, folder structure | `SpentyAIApp.swift`, `Info.plist`, project config | 2h |
| Design system: Theme, all shared components | `Design/` folder (15 files) | 4h |
| APIClient + TokenManager + APIError | `Core/Networking/` (5 files) | 3h |
| All Codable models (mirrors backend) | `Core/Models/` (18 files) | 3h |
| AppState (auth + subscription observable) | `AppState.swift` | 1h |
| Google Sign-In integration | `LoginView`, `LoginViewModel`, `AuthRepository` | 3h |
| StoreKit 2 integration (SubscriptionManager, TransactionListener, product loading) | `Core/StoreKit/` (3 files) | 4h |
| Subscription gate + BillingView with Apple IAP | `SubscriptionGate`, `BillingView`, `BillingViewModel` | 4h |
| Tab navigation + More menu | `MainTabView`, `MoreMenuView`, `Router` | 2h |
| Dashboard (stats + accounts + recent txns + AI chat) | `Dashboard/` (3 files) | 4h |
| Transactions (list + ledger + filters + CRUD) | `Transactions/` (6 files) | 6h |
| EditTransactionSheet (full form + receipt upload) | 2 files | 4h |
| Accounts (grouped cards + form + sub-types + OD/amortization) | `Accounts/` (6 files) | 5h |
| **Phase 1 Total** | | **~45h** |

**Deliverable:** TestFlight build with login → Apple IAP billing → dashboard → transactions → accounts working end-to-end.

---

### Phase 2 — Invoicing + Purchases (Week 3)

| Task | Files | Est. |
|------|-------|------|
| Categories (tree view + CRUD) | `Categories/` (2 files) | 3h |
| Settings (all sections + setup mode) | `Settings/` (2 files) | 3h |
| CountryConfig port (20 countries) | `CountryConfig.swift` | 2h |
| Sales Invoices (list + form + preview + payment + PDF share) | `Invoices/` (6 files) | 6h |
| Customers (debtors + aging + sales tables) | `Customers/` (2 files) | 2h |
| Purchase Bills (list + form + AI upload + preview + payment) | `Purchases/` (6 files) | 6h |
| Vendors (creditors + aging + purchases tables) | `Vendors/` (2 files) | 2h |
| **Phase 2 Total** | | **~24h** |

**Deliverable:** Full invoicing and purchase bill flow with country-aware forms and PDF sharing.

---

### Phase 3 — Analytics + Reconciliation (Week 4)

| Task | Files | Est. |
|------|-------|------|
| Cash Flow (stats + Swift Charts + recurring + mandates) | `CashFlow/` (4 files) | 5h |
| Reports (periods + charts + category breakdown) | `Reports/` (3 files) | 4h |
| Reconciliation (upload + parse + category assign + reconcile + results) | `Reconciliation/` (5 files) | 6h |
| **Phase 3 Total** | | **~15h** |

**Deliverable:** Full analytics and bank reconciliation working.

---

### Phase 4 — Email/SMS, Records, Remaining Features (Week 5)

| Task | Files | Est. |
|------|-------|------|
| Email & SMS Sync (OAuth connect + stats + pending review) | `EmailSync/` (4 files) | 5h |
| Records (email archive + receipts + preview + ZIP download) | `Records/` (4 files) | 4h |
| Past Insights (create + list + detail + export) | `PastInsights/` (3 files) | 3h |
| Demat/Trading (upload + manual + approve) | `Demat/` (2 files) | 3h |
| Feature Requests (form + list) | `FeatureRequests/` (2 files) | 1h |
| Support (ticket form) | `Support/` (2 files) | 1h |
| **Phase 4 Total** | | **~17h** |

**Deliverable:** 100% feature parity with web app.

---

### Phase 5 — Polish, Performance, App Store (Week 6)

| Task | Est. |
|------|------|
| SwiftData offline cache for dashboard + accounts + transactions | 4h |
| SyncManager: background refresh, foreground refresh, post-mutation refresh | 3h |
| Push notification setup (APNs registration + backend integration) | 4h |
| App icon + splash screen + launch animation | 2h |
| Accessibility: Dynamic Type, VoiceOver labels, focus order | 3h |
| Performance: Instruments profiling, lazy loading, image caching | 3h |
| Haptic feedback on key actions (save, delete, approve) | 1h |
| Error handling polish: retry banners, offline indicators | 2h |
| Unit tests for all ViewModels | 4h |
| UI tests for critical flows (login → dashboard → create transaction) | 3h |
| App Store Connect: screenshots, description, keywords, review notes | 2h |
| TestFlight → App Store submission | 1h |
| StoreKit 2 edge cases: family sharing, offer codes, subscription upgrades/downgrades | 3h |
| **Phase 5 Total** | **~35h** |

---

### Total Estimate

| Phase | Hours | Timeline |
|-------|-------|----------|
| Phase 1: Foundation + Core + Apple IAP | 45h | Week 1-2 |
| Phase 2: Invoicing + Purchases | 24h | Week 3 |
| Phase 3: Analytics + Reconciliation | 15h | Week 4 |
| Phase 4: Email/SMS, Records, Rest | 17h | Week 5 |
| Phase 5: Polish + App Store | 35h | Week 6 |
| **Total** | **~136h** | **~6 weeks** |

---

## 8. Backend Changes Required

The existing backend needs these changes to support iOS + Apple IAP:

| Change | Why | Effort |
|--------|-----|--------|
| Accept `Authorization: Bearer <token>` alongside cookies | iOS can't rely on browser cookies; needs explicit token auth | 1h |
| `POST /api/auth/google/mobile` endpoint | iOS sends Google `id_token` directly (no redirect flow); backend verifies with Google, creates session, returns token in JSON | 2h |
| `POST /api/payments/apple/verify` endpoint | Receives StoreKit 2 signed transaction (JWS), verifies with Apple's public key or App Store Server API v2, extracts product ID + expiry, maps to plan, updates user subscription in MongoDB | 4h |
| `POST /api/payments/apple/webhook` endpoint | Receives Apple App Store Server Notifications v2 (renewals, cancellations, refunds, billing issues). Updates subscription status accordingly. Must return HTTP 200 to acknowledge. | 3h |
| Add `purchase_platform` + `apple_original_transaction_id` fields to user model | Track which platform the subscription came from; Apple's transaction ID needed for refund/dispute lookups | 0.5h |
| Cross-platform subscription resolution in `GET /api/auth/me` | When user has both Razorpay and Apple subscriptions, return the one with latest expiry as active | 1h |
| Add APNs device token storage + push send utility | For real-time push notifications (Phase 5) | 3h |
| Install `PyJWT` + Apple root certificates for JWS verification | Needed to verify StoreKit 2 signed transactions server-side | 0.5h |

**Total backend work: ~15 hours**

**Apple App Store Server API v2** — the backend will use Apple's `/inApps/v1/transactions/{transactionId}` and `/inApps/v1/subscriptions/{originalTransactionId}` endpoints for server-side receipt validation. This requires an App Store Connect API key (generated in App Store Connect → Users and Access → Keys → In-App Purchase).

The rest of the 129 existing endpoints work as-is — the iOS app is just another HTTP client.

---

## 9. Third-Party Dependencies

| Library | Purpose | Source |
|---------|---------|--------|
| **GoogleSignIn** | Google OAuth for iOS | SPM: `google/GoogleSignIn-iOS` |
| **KeychainAccess** | Secure token storage | SPM: `kishikawakatsumi/KeychainAccess` |
| **SwiftUI (built-in)** | UI framework | Apple |
| **StoreKit 2 (built-in)** | Apple In-App Purchase | Apple (iOS 15+) |
| **Swift Charts (built-in)** | Bar/line charts | Apple (iOS 16+) |
| **SwiftData (built-in)** | Local cache | Apple (iOS 17+) |
| **PhotosUI (built-in)** | Image/document picker | Apple |

**Total external dependencies: 2** (Google Sign-In, KeychainAccess). Everything else — including payments — uses Apple's built-in frameworks. No Razorpay SDK on iOS.

---

## 10. Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| **Models** | XCTest | 100% — all Codable round-trip tests |
| **APIClient** | XCTest + URLProtocol mock | All error paths, auth injection, retry logic |
| **Repositories** | XCTest + mock APIClient | All CRUD operations per repository |
| **ViewModels** | XCTest + mock repositories | All user actions, state transitions, error handling |
| **UI** | XCUITest | 5 critical flows: login, create transaction, create invoice, reconcile, payment |
| **Integration** | Manual + TestFlight | Full regression before each App Store submission |

---

## 11. Security Considerations

| Area | Approach |
|------|----------|
| **Token storage** | Keychain only — never UserDefaults, never files |
| **Network** | HTTPS only (ATS enforced); certificate pinning for production |
| **Sensitive data** | No financial data cached in plaintext; SwiftData with Data Protection |
| **Biometric lock** | Optional Face ID / Touch ID gate on app launch (Phase 5) |
| **Clipboard** | Never auto-copy sensitive data (account numbers, GSTIN) |
| **Jailbreak detection** | Basic check on launch; warn but don't block |

---

## 12. What This Plan Does NOT Cover

- **Android app** — separate plan (the existing `apps/mobile/` React Native app covers Android)
- **Changes to the web app** — zero web files touched
- **Changes to the Cloudflare Worker** — separate deploy concern
- **Supabase schema changes** — the iOS app talks to FastAPI, not Supabase directly
- **Apple Watch / iPad-specific layouts** — iPad gets automatic scaling via `supportsTablet: true`; no custom layouts in v1
- **Widget / Live Activity** — post-v1 enhancement
- **Siri Shortcuts** — post-v1 enhancement

---

## 13. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Apple App Review rejects the app | High — delays launch | Follow all App Store guidelines strictly; no external payment links; IAP is the only purchase path on iOS |
| Apple's 30% commission reduces revenue on iOS purchases | Medium — ₹199 plan nets ₹139 | Price plans slightly higher on iOS to offset, or accept the margin. After Year 1 the commission drops to 15% (Small Business Program) |
| StoreKit 2 receipt verification fails or is unreliable | Medium — users pay but don't get access | Implement both local JWS verification AND server-side App Store Server API v2 as fallback; add "Restore Purchases" button |
| User buys on both Razorpay and Apple (double subscription) | Low — confusion | Backend resolves to latest-expiring subscription; show "Active via [platform]" in settings |
| Google Sign-In SDK breaking changes | Medium — blocks auth | Pin SDK version; have ASWebAuthenticationSession fallback |
| Large statement PDF upload fails on cellular | Medium — bad UX | Compress before upload; show progress; allow WiFi-only setting |
| SwiftData migration issues across versions | Medium — data loss | Version the schema; keep cache as non-critical (server is source of truth) |
| Backend cookie auth doesn't work on iOS | Low — blocks all API calls | Already mitigated: add Bearer token auth to backend (Section 8) |
| Apple subscription renewal webhook delivery fails | Low — user loses access despite paying | iOS app checks `Transaction.currentEntitlements` on every launch as safety net; backend also polls Apple's API daily for active subscribers |

---

*This plan is the single source of truth for the iOS native app. Every phase lists exactly what will and will NOT be touched. Implementation starts only after Ricky approves this plan.*
