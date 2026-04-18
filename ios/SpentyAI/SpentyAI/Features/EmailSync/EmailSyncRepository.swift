import Foundation

final class EmailSyncRepository {

    static let shared = EmailSyncRepository()
    private init() {}

    // MARK: - Gmail

    func connectGmail() async throws -> OAuthConnectResponse {
        try await APIClient.shared.get(APIEndpoints.gmailConnect)
    }

    func gmailStatus() async throws -> EmailProviderStatus {
        try await APIClient.shared.get(APIEndpoints.gmailStatus)
    }

    func disconnectGmail() async throws -> GenericMessageResponse {
        try await APIClient.shared.post(APIEndpoints.gmailDisconnect)
    }

    // MARK: - Outlook

    func connectOutlook() async throws -> OAuthConnectResponse {
        try await APIClient.shared.get(APIEndpoints.outlookConnect)
    }

    func outlookStatus() async throws -> EmailProviderStatus {
        try await APIClient.shared.get(APIEndpoints.outlookStatus)
    }

    func disconnectOutlook() async throws -> GenericMessageResponse {
        try await APIClient.shared.post(APIEndpoints.outlookDisconnect)
    }

    // MARK: - Sync

    func startSync() async throws -> EmailSyncResponse {
        try await APIClient.shared.post(APIEndpoints.emailStartSync)
    }

    func retryPending() async throws -> EmailRetryResponse {
        try await APIClient.shared.post(APIEndpoints.emailRetryPending)
    }

    // MARK: - Stats & Review

    func syncStats() async throws -> EmailSyncStatsResponse {
        try await APIClient.shared.get(APIEndpoints.emailSyncStats)
    }

    func pendingReview() async throws -> [PendingTransaction] {
        try await APIClient.shared.get(APIEndpoints.emailPendingReview)
    }

    func approveTransaction(_ id: String) async throws -> GenericMessageResponse {
        try await APIClient.shared.post(APIEndpoints.transactionApprove(id))
    }

    func rejectTransaction(_ id: String) async throws -> GenericMessageResponse {
        try await APIClient.shared.post(APIEndpoints.transactionReject(id))
    }

    func bulkApproveTransactions(ids: [String]) async throws -> GenericMessageResponse {
        let body = BulkTransactionRequest(transactionIds: ids)
        return try await APIClient.shared.post(APIEndpoints.transactionsBulkApprove, body: body)
    }

    func bulkRejectTransactions(ids: [String]) async throws -> GenericMessageResponse {
        let body = BulkTransactionRequest(transactionIds: ids)
        return try await APIClient.shared.post(APIEndpoints.transactionsBulkReject, body: body)
    }

    func updateTransaction(_ id: String, body: PendingTransactionUpdate) async throws -> Transaction {
        try await APIClient.shared.patch(APIEndpoints.transaction(id), body: body)
    }

    // MARK: - SMS Stats (for cross-link)

    func smsStats() async throws -> SMSSyncStats {
        try await APIClient.shared.get(APIEndpoints.smsStats)
    }
}

// MARK: - Request Models

struct BulkTransactionRequest: Encodable {
    let transactionIds: [String]
}

struct PendingTransactionUpdate: Encodable {
    var description: String?
    var amount: Double?
    var accountId: String?
    var categoryId: String?
    var date: Date?
}

// MARK: - Response Models

struct OAuthConnectResponse: Decodable {
    let authUrl: String?
    let message: String?
}

struct EmailProviderStatus: Decodable {
    let connected: Bool?
    let accounts: [EmailAccount]?
    let message: String?
}

struct EmailSyncResponse: Decodable {
    let syncing: Bool?
    let message: String?
    let emailsFound: Int?
}

struct EmailRetryResponse: Decodable {
    let retried: Int?
    let succeeded: Int?
    let failed: Int?
    let message: String?
}

struct EmailSyncStatsResponse: Decodable {
    let totalEmails: Int?
    let processedEmails: Int?
    let transactionsCreated: Int?
    let pendingReview: Int?
    let aiFailed: Int?
    let aiPending: Int?
    let isProcessing: Bool?
    let lastSyncAt: Date?
}

struct GenericMessageResponse: Decodable {
    let message: String?
    let success: Bool?
}

struct PendingTransaction: Codable, Identifiable {
    let id: String
    var date: Date?
    var description: String?
    var amount: Double?
    var accountId: String?
    var accountName: String?
    var categoryId: String?
    var categoryName: String?
    var transactionType: String?
    var source: String?
    var status: String?

    enum CodingKeys: String, CodingKey {
        case id = "transactionId"
        case date
        case description
        case amount
        case accountId
        case accountName
        case categoryId
        case categoryName
        case transactionType
        case source
        case status
    }
}
