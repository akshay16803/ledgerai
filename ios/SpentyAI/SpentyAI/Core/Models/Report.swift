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
    var id: String { period ?? UUID().uuidString }
    var period: String?
    var income: Double?
    var expense: Double?
    var net: Double?
    var transactionCount: Int?
}

struct ReportCategory: Codable, Identifiable {
    var id: String { categoryId ?? name ?? UUID().uuidString }
    var categoryId: String?
    var name: String?
    var amount: Double?
    var percentage: Double?
    var transactionCount: Int?
}
