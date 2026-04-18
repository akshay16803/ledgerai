import Foundation

struct Mandate: Codable, Identifiable, Hashable {
    var id: String { mandateId }

    let mandateId: String
    var merchant: String?
    var amount: Double?
    var currency: String?
    var frequency: String?
    var mandateType: String?
    var startDate: String?
    var endDate: String?
    var debitDay: Int?
    var accountId: String?
    var detectedBankName: String?
    var status: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case mandateId = "mandate_id"
        case merchant
        case amount
        case currency
        case frequency
        case mandateType = "mandate_type"
        case startDate = "start_date"
        case endDate = "end_date"
        case debitDay = "debit_day"
        case accountId = "account_id"
        case detectedBankName = "detected_bank_name"
        case status
        case createdAt = "created_at"
    }
}
