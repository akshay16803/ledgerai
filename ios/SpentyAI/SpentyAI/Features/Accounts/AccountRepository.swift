import Foundation

// MARK: - Response Wrappers

// Backend wraps account list as {"accounts": [...]}
struct AccountListResponse: Decodable {
    let accounts: [Account]
}

// Backend wraps single account as {"account": {...}}
struct AccountResponse: Decodable {
    let account: Account
}

struct AmortizationEntry: Codable, Identifiable {
    var id: Int { month }
    let month: Int
    let emi: Double
    let principal: Double
    let interest: Double
    let outstanding: Double

    // Convenience accessors used by views
    var emiAmount: Double { emi }
    var principalComponent: Double { principal }
    var interestComponent: Double { interest }
    var outstandingBalance: Double { outstanding }
}

struct AmortizationResponse: Decodable {
    let schedule: [AmortizationEntry]
    let totalInterest: Double?
    let totalPayment: Double?
}

struct ODInterestResponse: Decodable {
    let totalInterest: Double
    let dailyBreakdown: [ODDailyEntry]?
    let closingOutstanding: Double?
    let interestRate: Double?

    // Convenience accessors matching the view's expectations
    var interest: Double { totalInterest }
    var days: Int { dailyBreakdown?.count ?? 0 }
    var averageBalance: Double? {
        guard let breakdown = dailyBreakdown, !breakdown.isEmpty else { return nil }
        let sum = breakdown.reduce(0.0) { $0 + $1.outstanding }
        return sum / Double(breakdown.count)
    }
    var rate: Double? { interestRate }
}

struct ODDailyEntry: Decodable {
    let date: String
    let outstanding: Double
    let interest: Double
}

struct AccountTransactionsResponse: Decodable {
    let transactions: [Transaction]
    let total: Int?
    let accountName: String?
}

struct DematStatement: Codable, Identifiable {
    let id: String
    var filename: String?
    var createdAt: String?
    var status: String?
    var transactionIds: [String]?

    enum CodingKeys: String, CodingKey {
        case id = "statementId"
        case filename
        case createdAt
        case status
        case transactionIds
    }

    // Convenience: parse createdAt string to Date
    var uploadedAt: Date? {
        guard let str = createdAt else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = formatter.date(from: str) { return d }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: str)
    }

    // Convenience: count of transactions
    var transactionsCount: Int? {
        guard let ids = transactionIds, !ids.isEmpty else { return nil }
        return ids.count
    }

    /// Whether this statement is pending approval (backend uses "pending_approval")
    var isPendingApproval: Bool {
        guard let s = status?.lowercased() else { return false }
        return s == "pending_approval" || s == "pending"
    }
}

struct DematStatementsResponse: Decodable {
    let statements: [DematStatement]
}

struct DematUploadResponse: Decodable {
    let message: String?
    let statementId: String?
}

struct DematActionResponse: Decodable {
    let message: String?
}

// Backend returns {"sub_types": [...], "grouped": {...}}
// With .convertFromSnakeCase, sub_types becomes subTypes
struct SubTypeListResponse: Decodable {
    let subTypes: [AccountSubType]
}

// Backend returns {"sub_type": {...}} for create/update
// With .convertFromSnakeCase, sub_type becomes subType
struct SubTypeResponse: Decodable {
    let subType: AccountSubType
}

// MARK: - Repository

