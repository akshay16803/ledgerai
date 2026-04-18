import Foundation

// MARK: - Response Types

struct RecordListResponse: Codable {
    let records: [Record]
    let total: Int
}

struct ReceiptListResponse: Codable {
    let receipts: [Receipt]
    let total: Int
}

struct RecordPreviewResponse: Codable {
    let id: String
    let subject: String?
    let sender: String?
    let receivedDate: Date?
    let source: String?
    let body: String?
    let bodyHtml: String?
    let attachments: [RecordAttachment]?
    let transactionId: String?

    enum CodingKeys: String, CodingKey {
        case id = "emailId"
        case subject, sender, receivedDate, source, body, bodyHtml
        case attachments, transactionId
    }
}

struct RecordAttachment: Codable, Identifiable {
    var id: String { "\(index)-\(filename ?? "unknown")" }
    let index: Int
    let filename: String?
    let mimeType: String?
    let size: Int?
}

struct RecordSearchBody: Codable {
    let query: String
    let page: Int?
    let limit: Int?
}

struct ReceiptLinkBody: Codable {
    let transactionId: String
}

struct ReceiptUploadResponse: Codable {
    let id: String
    let filename: String?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case id = "receiptId"
        case filename, message
    }
}

// MARK: - Repository

final class RecordsRepository: Sendable {

    static let shared = RecordsRepository()
    private let api = APIClient.shared

    private init() {}

    // MARK: - Records

    func fetchRecords(
        page: Int = 1,
        limit: Int = 30,
        dateFrom: String? = nil,
        dateTo: String? = nil,
        amountMin: Double? = nil,
        amountMax: Double? = nil
    ) async throws -> RecordListResponse {
        var query: [String] = ["page=\(page)", "limit=\(limit)"]
        if let dateFrom, !dateFrom.isEmpty { query.append("date_from=\(dateFrom)") }
        if let dateTo, !dateTo.isEmpty { query.append("date_to=\(dateTo)") }
        if let amountMin { query.append("amount_min=\(amountMin)") }
        if let amountMax { query.append("amount_max=\(amountMax)") }
        let path = APIEndpoints.records + "?" + query.joined(separator: "&")
        return try await api.get(path)
    }

    func searchRecords(query: String, page: Int = 1, limit: Int = 30) async throws -> RecordListResponse {
        let body = RecordSearchBody(query: query, page: page, limit: limit)
        return try await api.post(APIEndpoints.recordsSearch, body: body)
    }

    func fetchRecordPreview(id: String) async throws -> RecordPreviewResponse {
        return try await api.get(APIEndpoints.recordPreview(id))
    }

    func deleteRecord(id: String) async throws -> MessageResponse {
        return try await api.delete(APIEndpoints.record(id))
    }

    func downloadEml(id: String) async throws -> Data {
        return try await api.getRaw(APIEndpoints.recordDownloadEml(id))
    }

    func downloadAttachment(id: String, index: Int) async throws -> Data {
        return try await api.getRaw(APIEndpoints.recordAttachment(id, index))
    }

    func downloadZip() async throws -> Data {
        return try await api.getRaw(APIEndpoints.recordsDownloadZip)
    }

    // MARK: - Receipts

    func fetchReceipts(page: Int = 1, limit: Int = 30) async throws -> ReceiptListResponse {
        let path = APIEndpoints.receipts + "?page=\(page)&limit=\(limit)"
        return try await api.get(path)
    }

    func uploadReceipt(imageData: Data, filename: String, mimeType: String) async throws -> ReceiptUploadResponse {
        return try await api.upload(
            APIEndpoints.receiptsUpload,
            data: imageData,
            filename: filename,
            mimeType: mimeType
        )
    }

    func parseReceipt(id: String) async throws -> Receipt {
        return try await api.post(APIEndpoints.receiptParse(id))
    }

    func fetchReceipt(id: String) async throws -> Receipt {
        return try await api.get(APIEndpoints.receipt(id))
    }

    func deleteReceipt(id: String) async throws -> MessageResponse {
        return try await api.delete(APIEndpoints.receipt(id))
    }

    func downloadReceipt(id: String) async throws -> Data {
        return try await api.getRaw(APIEndpoints.receiptDownload(id))
    }

    func receiptsByTransaction(id: String) async throws -> ReceiptListResponse {
        return try await api.get(APIEndpoints.receiptsByTransaction(id))
    }

    func linkReceipt(id: String, transactionId: String) async throws -> Receipt {
        return try await api.post(APIEndpoints.receiptLink(id), body: ReceiptLinkBody(transactionId: transactionId))
    }
}
