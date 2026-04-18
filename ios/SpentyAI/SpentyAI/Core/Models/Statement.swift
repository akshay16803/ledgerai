import Foundation

struct Statement: Codable, Identifiable {
    let id: String
    var filename: String?
    var accountId: String?
    var accountName: String?
    var statementType: String?
    var status: String?
    var entryCount: Int?
    var periodFrom: Date?
    var periodTo: Date?
    var uploadedAt: Date?
    var parsedEntries: [ParsedEntry]?
    var reconciliation: ReconciliationResult?
    var auditStatus: String?
    var processingProgress: Double?
    var processingStageLabel: String?

    enum CodingKeys: String, CodingKey {
        case id = "statementId"
        case filename
        case accountId
        case accountName
        case statementType
        case status
        case entryCount
        case periodFrom
        case periodTo
        case uploadedAt
        case parsedEntries
        case reconciliation
        case auditStatus
        case processingProgress
        case processingStageLabel
    }
}

struct ParsedEntry: Codable, Identifiable {
    var id: String { "\(date?.description ?? "")-\(amount ?? 0)-\(description ?? "")" }
    var date: Date?
    var description: String?
    var amount: Double?
    var type: String?
    var balance: Double?
    var categoryId: String?
    var categoryName: String?
    var matched: Bool?
    var matchedTransactionId: String?

    enum CodingKeys: String, CodingKey {
        case date
        case description
        case amount
        case type
        case balance
        case categoryId
        case categoryName
        case matched
        case matchedTransactionId
    }
}

struct ReconciliationResult: Codable {
    var totalEntries: Int?
    var matched: Int?
    var unmatched: Int?
    var missing: Int?
    var openingBalance: Double?
    var closingBalance: Double?
    var computedClosing: Double?
    var difference: Double?
}
