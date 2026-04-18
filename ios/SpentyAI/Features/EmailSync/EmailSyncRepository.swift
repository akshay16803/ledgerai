import Foundation

// MARK: - Response Types

struct AuthURLResponse: Codable {
    let url: String
}

struct EmailSyncStatus: Codable {
    let connected: Bool
    let lastSyncDate: String?
    let totalRecords: Int?
    let foundTransactions: Int?
    let skippedCount: Int?
    let pendingCount: Int?
    let failedCount: Int?

    enum CodingKeys: String, CodingKey {
        case connected
        case lastSyncDate = "last_sync_date"
        case totalRecords = "total_records"
        case foundTransactions = "found_transactions"
        case skippedCount = "skipped_count"
        case pendingCount = "pending_count"
        case failedCount = "failed_count"
    }
}

struct SyncResult: Codable {
    let success: Bool
    let newRecords: Int?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case success
        case newRecords = "new_records"
        case message
    }
}

struct PendingTransaction: Codable, Identifiable {
    let id: String
    let date: String?
    let description: String?
    let amount: Double?
    let type: String?
    let suggestedCategory: String?

    enum CodingKeys: String, CodingKey {
        case id
        case date
        case description
        case amount
        case type
        case suggestedCategory = "suggested_category"
    }
}

// MARK: - Repository

struct EmailSyncRepository {
    private let api = APIClient.shared

    // MARK: - Gmail

    func getGmailAuthURL() async throws -> AuthURLResponse {
        try await api.request(APIEndpoints.Gmail.authURL, method: .get)
    }

    func getGmailStatus() async throws -> EmailSyncStatus {
        try await api.request(APIEndpoints.Gmail.status, method: .get)
    }

    func syncGmail() async throws -> SyncResult {
        try await api.request(APIEndpoints.Gmail.sync, method: .post)
    }

    func disconnectGmail() async throws {
        let _: EmptyResponse = try await api.request(APIEndpoints.Gmail.disconnect, method: .post)
    }

    // MARK: - Outlook

    func getOutlookAuthURL() async throws -> AuthURLResponse {
        try await api.request(APIEndpoints.Outlook.authURL, method: .get)
    }

    func getOutlookStatus() async throws -> EmailSyncStatus {
        try await api.request(APIEndpoints.Outlook.status, method: .get)
    }

    func syncOutlook() async throws -> SyncResult {
        try await api.request(APIEndpoints.Outlook.sync, method: .post)
    }

    func disconnectOutlook() async throws {
        let _: EmptyResponse = try await api.request(APIEndpoints.Outlook.disconnect, method: .post)
    }

    // MARK: - Pending Review

    func getPendingReview() async throws -> [PendingTransaction] {
        try await api.request(APIEndpoints.Gmail.records, method: .get, queryItems: [
            URLQueryItem(name: "status", value: "pending")
        ])
    }
}

private struct EmptyResponse: Codable {}
