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
    var planKey: String?
    var amount: Double?
    var currency: String?
    var status: String?
    var provider: String?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case planKey
        case amount
        case currency
        case status
        case provider
        case createdAt
    }
}

struct SubscriptionStatus: Codable {
    var plan: String?
    var status: String?
    var expiresAt: Date?
    var provider: String?
    var isTrial: Bool?
    var trialEndsAt: Date?
}
