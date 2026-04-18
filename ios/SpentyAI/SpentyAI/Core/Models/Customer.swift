import Foundation

struct Customer: Codable, Identifiable, Hashable {
    var id: String { customerId }

    let customerId: String
    var name: String
    var gstin: String?
    var pan: String?
    var phone: String?
    var email: String?
    var billingAddress: String?
    var city: String?
    var state: String?
    var pincode: String?
    var notes: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case customerId = "customer_id"
        case name
        case gstin
        case pan
        case phone
        case email
        case billingAddress = "billing_address"
        case city
        case state
        case pincode
        case notes
        case createdAt = "created_at"
    }
}
