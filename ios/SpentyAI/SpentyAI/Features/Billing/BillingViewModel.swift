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

    @MainActor
    func loadStoreProducts() async {
        do {
            let products = try await Product.products(for: Self.allProductIds)
            for product in products {
                storeProducts[product.id] = product
            }
        } catch {
            #if DEBUG
            print("[Billing] Failed to load StoreKit products: \(error)")
            #endif
        }
    }

    // MARK: - Purchase

    @MainActor
    func purchasePlan(_ productId: String) async {
        guard !isPurchasing else { return }
        guard let product = storeProducts[productId] else {
            errorMessage = "Product not available. Please try again later."
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
}
