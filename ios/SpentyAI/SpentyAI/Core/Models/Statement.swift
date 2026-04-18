import Foundation

enum StatementStatus: String, Codable, Hashable, CaseIterable {
    case parsing
    case ready
    case reconciled
    case failed
    case passwordNeeded = "password_needed"
}

struct ParsedEntry: Codable, Hashable {
    var date: String?
    var description: String?
    var debit: Double?
    var credit: Double?
    var categoryId: String?
    var subcategoryId: String?
    var transactionType: String?

    enum CodingKeys: String, CodingKey {
        case date
        case description
        case debit
        case credit
        case categoryId = "category_id"
        case subcategoryId = "subcategory_id"
        case transactionType = "transaction_type"
    }
}

struct Statement: Codable, Identifiable, Hashable {
    var id: String { statementId }

    let statementId: String
    let userId: String?
    var accountId: String?
    var filename: String?
    var statementType: String?
    var periodFrom: String?
    var periodTo: String?
    var status: StatementStatus?
    var parsedEntries: [ParsedEntry]?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case statementId = "statement_id"
        case userId = "user_id"
        case accountId = "account_id"
        case filename
        case statementType = "statement_type"
        case periodFrom = "period_from"
        case periodTo = "period_to"
        case status
        case parsedEntries = "parsed_entries"
        case createdAt = "created_at"
    }
}
