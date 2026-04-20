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
        case transactionType
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
            for fmt in ["yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "MM/dd/yyyy", "dd MMM yyyy", "yyyy/MM/dd"] {
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
        // Backend sends "transactionType" (camelCase), try both keys
        self.type = (try? container.decodeIfPresent(String.self, forKey: .transactionType))
            ?? (try? container.decodeIfPresent(String.self, forKey: .type))
        self.balance = try? container.decodeIfPresent(Double.self, forKey: .balance)
        self.categoryId = try? container.decodeIfPresent(String.self, forKey: .categoryId)
        self.categoryName = try? container.decodeIfPresent(String.self, forKey: .categoryName)
        self.matched = try? container.decodeIfPresent(Bool.self, forKey: .matched)
        self.matchedTransactionId = try? container.decodeIfPresent(String.self, forKey: .matchedTransactionId)
    }
}

struct ReconciliationSummary: Codable {
    var totalStatementEntries: Int?
    var matched: Int?
    var missingFromLedger: Int?
    var missingFromStatement: Int?
    var conflicts: Int?

    enum CodingKeys: String, CodingKey {
        case totalStatementEntries
        case matched
        case missingFromLedger
        case missingFromStatement
        case conflicts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.totalStatementEntries = try? container.decodeIfPresent(Int.self, forKey: .totalStatementEntries)
        self.matched = try? container.decodeIfPresent(Int.self, forKey: .matched)
        self.missingFromLedger = try? container.decodeIfPresent(Int.self, forKey: .missingFromLedger)
        self.missingFromStatement = try? container.decodeIfPresent(Int.self, forKey: .missingFromStatement)
        self.conflicts = try? container.decodeIfPresent(Int.self, forKey: .conflicts)
    }
}

struct MatchedEntry: Codable, Identifiable {
    var id: String { "\(statementEntry?.description ?? "")-\(statementEntry?.amount ?? 0)-\(matchScore ?? 0)" }
    var statementEntry: ReconciliationEntry?
    var ledgerTransaction: ReconciliationEntry?
    var matchScore: Double?

    enum CodingKeys: String, CodingKey {
        case statementEntry
        case ledgerTransaction
        case matchScore
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.statementEntry = try? container.decodeIfPresent(ReconciliationEntry.self, forKey: .statementEntry)
        self.ledgerTransaction = try? container.decodeIfPresent(ReconciliationEntry.self, forKey: .ledgerTransaction)
        self.matchScore = try? container.decodeIfPresent(Double.self, forKey: .matchScore)
    }
}

struct ReconciliationEntry: Codable, Identifiable {
    var id: String { "\(date ?? "")-\(description ?? "")-\(amount ?? 0)" }
    var date: String?
    var description: String?
    var amount: Double?
    var transactionType: String?

    enum CodingKeys: String, CodingKey {
        case date
        case description
        case amount
        case transactionType
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.date = try? container.decodeIfPresent(String.self, forKey: .date)
        self.description = try? container.decodeIfPresent(String.self, forKey: .description)
        self.amount = try? container.decodeIfPresent(Double.self, forKey: .amount)
        self.transactionType = try? container.decodeIfPresent(String.self, forKey: .transactionType)
    }
}

struct ConflictEntry: Codable, Identifiable {
    var id: String { "\(statementEntry?.description ?? "")-\(amountDifference ?? 0)" }
    var statementEntry: ReconciliationEntry?
    var ledgerTransaction: ReconciliationEntry?
    var amountDifference: Double?

    enum CodingKeys: String, CodingKey {
        case statementEntry
        case ledgerTransaction
        case amountDifference
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.statementEntry = try? container.decodeIfPresent(ReconciliationEntry.self, forKey: .statementEntry)
        self.ledgerTransaction = try? container.decodeIfPresent(ReconciliationEntry.self, forKey: .ledgerTransaction)
        self.amountDifference = try? container.decodeIfPresent(Double.self, forKey: .amountDifference)
    }
}

struct ReconciliationResult: Codable {
    // Legacy fields (kept for backward compatibility)
    var totalEntries: Int?
    var unmatched: Int?
    var missing: Int?
    var openingBalance: Double?
    var closingBalance: Double?
    var computedClosing: Double?
    var difference: Double?

    // New detailed fields from backend
    var summary: ReconciliationSummary?
    var matched: [MatchedEntry]?
    var missingFromLedger: [ReconciliationEntry]?
    var missingFromStatement: [ReconciliationEntry]?
    var conflicts: [ConflictEntry]?

    // Computed counts that prefer new summary, fall back to legacy
    var matchedCount: Int { summary?.matched ?? matched?.count ?? 0 }
    var missingFromLedgerCount: Int { summary?.missingFromLedger ?? missingFromLedger?.count ?? missing ?? 0 }
    var missingFromStatementCount: Int { summary?.missingFromStatement ?? missingFromStatement?.count ?? 0 }
    var conflictsCount: Int { summary?.conflicts ?? conflicts?.count ?? unmatched ?? 0 }
    var totalCount: Int { summary?.totalStatementEntries ?? totalEntries ?? 0 }

    // Memberwise init for building from reconcile response
    init(
        summary: ReconciliationSummary? = nil,
        matched: [MatchedEntry]? = nil,
        missingFromLedger: [ReconciliationEntry]? = nil,
        missingFromStatement: [ReconciliationEntry]? = nil,
        conflicts: [ConflictEntry]? = nil
    ) {
        self.totalEntries = nil
        self.unmatched = nil
        self.missing = nil
        self.openingBalance = nil
        self.closingBalance = nil
        self.computedClosing = nil
        self.difference = nil
        self.summary = summary
        self.matched = matched
        self.missingFromLedger = missingFromLedger
        self.missingFromStatement = missingFromStatement
        self.conflicts = conflicts
    }

    enum CodingKeys: String, CodingKey {
        case totalEntries
        case unmatched
        case missing
        case openingBalance
        case closingBalance
        case computedClosing
        case difference
        case summary
        case matched
        case missingFromLedger
        case missingFromStatement
        case conflicts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.totalEntries = try? container.decodeIfPresent(Int.self, forKey: .totalEntries)
        self.unmatched = try? container.decodeIfPresent(Int.self, forKey: .unmatched)
        self.missing = try? container.decodeIfPresent(Int.self, forKey: .missing)
        self.openingBalance = try? container.decodeIfPresent(Double.self, forKey: .openingBalance)
        self.closingBalance = try? container.decodeIfPresent(Double.self, forKey: .closingBalance)
        self.computedClosing = try? container.decodeIfPresent(Double.self, forKey: .computedClosing)
        self.difference = try? container.decodeIfPresent(Double.self, forKey: .difference)
        self.summary = try? container.decodeIfPresent(ReconciliationSummary.self, forKey: .summary)
        self.matched = try? container.decodeIfPresent([MatchedEntry].self, forKey: .matched)
        self.missingFromLedger = try? container.decodeIfPresent([ReconciliationEntry].self, forKey: .missingFromLedger)
        self.missingFromStatement = try? container.decodeIfPresent([ReconciliationEntry].self, forKey: .missingFromStatement)
        self.conflicts = try? container.decodeIfPresent([ConflictEntry].self, forKey: .conflicts)
    }
}
