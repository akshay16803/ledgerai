import Foundation

struct CashFlowProjection: Codable {
    var monthlyRecurringIncome: Double?
    var monthlyRecurringExpense: Double?
    var monthlyMandateExpense: Double?
    var monthlyOdInterest: Double?
    var monthlyEmiTotal: Double?
    var monthlyNet: Double?
    var recurringItems: [RecurringItem]?
    var mandateItems: [MandateItem]?
    var odInterestItems: [ODInterestItem]?
    var emiItems: [EMIItem]?
    var projection: [ProjectionMonth]?
}

struct MandateItem: Codable, Identifiable {
    var id: String { mandateId ?? UUID().uuidString }
    var mandateId: String?
    var merchant: String?
    var amount: Double?
    var frequency: String?
    var mandateType: String?
    var monthlyEquivalent: Double?
    var source: String?
    var sourceEmailId: String?
    var sourceEmailSubject: String?
    var startDate: String?
    var debitDay: Int?

    /// Day of month for calendar placement: prefers explicit debitDay, falls back to startDate day
    var dayOfMonth: Int? {
        if let debitDay { return debitDay }
        guard let startDate else { return nil }
        let parts = startDate.split(separator: "-")
        guard parts.count >= 3, let day = Int(parts[2].prefix(2)) else { return nil }
        return day
    }
}

struct EMIItem: Codable, Identifiable {
    var id: String { accountId ?? UUID().uuidString }
    var accountId: String?
    var accountName: String?
    var emiAmount: Double?
    var emiDay: Int?
    var loanInterestRate: Double?
    var loanTenureMonths: Int?
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
    var recurrenceDate: Int?
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
    var interestChargeDay: Int?
}
