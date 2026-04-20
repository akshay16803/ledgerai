import Foundation

struct Mandate: Codable, Identifiable {
    let id: String
    var merchant: String?
    var mandateType: String?
    var amount: Double?
    var frequency: String?
    var startDate: Date?
    var status: String?
    var source: String?
    var sourceEmailId: String?
    var sourceEmailSubject: String?

    enum CodingKeys: String, CodingKey {
        case id = "mandateId"
        case merchant
        case mandateType
        case amount
        case frequency
        case startDate
        case status
        case source
        case sourceEmailId
        case sourceEmailSubject
    }
}
