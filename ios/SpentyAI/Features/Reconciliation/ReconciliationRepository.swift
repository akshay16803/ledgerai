import Foundation

// MARK: - Inline Response Types

struct ReconciliationResult: Codable, Hashable {
    var matchedCount: Int?
    var missingCount: Int?
    var conflictCount: Int?
    var transactions: [ReconciliationTransaction]?

    enum CodingKeys: String, CodingKey {
        case matchedCount = "matched_count"
        case missingCount = "missing_count"
        case conflictCount = "conflict_count"
        case transactions
    }
}

struct ReconciliationTransaction: Codable, Hashable {
    var date: String?
    var description: String?
    var amount: Double?
    var status: String?
    var categoryId: String?
    var transactionType: String?

    enum CodingKeys: String, CodingKey {
        case date
        case description
        case amount
        case status
        case categoryId = "category_id"
        case transactionType = "transaction_type"
    }
}

struct EntryUpdate: Codable {
    var categoryId: String?
    var subcategoryId: String?
    var transactionType: String?

    enum CodingKeys: String, CodingKey {
        case categoryId = "category_id"
        case subcategoryId = "subcategory_id"
        case transactionType = "transaction_type"
    }
}

struct BulkCategoryEntry: Codable {
    var entryIndex: Int
    var categoryId: String
    var subcategoryId: String?

    enum CodingKeys: String, CodingKey {
        case entryIndex = "entry_index"
        case categoryId = "category_id"
        case subcategoryId = "subcategory_id"
    }
}

struct BulkCategorizeRequest: Codable {
    var entries: [BulkCategoryEntry]
}

struct PasswordRequest: Codable {
    var password: String
}

// MARK: - Repository

struct ReconciliationRepository {

    func getStatements() async throws -> [Statement] {
        try await APIClient.shared.get(APIEndpoints.Reconciliation.statements)
    }

    func getStatement(_ id: String) async throws -> Statement {
        try await APIClient.shared.get(APIEndpoints.Reconciliation.statement(id))
    }

    func uploadStatement(
        fileData: Data,
        fileName: String,
        mimeType: String,
        accountId: String,
        subType: String? = nil,
        periodFrom: String? = nil,
        periodTo: String? = nil
    ) async throws -> Statement {
        var fields: [String: String] = ["account_id": accountId]
        if let subType { fields["sub_type"] = subType }
        if let periodFrom { fields["period_from"] = periodFrom }
        if let periodTo { fields["period_to"] = periodTo }

        return try await APIClient.shared.upload(
            APIEndpoints.Reconciliation.upload,
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            extraFields: fields
        )
    }

    func deleteStatement(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Reconciliation.delete(id))
    }

    func reconcile(_ id: String) async throws -> ReconciliationResult {
        try await APIClient.shared.post(APIEndpoints.Reconciliation.reconcile(id))
    }

    func unlockStatement(_ id: String, password: String) async throws -> Statement {
        try await APIClient.shared.post(
            APIEndpoints.Reconciliation.password(id),
            body: PasswordRequest(password: password)
        )
    }

    func updateEntry(
        _ statementId: String,
        entryIndex: Int,
        update: EntryUpdate
    ) async throws -> Statement {
        try await APIClient.shared.put(
            APIEndpoints.Reconciliation.updateEntry(statementId, entryIndex: entryIndex),
            body: update
        )
    }

    func bulkCategorize(_ id: String, entries: [BulkCategoryEntry]) async throws -> Statement {
        try await APIClient.shared.post(
            APIEndpoints.Reconciliation.bulkCategorize(id),
            body: BulkCategorizeRequest(entries: entries)
        )
    }
}
