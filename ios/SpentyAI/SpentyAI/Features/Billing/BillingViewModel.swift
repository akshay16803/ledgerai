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

    @MainActor
    func purchasePlan(_ productId: String) async {
        guard !isPurchasing else { return }

        // Defensive: if the product isn't in our cache, try one more reload
        // before giving up. Covers the race where a reviewer (or fast user)
        // taps Continue while the initial StoreKit fetch is still in flight.
        if storeProducts[productId] == nil {
            await loadStoreProducts()
        }

        guard let product = storeProducts[productId] else {
            errorMessage = "Unable to connect to the App Store. Please check your internet connection and try again."
            showError = true
            return
        }

        isPurchasing = true
        purchasingProductId = productId

        do {
            let result = try await product.purchase()

            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)

                // Send receipt to backend
                let jwsRepresentation = verification.jwsRepresentation
                let response = try await repository.verifyApplePurchase(
                    receiptData: jwsRepresentation,
                    productId: productId
                )

                if response.success {
                    await transaction.finish()
                    await loadStatus()
                    await loadHistory()
                } else {
                    errorMessage = response.message ?? "Purchase verification failed."
                    showError = true
                }

            case .userCancelled:
                break

            case .pending:
                errorMessage = "Purchase is pending approval."
                showError = true

            @unknown default:
                break
            }
        } catch {
            handleError(error)
        }

        isPurchasing = false
        purchasingProductId = nil
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
