import Foundation

struct TransactionListResponse: Codable {
    let transactions: [Transaction]
    let total: Int?

    init(transactions: [Transaction], total: Int?) {
        self.transactions = transactions
        self.total = total
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.total = try container.decodeIfPresent(Int.self, forKey: .total)
        // Decode transactions one-by-one so a single malformed element
        // doesn't discard the entire array.
        var transactionsContainer = try container.nestedUnkeyedContainer(forKey: .transactions)
        var decoded: [Transaction] = []
        while !transactionsContainer.isAtEnd {
            if let txn = try? transactionsContainer.decode(Transaction.self) {
                decoded.append(txn)
            } else {
                // Skip the malformed element
                _ = try? transactionsContainer.decode(TransactionFallback.self)
            }
        }
        self.transactions = decoded
    }

    enum CodingKeys: String, CodingKey {
        case transactions, total
    }
}

/// Opaque helper that consumes any JSON value so the unkeyed container advances.
private struct TransactionFallback: Decodable {
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { return }
        if let _ = try? container.decode(String.self) { return }
        if let _ = try? container.decode(Int.self) { return }
        if let _ = try? container.decode(Double.self) { return }
        if let _ = try? container.decode(Bool.self) { return }
        if let _ = try? container.decode([String: TransactionFallback].self) { return }
        if let _ = try? container.decode([TransactionFallback].self) { return }
    }
}

struct TransactionItemsResponse: Codable {
    let items: [Transaction]
    let total: Int?

    var asListResponse: TransactionListResponse {
        TransactionListResponse(transactions: items, total: total)
    }
}

struct BulkIdsBody: Codable {
    let transactionIds: [String]

    enum CodingKeys: String, CodingKey {
        case transactionIds = "transaction_ids"
    }
}

struct BulkUpdateBody: Codable {
    let transactionIds: [String]
    let fields: [String: String]

    enum CodingKeys: String, CodingKey {
        case transactionIds = "transaction_ids"
        case fields
    }
}

struct RecurringToggleBody: Codable {
    let isRecurring: Bool
    let recurringFrequency: String?

    enum CodingKeys: String, CodingKey {
        case isRecurring = "is_recurring"
        case recurringFrequency = "recurring_frequency"
    }
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
        categoryId: String? = nil,
        subcategoryId: String? = nil,
        dateFrom: String? = nil,
        dateTo: String? = nil,
        status: String? = nil
    ) async throws -> TransactionListResponse {
        let skip = (page - 1) * limit
        var query: [String] = ["skip=\(skip)", "limit=\(limit)"]
        if let type, !type.isEmpty { query.append("transaction_type=\(type)") }
        if let accountId, !accountId.isEmpty { query.append("account_id=\(accountId)") }
        if let categoryId, !categoryId.isEmpty { query.append("category_id=\(categoryId)") }
        if let subcategoryId, !subcategoryId.isEmpty { query.append("subcategory_id=\(subcategoryId)") }
        if let dateFrom, !dateFrom.isEmpty { query.append("from_date=\(dateFrom)") }
        if let dateTo, !dateTo.isEmpty { query.append("to_date=\(dateTo)") }
        if let status, !status.isEmpty { query.append("status=\(status)") }
        let path = APIEndpoints.transactions + "?" + query.joined(separator: "&")
        return try await api.get(path)
    }

    func fetchPending() async throws -> TransactionListResponse {
        let response: TransactionItemsResponse = try await api.get(APIEndpoints.transactionsPending)
        return response.asListResponse
    }

    // MARK: - Search

    func search(query: String, page: Int = 1, limit: Int = 30) async throws -> TransactionListResponse {
        let skip = (page - 1) * limit
        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let path = APIEndpoints.transactionsSearch + "?q=\(encodedQuery)&skip=\(skip)&limit=\(limit)"
        let response: TransactionItemsResponse = try await api.get(path)
        return response.asListResponse
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

    func rejectTransaction(id: String) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionReject(id))
    }

    // MARK: - Bulk Operations

    func bulkApprove(ids: [String]) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionsBulkApprove, body: BulkIdsBody(transactionIds: ids))
    }

    func bulkReject(ids: [String]) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionsBulkReject, body: BulkIdsBody(transactionIds: ids))
    }

    func bulkDelete(ids: [String]) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionsBulkDelete, body: BulkIdsBody(transactionIds: ids))
    }

    func bulkUpdate(ids: [String], updates: [String: String]) async throws -> MessageResponse {
        return try await api.post(APIEndpoints.transactionsBulkUpdate, body: BulkUpdateBody(transactionIds: ids, fields: updates))
    }

    // MARK: - Recurring

    func toggleRecurring(id: String, isRecurring: Bool, frequency: String? = nil) async throws -> Transaction {
        let body = RecurringToggleBody(isRecurring: isRecurring, recurringFrequency: frequency)
        return try await api.post(APIEndpoints.transactionToggleRecurring(id), body: body)
    }

    // MARK: - Supporting Data

    func fetchAccounts() async throws -> [Account] {
        let response: AccountListResponse = try await api.get(APIEndpoints.accounts)
        return response.accounts
    }

    func fetchCategories() async throws -> [Category] {
        return try await api.get(APIEndpoints.categories)
    }
}
