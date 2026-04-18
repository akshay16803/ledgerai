import Foundation
import StoreKit
import os

@Observable
final class SubscriptionManager {
    var products: [Product] = []
    var purchasedProductIDs: Set<String> = []
    var isLoading = false
    var errorMessage: String?

    private let logger = Logger(subsystem: "com.spentyai", category: "storekit")

    init() {}

    // MARK: - Load Products

    @MainActor
    func loadProducts() async {
        isLoading = true
        errorMessage = nil

        do {
            let storeProducts = try await Product.products(for: StoreKitProducts.allProductIDs)
            products = storeProducts.sorted { $0.price < $1.price }
            logger.info("Loaded \(storeProducts.count) products from App Store")
        } catch {
            logger.error("Failed to load products: \(error.localizedDescription)")
            errorMessage = "Failed to load subscription options."
        }

        isLoading = false
    }

    // MARK: - Purchase

    @MainActor
    func purchase(product: Product) async throws -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await verifyWithBackend(transaction: transaction)
            await transaction.finish()
            purchasedProductIDs.insert(product.id)
            logger.info("Purchase successful: \(product.id)")
            return true

        case .userCancelled:
            logger.info("User cancelled purchase")
            return false

        case .pending:
            logger.info("Purchase pending approval")
            errorMessage = "Purchase is pending approval."
            return false

        @unknown default:
            logger.warning("Unknown purchase result")
            return false
        }
    }

    // MARK: - Restore Purchases

    @MainActor
    func restorePurchases() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        var restored: Set<String> = []

        for await result in Transaction.currentEntitlements {
            if let transaction = try? checkVerified(result) {
                restored.insert(transaction.productID)
                await verifyWithBackend(transaction: transaction)
            }
        }

        purchasedProductIDs = restored

        if restored.isEmpty {
            errorMessage = "No active subscriptions found."
        } else {
            logger.info("Restored \(restored.count) subscriptions")
        }
    }

    // MARK: - Verify with Backend

    func verifyWithBackend(transaction: StoreKit.Transaction) async {
        let request = AppleVerifyRequest(
            originalTransactionId: String(transaction.originalID),
            signedPayload: nil
        )

        do {
            let _: AppleVerifyResponse = try await APIClient.shared.post(
                APIEndpoints.Payments.appleVerify,
                body: request
            )
            logger.info("Backend verification successful for transaction \(transaction.originalID)")
        } catch {
            logger.error("Backend verification failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Helpers

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let value):
            return value
        }
    }
}
