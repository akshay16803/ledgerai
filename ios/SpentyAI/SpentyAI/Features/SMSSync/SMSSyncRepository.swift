import Foundation

final class SMSSyncRepository {

    static let shared = SMSSyncRepository()
    private init() {}

    // MARK: - Upload SMS Messages

    func uploadMessages(_ messages: [SmsMessagePayload]) async throws -> SMSUploadResponse {
        let body = SMSUploadRequest(messages: messages)
        return try await APIClient.shared.post(APIEndpoints.smsUpload, body: body)
    }

    // MARK: - Bulk Parse

    func bulkParse() async throws -> SMSParseResponse {
        let body: [String: String] = [:]  // Backend requires a body
        return try await APIClient.shared.post(APIEndpoints.smsBulkParse, body: body)
    }

    // MARK: - Parse Single

    func parseSingle(message: String, sender: String) async throws -> SMSParseSingleResponse {
        let body = SMSParseRequest(message: message, sender: sender)
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

struct SmsMessagePayload: Encodable {
    let sender: String
    let body: String
    let timestamp: String
    var phoneNumber: String?
}

struct SMSUploadRequest: Encodable {
    let messages: [SmsMessagePayload]
}

struct SMSParseRequest: Encodable {
    let message: String
    let sender: String
}

// MARK: - Response Models

struct SMSUploadResponse: Decodable {
    let stored: Int
    let skipped: Int
    let message: String?
}

struct SMSParseResponse: Decodable {
    let message: String?
    let count: Int?
}

struct SMSParseSingleResponse: Decodable {
    let message: String?

    enum CodingKeys: String, CodingKey {
        case parsed
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Backend returns {"parsed": <dynamic object>} - we skip decoding the dynamic parsed field
        self.message = try container.decodeIfPresent(String.self, forKey: .message)
    }
}

struct SMSRetryResponse: Decodable {
    let message: String?
    let count: Int?
}

struct SMSMandateDetected: Decodable {
    let merchant: String?
    let amount: Double?
    let frequency: String?
    let occurrences: Int?
    let source: String?
}

struct SMSMandateResponse: Decodable {
    let detected: [SMSMandateDetected]
    let total: Int
}

struct SMSSyncStats: Decodable {
    let totalSynced: Int
    let processedByAi: Int
    let noTransaction: Int?
    let aiPending: Int?
    let aiFailed: Int
    let transactionsCreated: Int
    let pendingReview: Int
}
