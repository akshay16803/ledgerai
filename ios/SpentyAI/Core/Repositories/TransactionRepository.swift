import Foundation

struct TransactionRepository {

    func getTransactions(
        type: String? = nil,
        status: String? = nil,
        fromDate: String? = nil,
        toDate: String? = nil,
        accountId: String? = nil,
        limit: Int = 50,
        skip: Int = 0
    ) async throws -> PaginatedList<Transaction> {
        var query: [String: String] = [
            "limit": String(limit),
            "skip": String(skip)
        ]
        if let type { query["type"] = type }
        if let status { query["status"] = status }
        if let fromDate { query["from_date"] = fromDate }
        if let toDate { query["to_date"] = toDate }
        if let accountId { query["account_id"] = accountId }

        return try await APIClient.shared.get(APIEndpoints.Transactions.list, query: query)
    }

    func createTransaction(_ txn: TransactionCreate) async throws -> Transaction {
        try await APIClient.shared.post(APIEndpoints.Transactions.create, body: txn)
    }

    func updateTransaction(_ id: String, _ update: TransactionUpdate) async throws -> Transaction {
        try await APIClient.shared.put(APIEndpoints.Transactions.update(id), body: update)
    }

    func deleteTransaction(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Transactions.delete(id))
    }

    func approveTransaction(_ id: String) async throws -> Transaction {
        try await APIClient.shared.post(APIEndpoints.Transactions.approve(id))
    }

    func rejectTransaction(_ id: String) async throws {
        let _: EmptyResponse = try await APIClient.shared.post(APIEndpoints.Transactions.reject(id))
    }

    func toggleRecurring(_ id: String, isRecurring: Bool, frequency: String? = nil) async throws -> Transaction {
        var body: [String: Any] = ["is_recurring": isRecurring]
        if let frequency { body["recurring_frequency"] = frequency }
        let update = TransactionUpdate(isRecurring: isRecurring, recurringFrequency: frequency)
        return try await APIClient.shared.put(APIEndpoints.Transactions.update(id), body: update)
    }
}
