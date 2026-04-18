import Foundation
import StoreKit
import os

final class TransactionListener {
    private var updateTask: Task<Void, Never>?
    private let logger = Logger(subsystem: "com.spentyai", category: "storekit")
    private let subscriptionManager: SubscriptionManager

    init(subscriptionManager: SubscriptionManager) {
        self.subscriptionManager = subscriptionManager
    }

    func startListening() {
        updateTask = Task(priority: .background) { [weak self] in
            guard let self else { return }

            for await result in Transaction.updates {
                do {
                    let transaction = try self.checkVerified(result)
                    logger.info("Transaction update: \(transaction.productID) — revoked: \(transaction.revocationDate != nil)")

                    await subscriptionManager.verifyWithBackend(transaction: transaction)
                    await transaction.finish()

                    if transaction.revocationDate != nil {
                        await MainActor.run {
                            subscriptionManager.purchasedProductIDs.remove(transaction.productID)
                        }
                    } else {
                        await MainActor.run {
                            subscriptionManager.purchasedProductIDs.insert(transaction.productID)
                        }
                    }
                } catch {
                    logger.error("Transaction verification failed: \(error.localizedDescription)")
                }
            }
        }
    }

    func stopListening() {
        updateTask?.cancel()
        updateTask = nil
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let value):
            return value
        }
    }
}
