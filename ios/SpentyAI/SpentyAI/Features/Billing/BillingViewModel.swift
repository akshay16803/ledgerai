import Foundation
import StoreKit
import SwiftUI

@Observable
final class BillingViewModel {

    // MARK: - Published State

    var plans: [PlanDTO] = []
    var currentStatus: SubscriptionStatus?
    var paymentHistory: [PaymentOrder] = []
    var isLoading = false
    var errorMessage = ""
    var showError = false

    // Promo
    var promoCode = ""
    var promoMessage = ""
    var promoValid: Bool?
    var isValidatingPromo = false
    var isActivatingPromo = false

    // Purchase
    var isPurchasing = false
    var purchasingProductId: String?

    // Cancel
    var showCancelConfirmation = false
    var isCancelling = false

    // MARK: - StoreKit Products (cached)

    private(set) var storeProducts: [String: Product] = [:]

    // MARK: - Dependencies

    private let repository: BillingRepository

    // MARK: - Constants

    static let subscriptionGroupId = "com.spentyai.premium"

    static let allProductIds: Set<String> = [
        "com.spentyai.monthly",
        "com.spentyai.quarterly",
        "com.spentyai.yearly",
        "com.spentyai.lifetime",
        "com.spentyai.lifetime_offer"
    ]

    // MARK: - Init

    init(repository: BillingRepository = .shared) {
        self.repository = repository
        startTransactionListener()
    }

    deinit {
        transactionListenerTask?.cancel()
    }

    // MARK: - Transaction listener (Apple guideline 3.1.2)
    // Listen for renewals / refunds / family-share grants in-process so the
    // app's local subscription state stays in sync with the App Store.

    private var transactionListenerTask: Task<Void, Never>?

