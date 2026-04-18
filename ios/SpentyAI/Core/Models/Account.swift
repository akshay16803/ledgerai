import Foundation

struct Account: Codable, Identifiable, Hashable {
    var id: String { accountId }

    let accountId: String
    let userId: String?
    var name: String
    var accountType: String
    var subType: String?
    var accountNumber: String?
    var openingBalance: Double?
    var currentBalance: Double?
    var balanceAsOfDate: String?
    var currency: String?
    var description: String?

    // Loan fields
    var loanSanctionedAmount: Double?
    var loanInterestRate: Double?
    var loanTenureMonths: Int?
    var loanEmiAmount: Double?
    var loanEmiDay: Int?
    var loanStartDate: String?
    var loanOutstandingBalance: Double?

    var brokerName: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case accountId = "account_id"
        case userId = "user_id"
        case name
        case accountType = "account_type"
        case subType = "sub_type"
        case accountNumber = "account_number"
        case openingBalance = "opening_balance"
        case currentBalance = "current_balance"
        case balanceAsOfDate = "balance_as_of_date"
        case currency
        case description
        case loanSanctionedAmount = "loan_sanctioned_amount"
        case loanInterestRate = "loan_interest_rate"
        case loanTenureMonths = "loan_tenure_months"
        case loanEmiAmount = "loan_emi_amount"
        case loanEmiDay = "loan_emi_day"
        case loanStartDate = "loan_start_date"
        case loanOutstandingBalance = "loan_outstanding_balance"
        case brokerName = "broker_name"
        case createdAt = "created_at"
    }
}

struct AccountCreate: Codable {
    var name: String
    var accountType: String
    var subType: String?
    var accountNumber: String?
    var openingBalance: Double?
    var currency: String?
    var description: String?
    var loanSanctionedAmount: Double?
    var loanInterestRate: Double?
    var loanTenureMonths: Int?
    var loanEmiAmount: Double?
    var loanEmiDay: Int?
    var loanStartDate: String?
    var brokerName: String?

    enum CodingKeys: String, CodingKey {
        case name
        case accountType = "account_type"
        case subType = "sub_type"
        case accountNumber = "account_number"
        case openingBalance = "opening_balance"
        case currency
        case description
        case loanSanctionedAmount = "loan_sanctioned_amount"
        case loanInterestRate = "loan_interest_rate"
        case loanTenureMonths = "loan_tenure_months"
        case loanEmiAmount = "loan_emi_amount"
        case loanEmiDay = "loan_emi_day"
        case loanStartDate = "loan_start_date"
        case brokerName = "broker_name"
    }
}

struct AccountUpdate: Codable {
    var name: String?
    var accountType: String?
    var subType: String?
    var accountNumber: String?
    var openingBalance: Double?
    var currency: String?
    var description: String?
    var loanSanctionedAmount: Double?
    var loanInterestRate: Double?
    var loanTenureMonths: Int?
    var loanEmiAmount: Double?
    var loanEmiDay: Int?
    var loanStartDate: String?
    var loanOutstandingBalance: Double?
    var brokerName: String?

    enum CodingKeys: String, CodingKey {
        case name
        case accountType = "account_type"
        case subType = "sub_type"
        case accountNumber = "account_number"
        case openingBalance = "opening_balance"
        case currency
        case description
        case loanSanctionedAmount = "loan_sanctioned_amount"
        case loanInterestRate = "loan_interest_rate"
        case loanTenureMonths = "loan_tenure_months"
        case loanEmiAmount = "loan_emi_amount"
        case loanEmiDay = "loan_emi_day"
        case loanStartDate = "loan_start_date"
        case loanOutstandingBalance = "loan_outstanding_balance"
        case brokerName = "broker_name"
    }
}
