import Foundation

// MARK: - Inline Response Types

struct ReceiptParseResponse: Codable, Hashable {
    var parsedData: ReceiptParsedData?

    enum CodingKeys: String, CodingKey {
        case parsedData = "parsed_data"
    }
}

// MARK: - Repository

struct ReceiptRepository {

    func uploadReceipt(
        fileData: Data,
        fileName: String,
        mimeType: String
    ) async throws -> Receipt {
        try await APIClient.shared.upload(
            APIEndpoints.Receipts.upload,
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType
        )
    }

    func parseReceipt(_ id: String) async throws -> ReceiptParseResponse {
        try await APIClient.shared.post(APIEndpoints.Receipts.parse(id))
    }

    func downloadReceipt(_ id: String) async throws -> Data {
        try await APIClient.shared.get(APIEndpoints.Receipts.download(id))
    }

    func getReceiptByTransaction(_ transactionId: String) async throws -> Receipt? {
        let result: Receipt? = try? await APIClient.shared.get(
            APIEndpoints.Receipts.byTransaction(transactionId)
        )
        return result
    }

    func getReceipts(limit: Int = 50, skip: Int = 0) async throws -> PaginatedList<Receipt> {
        let query: [String: String] = [
            "limit": String(limit),
            "skip": String(skip)
        ]
        return try await APIClient.shared.get(APIEndpoints.Receipts.list, query: query)
    }
}
