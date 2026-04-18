import Foundation

struct TaxTotals: Codable, Hashable {
    var income: Double?
    var expense: Double?
    var net: Double?
}

struct TaxSummary: Codable, Identifiable, Hashable {
    var id: String { summaryId }

    let summaryId: String
    var name: String?
    var dateFrom: String?
    var dateTo: String?
    var emailAddress: String?
    var provider: String?
    var status: String?
    var totals: TaxTotals?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case summaryId = "summary_id"
        case name
        case dateFrom = "date_from"
        case dateTo = "date_to"
        case emailAddress = "email_address"
        case provider
        case status
        case totals
        case createdAt = "created_at"
    }
}