    private func startTransactionListener() {
        transactionListenerTask = Task.detached { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result {
                    if Self.allProductIds.contains(transaction.productID) {
                        // Re-sync server-side status, then finish the transaction.
                        await MainActor.run {
                            Task {
                                await self.loadStatus()
                                await self.loadHistory()
                            }
                        }
                        await transaction.finish()
                    }
                }
            }
        }
    }

    // MARK: - Load All

    @MainActor
    func loadAll() async {
        isLoading = true
        showError = false

        async let plansTask: ()   = loadPlans()
        async let statusTask: ()  = loadStatus()
        async let historyTask: () = loadHistory()
        async let productsTask: () = loadStoreProducts()

        _ = await (plansTask, statusTask, historyTask, productsTask)

        isLoading = false
    }

    // MARK: - Plans

    @MainActor
    func loadPlans() async {
        do {
            plans = try await repository.getPlans()
        } catch {
            handleError(error)
        }
    }

    // MARK: - Subscription Status

    @MainActor
    func loadStatus() async {
        do {
            currentStatus = try await repository.getStatus()
        } catch {
            handleError(error)
        }
    }

    // MARK: - Payment History

    @MainActor
    func loadHistory() async {
        do {
            paymentHistory = try await repository.getHistory()
        } catch {
            handleError(error)
        }
    }

    // MARK: - StoreKit Products

    /// Indicates whether the StoreKit product catalog is fully populated.
    /// UI should disable purchase CTAs until this returns true so a user
    /// cannot tap a price that hasn't loaded yet (Apple App Review 2.1(b),
    /// May 2026 — reviewers tapped Continue before prices arrived and saw
    /// our "Product not available" error).
    var areProductsLoaded: Bool {
        storeProducts.count >= Self.allProductIds.count
    }

    @MainActor
    func loadStoreProducts() async {
        // Retry up to 3 times with linear backoff. StoreKit fetches can fail
        // transiently in slow / sandbox network conditions (Apple's review
        // lab on iPad). Returning early on partial success would silently
        // leave the catalog incomplete, so we keep going until we have all
        // expected IDs or we've exhausted retries.
        for attempt in 0..<3 {
            do {
                let products = try await Product.products(for: Self.allProductIds)
                for product in products {
                    storeProducts[product.id] = product
                }
                if areProductsLoaded { return }
                #if DEBUG
                print("[Billing] loadStoreProducts attempt \(attempt + 1): partial — got \(storeProducts.count)/\(Self.allProductIds.count)")
                #endif
            } catch {
                #if DEBUG
                print("[Billing] loadStoreProducts attempt \(attempt + 1) failed: \(error)")
                #endif
            }
            // Backoff: 500ms, 1000ms, then exit
            if attempt < 2 {
                try? await Task.sleep(nanoseconds: UInt64(500_000_000 * (attempt + 1)))
            }
        }
    }

    // MARK: - Purchase

    /// Returns true if the purchase fully succeeded server-side (Apple
    /// verified + backend marked the user active). Callers can use the return
    /// value to immediately route the user out of the paywall instead of
    /// reading `isSubscribed`, which depends on a separate `loadStatus()`
    /// call that races with the backend's Mongo write.
    @MainActor
    @discardableResult
    func purchasePlan(_ productId: String) async -> Bool {
        guard !isPurchasing else { return false }

        // Defensive: if the product isn't in our cache, try one more reload
        // before giving up. Covers the race where a reviewer (or fast user)
        // taps Continue while the initial StoreKit fetch is still in flight.
        if storeProducts[productId] == nil {
            await loadStoreProducts()
        }

        guard let product = storeProducts[productId] else {
            errorMessage = "Unable to connect to the App Store. Please check your internet connection and try again."
            showError = true
            return false
        }

        isPurchasing = true
        purchasingProductId = productId
        defer {
            isPurchasing = false
            purchasingProductId = nil
        }

        do {
            let result = try await product.purchase()

            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)

                // Send the StoreKit 2 JWS to the backend.
                //
                // The backend verifies the ES256 signature with the leaf
                // cert from the JWS x5c chain (see _verify_and_decode_apple_jws
                // in server.py) — no call to Apple's legacy /verifyReceipt
                // endpoint is needed.
                //
                // History of this code path:
                //   v1.0   (build 13): sent JWS as `receiptData` (camelCase) →
                //                       backend rejected with HTTP 400
                //                       "receipt_data is required" → user stuck
                //                       on paywall, never charged twice but
                //                       also never marked subscribed.
                //   v1.0.2 (build 15): switched to snake_case CodingKeys → request
                //                       reached backend → backend forwarded JWS to
                //                       legacy /verifyReceipt → Apple returned
                //                       status 21002 ("malformed receipt-data").
                //   v1.0.2 (build 16): backend now JWS-verifies locally. Sending
                //                       the JWS as `receipt_data` is the correct
                //                       contract.
                let signedTransactionJWS = verification.jwsRepresentation

                let response = try await repository.verifyApplePurchase(
                    receiptData: signedTransactionJWS,
                    productId: productId
                )

                if response.isSuccess {
                    await transaction.finish()
                    // Optimistically mark as subscribed locally so the UI
                    // doesn't bounce back to the paywall while loadStatus is
                    // racing against the backend's Mongo write.
                    currentStatus = SubscriptionStatus(
                        isActive: true,
                        plan: response.plan,
                        productId: productId,
                        expiresAt: response.expiry,
                        provider: "apple",
                        autoRenew: nil,
                        status: "active"
                    )
                    // Tell AuthManager to refresh /auth/me so that any
                    // entry point — paywall (with onSubscribed) AND
                    // BillingView (which has no callback) — sees
                    // user.hasActiveSubscription flip to true and
                    // AppRouter advances to the dashboard.
                    NotificationCenter.default.post(name: .subscriptionActivated, object: nil)
                    // Best-effort refresh — if it returns stale data we still
                    // routed the user through above. The transaction listener
                    // + AuthManager.checkSession will reconcile shortly.
                    await loadStatus()
                    await loadHistory()
                    return true
                } else {
                    errorMessage = response.message ?? "Purchase verification failed."
                    showError = true
                    return false
                }

            case .userCancelled:
                return false

            case .pending:
                errorMessage = "Purchase is pending approval."
                showError = true
                return false

            @unknown default:
                return false
            }
        } catch {
            handleError(error)
            return false
        }
    }

    // MARK: - Promo Code
    //
    // Promo / coupon codes are intentionally restricted to App Review staff
    // and internal team members. Public users cannot redeem them, so the
    // /api/promo/activate path does not constitute a paid digital purchase
    // outside StoreKit (Apple Guideline 3.1.1).

    @MainActor
    func validatePromo() async {
        let code = promoCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }

        isValidatingPromo = true
        promoValid = nil
        promoMessage = ""

        do {
            let response = try await repository.validatePromo(code: code)
            promoValid = response.valid ?? false
            promoMessage = response.displayMessage
        } catch {
            promoValid = false
            promoMessage = "Failed to validate promo code."
        }

        isValidatingPromo = false
    }

    @MainActor
    func activatePromo() async {
        let code = promoCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty, promoValid == true else { return }

        isActivatingPromo = true

        do {
            let response = try await repository.activatePromo(code: code)
            promoMessage = response.displayMessage

            // Activate endpoint may not return `valid`; treat presence of subscriptionPlan as success
            if response.valid == true || response.subscriptionPlan != nil {
                promoCode = ""
                promoValid = nil
                // Promo activation grants access. Notify AuthManager so the
                // refreshed user.hasActiveSubscription routes the user out
                // of any paywall they happened to be on. Without this the
                // promo-activating user stays on the paywall until they
                // background+foreground the app.
                NotificationCenter.default.post(name: .subscriptionActivated, object: nil)
                await loadStatus()
                await loadHistory()
            }
        } catch {
            promoMessage = "Failed to activate promo code."
        }

        isActivatingPromo = false
    }

    // MARK: - Cancel Subscription

    @MainActor
    func cancelSubscription() async {
        isCancelling = true

        do {
            _ = try await repository.cancelSubscription()
            await loadStatus()
        } catch {
            handleError(error)
        }

        isCancelling = false
    }

    // MARK: - Entitlements Check

    @MainActor
    func checkEntitlements() async {
        for await result in StoreKit.Transaction.currentEntitlements {
            if let transaction = try? checkVerified(result) {
                if Self.allProductIds.contains(transaction.productID) {
                    await loadStatus()
                    // Apple guidance: finish every consumed transaction, even
                    // those discovered via currentEntitlements. Without this,
                    // StoreKit replays the same transaction on every launch
                    // and Apple's queue can hold up new purchases on review
                    // devices.
                    await transaction.finish()
                    return
                }
            }
        }
    }

    // MARK: - Helpers

    private func checkVerified(_ result: VerificationResult<StoreKit.Transaction>) throws -> StoreKit.Transaction {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let value):
            return value
        }
    }

    @MainActor
    private func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            errorMessage = apiError.localizedDescription
        } else {
            errorMessage = error.localizedDescription
        }
        showError = true
    }

    // MARK: - Computed

    var isSubscribed: Bool {
        currentStatus?.isActive == true
    }

    var isLifetime: Bool {
        currentStatus?.isActive == true &&
        (currentStatus?.plan?.lowercased() == "lifetime" ||
         currentStatus?.productId == "com.spentyai.lifetime" ||
         currentStatus?.productId == "com.spentyai.lifetime_offer")
    }

    var currentPlanName: String? {
        currentStatus?.plan
    }

    func isCurrentPlan(_ productId: String) -> Bool {
        currentStatus?.isActive == true && currentStatus?.productId == productId
    }

    func displayPrice(for productId: String) -> String? {
        storeProducts[productId]?.displayPrice
    }

    /// Returns a customer-facing trial summary like "7 days free, then ₹1,499/year"
    /// when the product has an introductory free-trial offer. Nil otherwise.
    /// Required by Apple Guideline 3.1.2: trial price + post-trial price must
    /// be clearly disclosed on the paywall.
    func trialSummary(for productId: String) -> String? {
        guard let product = storeProducts[productId],
              let intro = product.subscription?.introductoryOffer,
              intro.paymentMode == .freeTrial else { return nil }

        let days = intro.period.value * periodDays(for: intro.period.unit)
        let unit: String
        switch product.subscription?.subscriptionPeriod.unit {
        case .day:   unit = "day"
        case .week:  unit = "week"
        case .month: unit = "month"
        case .year:  unit = "year"
        default:     unit = "period"
        }
        return "\(days) days free, then \(product.displayPrice)/\(unit)"
    }

    private func periodDays(for unit: Product.SubscriptionPeriod.Unit) -> Int {
        switch unit {
        case .day:   return 1
        case .week:  return 7
        case .month: return 30
        case .year:  return 365
        @unknown default: return 0
        }
    }
}
