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
    let plan: String
    let amount: Double
    let currency: String
    let status: String             // "completed", "refunded", "pending"
    let provider: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, plan, amount, currency, status, provider
        case createdAt
    }
}

struct SubscriptionStatus: Codable {
    let isActive: Bool
    let plan: String?
    let productId: String?
    let expiresAt: String?
    let provider: String?          // "apple", "web", "promo"
    let autoRenew: Bool?

    enum CodingKeys: String, CodingKey {
        case plan, provider
        case isActive
        case productId
        case expiresAt
        case autoRenew
    }
}
