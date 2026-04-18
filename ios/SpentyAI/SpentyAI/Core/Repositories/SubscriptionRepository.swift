import Foundation

// MARK: - Inline Response Types

struct PromoValidation: Codable, Hashable {
    var valid: Bool
    var code: String?
    var description: String?
}

struct PromoActivation: Codable, Hashable {
    var message: String?
    var subscriptionPlan: String?
    var subscriptionStatus: String?

    enum CodingKeys: String, CodingKey {
        case message
        case subscriptionPlan = "subscription_plan"
        case subscriptionStatus = "subscription_status"
    }
}

struct PaymentOrder: Codable, Hashable {
    var orderId: String?
    var plan: String?
    var amount: Double?
    var status: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case orderId = "order_id"
        case plan
        case amount
        case status
        case createdAt = "created_at"
    }
}

struct PaymentHistory: Codable, Hashable {
    var orders: [PaymentOrder]?
}

// MARK: - Repository

struct SubscriptionRepository {

    func verifyApplePurchase(
        originalTransactionId: String,
        signedPayload: String
    ) async throws -> AppleVerifyResponse {
        let body = AppleVerifyRequest(
            originalTransactionId: originalTransactionId,
            signedPayload: signedPayload
        )
        return try await APIClient.shared.post(APIEndpoints.Payments.appleVerify, body: body)
    }

    func validatePromo(code: String) async throws -> PromoValidation {
        let body = ["code": code]
        return try await APIClient.shared.post(APIEndpoints.Promo.validate, body: body)
    }

    func activatePromo(code: String) async throws -> PromoActivation {
        let body = ["code": code]
        return try await APIClient.shared.post(APIEndpoints.Promo.activate, body: body)
    }

    func getPaymentHistory() async throws -> PaymentHistory {
        try await APIClient.shared.get(APIEndpoints.Payments.history)
    }
}
