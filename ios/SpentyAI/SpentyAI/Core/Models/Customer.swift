import Foundation

struct Customer: Codable, Identifiable, Equatable {
    let id: String
    var name: String?
    var email: String?
    var phone: String?
    var gstin: String?
    var billingAddress: String?
    var shippingAddress: String?
    var totalInvoiced: Double?
    var totalPaid: Double?
    var outstanding: Double?

    enum CodingKeys: String, CodingKey {
        case id = "customerId"
        case name
        case email
        case phone
        case gstin
        case billingAddress
        case shippingAddress
        case totalInvoiced
        case totalPaid
        case outstanding
    }
}
