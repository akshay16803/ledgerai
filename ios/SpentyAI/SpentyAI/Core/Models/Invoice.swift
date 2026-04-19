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
    var totalCgst: Double?
    var totalSgst: Double?
    var totalIgst: Double?
    var grandTotal: Double?
    var paymentStatus: String?
    var amountPaid: Double?
    var payments: [InvoicePayment]?
    var notes: String?
    var terms: String?

    enum CodingKeys: String, CodingKey {
        case id = "invoiceId"
        case invoiceNumber
        case customerId
        case customerName
        case date = "invoiceDate"
        case dueDate
        case lineItems
        case subtotal
        case taxAmount
        case totalCgst
        case totalSgst
        case totalIgst
        case grandTotal
        case paymentStatus
        case amountPaid
        case payments
        case notes
        case terms = "termsConditions"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        self.invoiceNumber = try? container.decodeIfPresent(String.self, forKey: .invoiceNumber)
        self.customerId = try? container.decodeIfPresent(String.self, forKey: .customerId)
        self.customerName = try? container.decodeIfPresent(String.self, forKey: .customerName)
        self.date = try? container.decodeIfPresent(Date.self, forKey: .date)
        self.dueDate = try? container.decodeIfPresent(Date.self, forKey: .dueDate)
        self.lineItems = try? container.decodeIfPresent([InvoiceLineItem].self, forKey: .lineItems)
        self.subtotal = try? container.decodeIfPresent(Double.self, forKey: .subtotal)
        self.taxAmount = try? container.decodeIfPresent(Double.self, forKey: .taxAmount)
        self.totalCgst = try? container.decodeIfPresent(Double.self, forKey: .totalCgst)
        self.totalSgst = try? container.decodeIfPresent(Double.self, forKey: .totalSgst)
        self.totalIgst = try? container.decodeIfPresent(Double.self, forKey: .totalIgst)
        self.grandTotal = try? container.decodeIfPresent(Double.self, forKey: .grandTotal)
        self.paymentStatus = try? container.decodeIfPresent(String.self, forKey: .paymentStatus)
        self.amountPaid = try? container.decodeIfPresent(Double.self, forKey: .amountPaid)
        self.payments = try? container.decodeIfPresent([InvoicePayment].self, forKey: .payments)
        self.notes = try? container.decodeIfPresent(String.self, forKey: .notes)
        self.terms = try? container.decodeIfPresent(String.self, forKey: .terms)
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
    var cgst: Double?
    var sgst: Double?
    var igst: Double?
    var amount: Double?

    enum CodingKeys: String, CodingKey {
        case description
        case hsnSac
        case quantity
        case rate
        case taxPercent
        case cgst
        case sgst
        case igst
        case amount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.description = try? container.decodeIfPresent(String.self, forKey: .description)
        self.hsnSac = try? container.decodeIfPresent(String.self, forKey: .hsnSac)
        self.quantity = try? container.decodeIfPresent(Double.self, forKey: .quantity)
        self.rate = try? container.decodeIfPresent(Double.self, forKey: .rate)
        self.taxPercent = try? container.decodeIfPresent(Double.self, forKey: .taxPercent)
        self.cgst = try? container.decodeIfPresent(Double.self, forKey: .cgst)
        self.sgst = try? container.decodeIfPresent(Double.self, forKey: .sgst)
        self.igst = try? container.decodeIfPresent(Double.self, forKey: .igst)
        self.amount = try? container.decodeIfPresent(Double.self, forKey: .amount)
    }

    init(description: String? = nil, hsnSac: String? = nil, quantity: Double? = nil, rate: Double? = nil, taxPercent: Double? = nil, cgst: Double? = nil, sgst: Double? = nil, igst: Double? = nil, amount: Double? = nil) {
        self.description = description
        self.hsnSac = hsnSac
        self.quantity = quantity
        self.rate = rate
        self.taxPercent = taxPercent
        self.cgst = cgst
        self.sgst = sgst
        self.igst = igst
        self.amount = amount
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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.amount = try? container.decodeIfPresent(Double.self, forKey: .amount)
        self.date = try? container.decodeIfPresent(Date.self, forKey: .date)
        self.method = try? container.decodeIfPresent(String.self, forKey: .method)
        self.accountId = try? container.decodeIfPresent(String.self, forKey: .accountId)
        self.note = try? container.decodeIfPresent(String.self, forKey: .note)
    }

    init(amount: Double? = nil, date: Date? = nil, method: String? = nil, accountId: String? = nil, note: String? = nil) {
        self.amount = amount
        self.date = date
        self.method = method
        self.accountId = accountId
        self.note = note
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
