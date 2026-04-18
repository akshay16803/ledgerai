import Foundation

struct LineItem: Codable, Hashable, Identifiable {
    var id: String { "\(description ?? "")-\(quantity)-\(rate)" }

    var description: String?
    var quantity: Double
    var rate: Double
    var discountPercent: Double?
    var gstRate: Double?
    var hsnSac: String?
    var amount: Double?
    var taxAmount: Double?

    enum CodingKeys: String, CodingKey {
        case description
        case quantity
        case rate
        case discountPercent = "discount_percent"
        case gstRate = "gst_rate"
        case hsnSac = "hsn_sac"
        case amount
        case taxAmount = "tax_amount"
    }
}

struct Invoice: Codable, Identifiable, Hashable {
    var id: String { invoiceId }

    let invoiceId: String
    let userId: String?
    var invoiceNumber: String?
    var invoiceType: String?
    var invoiceDate: String?
    var dueDate: String?
    var customerId: String?
    var customerName: String?
    var customerGstin: String?
    var customerAddress: String?
    var customerState: String?
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
        case invoiceId = "invoice_id"
        case userId = "user_id"
        case invoiceNumber = "invoice_number"
        case invoiceType = "invoice_type"
        case invoiceDate = "invoice_date"
        case dueDate = "due_date"
        case customerId = "customer_id"
        case customerName = "customer_name"
        case customerGstin = "customer_gstin"
        case customerAddress = "customer_address"
        case customerState = "customer_state"
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
