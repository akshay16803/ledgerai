import Foundation

struct Bill: Codable, Identifiable, Hashable {
    var id: String { billId }

    let billId: String
    let userId: String?
    var billNumber: String?
    var billType: String?
    var billDate: String?
    var dueDate: String?
    var vendorId: String?
    var vendorName: String?
    var vendorGstin: String?
    var vendorAddress: String?
    var vendorState: String?
    var placeOfSupply: String?
    var lineItems: [LineItem]?
    var subtotal: Double?
    var taxTotal: Double?
    var grandTotal: Double?
    var paymentStatus: String?
    var amountPaid: Double?
    var paymentAccountId: String?
    var paymentMethod: String?
    var paymentDate: String?
    var poNumber: String?
    var notes: String?
    var termsConditions: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case billId = "bill_id"
        case userId = "user_id"
        case billNumber = "bill_number"
        case billType = "bill_type"
        case billDate = "bill_date"
        case dueDate = "due_date"
        case vendorId = "vendor_id"
        case vendorName = "vendor_name"
        case vendorGstin = "vendor_gstin"
        case vendorAddress = "vendor_address"
        case vendorState = "vendor_state"
        case placeOfSupply = "place_of_supply"
        case lineItems = "line_items"
        case subtotal
        case taxTotal = "tax_total"
        case grandTotal = "grand_total"
        case paymentStatus = "payment_status"
        case amountPaid = "amount_paid"
        case paymentAccountId = "payment_account_id"
        case paymentMethod = "payment_method"
        case paymentDate = "payment_date"
        case poNumber = "po_number"
        case notes
        case termsConditions = "terms_conditions"
        case createdAt = "created_at"
    }
}
