import Foundation

struct PeriodsResponse: Codable {
    let periods: [ReportPeriod]
}

struct CategoriesResponse: Codable {
    let categories: [ReportCategory]
}

final class ReportsRepository {

    static let shared = ReportsRepository()
    private init() {}

    // MARK: - Summary

    func getSummary(from: Date, to: Date) async throws -> ReportSummary {
        let query = dateQuery(from: from, to: to)
        return try await APIClient.shared.get(APIEndpoints.reportsSummary + query)
    }

    // MARK: - Period Breakdown

    func getPeriods(from: Date, to: Date) async throws -> [ReportPeriod] {
        let query = dateQuery(from: from, to: to)
        let response: PeriodsResponse = try await APIClient.shared.get(APIEndpoints.reportsByPeriod + query)
        return response.periods
    }

    // MARK: - Category Breakdown

    func getCategories(from: Date, to: Date, type: String = "expense") async throws -> [ReportCategory] {
        let query = dateQuery(from: from, to: to) + "&transaction_type=\(type)"
        let response: CategoriesResponse = try await APIClient.shared.get(APIEndpoints.reportsByCategory + query)
        return response.categories
    }

    // MARK: - Income vs Expense

    func getIncomeExpense(from: Date, to: Date) async throws -> IncomeExpenseResponse {
        let query = dateQuery(from: from, to: to)
        return try await APIClient.shared.get(APIEndpoints.reportsIncomeExpense + query)
    }

    // MARK: - Export

    func exportCSV(from: Date, to: Date) async throws -> Data {
        let query = dateQuery(from: from, to: to)
        return try await APIClient.shared.getRaw(APIEndpoints.reportsExportCSV + query)
    }

    func exportPDF(from: Date, to: Date) async throws -> Data {
        let query = dateQuery(from: from, to: to)
        return try await APIClient.shared.getRaw(APIEndpoints.reportsExportPDF + query)
    }

    // MARK: - Helpers

    private func dateQuery(from: Date, to: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        let fromStr = formatter.string(from: from)
        let toStr = formatter.string(from: to)
        return "?start_date=\(fromStr)&end_date=\(toStr)"
    }
}
