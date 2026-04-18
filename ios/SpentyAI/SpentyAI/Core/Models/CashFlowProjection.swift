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
    var id: String { month ?? UUID().uuidString }
    var month: String?
    var income: Double?
    var expense: Double?
    var mandates: Double?
    var odInterest: Double?
    var net: Double?
    var cumulativeNet: Double?
}

struct RecurringItem: Codable, Identifiable {
    var id: String { description ?? UUID().uuidString }
    var description: String?
    var amount: Double?
    var frequency: String?
    var type: String?
}

struct ODInterestItem: Codable, Identifiable {
    var id: String { accountId ?? UUID().uuidString }
    var accountId: String?
    var accountName: String?
    var monthlyInterest: Double?
    var balance: Double?
    var rate: Double?
}
