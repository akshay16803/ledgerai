import Foundation

struct DashboardSummary: Codable {
    var netWorth: Double?
    var incomeThisMonth: Double?
    var expenseThisMonth: Double?
    var pendingReview: Int?
    var totalAssets: Double?
    var totalLiabilities: Double?
    var savingsThisMonth: Double?
    var accounts: [Account]?
    var recentTransactions: [Transaction]?
}
