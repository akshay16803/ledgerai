import Foundation

struct ReportSummary: Codable, Hashable {
    var totalIncome: Double?
    var totalExpense: Double?
    var totalTransfers: Double?
    var net: Double?
    var transactionCount: Int?

    enum CodingKeys: String, CodingKey {
        case totalIncome = "total_income"
        case totalExpense = "total_expense"
        case totalTransfers = "total_transfers"
        case net
        case transactionCount = "transaction_count"
    }
}

struct PeriodEntry: Codable, Hashable {
    var period: String?
    var income: Double?
    var expense: Double?
    var transfers: Double?
    var net: Double?
    var transactionCount: Int?

    enum CodingKeys: String, CodingKey {
        case period
        case income
        case expense
        case transfers
        case net
        case transactionCount = "transaction_count"
    }
}

struct PeriodReport: Codable, Hashable {
    var summary: ReportSummary?
    var periods: [PeriodEntry]?
}

struct SubcategoryBreakdown: Codable, Hashable, Identifiable {
    var id: String { name ?? UUID().uuidString }

    var name: String?
    var amount: Double?
    var count: Int?
    var percentage: Double?
}

struct CategoryBreakdown: Codable, Hashable, Identifiable {
    var id: String { name ?? UUID().uuidString }

    var name: String?
    var amount: Double?
    var count: Int?
    var percentage: Double?
    var subcategories: [SubcategoryBreakdown]?
}

struct CategoryReport: Codable, Hashable {
    var summary: ReportSummary?
    var categories: [CategoryBreakdown]?
}
