import Foundation

struct ReportRepository {

    func getSummary(
        startDate: String? = nil,
        endDate: String? = nil
    ) async throws -> ReportSummary {
        var query: [String: String] = [:]
        if let startDate { query["start_date"] = startDate }
        if let endDate { query["end_date"] = endDate }
        return try await APIClient.shared.get(
            APIEndpoints.Reports.summary,
            query: query.isEmpty ? nil : query
        )
    }

    func getByPeriod(
        startDate: String? = nil,
        endDate: String? = nil
    ) async throws -> PeriodReport {
        var query: [String: String] = [:]
        if let startDate { query["start_date"] = startDate }
        if let endDate { query["end_date"] = endDate }
        return try await APIClient.shared.get(
            APIEndpoints.Reports.periodReport,
            query: query.isEmpty ? nil : query
        )
    }

    func getByCategory(
        startDate: String? = nil,
        endDate: String? = nil,
        transactionType: String? = nil
    ) async throws -> CategoryReport {
        var query: [String: String] = [:]
        if let startDate { query["start_date"] = startDate }
        if let endDate { query["end_date"] = endDate }
        if let transactionType { query["transaction_type"] = transactionType }
        return try await APIClient.shared.get(
            APIEndpoints.Reports.categoryReport,
            query: query.isEmpty ? nil : query
        )
    }
}
