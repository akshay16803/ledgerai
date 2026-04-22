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

    func disconnectGmail(email: String) async throws -> GenericMessageResponse {
        let body = DisconnectRequest(gmailEmail: email)
        return try await APIClient.shared.post(APIEndpoints.gmailDisconnect, body: body)
    }

    // MARK: - Outlook

    func connectOutlook() async throws -> OAuthConnectResponse {
        try await APIClient.shared.get(APIEndpoints.outlookConnect)
    }

    func outlookStatus() async throws -> EmailProviderStatus {
        try await APIClient.shared.get(APIEndpoints.outlookStatus)
    }

    func disconnectOutlook(email: String) async throws -> GenericMessageResponse {
        let body = DisconnectRequest(outlookEmail: email)
        return try await APIClient.shared.post(APIEndpoints.outlookDisconnect, body: body)
    }

    // MARK: - Sync

    func startSync(gmailEmail: String, syncFromDate: String) async throws -> EmailSyncResponse {
        let body = StartSyncRequest(gmailEmail: gmailEmail, syncFromDate: syncFromDate)
        return try await APIClient.shared.post(APIEndpoints.emailStartSync, body: body)
    }

    func retryPending(gmailEmail: String? = nil) async throws -> EmailRetryResponse {
        let body = RetryPendingRequest(gmailEmail: gmailEmail ?? "")
        return try await APIClient.shared.post(APIEndpoints.emailRetryPending, body: body)
    }

    // MARK: - Stats & Review

    func syncStats() async throws -> EmailSyncStatsResponse {
        try await APIClient.shared.get(APIEndpoints.emailSyncStats)
    }

    func pendingReview() async throws -> [PendingTransaction] {
        let response: PendingReviewResponse = try await APIClient.shared.get(APIEndpoints.emailPendingReview)
        return response.transactions
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

    // MARK: - Source Content

    func sourceContent(id: String) async throws -> SourceContent {
        try await APIClient.shared.get(APIEndpoints.sourceContent(id))
    }
}

// MARK: - Request Models

struct DisconnectRequest: Encodable {
    var gmailEmail: String?
    var outlookEmail: String?
}

struct StartSyncRequest: Encodable {
    let gmailEmail: String
    let syncFromDate: String
}

struct RetryPendingRequest: Encodable {
    let gmailEmail: String
}

struct BulkTransactionRequest: Encodable {
    let transactionIds: [String]
}

struct PendingReviewResponse: Decodable {
    let transactions: [PendingTransaction]
    let total: Int?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.total = try container.decodeIfPresent(Int.self, forKey: .total)

        // Decode transactions one-by-one so a single malformed element
        // doesn't discard the entire array.
        var transactionsContainer = try container.nestedUnkeyedContainer(forKey: .transactions)
        var decoded: [PendingTransaction] = []
        while !transactionsContainer.isAtEnd {
            if let txn = try? transactionsContainer.decode(PendingTransaction.self) {
                decoded.append(txn)
            } else {
                // Skip the malformed element by consuming it as an opaque JSON value
                _ = try? transactionsContainer.decode(AnyCodable.self)
            }
        }
        self.transactions = decoded
    }

    enum CodingKeys: String, CodingKey {
        case transactions, total
    }
}

/// Opaque helper that consumes any JSON value so the unkeyed container advances.
private struct AnyCodable: Decodable {
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { return }
        if let _ = try? container.decode(Bool.self) { return }
        if let _ = try? container.decode(Int.self) { return }
        if let _ = try? container.decode(Double.self) { return }
        if let _ = try? container.decode(String.self) { return }
        if let _ = try? container.decode([AnyCodable].self) { return }
        if let _ = try? container.decode([String: AnyCodable].self) { return }
    }
}

struct PendingTransactionUpdate: Encodable {
    var description: String?
    var amount: Double?
    var accountId: String?
    var toAccountId: String?
    var categoryId: String?
    var subcategoryId: String?
    var date: Date?
    var transactionType: String?
    var paymentMethod: String?
    var isRecurring: Bool?
    var recurringFrequency: String?
    var recurrenceDate: Int?
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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.connected = try? container.decodeIfPresent(Bool.self, forKey: .connected)
        self.message = try? container.decodeIfPresent(String.self, forKey: .message)

