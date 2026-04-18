import Foundation

struct TransactionListResponse: Codable {
    let transactions: [Transaction]
    let total: Int
}

struct BulkIdsBody: Codable {
    let ids: [String]
}

struct BulkUpdateBody: Codable {
    let ids: [String]
    let updates: [String: String]
}

struct SearchBody: Codable {
    let query: String
    let page: Int?
    let limit: Int?
}

final class TransactionRepository: Sendable {

    static let shared = TransactionRepository()
    private let api = APIClient.shared

    private init() {}

    // MARK: - List / Pagination

    func fetchTransactions(
        page: Int = 1,
        limit: Int = 30,
        type: String? = nil,
        accountId: String? = nil,
        dateFrom: String? = nil,
        dateTo: String? = nil,
        status: String? = nil
    ) async throws -> TransactionListResponse {
        var query: [String] = ["page=\(page)", "limit=\(limit)"]
        if let type, !type.isEmpty { query.append("type=\(type)") }
        if let accountId, !accountId.isEmpty { query.append("account_id=\(accountId)") }
        if let dateFrom, !dateFrom.isEmpty { query.append("date_from=\(dateFrom)") }
        if let dateTo, !dateTo.isEmpty { query.append("date_to=\(dateTo)") }
        if let status, !status.isEmpty { query.append("status=\(status)") }
        let path = APIEndpoints.transactions + "?" + query.joined(separator: "&")
        return try await api.get(path)
    }

    func fetchPending() async throws -> TransactionListResponse {
        return try await api.get(APIEndpoints.transactionsPending)
    }

    // MARK: - Search

    func search(query: String, page: Int = 1, limit: Int = 30) async throws -> TransactionListResponse {
        let body = SearchBody(query: query, page: page, limit: limit)
        return try await api.post(APIEndpoints.transactionsSearch, body: body)
    }

    // MARK: - CRUD

    func fetchTransaction(id: String) async throws -> Transaction {
        return try await api.get(APIEndpoints.transaction(id))
    }

    func createTransaction(_ transaction: Transaction) async throws -> Transaction {
        return try await api.post(APIEndpoints.transactions, body: transaction)
    }

    func updateTransaction(id: String, _ transaction: Transaction) async throws -> Transaction {
        return try await api.put(APIEndpoints.transaction(id), body: transaction)
    }

    func deleteTransaction(id: String) async throws -> MessageResponse {
        return try await api.delete(APIEndpoints.transaction(id))
    }

    // MARK: - Approve / Reject

    func approveTransaction(id: String) async throws -> Transaction {
        return try await api.post(APIEndpoints.transactionApprove(id))
    }

    func rejectTransaction(id: String) async throws -> Transaction {
        return try await api.post(APIEndpoints.transactionReject(id))
    }

    // MARK: - Bulk Operations

    func bulkApprove(ids: [String]) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionsBulkApprove, body: BulkIdsBody(ids: ids))
    }

    func bulkReject(ids: [String]) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionsBulkReject, body: BulkIdsBody(ids: ids))
    }

    func bulkDelete(ids: [String]) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionsBulkDelete, body: BulkIdsBody(ids: ids))
    }

    func bulkUpdate(ids: [String], updates: [String: String]) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionsBulkUpdate, body: BulkUpdateBody(ids: ids, updates: updates))
    }

    // MARK: - Recurring

    func toggleRecurring(id: String) async throws -> Transaction {
        return try await api.post(APIEndpoints.transactionToggleRecurring(id))
    }

    // MARK: - Supporting Data

    func fetchAccounts() async throws -> [Account] {
        return try await api.get(APIEndpoints.accounts)
    }

    func fetchCategories() async throws -> [Category] {
        return try await api.get(APIEndpoints.categories)
    }
}
