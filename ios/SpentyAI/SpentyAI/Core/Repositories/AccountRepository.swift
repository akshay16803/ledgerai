import Foundation

// MARK: - Inline Response Types

struct AmortizationEntry: Codable, Hashable {
    var month: Int?
    var emiAmount: Double?
    var principalComponent: Double?
    var interestComponent: Double?
    var outstandingBalance: Double?

    enum CodingKeys: String, CodingKey {
        case month
        case emiAmount = "emi_amount"
        case principalComponent = "principal_component"
        case interestComponent = "interest_component"
        case outstandingBalance = "outstanding_balance"
    }
}

struct AmortizationSchedule: Codable, Hashable {
    var accountId: String?
    var accountName: String?
    var outstandingBalance: Double?
    var interestRate: Double?
    var tenureMonths: Int?
    var emiAmount: Double?
    var schedule: [AmortizationEntry]?

    enum CodingKeys: String, CodingKey {
        case accountId = "account_id"
        case accountName = "account_name"
        case outstandingBalance = "outstanding_balance"
        case interestRate = "interest_rate"
        case tenureMonths = "tenure_months"
        case emiAmount = "emi_amount"
        case schedule
    }
}

struct ODDailyBreakdown: Codable, Hashable {
    var date: String?
    var outstandingBalance: Double?
    var interest: Double?

    enum CodingKeys: String, CodingKey {
        case date
        case outstandingBalance = "outstanding_balance"
        case interest
    }
}

struct ODInterestReport: Codable, Hashable {
    var accountId: String?
    var month: String?
    var interestRate: Double?
    var dailyRate: Double?
    var totalInterest: Double?
    var dailyBreakdown: [ODDailyBreakdown]?
    var closingOutstanding: Double?

    enum CodingKeys: String, CodingKey {
        case accountId = "account_id"
        case month
        case interestRate = "interest_rate"
        case dailyRate = "daily_rate"
        case totalInterest = "total_interest"
        case dailyBreakdown = "daily_breakdown"
        case closingOutstanding = "closing_outstanding"
    }
}

struct ODInterestPost: Codable {
    var month: String
    var interestRate: Double?
    var transactions: [[String: String]]?

    enum CodingKeys: String, CodingKey {
        case month
        case interestRate = "interest_rate"
        case transactions
    }
}

struct AccountSubType: Codable, Hashable, Identifiable {
    var id: String { subTypeId ?? UUID().uuidString }

    var subTypeId: String?
    var name: String?
    var accountType: String?
    var icon: String?

    enum CodingKeys: String, CodingKey {
        case subTypeId = "sub_type_id"
        case name
        case accountType = "account_type"
        case icon
    }
}

struct AccountSubTypesResponse: Codable, Hashable {
    var subTypes: [AccountSubType]?

    enum CodingKeys: String, CodingKey {
        case subTypes = "sub_types"
    }
}

// MARK: - Repository

struct AccountRepository {

    func getAccounts() async throws -> [Account] {
        try await APIClient.shared.get(APIEndpoints.Accounts.list)
    }

    func createAccount(_ account: AccountCreate) async throws -> Account {
        try await APIClient.shared.post(APIEndpoints.Accounts.create, body: account)
    }

    func updateAccount(_ id: String, _ update: AccountUpdate) async throws -> Account {
        try await APIClient.shared.put(APIEndpoints.Accounts.update(id), body: update)
    }

    func deleteAccount(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Accounts.delete(id))
    }

    func recalculateBalance(_ id: String) async throws -> Account {
        try await APIClient.shared.post(APIEndpoints.Accounts.recalculate(id))
    }

    func getAmortization(_ id: String) async throws -> AmortizationSchedule {
        try await APIClient.shared.get(APIEndpoints.Accounts.amortization(id))
    }

    func getODInterest(_ id: String, month: String) async throws -> ODInterestReport {
        try await APIClient.shared.get(
            APIEndpoints.Accounts.odInterest(id),
            query: ["month": month]
        )
    }

    func postODInterest(_ id: String, body: ODInterestPost) async throws {
        let _: EmptyResponse = try await APIClient.shared.post(
            APIEndpoints.Accounts.odInterest(id),
            body: body
        )
    }

    func getSubTypes(accountType: String? = nil) async throws -> AccountSubTypesResponse {
        var query: [String: String]? = nil
        if let accountType {
            query = ["account_type": accountType]
        }
        return try await APIClient.shared.get(APIEndpoints.AccountSubTypes.list, query: query)
    }

    func createSubType(name: String, accountType: String, icon: String? = nil) async throws {
        var body: [String: String] = ["name": name, "account_type": accountType]
        if let icon { body["icon"] = icon }
        let _: EmptyResponse = try await APIClient.shared.post(
            APIEndpoints.AccountSubTypes.list,
            body: body
        )
    }

    func updateSubType(_ id: String, name: String? = nil, icon: String? = nil) async throws {
        var body: [String: String] = [:]
        if let name { body["name"] = name }
        if let icon { body["icon"] = icon }
        let _: EmptyResponse = try await APIClient.shared.put(
            APIEndpoints.AccountSubTypes.forType(id),
            body: body
        )
    }

    func deleteSubType(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.AccountSubTypes.forType(id))
    }
}
