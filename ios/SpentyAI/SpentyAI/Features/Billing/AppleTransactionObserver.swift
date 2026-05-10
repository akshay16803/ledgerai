import Foundation
import StoreKit

/// Process-lifetime listener for `StoreKit.Transaction.updates`.
///
/// Apple delivers background events here:
///   - Auto-renewal of an active subscription (DID_RENEW arrives in the
///     server-to-server V2 notification AND, separately, in
///     `Transaction.updates` on the device).
///   - Refunds processed by Apple.
///   - Family-Sharing grants where another family member purchased
///     the subscription.
///   - Restore Purchases on a new device.
///
/// The previous implementation lived inside `BillingViewModel`, which is
/// constructed per-screen. Whenever the user dismissed the paywall or
/// billing-settings sheet, the view model deinit'd and the listener task
/// was cancelled — every background renewal / refund that fired while the
/// user was on the dashboard was silently dropped, leaving the local
/// `subscription_status` stale until the next manual refresh.
///
/// `AppleTransactionObserver.shared.start()` is called once from
/// `SpentyAIApp.init` so the listener stays alive for the entire app
/// lifecycle. When a verified transaction comes through, we post
/// `.subscriptionActivated` on `NotificationCenter` — both `AuthManager`
/// (refresh `/auth/me`) and any live `BillingViewModel` (refresh local
/// status / history) react to it.
final class AppleTransactionObserver {

    static let shared = AppleTransactionObserver()

    private static let allProductIds: Set<String> = [
        "com.spentyai.monthly",
        "com.spentyai.quarterly",
        "com.spentyai.yearly",
        "com.spentyai.lifetime",
        "com.spentyai.lifetime_offer"
    ]

    private var listenerTask: Task<Void, Never>?

    private init() {}

    /// Start listening for StoreKit transaction updates. Idempotent — safe
    /// to call multiple times; subsequent calls are no-ops.
    func start() {
        guard listenerTask == nil else { return }
        listenerTask = Task.detached(priority: .background) {
            for await result in StoreKit.Transaction.updates {
                if case .verified(let transaction) = result,
                   Self.allProductIds.contains(transaction.productID) {
                    // Tell the rest of the app to refresh server-side state.
                    // AuthManager observes this and re-fetches /auth/me;
                    // any live BillingViewModel observes it and re-fetches
                    // /api/payments/status + /history.
                    await MainActor.run {
                        NotificationCenter.default.post(
                            name: .subscriptionActivated,
                            object: nil
                        )
                    }
                    // Finish the transaction so StoreKit doesn't keep
                    // replaying it on every launch (Apple guideline 3.1.2).
                    await transaction.finish()
                }
            }
        }
    }

    /// Only used by tests and previews.
    func stop() {
        listenerTask?.cancel()
        listenerTask = nil
    }
}
