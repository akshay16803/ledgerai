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

    /// Match the backend's `is_subscription_currently_active`: any of the
    /// active-equivalent statuses keeps the user out of the paywall. Includes
    /// "in_grace_period" so a user whose Apple auto-charge is being retried
    /// keeps their access during Apple's ~16-day retry window — otherwise the
    /// backend would 200 their requests but the iOS gate would lock them out.
    var hasActiveSubscription: Bool {
        guard let status = subscriptionStatus else { return false }
        return status == "active" || status == "trialing" || status == "in_grace_period"
    }
}
