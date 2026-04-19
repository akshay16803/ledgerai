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

    enum CodingKeys: String, CodingKey {
        case id = "orderId"
        case plan, amount, currency, status
        case paymentProvider
        case createdAt
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
    let provider: String?          // "apple", "web", "promo"
    let autoRenew: Bool?

    enum CodingKeys: String, CodingKey {
        case plan = "subscriptionPlan"
        case provider = "subscriptionProvider"
        case isActive
        case productId
        case expiresAt = "subscriptionExpiry"
        case autoRenew
    }
}