actor AccountRepository {

    private let api = APIClient.shared

    // MARK: - Accounts

    func fetchAccounts() async throws -> [Account] {
        // Backend returns {"accounts": [...]}
        let response: AccountListResponse = try await api.get(APIEndpoints.accounts)
        return response.accounts
    }

    func fetchAccount(_ id: String) async throws -> Account {
        // Backend returns {"account": {...}}
        let response: AccountResponse = try await api.get(APIEndpoints.account(id))
        return response.account
    }

    func createAccount(_ payload: [String: Any]) async throws -> Account {
        let body = JSONPayload(payload)
        // Backend returns bare account object
        let account: Account = try await api.post(APIEndpoints.accounts, body: body)
        return account
    }

    func updateAccount(_ id: String, _ payload: [String: Any]) async throws -> Account {
        let body = JSONPayload(payload)
        // Backend returns bare account object
        let account: Account = try await api.put(APIEndpoints.account(id), body: body)
        return account
    }

    func deleteAccount(_ id: String) async throws {
        let _: MessageResponse = try await api.delete(APIEndpoints.account(id))
    }

    // MARK: - Amortization & OD

    func fetchAmortization(_ accountId: String) async throws -> AmortizationResponse {
        try await api.get(APIEndpoints.accountAmortization(accountId))
    }

    func calculateODInterest(_ accountId: String, from: Date, to: Date) async throws -> ODInterestResponse {
        // Backend expects GET with ?month=YYYY-MM query param
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        let monthStr = formatter.string(from: from)
        let endpoint = APIEndpoints.accountODInterest(accountId) + "?month=\(monthStr)"
        return try await api.get(endpoint)
    }

    // MARK: - Account Transactions

    func fetchAccountTransactions(_ accountId: String) async throws -> [Transaction] {
        let response: AccountTransactionsResponse = try await api.get(APIEndpoints.accountTransactions(accountId))
        return response.transactions
    }

    func fetchFilteredAccountTransactions(
        _ accountId: String,
        transactionType: String? = nil,
        categoryId: String? = nil,
        startDate: String? = nil,
        endDate: String? = nil,
        minAmount: Double? = nil,
        maxAmount: Double? = nil,
        search: String? = nil
    ) async throws -> (transactions: [Transaction], total: Int) {
        var endpoint = APIEndpoints.accountTransactions(accountId)
        var params: [String] = []
        params.append("limit=100")
        if let transactionType, !transactionType.isEmpty {
            params.append("transaction_type=\(transactionType)")
        }
        if let categoryId, !categoryId.isEmpty {
            params.append("category_id=\(categoryId)")
        }
        if let startDate, !startDate.isEmpty {
            params.append("from_date=\(startDate)")
        }
        if let endDate, !endDate.isEmpty {
            params.append("to_date=\(endDate)")
        }
        if let minAmount {
            params.append("min_amount=\(minAmount)")
        }
        if let maxAmount {
            params.append("max_amount=\(maxAmount)")
        }
        if let search, !search.isEmpty {
            params.append("search=\(search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search)")
        }
        if !params.isEmpty {
            endpoint += "?" + params.joined(separator: "&")
        }
        let response: AccountTransactionsResponse = try await api.get(endpoint)
        return (transactions: response.transactions, total: response.total ?? 0)
    }

    // MARK: - Sub-Types

    func fetchSubTypes() async throws -> [AccountSubType] {
        // Backend returns {"sub_types": [...], "grouped": {...}}
        let response: SubTypeListResponse = try await api.get(APIEndpoints.accountSubTypes)
        return response.subTypes
    }

    func createSubType(_ payload: [String: String]) async throws -> AccountSubType {
        let body = JSONPayload(payload)
        // Backend returns {"sub_type": {...}}
        let response: SubTypeResponse = try await api.post(APIEndpoints.accountSubTypes, body: body)
        return response.subType
    }

    func updateSubType(_ id: String, _ payload: [String: String]) async throws -> AccountSubType {
        let body = JSONPayload(payload)
        // Backend returns {"sub_type": {...}}
        let response: SubTypeResponse = try await api.put(APIEndpoints.accountSubType(id), body: body)
        return response.subType
    }

    func deleteSubType(_ id: String) async throws {
        let _: MessageResponse = try await api.delete(APIEndpoints.accountSubType(id))
    }

    // MARK: - Demat

    func uploadDematStatement(data: Data, filename: String, accountId: String) async throws -> DematUploadResponse {
        // Derive MIME type from filename extension
        let mimeType: String
        if filename.lowercased().hasSuffix(".csv") {
            mimeType = "text/csv"
        } else {
            mimeType = "application/pdf"
        }
        return try await api.upload(
            APIEndpoints.dematUpload,
            data: data,
            filename: filename,
            mimeType: mimeType,
            fields: ["accountId": accountId]
        )
    }

    func fetchDematStatements(_ accountId: String) async throws -> [DematStatement] {
        let response: DematStatementsResponse = try await api.get(APIEndpoints.dematStatements(accountId))
        return response.statements
    }

    func approveDematStatement(_ id: String) async throws {
        let _: DematActionResponse = try await api.post(APIEndpoints.dematApprove(id))
    }

    func rejectDematStatement(_ id: String) async throws {
        let _: DematActionResponse = try await api.post(APIEndpoints.dematReject(id))
    }
}

// MARK: - JSON Payload Helper

private struct JSONPayload: Encodable {
    private let data: [String: AnyCodableValue]

    init(_ dictionary: [String: Any]) {
        var result: [String: AnyCodableValue] = [:]
        for (key, value) in dictionary {
            result[key] = AnyCodableValue(value)
        }
        self.data = result
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(data)
    }
}

private enum AnyCodableValue: Encodable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case date(Date)
    case null

    init(_ value: Any) {
        switch value {
        case let s as String: self = .string(s)
        case let i as Int: self = .int(i)
        case let d as Double: self = .double(d)
        case let b as Bool: self = .bool(b)
        case let dt as Date: self = .date(dt)
        default: self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .int(let v): try container.encode(v)
        case .double(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .date(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }
}
