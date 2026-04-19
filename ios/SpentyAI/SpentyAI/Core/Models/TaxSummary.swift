import Foundation

struct TaxSummary: Codable, Identifiable {
    let id: String
    var name: String?
    var dateFrom: String?
    var dateTo: String?
    var status: String?
    var totalIncome: Double?
    var totalExpenses: Double?
    var net: Double?
    var transactionCount: Int?
    var emailAddress: String?
    var provider: String?

    /// UI convenience – keep backward compatibility with views that use `totalExpense`
    var totalExpense: Double? { totalExpenses }

    /// Parse dateFrom string to Date for views that need it
    var dateFromDate: Date? { Self.parseDate(dateFrom) }
    /// Parse dateTo string to Date for views that need it
    var dateToDate: Date? { Self.parseDate(dateTo) }

    private static func parseDate(_ string: String?) -> Date? {
        guard let string, !string.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        if let d = formatter.date(from: string) { return d }
        let iso = ISO8601DateFormatter()
        return iso.date(from: string)
    }

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
    var date: String?
    var description: String?
    var amount: Double?
    var transactionType: String?
    var category: String?
    var accountName: String?
    var fromEmail: String?
    var source: String?

    /// UI convenience – keep backward compatibility with views that use `categoryName`
    var categoryName: String? { category }

    /// Parse date string to Date for views that need it
    var dateAsDate: Date? {
        guard let date, !date.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        if let d = formatter.date(from: date) { return d }
        let iso = ISO8601DateFormatter()
        return iso.date(from: date)
    }

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
