import Foundation

// MARK: - API Models

struct PlanDTO: Codable, Identifiable {
    let id: String
    let name: String
    let productId: String
    let price: Double
    let currency: String
    let interval: String?          // "month", "quarter", "year", nil for lifetime
    let features: [String]?

    enum CodingKeys: String, CodingKey {
        case id, name, price, currency, interval, features
        case productId
    }
}

struct PromoResponse: Codable {
    let valid: Bool
    let message: String
    let plan: String?
    let discount: Double?
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
        try await APIClient.shared.get(BillingEndpoints.plans)
    }

    // MARK: - Subscription Status

    func getStatus() async throws -> SubscriptionStatus {
        try await APIClient.shared.get(BillingEndpoints.status)
    }

    // MARK: - Payment History

    func getHistory() async throws -> [PaymentOrder] {
        try await APIClient.shared.get(BillingEndpoints.history)
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
