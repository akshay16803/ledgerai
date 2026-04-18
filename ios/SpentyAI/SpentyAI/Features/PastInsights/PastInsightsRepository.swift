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
    let categoryName: String?
}

struct AddTransactionRequest: Codable {
    let date: String
    let description: String
    let amount: Double
    let transactionType: String
    let categoryName: String?
}

struct AvailableEmailsResponse: Codable {
    let emails: [String]
}

struct GenerateResponse: Codable {
    let message: String?
    let id: String?
}

// MARK: - Repository

final class PastInsightsRepository {

    static let shared = PastInsightsRepository()
    private init() {}

    // MARK: - Summaries

    func getSummaries() async throws -> [TaxSummary] {
        try await APIClient.shared.get(APIEndpoints.taxSummary)
    }

    func getSummary(id: String) async throws -> TaxSummary {
        try await APIClient.shared.get(APIEndpoints.taxSummaryDetail(id))
    }

    func createSummary(_ request: CreateTaxSummaryRequest) async throws -> TaxSummary {
        try await APIClient.shared.post(APIEndpoints.taxSummary, body: request)
    }

    func generateSummary() async throws -> GenerateResponse {
        try await APIClient.shared.get(APIEndpoints.taxSummaryGenerate)
    }

    func deleteSummary(id: String) async throws {
        let _: EmptyResponse = try await APIClient.shared.delete(APIEndpoints.taxSummaryDetail(id))
    }

    func getAvailableEmails() async throws -> [String] {
        let response: AvailableEmailsResponse = try await APIClient.shared.get(APIEndpoints.taxSummaryAvailableEmails)
        return response.emails
    }

    // MARK: - Transactions

    func getTransactions(summaryId: String) async throws -> [TaxSummaryTransaction] {
        try await APIClient.shared.get(APIEndpoints.taxSummaryTransactions(summaryId))
    }

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

    func downloadPDF(summaryId: String) async throws -> Data {
        try await APIClient.shared.getRaw(APIEndpoints.taxSummaryDownload(summaryId))
    }
}
