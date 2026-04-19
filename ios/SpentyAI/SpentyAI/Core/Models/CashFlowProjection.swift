import Foundation

struct CashFlowProjection: Codable {
    var monthlyRecurringIncome: Double?
    var monthlyRecurringExpense: Double?
    var monthlyMandateExpense: Double?
    var monthlyOdInterest: Double?
    var monthlyNet: Double?
    var recurringItems: [RecurringItem]?
    var projection: [ProjectionMonth]?
    var odInterestItems: [ODInterestItem]?
}

struct ProjectionMonth: Codable, Identifiable {
    var id: String { label ?? "\(monthIndex ?? 0)" }
    var monthIndex: Int?
    var label: String?
    var projectedIncome: Double?
    var projectedExpense: Double?
    var mandateExpense: Double?
    var odInterest: Double?
    var net: Double?
    var runningBalance: Double?

    enum CodingKeys: String, CodingKey {
        case monthIndex = "month"
        case label
        case projectedIncome
        case projectedExpense
        case mandateExpense
        case odInterest
        case net
        case runningBalance
    }

    /// Convenience aliases so views can still use the old names
    var month: String? { label }
    var income: Double? { projectedIncome }
    var expense: Double? { projectedExpense }
    var mandates: Double? { mandateExpense }
    var cumulativeNet: Double? { runningBalance }
}

struct RecurringItem: Codable, Identifiable {
    var id: String { transactionId ?? description ?? UUID().uuidString }
    var transactionId: String?
    var description: String?
    var amount: Double?
    var frequency: String?
    var recurringFrequency: String?
    var transactionType: String?
    var monthlyAmount: Double?
    var categoryId: String?
    var accountId: String?
    var isRecurring: Bool?

    /// Convenience alias: the projection endpoint uses `frequency`, the list endpoint uses `recurring_frequency`
    var effectiveFrequency: String? { frequency ?? recurringFrequency }
    /// Convenience alias for type
    var type: String? { transactionType }
}

struct ODInterestItem: Codable, Identifiable {
    var id: String { accountId ?? UUID().uuidString }
    var accountId: String?
    var accountName: String?
    var monthlyInterest: Double?
    var balance: Double?
    var rate: Double?
}
