import Foundation

struct ReportSummary: Identifiable, Codable {
    let id = UUID()
    var totalIncome: Double?
    var totalExpense: Double?
    var totalTransfers: Double?
    var net: Double?
    var transactionCount: Int?
    var topCategories: [ReportCategory]?
    var startDate: String?
    var endDate: String?

    enum CodingKeys: String, CodingKey {
        case totalIncome, totalExpense, totalTransfers, net, transactionCount, topCategories, startDate, endDate
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalIncome = try? c.decodeIfPresent(Double.self, forKey: .totalIncome)
        totalExpense = try? c.decodeIfPresent(Double.self, forKey: .totalExpense)
        totalTransfers = try? c.decodeIfPresent(Double.self, forKey: .totalTransfers)
        net = try? c.decodeIfPresent(Double.self, forKey: .net)
        transactionCount = try? c.decodeIfPresent(Int.self, forKey: .transactionCount)
        topCategories = try? c.decodeIfPresent([ReportCategory].self, forKey: .topCategories)
        startDate = try? c.decodeIfPresent(String.self, forKey: .startDate)
        endDate = try? c.decodeIfPresent(String.self, forKey: .endDate)
    }
}

struct IncomeExpenseResponse: Codable {
    let id = UUID()
    var totalIncome: Double?
    var totalExpense: Double?
    var net: Double?
    var incomeByCategory: [ReportCategory]?
    var expenseByCategory: [ReportCategory]?
    var startDate: String?
    var endDate: String?

    enum CodingKeys: String, CodingKey {
        case totalIncome, totalExpense, net, incomeByCategory, expenseByCategory, startDate, endDate
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalIncome = try? c.decodeIfPresent(Double.self, forKey: .totalIncome)
        totalExpense = try? c.decodeIfPresent(Double.self, forKey: .totalExpense)
        net = try? c.decodeIfPresent(Double.self, forKey: .net)
        incomeByCategory = try? c.decodeIfPresent([ReportCategory].self, forKey: .incomeByCategory)
        expenseByCategory = try? c.decodeIfPresent([ReportCategory].self, forKey: .expenseByCategory)
        startDate = try? c.decodeIfPresent(String.self, forKey: .startDate)
        endDate = try? c.decodeIfPresent(String.self, forKey: .endDate)
    }
}

struct ReportPeriod: Codable, Identifiable {
    let id = UUID()
    var month: String?
    var income: Double?
    var expense: Double?
    var net: Double?
    var count: Int?
    var transfer: Double?

    /// Convenience alias so views can still use `period`
    var period: String? { month }
    /// Convenience alias so views can still use `transactionCount`
    var transactionCount: Int? { count }

    enum CodingKeys: String, CodingKey {
        case month, income, expense, net, count, transfer
    }

    init(month: String? = nil, income: Double? = nil, expense: Double? = nil, net: Double? = nil, count: Int? = nil, transfer: Double? = nil) {
        self.month = month
        self.income = income
        self.expense = expense
        self.net = net
        self.count = count
        self.transfer = transfer
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        month = try? c.decodeIfPresent(String.self, forKey: .month)
        income = try? c.decodeIfPresent(Double.self, forKey: .income)
        expense = try? c.decodeIfPresent(Double.self, forKey: .expense)
        net = try? c.decodeIfPresent(Double.self, forKey: .net)
        count = try? c.decodeIfPresent(Int.self, forKey: .count)
        transfer = try? c.decodeIfPresent(Double.self, forKey: .transfer)
    }
}

struct ReportCategory: Codable, Identifiable {
    let id = UUID()
    var categoryId: String?
    var categoryName: String?
    var total: Double?
    var income: Double?
    var expense: Double?
    var count: Int?
    var subcategories: [ReportSubcategory]?

    /// Convenience alias so views can still use `name`
    var name: String? { categoryName }
    /// Convenience alias so views can still use `amount`
    var amount: Double? { total }
    /// Convenience alias so views can still use `transactionCount`
    var transactionCount: Int? { count }
    /// Backend does not send percentage; views compute it from totalCategoryAmount
    var percentage: Double? { nil }

    enum CodingKeys: String, CodingKey {
        case categoryId, categoryName, total, income, expense, count, subcategories
    }

    init(categoryId: String? = nil, categoryName: String? = nil, total: Double? = nil, income: Double? = nil, expense: Double? = nil, count: Int? = nil, subcategories: [ReportSubcategory]? = nil) {
        self.categoryId = categoryId
        self.categoryName = categoryName
        self.total = total
        self.income = income
        self.expense = expense
        self.count = count
        self.subcategories = subcategories
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        categoryId = try? c.decodeIfPresent(String.self, forKey: .categoryId)
        categoryName = try? c.decodeIfPresent(String.self, forKey: .categoryName)
        total = try? c.decodeIfPresent(Double.self, forKey: .total)
        income = try? c.decodeIfPresent(Double.self, forKey: .income)
        expense = try? c.decodeIfPresent(Double.self, forKey: .expense)
        count = try? c.decodeIfPresent(Int.self, forKey: .count)
        subcategories = try? c.decodeIfPresent([ReportSubcategory].self, forKey: .subcategories)
    }
}

/// Subcategory breakdown returned by the backend inside each ReportCategory.
struct ReportSubcategory: Codable, Identifiable {
    let id = UUID()
    var subcategoryId: String?
    var subcategoryName: String?
    var total: Double?
    var income: Double?
    var expense: Double?
    var count: Int?

    enum CodingKeys: String, CodingKey {
        case subcategoryId, subcategoryName, total, income, expense, count
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        subcategoryId = try? c.decodeIfPresent(String.self, forKey: .subcategoryId)
        subcategoryName = try? c.decodeIfPresent(String.self, forKey: .subcategoryName)
        total = try? c.decodeIfPresent(Double.self, forKey: .total)
        income = try? c.decodeIfPresent(Double.self, forKey: .income)
        expense = try? c.decodeIfPresent(Double.self, forKey: .expense)
        count = try? c.decodeIfPresent(Int.self, forKey: .count)
    }
}
