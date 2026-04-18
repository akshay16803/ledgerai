import Foundation

struct AppleVerifyRequest: Codable {
    let originalTransactionId: String
    let signedPayload: String?

    enum CodingKeys: String, CodingKey {
        case originalTransactionId = "original_transaction_id"
        case signedPayload = "signed_payload"
    }
}

struct AppleVerifyResponse: Codable, Hashable {
    let success: Bool
    let subscriptionPlan: String?
    let subscriptionStatus: String?
    let subscriptionExpiry: String?

    enum CodingKeys: String, CodingKey {
        case success
        case subscriptionPlan = "subscription_plan"
        case subscriptionStatus = "subscription_status"
        case subscriptionExpiry = "subscription_expiry"
    }
}
