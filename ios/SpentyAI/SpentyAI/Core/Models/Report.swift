import Foundation

struct ReportSummary: Codable {
    var totalIncome: Double?
    var totalExpense: Double?
    var net: Double?
    var transactionCount: Int?
    var topCategories: [ReportCategory]?
    var dateFrom: Date?
    var dateTo: Date?
}

struct ReportPeriod: Codable, Identifiable {
    var id: String { month ?? UUID().uuidString }
    var month: String?
    var income: Double?
    var expense: Double?
    var net: Double?
    var count: Int?

    /// Convenience alias so views can still use `period`
    var period: String? { month }
    /// Convenience alias so views can still use `transactionCount`
    var transactionCount: Int? { count }
}

struct ReportCategory: Codable, Identifiable {
    var id: String { categoryId ?? categoryName ?? UUID().uuidString }
    var categoryId: String?
    var categoryName: String?
    var total: Double?
    var income: Double?
    var expense: Double?
    var count: Int?

    /// Convenience alias so views can still use `name`
    var name: String? { categoryName }
    /// Convenience alias so views can still use `amount`
    var amount: Double? { total }
    /// Convenience alias so views can still use `transactionCount`
    var transactionCount: Int? { count }
    /// Backend does not send percentage; views compute it from totalCategoryAmount
    var percentage: Double? { nil }
}