        // Decode accounts one-by-one so a single malformed account
        // doesn't discard the entire array.
        if var accountsContainer = try? container.nestedUnkeyedContainer(forKey: .accounts) {
            var decoded: [EmailAccount] = []
            while !accountsContainer.isAtEnd {
                if let account = try? accountsContainer.decode(EmailAccount.self) {
                    decoded.append(account)
                } else {
                    _ = try? accountsContainer.decode(AnyCodable.self)
                }
            }
            self.accounts = decoded
        } else {
            self.accounts = nil
        }
    }

    enum CodingKeys: String, CodingKey {
        case connected, accounts, message
    }
}

struct EmailSyncResponse: Decodable {
    let message: String?
    let gmailEmail: String?
}

struct EmailRetryResponse: Decodable {
    let message: String?
    let count: Int?
    let alreadyProcessing: Bool?
}

struct EmailSyncStatsResponse: Decodable {
    let totalSynced: Int?
    let processedByAi: Int?
    let noTransaction: Int?
    let transactionsCreated: Int?
    let pendingReview: Int?
    let aiFailed: Int?
    let aiPending: Int?
    let isProcessing: Bool?

    /// Total emails AI has finished analyzing (processed + no_transaction)
    var aiAnalyzed: Int {
        (processedByAi ?? 0) + (noTransaction ?? 0)
    }
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
    var subcategoryId: String?
    var paymentMethod: String?
    var transactionType: String?
    var source: String?
    var status: String?
    var sourceEmailId: String?
    var sourceSmsId: String?
    var isRecurring: Bool?
    var recurringFrequency: String?
    var recurrenceDate: Int?

    /// The source ID used to fetch the original email or SMS content.
    var sourceId: String? {
        sourceEmailId ?? sourceSmsId
    }

    enum CodingKeys: String, CodingKey {
        case id = "transactionId"
        case date
        case description
        case amount
        case accountId
        case accountName
        case categoryId
        case categoryName
        case subcategoryId
        case paymentMethod
        case transactionType
        case source
        case status
        case sourceEmailId
        case sourceSmsId
        case isRecurring
        case recurringFrequency
        case recurrenceDate
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        // Use try? so that invalid / empty date strings don't crash the entire model
        self.date = try? container.decodeIfPresent(Date.self, forKey: .date)
        self.description = try? container.decodeIfPresent(String.self, forKey: .description)
        self.amount = try? container.decodeIfPresent(Double.self, forKey: .amount)
        self.accountId = try? container.decodeIfPresent(String.self, forKey: .accountId)
        self.accountName = try? container.decodeIfPresent(String.self, forKey: .accountName)
        self.categoryId = try? container.decodeIfPresent(String.self, forKey: .categoryId)
        self.categoryName = try? container.decodeIfPresent(String.self, forKey: .categoryName)
        self.subcategoryId = try? container.decodeIfPresent(String.self, forKey: .subcategoryId)
        self.paymentMethod = try? container.decodeIfPresent(String.self, forKey: .paymentMethod)
        self.transactionType = try? container.decodeIfPresent(String.self, forKey: .transactionType)
        self.source = try? container.decodeIfPresent(String.self, forKey: .source)
        self.status = try? container.decodeIfPresent(String.self, forKey: .status)
        self.sourceEmailId = try? container.decodeIfPresent(String.self, forKey: .sourceEmailId)
        self.sourceSmsId = try? container.decodeIfPresent(String.self, forKey: .sourceSmsId)
        self.isRecurring = try? container.decodeIfPresent(Bool.self, forKey: .isRecurring)
        self.recurringFrequency = try? container.decodeIfPresent(String.self, forKey: .recurringFrequency)
        self.recurrenceDate = try? container.decodeIfPresent(Int.self, forKey: .recurrenceDate)
    }
}

struct SourceContent: Decodable {
    let type: String
    let sourceId: String?
    let subject: String?
    let from: String?
    let sender: String?
    let date: String?
    let snippet: String?
    let body: String?
}
