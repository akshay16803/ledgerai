import Foundation

struct Vendor: Codable, Identifiable {
    let id: String
    var name: String?
    var email: String?
    var phone: String?
    var gstin: String?
    var address: String?
    var totalBilled: Double?
    var totalPaid: Double?
    var outstanding: Double?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case email
        case phone
        case gstin
        case address
        case totalBilled
        case totalPaid
        case outstanding
    }
}
