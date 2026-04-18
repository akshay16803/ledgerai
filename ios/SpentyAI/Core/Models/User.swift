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
    var settings: AppSettings?

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

// UserSettings merged into AppSettings (in Settings.swift) — kept as typealias for backwards compat
typealias UserSettings = AppSettings
