import Foundation

// MARK: - Response Types

struct RecordListResponse: Codable {
    let records: [Record]
    let total: Int
}

/// Search endpoint returns `items` instead of `records`
struct RecordSearchResponse: Codable {
    let items: [Record]
    let total: Int
}

struct ReceiptListResponse: Codable {
    let receipts: [Receipt]
    let total: Int
}

struct RecordPreviewResponse: Codable {
    let id: String
    let subject: String?
    let fromEmail: String?
    let archivedAt: Date?
    let source: String?
    let body: String?
    let bodyHtml: String?
    let attachments: [RecordAttachment]?
    let transactionId: String?

    /// UI convenience accessors
    var sender: String? { fromEmail }
    var receivedDate: Date? { archivedAt }

    enum CodingKeys: String, CodingKey {
        case id = "archiveId"
        case subject, fromEmail, archivedAt, source, body, bodyHtml
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

struct ReceiptLinkBody: Codable {
    let transactionId: String
}

struct ReceiptUploadResponse: Codable {
    let id: String
    let filename: String?
    let fileSize: Int?
    let mimeType: String?

    enum CodingKeys: String, CodingKey {
        case id = "receiptId"
        case filename
        case fileSize
        case mimeType
    }
}

/// Response from POST /api/receipts/{id}/parse
struct ReceiptParseResponse: Codable {
    let receiptId: String
    let parsedData: ReceiptParsedData?
    let error: String?
}

/// Response from POST /api/receipts/{id}/link
struct ReceiptLinkResponse: Codable {
    let message: String?
    let receiptId: String?
    let transactionId: String?
}

struct DownloadZipBody: Codable {
    let archiveIds: [String]
}

// MARK: - Repository

final class RecordsRepository: Sendable {

    static let shared = RecordsRepository()
    private let api = APIClient.shared

    private init() {}

    // MARK: - Records

    func fetchRecords(
        skip: Int = 0,
        limit: Int = 30,
        dateFrom: String? = nil,
        dateTo: String? = nil,
        amountMin: Double? = nil,
        amountMax: Double? = nil
    ) async throws -> RecordListResponse {
        var query: [String] = ["skip=\(skip)", "limit=\(limit)"]
        if let dateFrom, !dateFrom.isEmpty { query.append("date_from=\(dateFrom)") }
        if let dateTo, !dateTo.isEmpty { query.append("date_to=\(dateTo)") }
        if let amountMin { query.append("amount_min=\(amountMin)") }
        if let amountMax { query.append("amount_max=\(amountMax)") }
        let path = APIEndpoints.records + "?" + query.joined(separator: "&")
        return try await api.get(path)
    }

    func searchRecords(query: String, skip: Int = 0, limit: Int = 30) async throws -> RecordSearchResponse {
        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let path = APIEndpoints.recordsSearch + "?q=\(encodedQuery)&skip=\(skip)&limit=\(limit)"
        return try await api.get(path)
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

    func downloadZip(archiveIds: [String]) async throws -> Data {
        // Backend expects POST with archive_ids body
        let body = DownloadZipBody(archiveIds: archiveIds)
        var request = try buildPostRequest(path: APIEndpoints.recordsDownloadZip, body: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.badRequest("Failed to download ZIP")
        }
        return data
    }

    // MARK: - Receipts

    func fetchReceipts(skip: Int = 0, limit: Int = 30) async throws -> ReceiptListResponse {
        let path = APIEndpoints.receipts + "?skip=\(skip)&limit=\(limit)"
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

    func parseReceipt(id: String) async throws -> ReceiptParseResponse {
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

    func receiptsByTransaction(id: String) async throws -> Receipt {
        // Backend returns a single receipt object, not a list
        return try await api.get(APIEndpoints.receiptsByTransaction(id))
    }

    func linkReceipt(id: String, transactionId: String) async throws -> ReceiptLinkResponse {
        return try await api.post(APIEndpoints.receiptLink(id), body: ReceiptLinkBody(transactionId: transactionId))
    }

    // MARK: - Private helpers

    private func buildPostRequest(path: String, body: Encodable) throws -> URLRequest {
        guard let url = URL(string: api.baseURL + path) else {
            throw APIError.badRequest("Invalid URL: \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = KeychainHelper.read(key: KeychainHelper.sessionTokenKey) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(AnyEncodableWrapper(body))
        return request
    }
}

/// Wrapper to encode any Encodable value
private struct AnyEncodableWrapper: Encodable {
    private let _encode: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { _encode = wrapped.encode }
    func encode(to encoder: Encoder) throws { try _encode(encoder) }
}
