import Foundation

struct StatementListResponse: Codable {
    let statements: [Statement]

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.statements = (try? container.decode([Statement].self, forKey: .statements)) ?? []
    }
}

struct StatementUploadResponse: Codable {
    let statementId: String?
    let message: String?
    let filename: String?
}

struct ReconcileResponse: Codable {
    // The backend reconcile endpoint returns the full reconciliation result directly
    let summary: ReconciliationSummary?
    let matched: [MatchedEntry]?
    let missingFromLedger: [ReconciliationEntry]?
    let missingFromStatement: [ReconciliationEntry]?
    let conflicts: [ConflictEntry]?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.summary = try? container.decodeIfPresent(ReconciliationSummary.self, forKey: .summary)
        self.matched = try? container.decodeIfPresent([MatchedEntry].self, forKey: .matched)
        self.missingFromLedger = try? container.decodeIfPresent([ReconciliationEntry].self, forKey: .missingFromLedger)
        self.missingFromStatement = try? container.decodeIfPresent([ReconciliationEntry].self, forKey: .missingFromStatement)
        self.conflicts = try? container.decodeIfPresent([ConflictEntry].self, forKey: .conflicts)
    }
}

struct ReauditResponse: Codable {
    let statementId: String?
    let status: String?
    let message: String?
}

struct ApproveResponse: Codable {
    let message: String?
    let transactionsCreated: Int?
}

struct EntriesResponse: Codable {
    let entries: [ParsedEntry]
    let total: Int?
    let statementId: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.entries = (try? container.decode([ParsedEntry].self, forKey: .entries)) ?? []
        self.total = try? container.decodeIfPresent(Int.self, forKey: .total)
        self.statementId = try? container.decodeIfPresent(String.self, forKey: .statementId)
    }
}

struct EntryUpdateResponse: Codable {
    let entryIndex: Int?
    let entry: ParsedEntry?
}

struct BulkCategorizeResponse: Codable {
    let updated: Int?
    let total: Int?
}

struct AddMissingResponse: Codable {
    let message: String?
    let added: Int?
}

struct AddMissingBody: Codable {
    let entryIndices: [Int]
}

struct UnlockBody: Codable {
    let password: String
}

struct EntryUpdateBody: Codable {
    let categoryId: String?
    let categoryName: String?
}

struct BulkCategorizeEntry: Codable {
    let entryIndex: Int
    let categoryId: String
    let subcategoryId: String?
}

struct BulkCategorizeBody: Codable {
    let updates: [BulkCategorizeEntry]
}

final class ReconciliationRepository: Sendable {

    static let shared = ReconciliationRepository()
    private let api = APIClient.shared

    private init() {}

    // MARK: - Statements List

    func fetchStatements() async throws -> [Statement] {
        let response: StatementListResponse = try await api.get(APIEndpoints.statementsList)
        return response.statements
    }

    func fetchStatement(id: String) async throws -> Statement {
        return try await api.get(APIEndpoints.statement(id))
    }

    func deleteStatement(id: String) async throws -> MessageResponse {
        return try await api.delete(APIEndpoints.statement(id))
    }

    // MARK: - Upload

    func uploadStatement(
        fileData: Data,
        filename: String,
        mimeType: String,
        accountId: String,
        periodFrom: String,
        periodTo: String
    ) async throws -> StatementUploadResponse {
        let fields: [String: String] = [
            "account_id": accountId,
            "period_from": periodFrom,
            "period_to": periodTo
        ]
        return try await api.upload(
            APIEndpoints.statementsUpload,
            data: fileData,
            filename: filename,
            mimeType: mimeType,
            fields: fields
        )
    }

    // MARK: - Entries

    func fetchEntries(statementId: String) async throws -> [ParsedEntry] {
        let response: EntriesResponse = try await api.get(APIEndpoints.statementEntries(statementId))
        return response.entries
    }

    func updateEntry(statementId: String, index: Int, categoryId: String?, categoryName: String?) async throws -> EntryUpdateResponse {
        let body = EntryUpdateBody(categoryId: categoryId, categoryName: categoryName)
        return try await api.patch(APIEndpoints.statementEntryUpdate(statementId, index), body: body)
    }

    func bulkCategorize(statementId: String, updates: [BulkCategorizeEntry]) async throws -> BulkCategorizeResponse {
        let body = BulkCategorizeBody(updates: updates)
        return try await api.post(APIEndpoints.statementBulkCategorize(statementId), body: body)
    }

    // MARK: - Reconciliation Actions

    func reconcile(statementId: String) async throws -> ReconcileResponse {
        return try await api.post(APIEndpoints.statementReconcile(statementId))
    }

    func addMissingToLedger(statementId: String, entryIndices: [Int]) async throws -> AddMissingResponse {
        let body = AddMissingBody(entryIndices: entryIndices)
        return try await api.post(APIEndpoints.statementAddMissing(statementId), body: body)
    }

    func reaudit(statementId: String) async throws -> ReauditResponse {
        return try await api.post(APIEndpoints.statementReaudit(statementId))
    }

    func unlock(statementId: String, password: String) async throws -> ReauditResponse {
        let body = UnlockBody(password: password)
        return try await api.post(APIEndpoints.statementUnlock(statementId), body: body)
    }

    // MARK: - Approve / Reject

    func approveStatement(id: String) async throws -> ApproveResponse {
        return try await api.post(APIEndpoints.statementApprove(id))
    }

    func rejectStatement(id: String) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.statementReject(id))
    }

    // MARK: - Supporting Data

    func fetchAccounts() async throws -> [Account] {
        let response: AccountListResponse = try await api.get(APIEndpoints.accounts)
        return response.accounts
    }

    func fetchAccountSubTypes() async throws -> [AccountSubType] {
        let response: AccountSubTypesResponse = try await api.get(APIEndpoints.accountSubTypes)
        return response.subTypes
    }

    func fetchCategories() async throws -> [Category] {
        return try await api.get(APIEndpoints.categories)
    }
}
