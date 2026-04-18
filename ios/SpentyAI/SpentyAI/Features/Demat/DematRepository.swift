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

    func getStatements(accountId: String) async throws -> [DematStatement] {
        try await APIClient.shared.get(APIEndpoints.Demat.statements(accountId))
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

    func approveStatement(_ statementId: String) async throws -> DematStatement {
        try await APIClient.shared.post(APIEndpoints.Demat.approve(statementId))
    }

    func rejectStatement(_ statementId: String) async throws -> DematStatement {
        try await APIClient.shared.post(APIEndpoints.Demat.reject(statementId))
    }
}
