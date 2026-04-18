import StoreKit
import Foundation

// MARK: - SubscriptionInfo

/// Snapshot of the user's current subscription state.
struct SubscriptionInfo: Sendable {
    var isActive: Bool
    var expirationDate: Date?
    var willRenew: Bool
    var isInGracePeriod: Bool
    var isInBillingRetry: Bool
    var currentProductId: String?
    /// The platform the subscription was purchased on.
    var platform: SubscriptionPlatform

    enum SubscriptionPlatform: String, Sendable {
        case apple
        case razorpay
        case unknown
    }

    static let inactive = SubscriptionInfo(
        isActive: false,
        expirationDate: nil,
        willRenew: false,
        isInGracePeriod: false,
        isInBillingRetry: false,
        currentProductId: nil,
        platform: .unknown
    )
}

// MARK: - SubscriptionManager Extensions

extension SubscriptionManager {

    // MARK: Subscription Status

    /// Builds a ``SubscriptionInfo`` from the current StoreKit 2 transaction state.
    func getSubscriptionStatus() async -> SubscriptionInfo {
        // Check all subscription group statuses
        guard let statuses = try? await Product.SubscriptionInfo.status(
            for: StoreKitProducts.subscriptionGroupId
        ) else {
            return .inactive
        }

        for status in statuses {
            guard case .verified(let renewalInfo) = status.renewalInfo,
                  case .verified(let transaction) = status.transaction else {
                continue
            }

            let isActive: Bool
            let isInGracePeriod: Bool
            let isInBillingRetry: Bool

            switch status.state {
            case .subscribed:
                isActive = true
                isInGracePeriod = false
                isInBillingRetry = false
            case .inGracePeriod:
                isActive = true
                isInGracePeriod = true
                isInBillingRetry = false
            case .inBillingRetryPeriod:
                isActive = false
                isInGracePeriod = false
                isInBillingRetry = true
            case .revoked, .expired:
                continue
            default:
                continue
            }

            return SubscriptionInfo(
                isActive: isActive,
                expirationDate: transaction.expirationDate,
                willRenew: renewalInfo.willAutoRenew,
                isInGracePeriod: isInGracePeriod,
                isInBillingRetry: isInBillingRetry,
                currentProductId: transaction.productID,
                platform: .apple
            )
        }

        return .inactive
    }

    // MARK: Family Sharing

    /// Checks ``Transaction.currentEntitlement`` for family-shared purchases
    /// and unlocks features if a shared transaction is found.
    func handleFamilySharing() async {
        for await result in StoreKit.Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else {
                continue
            }

            if transaction.ownershipType == StoreKit.Transaction.OwnershipType.familyShared {
                // Grant access for family-shared subscription
                await MainActor.run {
                    self.purchasedProductIDs.insert(transaction.productID)
                }
            }
        }
    }

    // MARK: Offer Codes

    /// Presents the system offer-code redemption sheet.
    ///
    /// On iOS 16+, StoreKit can open the redemption sheet directly.
    /// The result is picked up by ``TransactionListener``.
    @MainActor
    func handleOfferCodes() async {
        #if os(iOS)
        guard let windowScene = UIApplication.shared
            .connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first else {
            return
        }

        do {
            try await AppStore.presentOfferCodeRedeemSheet(in: windowScene)
        } catch {
            print("[StoreKit] Offer code redemption failed: \(error.localizedDescription)")
        }
        #endif
    }

    // MARK: Upgrade / Downgrade

    /// Handles a subscription change from one product to another.
    ///
    /// Uses `Product.SubscriptionInfo.RenewalInfo` to determine upgrade/downgrade
    /// behaviour. The App Store automatically prorates or defers the change.
    ///
    /// - Parameters:
    ///   - from: The product the user is currently subscribed to.
    ///   - to: The product the user wants to switch to.
    /// - Returns: The resulting ``Transaction`` if successful.
    @discardableResult
    func handleUpgradeDowngrade(from currentProduct: Product, to newProduct: Product) async throws -> StoreKit.Transaction? {
        // Attempt the purchase with the upgrade policy.
        let result = try await newProduct.purchase()

        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else {
                throw StoreKitHelperError.verificationFailed
            }
            await transaction.finish()
            await MainActor.run {
                self.purchasedProductIDs.insert(newProduct.id)
                self.purchasedProductIDs.remove(currentProduct.id)
            }
            return transaction

        case .userCancelled:
            return nil

        case .pending:
            // Ask-to-Buy or requires approval
            return nil

        @unknown default:
            return nil
        }
    }

    // MARK: Expiration Formatting

    /// Formats a subscription expiration date for display.
    ///
    /// Returns relative text like "Expires in 3 days" when close, or a
    /// full date string otherwise.
    func formatExpirationDate(_ date: Date) -> String {
        let calendar = Calendar.current
        let now = Date()

        guard date > now else {
            return "Expired"
        }

        let components = calendar.dateComponents([.day], from: now, to: date)
        let daysRemaining = components.day ?? 0

        if daysRemaining <= 7 {
            if daysRemaining == 0 {
                return "Expires today"
            } else if daysRemaining == 1 {
                return "Expires tomorrow"
            } else {
                return "Expires in \(daysRemaining) days"
            }
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return "Expires on \(formatter.string(from: date))"
    }
}

// MARK: - Errors

enum StoreKitHelperError: LocalizedError {
    case verificationFailed
    case productNotFound

    var errorDescription: String? {
        switch self {
        case .verificationFailed:
            return "Transaction verification failed."
        case .productNotFound:
            return "The requested product could not be found."
        }
    }
}
