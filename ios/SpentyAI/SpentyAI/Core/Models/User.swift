import Foundation

struct User: Codable, Identifiable {
    let id: String
    var email: String?
    var name: String?
    var picture: String?
    var subscriptionPlan: String?
    var subscriptionStatus: String?
    var subscriptionExpiry: Date?
    var subscriptionProvider: String?

    enum CodingKeys: String, CodingKey {
        case id = "userId"
        case email
        case name
        case picture
        case subscriptionPlan
        case subscriptionStatus
        case subscriptionExpiry
        case subscriptionProvider
    }

    var hasActiveSubscription: Bool {
        guard let status = subscriptionStatus else { return false }
        return status == "active" || status == "trialing"
    }
}
