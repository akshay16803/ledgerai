import Foundation

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
        return try await APIClient.shared.get(APIEndpoints.reportsByPeriod + query)
    }

    // MARK: - Category Breakdown

    func getCategories(from: Date, to: Date, type: String = "expense") async throws -> [ReportCategory] {
        let query = dateQuery(from: from, to: to) + "&type=\(type)"
        return try await APIClient.shared.get(APIEndpoints.reportsByCategory + query)
    }

    // MARK: - Income vs Expense

    func getIncomeExpense(from: Date, to: Date) async throws -> [ReportPeriod] {
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
        return "?from=\(fromStr)&to=\(toStr)"
    }
}
