import Foundation

struct ChatMessage: Codable, Identifiable {
    var id: String
    var role: String?
    var content: String?
    var transactionPosted: Bool?
    var transaction: Transaction?
    var invoiceCreated: Bool?
    var invoice: Invoice?
    var billCreated: Bool?
    var bill: Bill?

    enum CodingKeys: String, CodingKey {
        case role
        case content
        case transactionPosted
        case transaction
        case invoiceCreated
        case invoice
        case billCreated
        case bill
    }

    init(id: String = UUID().uuidString, role: String? = nil, content: String? = nil,
         transactionPosted: Bool? = nil, transaction: Transaction? = nil,
         invoiceCreated: Bool? = nil, invoice: Invoice? = nil,
         billCreated: Bool? = nil, bill: Bill? = nil) {
        self.id = id
        self.role = role
        self.content = content
        self.transactionPosted = transactionPosted
        self.transaction = transaction
        self.invoiceCreated = invoiceCreated
        self.invoice = invoice
        self.billCreated = billCreated
        self.bill = bill
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = UUID().uuidString
        self.role = try container.decodeIfPresent(String.self, forKey: .role)
        self.content = try container.decodeIfPresent(String.self, forKey: .content)
        self.transactionPosted = try container.decodeIfPresent(Bool.self, forKey: .transactionPosted)
        self.transaction = try container.decodeIfPresent(Transaction.self, forKey: .transaction)
        self.invoiceCreated = try container.decodeIfPresent(Bool.self, forKey: .invoiceCreated)
        self.invoice = try container.decodeIfPresent(Invoice.self, forKey: .invoice)
        self.billCreated = try container.decodeIfPresent(Bool.self, forKey: .billCreated)
        self.bill = try container.decodeIfPresent(Bill.self, forKey: .bill)
    }
}
