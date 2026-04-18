import Foundation

// MARK: - Response Types

struct DematOverallSummary: Codable, Hashable {
    var totalBuyValue: Double?
    var totalSellValue: Double?
    var totalCharges: Double?
    var netPnl: Double?
    var statementCount: Int?

    enum CodingKeys: String, CodingKey {
        case totalBuyValue = "total_buy_value"
        case totalSellValue = "total_sell_value"
        case totalCharges = "total_charges"
        case netPnl = "net_pnl"
        case statementCount = "statement_count"
    }
}

// MARK: - Repository

struct DematRepository {

    func getStatements() async throws -> [DematStatement] {
        try await APIClient.shared.get(APIEndpoints.Demat.statements)
    }

    func getStatement(_ id: String) async throws -> DematStatement {
        try await APIClient.shared.get(APIEndpoints.Demat.statement(id))
    }

    func uploadStatement(
        fileData: Data,
        fileName: String,
        mimeType: String,
        accountId: String,
        periodFrom: String? = nil,
        periodTo: String? = nil
    ) async throws -> DematStatement {
        var fields: [String: String] = ["account_id": accountId]
        if let periodFrom { fields["period_from"] = periodFrom }
        if let periodTo { fields["period_to"] = periodTo }

        return try await APIClient.shared.upload(
            APIEndpoints.Demat.upload,
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            extraFields: fields
        )
    }

    func deleteStatement(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Demat.delete(id))
    }

    func getSummary() async throws -> DematOverallSummary {
        try await APIClient.shared.get(APIEndpoints.Demat.summary)
    }
}
