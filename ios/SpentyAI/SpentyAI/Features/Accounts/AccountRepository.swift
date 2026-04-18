import Foundation

// MARK: - Response Wrappers

struct AccountListResponse: Decodable {
    let accounts: [Account]
}

struct AccountResponse: Decodable {
    let account: Account
}

struct SubTypeListResponse: Decodable {
    let subTypes: [AccountSubType]
}

struct SubTypeResponse: Decodable {
    let subType: AccountSubType
}

struct DeleteResponse: Decodable {
    let message: String?
}

struct AmortizationEntry: Codable, Identifiable {
    var id: Int { month }
    let month: Int
    let emiAmount: Double
    let principalComponent: Double
    let interestComponent: Double
    let outstandingBalance: Double
}

struct AmortizationResponse: Decodable {
    let schedule: [AmortizationEntry]
    let totalInterest: Double?
    let totalPayment: Double?
}

struct ODInterestRequest: Encodable {
    let fromDate: Date
    let toDate: Date
}

struct ODInterestResponse: Decodable {
    let interest: Double
    let days: Int
    let averageBalance: Double?
    let rate: Double?
}

struct TransactionListResponse: Decodable {
    let transactions: [Transaction]
}

struct DematStatement: Codable, Identifiable {
    let id: String
    var filename: String?
    var uploadedAt: Date?
    var status: String?
    var transactionsCount: Int?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case filename
        case uploadedAt
        case status
        case transactionsCount
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

// MARK: - Repository

actor AccountRepository {

    private let api = APIClient.shared

    // MARK: - Accounts

    func fetchAccounts() async throws -> [Account] {
        let response: AccountListResponse = try await api.get(APIEndpoints.accounts)
        return response.accounts
    }

    func fetchAccount(_ id: String) async throws -> Account {
        let response: AccountResponse = try await api.get(APIEndpoints.account(id))
        return response.account
    }

    func createAccount(_ payload: [String: Any]) async throws -> Account {
        let body = JSONPayload(payload)
        let response: AccountResponse = try await api.post(APIEndpoints.accounts, body: body)
        return response.account
    }

    func updateAccount(_ id: String, _ payload: [String: Any]) async throws -> Account {
        let body = JSONPayload(payload)
        let response: AccountResponse = try await api.put(APIEndpoints.account(id), body: body)
        return response.account
    }

    func deleteAccount(_ id: String) async throws {
        let _: DeleteResponse = try await api.delete(APIEndpoints.account(id))
    }

    // MARK: - Amortization & OD

    func fetchAmortization(_ accountId: String) async throws -> AmortizationResponse {
        try await api.get(APIEndpoints.accountAmortization(accountId))
    }

    func calculateODInterest(_ accountId: String, from: Date, to: Date) async throws -> ODInterestResponse {
        let body = ODInterestRequest(fromDate: from, toDate: to)
        return try await api.post(APIEndpoints.accountODInterest(accountId), body: body)
    }

    // MARK: - Account Transactions

    func fetchAccountTransactions(_ accountId: String) async throws -> [Transaction] {
        let response: TransactionListResponse = try await api.get(APIEndpoints.accountTransactions(accountId))
        return response.transactions
    }

    // MARK: - Sub-Types

    func fetchSubTypes() async throws -> [AccountSubType] {
        let response: SubTypeListResponse = try await api.get(APIEndpoints.accountSubTypes)
        return response.subTypes
    }

    func createSubType(_ payload: [String: String]) async throws -> AccountSubType {
        let body = JSONPayload(payload)
        let response: SubTypeResponse = try await api.post(APIEndpoints.accountSubTypes, body: body)
        return response.subType
    }

    func updateSubType(_ id: String, _ payload: [String: String]) async throws -> AccountSubType {
        let body = JSONPayload(payload)
        let response: SubTypeResponse = try await api.put(APIEndpoints.accountSubType(id), body: body)
        return response.subType
    }

    func deleteSubType(_ id: String) async throws {
        let _: DeleteResponse = try await api.delete(APIEndpoints.accountSubType(id))
    }

    // MARK: - Demat

    func uploadDematStatement(data: Data, filename: String, accountId: String) async throws -> DematUploadResponse {
        try await api.upload(
            APIEndpoints.dematUpload,
            data: data,
            filename: filename,
            mimeType: "application/pdf",
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
