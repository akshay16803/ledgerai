import Foundation

struct RecurringListResponse: Codable {
    let items: [RecurringItem]
}

struct MandateListResponse: Codable {
    let mandates: [Mandate]
}

struct UpcomingMandatesResponse: Codable {
    let upcoming: [Mandate]
}

struct DetectMandatesResponse: Codable {
    let detected: Int?
    let message: String?
}

struct MandateCreateBody: Codable {
    let merchant: String
    let amount: Double
    let frequency: String
    let mandateType: String?
}

struct MandateUpdateBody: Codable {
    let amount: Double?
    let status: String?
    let frequency: String?
}

final class CashFlowRepository: Sendable {

    static let shared = CashFlowRepository()
    private let api = APIClient.shared

    private init() {}

    // MARK: - Projection

    func getProjection() async throws -> CashFlowProjection {
        try await api.get(APIEndpoints.cashflowProjection)
    }

    func getHistory() async throws -> CashFlowProjection {
        try await api.get(APIEndpoints.cashflowHistory)
    }

    // MARK: - Mandates

    func getMandates() async throws -> [Mandate] {
        let response: MandateListResponse = try await api.get(APIEndpoints.mandates)
        return response.mandates
    }

    func getUpcoming() async throws -> [Mandate] {
        let response: UpcomingMandatesResponse = try await api.get(APIEndpoints.mandatesUpcoming)
        return response.upcoming
    }

    func createMandate(merchant: String, amount: Double, frequency: String, mandateType: String? = nil) async throws -> Mandate {
        let body = MandateCreateBody(merchant: merchant, amount: amount, frequency: frequency, mandateType: mandateType)
        return try await api.post(APIEndpoints.mandates, body: body)
    }

    func updateMandate(id: String, amount: Double? = nil, status: String? = nil, frequency: String? = nil) async throws -> Mandate {
        let body = MandateUpdateBody(amount: amount, status: status, frequency: frequency)
        return try await api.patch(APIEndpoints.mandate(id), body: body)
    }

    func deleteMandate(id: String) async throws -> MessageResponse {
        try await api.delete(APIEndpoints.mandate(id))
    }

    func detectMandates() async throws -> DetectMandatesResponse {
        try await api.post(APIEndpoints.mandatesDetect)
    }

    // MARK: - Recurring

    func getRecurringList() async throws -> [RecurringItem] {
        let response: RecurringListResponse = try await api.get(APIEndpoints.recurringList)
        return response.items
    }

    func toggleRecurring(transactionId: String) async throws -> Transaction {
        try await api.post(APIEndpoints.transactionToggleRecurring(transactionId))
    }
}
