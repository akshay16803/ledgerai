import Foundation

// MARK: - API Models

struct PlanDTO: Codable, Identifiable {
    let id: String
    let name: String?
    let amount: Int?
    let amountDisplay: String?
    let currency: String?
    let durationDays: Int?

    enum CodingKeys: String, CodingKey {
        case id = "planId"
        case name
        case amount
        case amountDisplay
        case currency
        case durationDays
    }
}

struct PlansResponse: Codable {
    let plans: [PlanDTO]
}

struct PromoResponse: Codable {
    let valid: Bool?
    let message: String?
    let description: String?
    let plan: String?
    let discount: Double?
    let subscriptionPlan: String?
    let subscriptionStatus: String?

    /// Unified message — uses `message` if present, falls back to `description`
    var displayMessage: String {
        message ?? description ?? ""
    }
}

struct VerifyReceiptRequest: Codable {
    let receiptData: String
    let productId: String

    enum CodingKeys: String, CodingKey {
        case receiptData
        case productId
    }
}

struct VerifyReceiptResponse: Codable {
    let success: Bool
    let message: String?
}

// MARK: - Endpoints

private enum BillingEndpoints {
    static let plans          = "/api/payments/plans"
    static let status         = "/api/payments/status"
    static let history        = "/api/payments/history"
    static let appleVerify    = "/api/payments/apple/verify"
    static let cancel         = "/api/payments/cancel"
    static let promoValidate  = "/api/promo/validate"
    static let promoActivate  = "/api/promo/activate"
}

// MARK: - Repository

final class BillingRepository {

    static let shared = BillingRepository()
    private init() {}

    // MARK: - Plans

    func getPlans() async throws -> [PlanDTO] {
        let response: PlansResponse = try await APIClient.shared.get(BillingEndpoints.plans)
        return response.plans
    }

    // MARK: - Subscription Status

    func getStatus() async throws -> SubscriptionStatus {
        try await APIClient.shared.get(BillingEndpoints.status)
    }

    // MARK: - Payment History

    func getHistory() async throws -> [PaymentOrder] {
        let response: PaymentHistoryResponse = try await APIClient.shared.get(BillingEndpoints.history)
        return response.orders
    }

    // MARK: - Apple Receipt Verification

    func verifyApplePurchase(receiptData: String, productId: String) async throws -> VerifyReceiptResponse {
        let body = VerifyReceiptRequest(receiptData: receiptData, productId: productId)
        return try await APIClient.shared.post(BillingEndpoints.appleVerify, body: body)
    }

    // MARK: - Cancel

    func cancelSubscription() async throws -> VerifyReceiptResponse {
        try await APIClient.shared.post(BillingEndpoints.cancel)
    }

    // MARK: - Promo Codes

    func validatePromo(code: String) async throws -> PromoResponse {
        try await APIClient.shared.post(BillingEndpoints.promoValidate, body: ["code": code])
    }

    func activatePromo(code: String) async throws -> PromoResponse {
        try await APIClient.shared.post(BillingEndpoints.promoActivate, body: ["code": code])
    }
}
