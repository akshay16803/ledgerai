import Foundation

struct TaxSummary: Codable, Identifiable {
    let id: String
    var name: String?
    var dateFrom: Date?
    var dateTo: Date?
    var status: String?
    var totalIncome: Double?
    var totalExpenses: Double?
    var net: Double?
    var transactionCount: Int?
    var emailAddress: String?
    var provider: String?

    /// UI convenience – keep backward compatibility with views that use `totalExpense`
    var totalExpense: Double? { totalExpenses }

    enum CodingKeys: String, CodingKey {
        case id = "summaryId"
        case name
        case dateFrom
        case dateTo
        case status
        case totalIncome
        case totalExpenses
        case net
        case transactionCount
        case emailAddress
        case provider
    }
}

struct TaxSummaryTransaction: Codable, Identifiable {
    let id: String
    var date: Date?
    var description: String?
    var amount: Double?
    var transactionType: String?
    var category: String?
    var accountName: String?
    var fromEmail: String?
    var source: String?

    /// UI convenience – keep backward compatibility with views that use `categoryName`
    var categoryName: String? { category }

    enum CodingKeys: String, CodingKey {
        case id = "txnId"
        case date
        case description
        case amount
        case transactionType
        case category
        case accountName
        case fromEmail
        case source
    }
}
