import Foundation

// MARK: - Request Models

struct CreateTaxSummaryRequest: Codable {
    let name: String
    let dateFrom: String
    let dateTo: String
    let emailAddress: String
}

struct UpdateTransactionRequest: Codable {
    let date: String?
    let description: String?
    let amount: Double?
    let transactionType: String?
    let category: String?
}

struct AddTransactionRequest: Codable {
    let date: String
    let description: String
    let amount: Double
    let transactionType: String
    let category: String?
}

// MARK: - Response Models

struct TaxSummaryListResponse: Codable {
    let summaries: [TaxSummary]
}

struct TaxSummaryDetailResponse: Codable {
    let summary: TaxSummary
    let transactions: [TaxSummaryTransaction]
}

struct EmailOption: Codable {
    let email: String
    let provider: String
}

struct AvailableEmailsResponse: Codable {
    let emails: [EmailOption]
}

struct GenerateResponse: Codable {
    let message: String?
    let id: String?
    let dateFrom: String?
    let dateTo: String?
    let totalIncome: Double?
    let totalExpenses: Double?
    let net: Double?
    let transactionCount: Int?
}

// MARK: - Repository

final class PastInsightsRepository {

    static let shared = PastInsightsRepository()
    private init() {}

    // MARK: - Summaries

    func getSummaries() async throws -> [TaxSummary] {
        let response: TaxSummaryListResponse = try await APIClient.shared.get(APIEndpoints.taxSummary)
        return response.summaries
    }

    func getSummaryDetail(id: String) async throws -> TaxSummaryDetailResponse {
        try await APIClient.shared.get(APIEndpoints.taxSummaryDetail(id))
    }

    func createSummary(_ request: CreateTaxSummaryRequest) async throws -> TaxSummary {
        try await APIClient.shared.post(APIEndpoints.taxSummary, body: request)
    }

    func generateSummary(dateFrom: String, dateTo: String) async throws -> GenerateResponse {
        let path = APIEndpoints.taxSummaryGenerate + "?date_from=\(dateFrom)&date_to=\(dateTo)"
        return try await APIClient.shared.get(path)
    }

    func deleteSummary(id: String) async throws {
        let _: EmptyResponse = try await APIClient.shared.delete(APIEndpoints.taxSummaryDetail(id))
    }

    func getAvailableEmails() async throws -> [EmailOption] {
        let response: AvailableEmailsResponse = try await APIClient.shared.get(APIEndpoints.taxSummaryAvailableEmails)
        return response.emails
    }

    // MARK: - Transactions

    func addTransaction(summaryId: String, _ request: AddTransactionRequest) async throws -> TaxSummaryTransaction {
        try await APIClient.shared.post(APIEndpoints.taxSummaryTransactions(summaryId), body: request)
    }

    func updateTransaction(summaryId: String, txnId: String, _ request: UpdateTransactionRequest) async throws -> TaxSummaryTransaction {
        try await APIClient.shared.put(APIEndpoints.taxSummaryTransaction(summaryId, txnId), body: request)
    }

    func deleteTransaction(summaryId: String, txnId: String) async throws {
        let _: EmptyResponse = try await APIClient.shared.delete(APIEndpoints.taxSummaryTransaction(summaryId, txnId))
    }

    // MARK: - Export / Download

    func exportCSV(summaryId: String) async throws -> Data {
        try await APIClient.shared.getRaw(APIEndpoints.taxSummaryExport(summaryId))
    }

    func downloadCSV(summaryId: String) async throws -> Data {
        // Backend download endpoint also returns CSV, not PDF
        try await APIClient.shared.getRaw(APIEndpoints.taxSummaryDownload(summaryId))
    }
}
