import Foundation

struct EmailAccount: Codable, Identifiable {
    var id: String { email ?? UUID().uuidString }
    var email: String?
    var provider: String?
    var connectedAt: Date?
    var syncFromDate: Date?
    var syncing: Bool?
    var needsReconnect: Bool?
    var stats: SyncStats?

    enum CodingKeys: String, CodingKey {
        case email
        case provider
        case connectedAt
        case syncFromDate
        case syncing
        case needsReconnect
        case stats
    }
}

struct SyncStats: Codable {
    var totalEmails: Int?
    var processedEmails: Int?
    var transactionsCreated: Int?
    var lastSyncAt: Date?
    var pendingReview: Int?
}
