import Foundation

final class SMSSyncRepository {

    static let shared = SMSSyncRepository()
    private init() {}

    // MARK: - Upload SMS Messages

    func uploadMessages(_ messages: [String]) async throws -> SMSUploadResponse {
        let body = SMSUploadRequest(messages: messages)
        return try await APIClient.shared.post(APIEndpoints.smsUpload, body: body)
    }

    // MARK: - Bulk Parse

    func bulkParse() async throws -> SMSParseResponse {
        try await APIClient.shared.post(APIEndpoints.smsBulkParse)
    }

    // MARK: - Parse Single

    func parseSingle(_ messageId: String) async throws -> SMSParseResponse {
        let body = SMSParseRequest(messageId: messageId)
        return try await APIClient.shared.post(APIEndpoints.smsParse, body: body)
    }

    // MARK: - Retry Pending

    func retryPending() async throws -> SMSRetryResponse {
        try await APIClient.shared.post(APIEndpoints.smsRetryPending)
    }

    // MARK: - Detect Mandates

    func detectMandates() async throws -> SMSMandateResponse {
        try await APIClient.shared.post(APIEndpoints.smsDetectMandates)
    }

    // MARK: - Stats

    func getStats() async throws -> SMSSyncStats {
        try await APIClient.shared.get(APIEndpoints.smsStats)
    }
}

// MARK: - Request Models

struct SMSUploadRequest: Encodable {
    let messages: [String]
}

struct SMSParseRequest: Encodable {
    let messageId: String
}

// MARK: - Response Models

struct SMSUploadResponse: Decodable {
    let uploaded: Int
    let duplicates: Int
    let message: String?
}

struct SMSParseResponse: Decodable {
    let parsed: Int
    let transactionsFound: Int
    let failed: Int
    let message: String?
}

struct SMSRetryResponse: Decodable {
    let retried: Int
    let succeeded: Int
    let failed: Int
    let message: String?
}

struct SMSMandateResponse: Decodable {
    let mandatesFound: Int
    let message: String?
}

struct SMSSyncStats: Decodable {
    let totalUploaded: Int
    let totalParsed: Int
    let transactionsFound: Int
    let pendingReview: Int
    let failed: Int
    let lastSyncDate: Date?
}
