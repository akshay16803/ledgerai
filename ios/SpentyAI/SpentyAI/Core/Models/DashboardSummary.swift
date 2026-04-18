import Foundation

struct DashboardSummary: Codable, Hashable {
    var totalAssets: Double?
    var totalLiabilities: Double?
    var netWorth: Double?
    var incomeThisMonth: Double?
    var expenseThisMonth: Double?
    var savingsThisMonth: Double?
    var pendingReview: Int?
    var accounts: [Account]?
    var recentTransactions: [Transaction]?

    enum CodingKeys: String, CodingKey {
        case totalAssets = "total_assets"
        case totalLiabilities = "total_liabilities"
        case netWorth = "net_worth"
        case incomeThisMonth = "income_this_month"
        case expenseThisMonth = "expense_this_month"
        case savingsThisMonth = "savings_this_month"
        case pendingReview = "pending_review"
        case accounts
        case recentTransactions = "recent_transactions"
    }
}
