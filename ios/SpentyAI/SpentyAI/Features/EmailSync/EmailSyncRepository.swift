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

    // MARK: - Gmail

    func getGmailAuthURL() async throws -> AuthURLResponse {
        try await APIClient.shared.get(APIEndpoints.Gmail.authURL)
    }

    func getGmailStatus() async throws -> EmailSyncStatus {
        try await APIClient.shared.get(APIEndpoints.Gmail.status)
    }

    func syncGmail() async throws -> SyncResult {
        try await APIClient.shared.post(APIEndpoints.Gmail.sync)
    }

    func disconnectGmail() async throws {
        let _: EmptyResponse = try await APIClient.shared.post(APIEndpoints.Gmail.disconnect)
    }

    // MARK: - Outlook

    func getOutlookAuthURL() async throws -> AuthURLResponse {
        try await APIClient.shared.get(APIEndpoints.Outlook.authURL)
    }

    func getOutlookStatus() async throws -> EmailSyncStatus {
        try await APIClient.shared.get(APIEndpoints.Outlook.status)
    }

    func syncOutlook() async throws -> SyncResult {
        try await APIClient.shared.post(APIEndpoints.Outlook.sync)
    }

    func disconnectOutlook() async throws {
        let _: EmptyResponse = try await APIClient.shared.post(APIEndpoints.Outlook.disconnect)
    }

    // MARK: - Pending Review

    func getPendingReview() async throws -> [PendingTransaction] {
        try await APIClient.shared.get(APIEndpoints.Gmail.records, query: ["status": "pending"])
    }
}
