import Foundation

struct Vendor: Codable, Identifiable, Hashable {
    var id: String { vendorId }

    let vendorId: String
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
        case vendorId = "vendor_id"
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
