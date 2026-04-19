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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Defensive: fallback to UUID if statement_id is missing or null
        self.id = (try? container.decode(String.self, forKey: .id)) ?? UUID().uuidString
        self.filename = try? container.decodeIfPresent(String.self, forKey: .filename)
        self.accountId = try? container.decodeIfPresent(String.self, forKey: .accountId)
        self.accountName = try? container.decodeIfPresent(String.self, forKey: .accountName)
        self.statementType = try? container.decodeIfPresent(String.self, forKey: .statementType)
        self.status = try? container.decodeIfPresent(String.self, forKey: .status)
        self.entryCount = try? container.decodeIfPresent(Int.self, forKey: .entryCount)
        self.periodFrom = try? container.decodeIfPresent(Date.self, forKey: .periodFrom)
        self.periodTo = try? container.decodeIfPresent(Date.self, forKey: .periodTo)
        self.uploadedAt = try? container.decodeIfPresent(Date.self, forKey: .uploadedAt)
        self.parsedEntries = try? container.decodeIfPresent([ParsedEntry].self, forKey: .parsedEntries)
        self.reconciliation = try? container.decodeIfPresent(ReconciliationResult.self, forKey: .reconciliation)
        self.auditStatus = try? container.decodeIfPresent(String.self, forKey: .auditStatus)
        self.processingProgress = try? container.decodeIfPresent(Double.self, forKey: .processingProgress)
        self.processingStageLabel = try? container.decodeIfPresent(String.self, forKey: .processingStageLabel)
    }
}

struct ParsedEntry: Codable, Identifiable {
    /// Stable unique ID — uses matchedTransactionId when available, otherwise a composite key
    var id: String {
        if let txnId = matchedTransactionId, !txnId.isEmpty { return txnId }
        return "\(date?.timeIntervalSince1970 ?? 0)-\(amount ?? 0)-\(description ?? "")-\(balance ?? 0)"
    }
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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Try decoding date as Date first; if that fails, try as raw String and parse manually
        if let dateValue = try? container.decodeIfPresent(Date.self, forKey: .date) {
            self.date = dateValue
        } else if let dateStr = try? container.decodeIfPresent(String.self, forKey: .date),
                  !dateStr.isEmpty {
            // Fallback: try common date formats the custom decoder might miss
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            for fmt in ["dd/MM/yyyy", "dd-MM-yyyy", "MM/dd/yyyy", "dd MMM yyyy", "yyyy/MM/dd"] {
                formatter.dateFormat = fmt
                if let parsed = formatter.date(from: dateStr) {
                    self.date = parsed
                    break
                }
            }
            if self.date == nil { self.date = nil }
        } else {
            self.date = nil
        }
        self.description = try? container.decodeIfPresent(String.self, forKey: .description)
        self.amount = try? container.decodeIfPresent(Double.self, forKey: .amount)
        self.type = try? container.decodeIfPresent(String.self, forKey: .type)
        self.balance = try? container.decodeIfPresent(Double.self, forKey: .balance)
        self.categoryId = try? container.decodeIfPresent(String.self, forKey: .categoryId)
        self.categoryName = try? container.decodeIfPresent(String.self, forKey: .categoryName)
        self.matched = try? container.decodeIfPresent(Bool.self, forKey: .matched)
        self.matchedTransactionId = try? container.decodeIfPresent(String.self, forKey: .matchedTransactionId)
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

    enum CodingKeys: String, CodingKey {
        case totalEntries
        case matched
        case unmatched
        case missing
        case openingBalance
        case closingBalance
        case computedClosing
        case difference
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.totalEntries = try? container.decodeIfPresent(Int.self, forKey: .totalEntries)
        self.matched = try? container.decodeIfPresent(Int.self, forKey: .matched)
        self.unmatched = try? container.decodeIfPresent(Int.self, forKey: .unmatched)
        self.missing = try? container.decodeIfPresent(Int.self, forKey: .missing)
        self.openingBalance = try? container.decodeIfPresent(Double.self, forKey: .openingBalance)
        self.closingBalance = try? container.decodeIfPresent(Double.self, forKey: .closingBalance)
        self.computedClosing = try? container.decodeIfPresent(Double.self, forKey: .computedClosing)
        self.difference = try? container.decodeIfPresent(Double.self, forKey: .difference)
    }
}
