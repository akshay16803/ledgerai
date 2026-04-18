import Foundation

struct StatementListResponse: Codable {
    let statements: [Statement]
}

struct StatementUploadResponse: Codable {
    let statement: Statement?
    let message: String?
}

struct ReconcileResponse: Codable {
    let statement: Statement?
    let reconciliation: ReconciliationResult?
    let message: String?
}

struct UnlockBody: Codable {
    let password: String
}

struct EntryUpdateBody: Codable {
    let categoryId: String?
    let categoryName: String?
}

struct BulkCategorizeBody: Codable {
    let categoryId: String
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
    ) async throws -> Statement {
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
        return try await api.get(APIEndpoints.statementEntries(statementId))
    }

    func updateEntry(statementId: String, index: Int, categoryId: String?, categoryName: String?) async throws -> Statement {
        let body = EntryUpdateBody(categoryId: categoryId, categoryName: categoryName)
        return try await api.patch(APIEndpoints.statementEntryUpdate(statementId, index), body: body)
    }

    func bulkCategorize(statementId: String, categoryId: String) async throws -> Statement {
        let body = BulkCategorizeBody(categoryId: categoryId)
        return try await api.post(APIEndpoints.statementBulkCategorize(statementId), body: body)
    }

    // MARK: - Reconciliation Actions

    func reconcile(statementId: String) async throws -> Statement {
        return try await api.post(APIEndpoints.statementReconcile(statementId))
    }

    func addMissingToLedger(statementId: String) async throws -> Statement {
        return try await api.post(APIEndpoints.statementAddMissing(statementId))
    }

    func reaudit(statementId: String) async throws -> Statement {
        return try await api.post(APIEndpoints.statementReaudit(statementId))
    }

    func unlock(statementId: String, password: String) async throws -> Statement {
        let body = UnlockBody(password: password)
        return try await api.post(APIEndpoints.statementUnlock(statementId), body: body)
    }

    // MARK: - Approve / Reject

    func approveStatement(id: String) async throws -> Statement {
        return try await api.post(APIEndpoints.statementApprove(id))
    }

    func rejectStatement(id: String) async throws -> Statement {
        return try await api.post(APIEndpoints.statementReject(id))
    }

    // MARK: - Supporting Data

    func fetchAccounts() async throws -> [Account] {
        return try await api.get(APIEndpoints.accounts)
    }

    func fetchAccountSubTypes() async throws -> [AccountSubType] {
        return try await api.get(APIEndpoints.accountSubTypes)
    }

    func fetchCategories() async throws -> [Category] {
        return try await api.get(APIEndpoints.categories)
    }
}
