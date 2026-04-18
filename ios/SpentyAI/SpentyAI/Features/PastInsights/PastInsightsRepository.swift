import Foundation

// MARK: - Request Types

struct TaxSummaryCreate: Codable {
    var name: String
    var dateFrom: String
    var dateTo: String
    var emailAddress: String
    var provider: String

    enum CodingKeys: String, CodingKey {
        case name
        case dateFrom = "date_from"
        case dateTo = "date_to"
        case emailAddress = "email_address"
        case provider
    }
}

// MARK: - Repository

struct PastInsightsRepository {

    func getSummaries() async throws -> [TaxSummary] {
        try await APIClient.shared.get(APIEndpoints.TaxSummary.list)
    }

    func getSummary(_ id: String) async throws -> TaxSummary {
        try await APIClient.shared.get(APIEndpoints.TaxSummary.summary(id))
    }

    func createSummary(_ body: TaxSummaryCreate) async throws -> TaxSummary {
        try await APIClient.shared.post(APIEndpoints.TaxSummary.create, body: body)
    }

    func deleteSummary(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.TaxSummary.delete(id))
    }

    func generateSummary(_ id: String) async throws -> TaxSummary {
        try await APIClient.shared.post(APIEndpoints.TaxSummary.generate)
    }
}
