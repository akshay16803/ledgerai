import Foundation

struct Vendor: Codable, Identifiable {
    let id: String
    var name: String?
    var email: String?
    var phone: String?
    var gstin: String?
    var billingAddress: String?
    var totalBilled: Double?
    var totalPaid: Double?
    var outstanding: Double?

    enum CodingKeys: String, CodingKey {
        case id = "vendorId"
        case name
        case email
        case phone
        case gstin
        case billingAddress
        case totalBilled
        case totalPaid
        case outstanding
    }
}
