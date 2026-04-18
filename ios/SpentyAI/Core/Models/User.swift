import Foundation

struct User: Codable, Identifiable, Hashable {
    let id: String
    let email: String
    var name: String?
    var picture: String?
    var emailVerified: Bool?
    var subscriptionPlan: String?
    var subscriptionStatus: String?
    var subscriptionExpiry: String?
    var settings: UserSettings?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case picture
        case emailVerified = "email_verified"
        case subscriptionPlan = "subscription_plan"
        case subscriptionStatus = "subscription_status"
        case subscriptionExpiry = "subscription_expiry"
        case settings
    }
}

struct UserSettings: Codable, Hashable {
    var baseCurrency: String?
    var dateFormat: String?

    enum CodingKeys: String, CodingKey {
        case baseCurrency = "base_currency"
        case dateFormat = "date_format"
    }
}
