import Foundation

struct TaxSummary: Codable, Identifiable {
    let id: String
    var name: String?
    var dateFrom: Date?
    var dateTo: Date?
    var status: String?
    var totalIncome: Double?
    var totalExpense: Double?
    var net: Double?
    var transactionCount: Int?
    var emailAddress: String?
    var provider: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case dateFrom
        case dateTo
        case status
        case totalIncome
        case totalExpense
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
    var categoryName: String?
    var accountName: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case date
        case description
        case amount
        case transactionType
        case categoryName
        case accountName
    }
}
