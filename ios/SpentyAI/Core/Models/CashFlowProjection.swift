import Foundation

struct CashFlowRecurringItem: Codable, Hashable {
    var description: String?
    var amount: Double?
    var frequency: String?
    var type: String?
}

struct CashFlowMandateItem: Codable, Hashable {
    var merchant: String?
    var amount: Double?
    var frequency: String?
    var debitDay: Int?

    enum CodingKeys: String, CodingKey {
        case merchant
        case amount
        case frequency
        case debitDay = "debit_day"
    }
}

struct CashFlowODInterestItem: Codable, Hashable {
    var accountName: String?
    var estimatedInterest: Double?

    enum CodingKeys: String, CodingKey {
        case accountName = "account_name"
        case estimatedInterest = "estimated_interest"
    }
}

struct CashFlowProjectionEntry: Codable, Hashable {
    var month: String?
    var label: String?
    var projectedIncome: Double?
    var projectedExpense: Double?
    var projectedNet: Double?
    var projectedBalance: Double?

    enum CodingKeys: String, CodingKey {
        case month
        case label
        case projectedIncome = "projected_income"
        case projectedExpense = "projected_expense"
        case projectedNet = "projected_net"
        case projectedBalance = "projected_balance"
    }
}

struct CashFlowProjection: Codable, Hashable {
    var currentBalance: Double?
    var monthlyIncome: Double?
    var monthlyExpense: Double?
    var monthlyNet: Double?
    var recurringItems: [CashFlowRecurringItem]?
    var mandateItems: [CashFlowMandateItem]?
    var odInterestItems: [CashFlowODInterestItem]?
    var projection: [CashFlowProjectionEntry]?

    enum CodingKeys: String, CodingKey {
        case currentBalance = "current_balance"
        case monthlyIncome = "monthly_income"
        case monthlyExpense = "monthly_expense"
        case monthlyNet = "monthly_net"
        case recurringItems = "recurring_items"
        case mandateItems = "mandate_items"
        case odInterestItems = "od_interest_items"
        case projection
    }
}
