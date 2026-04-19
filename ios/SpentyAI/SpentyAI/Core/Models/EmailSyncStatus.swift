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
        case gmailEmail
        case outlookEmail
        case provider
        case connectedAt
        case syncFromDate
        case syncing
        case needsReconnect
        case stats
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Backend returns gmail_email or outlook_email, map either to email
        if let gmail = try container.decodeIfPresent(String.self, forKey: .gmailEmail) {
            self.email = gmail
        } else if let outlook = try container.decodeIfPresent(String.self, forKey: .outlookEmail) {
            self.email = outlook
        } else {
            self.email = nil
        }
        self.provider = try container.decodeIfPresent(String.self, forKey: .provider)
        self.connectedAt = try container.decodeIfPresent(Date.self, forKey: .connectedAt)
        self.syncFromDate = try container.decodeIfPresent(Date.self, forKey: .syncFromDate)
        self.syncing = try container.decodeIfPresent(Bool.self, forKey: .syncing)
        self.needsReconnect = try container.decodeIfPresent(Bool.self, forKey: .needsReconnect)
        self.stats = try container.decodeIfPresent(SyncStats.self, forKey: .stats)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        // Map email back to the provider-specific key
        if provider == "outlook" {
            try container.encodeIfPresent(email, forKey: .outlookEmail)
        } else {
            try container.encodeIfPresent(email, forKey: .gmailEmail)
        }
        try container.encodeIfPresent(provider, forKey: .provider)
        try container.encodeIfPresent(connectedAt, forKey: .connectedAt)
        try container.encodeIfPresent(syncFromDate, forKey: .syncFromDate)
        try container.encodeIfPresent(syncing, forKey: .syncing)
        try container.encodeIfPresent(needsReconnect, forKey: .needsReconnect)
        try container.encodeIfPresent(stats, forKey: .stats)
    }
}

struct SyncStats: Codable {
    var totalSynced: Int?
    var processedByAi: Int?
    var transactionsCreated: Int?
    var pendingReview: Int?
}
