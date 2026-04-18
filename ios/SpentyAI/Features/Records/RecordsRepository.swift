import Foundation

// MARK: - Repository

struct RecordsRepository {

    // MARK: - Email Records

    func getRecords(
        query: String? = nil,
        limit: Int = 50,
        skip: Int = 0
    ) async throws -> PaginatedList<Record> {
        var params: [String: String] = [
            "limit": String(limit),
            "skip": String(skip)
        ]
        if let query, !query.isEmpty { params["q"] = query }

        return try await APIClient.shared.get(APIEndpoints.Records.list, query: params)
    }

    func getRecord(_ id: String) async throws -> Record {
        try await APIClient.shared.get(APIEndpoints.Records.record(id))
    }

    func deleteRecord(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Records.delete(id))
    }

    func searchRecords(query: String) async throws -> [Record] {
        let params: [String: String] = ["q": query]
        return try await APIClient.shared.get(APIEndpoints.Records.search, query: params)
    }

    // MARK: - Receipts

    func getReceipts(limit: Int = 50, skip: Int = 0) async throws -> PaginatedList<Receipt> {
        let params: [String: String] = [
            "limit": String(limit),
            "skip": String(skip)
        ]
        return try await APIClient.shared.get(APIEndpoints.Receipts.list, query: params)
    }

    func deleteReceipt(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Receipts.delete(id))
    }
}
