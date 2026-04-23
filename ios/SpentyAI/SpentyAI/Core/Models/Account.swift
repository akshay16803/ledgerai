import Foundation

struct Account: Codable, Identifiable {
    let id: String
    var name: String?
    var accountType: String?
    var subType: String?
    var accountNumber: String?
    var openingBalance: Double?
    var balanceAsOfDate: Date?
    var balance: Double?
    var currency: String?
    var description: String?
    var loanInterestRate: Double?
    var loanTenureMonths: Int?
    var loanEmiAmount: Double?
    var loanEmiDay: Int?
    var loanSanctionedAmount: Double?
    var brokerName: String?
    var aiCreated: Bool?

    enum CodingKeys: String, CodingKey {
        case id = "accountId"
        case name
        case accountType
        case subType
        case accountNumber
        case openingBalance
        case balanceAsOfDate
        case balance
        case currency
        case description
        case loanInterestRate
        case loanTenureMonths
        case loanEmiAmount
        case loanEmiDay
        case loanSanctionedAmount
        case brokerName
        case aiCreated = "ai_created"
    }

    /// Display name — replaces "Unknown Bank" with "Unidentified Account"
    var displayName: String {
        let raw = name ?? "Unnamed Account"
        if raw.lowercased() == "unknown bank" {
            return "Unidentified Account"
        }
        return raw
    }
}

struct AccountSubType: Codable, Identifiable {
    let id: String
    var name: String?
    var accountType: String?
    var icon: String?

    enum CodingKeys: String, CodingKey {
        case id = "subTypeId"
        case name
        case accountType
        case icon
    }
}
