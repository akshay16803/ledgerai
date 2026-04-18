import Foundation

struct Bill: Codable, Identifiable {
    let id: String
    var billNumber: String?
    var vendorId: String?
    var vendorName: String?
    var date: Date?
    var dueDate: Date?
    var lineItems: [BillLineItem]?
    var subtotal: Double?
    var taxAmount: Double?
    var grandTotal: Double?
    var paymentStatus: String?
    var amountPaid: Double?
    var payments: [BillPayment]?
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case id = "billId"
        case billNumber
        case vendorId
        case vendorName
        case date
        case dueDate
        case lineItems
        case subtotal
        case taxAmount
        case grandTotal
        case paymentStatus
        case amountPaid
        case payments
        case notes
    }
}

struct BillLineItem: Codable, Identifiable {
    var id: String { description ?? UUID().uuidString }
    var description: String?
    var quantity: Double?
    var rate: Double?
    var amount: Double?
    var taxPercent: Double?

    enum CodingKeys: String, CodingKey {
        case description
        case quantity
        case rate
        case amount
        case taxPercent
    }
}

struct BillPayment: Codable, Identifiable {
    var id: String { date?.description ?? UUID().uuidString }
    var amount: Double?
    var date: Date?
    var method: String?
    var note: String?

    enum CodingKeys: String, CodingKey {
        case amount
        case date
        case method
        case note
    }
}
