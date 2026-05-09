import Foundation

struct PaymentPlan: Codable, Identifiable {
    var id: String { key ?? UUID().uuidString }
    var key: String?
    var name: String?
    var price: Double?
    var period: String?
    var badge: String?
    var highlighted: Bool?

    enum CodingKeys: String, CodingKey {
        case key
        case name
        case price
        case period
        case badge
        case highlighted
    }
}

struct PaymentOrder: Codable, Identifiable {
    let id: String
    let plan: String?
    let amount: Double?
    let currency: String?
    let status: String?
    let paymentProvider: String?
    let createdAt: String?

    // Explicit CodingKeys disable JSONDecoder.keyDecodingStrategy per Apple's
    // Codable rules — when the rawValues differ from the JSON keys, decoding
    // silently nils the property (or, for non-optional `id`, fails the whole
    // row). Backend ships snake_case (`order_id`, `payment_provider`,
    // `created_at`), so the rawValues must match exactly. Symptom of the
    // previous bug: payment history list was always empty.
    enum CodingKeys: String, CodingKey {
        case id = "order_id"
        case plan, amount, currency, status
        case paymentProvider = "payment_provider"
        case createdAt = "created_at"
    }
}

struct PaymentHistoryResponse: Codable {
    let orders: [PaymentOrder]
}

struct SubscriptionStatus: Codable {
    let isActive: Bool
    let plan: String?
    let productId: String?
    let expiresAt: String?
    let provider: String?          // "apple", "google", "payu", "promo"
    let autoRenew: Bool?
    /// Raw backend status — "active" / "trialing" / "in_grace_period" /
    /// "expired" / "cancelled". Used to render the "Trial · ends [date]"
    /// badge in BillingView when status == "trialing".
    let status: String?

    // Same Apple-Codable trap as PaymentOrder above — explicit CodingKeys
    // disable JSONDecoder.keyDecodingStrategy. Backend `/api/payments/status`
    // returns BOTH the long subscription_* names AND short aliases. We map
    // each Swift property to the snake_case key the backend actually emits.
    // Previous bug: `productId` defaulted to JSON key "productId" (which
    // doesn't exist) — backend ships "product_id" — so `isLifetime` always
    // returned false for actual lifetime users, surfacing the wrong UI
    // (Upgrade-to-Lifetime banner shown to lifetime owners; Cancel button
    // visible where it should be hidden).
    enum CodingKeys: String, CodingKey {
        case plan = "subscription_plan"
        case provider = "subscription_provider"
        case isActive = "is_active"
        case productId = "product_id"
        case expiresAt = "subscription_expiry"
        case autoRenew = "auto_renew"
        case status
    }
}
