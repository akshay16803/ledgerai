import Foundation

// MARK: - Request Types

struct MandateCreate: Codable {
    var merchant: String
    var amount: Double
    var frequency: String
    var mandateType: String
    var startDate: String
    var endDate: String?
    var debitDay: Int
    var accountId: String?

    enum CodingKeys: String, CodingKey {
        case merchant
        case amount
        case frequency
        case mandateType = "mandate_type"
        case startDate = "start_date"
        case endDate = "end_date"
        case debitDay = "debit_day"
        case accountId = "account_id"
    }
}

// MARK: - Repository

struct CashFlowRepository {

    func getProjection() async throws -> CashFlowProjection {
        try await APIClient.shared.get(APIEndpoints.CashFlow.projection)
    }

    func getRecurring() async throws -> [CashFlowRecurringItem] {
        try await APIClient.shared.get(APIEndpoints.CashFlow.recurring)
    }

    func getMandates() async throws -> [Mandate] {
        try await APIClient.shared.get(APIEndpoints.Mandates.list)
    }

    func createMandate(_ body: MandateCreate) async throws -> Mandate {
        try await APIClient.shared.post(APIEndpoints.Mandates.create, body: body)
    }

    func updateMandate(_ id: String, _ body: MandateCreate) async throws -> Mandate {
        try await APIClient.shared.put(APIEndpoints.Mandates.update(id), body: body)
    }

    func deleteMandate(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Mandates.delete(id))
    }
}
