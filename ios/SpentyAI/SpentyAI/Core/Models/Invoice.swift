import Foundation

struct Invoice: Codable, Identifiable, Equatable {
    let id: String
    var invoiceNumber: String?
    var customerId: String?
    var customerName: String?
    var date: Date?
    var dueDate: Date?
    var lineItems: [InvoiceLineItem]?
    var subtotal: Double?
    var taxAmount: Double?
    var grandTotal: Double?
    var paymentStatus: String?
    var amountPaid: Double?
    var payments: [InvoicePayment]?
    var notes: String?
    var terms: String?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case invoiceNumber
        case customerId
        case customerName
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
        case terms
    }

    static func == (lhs: Invoice, rhs: Invoice) -> Bool {
        lhs.id == rhs.id
    }
}

struct InvoiceLineItem: Codable, Identifiable, Equatable {
    var id: String = UUID().uuidString
    var description: String?
    var hsnSac: String?
    var quantity: Double?
    var rate: Double?
    var taxPercent: Double?
    var amount: Double?

    enum CodingKeys: String, CodingKey {
        case description
        case hsnSac
        case quantity
        case rate
        case taxPercent
        case amount
    }

    /// Computed taxable amount (quantity * rate).
    var taxableAmount: Double {
        (quantity ?? 0) * (rate ?? 0)
    }

    /// Computed tax amount for this line.
    var taxAmount: Double {
        taxableAmount * (taxPercent ?? 0) / 100.0
    }

    /// Computed total for this line including tax.
    var lineTotal: Double {
        taxableAmount + taxAmount
    }
}

struct InvoicePayment: Codable, Identifiable, Equatable {
    var id: String { "\(date?.description ?? "")-\(amount ?? 0)" }
    var amount: Double?
    var date: Date?
    var method: String?
    var accountId: String?
    var note: String?

    enum CodingKeys: String, CodingKey {
        case amount
        case date
        case method
        case accountId
        case note
    }
}

// MARK: - Stats & Aggregates

struct InvoiceStats: Codable {
    var totalInvoiced: Double?
    var totalPaid: Double?
    var totalOutstanding: Double?
    var totalOverdue: Double?

    enum CodingKeys: String, CodingKey {
        case totalInvoiced
        case totalPaid
        case totalOutstanding
        case totalOverdue
    }
}

struct InvoiceDebtor: Codable, Identifiable {
    var id: String { customerName ?? UUID().uuidString }
    var customerId: String?
    var customerName: String?
    var totalOutstanding: Double?
    var invoiceCount: Int?

    enum CodingKeys: String, CodingKey {
        case customerId
        case customerName
        case totalOutstanding
        case invoiceCount
    }
}

struct InvoiceAgingBucket: Codable, Identifiable {
    var id: String { label ?? UUID().uuidString }
    var label: String?
    var amount: Double?
    var count: Int?

    enum CodingKeys: String, CodingKey {
        case label
        case amount
        case count
    }
}

struct InvoiceSalesByCustomer: Codable, Identifiable {
    var id: String { customerName ?? UUID().uuidString }
    var customerId: String?
    var customerName: String?
    var totalSales: Double?
    var invoiceCount: Int?

    enum CodingKeys: String, CodingKey {
        case customerId
        case customerName
        case totalSales
        case invoiceCount
    }
}

struct InvoiceNextNumber: Codable {
    var nextNumber: String?

    enum CodingKeys: String, CodingKey {
        case nextNumber
    }
}

struct InvoiceCountResponse: Codable {
    var count: Int?

    enum CodingKeys: String, CodingKey {
        case count
    }
}
