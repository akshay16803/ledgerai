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
    // Set true (with `account` populated) when the AI created a new
    // financial account via the chat flow. The UI uses this to fire a
    // refresh notification so AccountListView reloads.
    var accountCreated: Bool?
    var account: Account?

    enum CodingKeys: String, CodingKey {
        case id = "messageId"
        case role
        case content
        case transactionPosted
        case transaction
        case invoiceCreated
        case invoice
        case billCreated
        case bill
        case accountCreated
        case account
    }

    init(id: String = UUID().uuidString, role: String? = nil, content: String? = nil,
         transactionPosted: Bool? = nil, transaction: Transaction? = nil,
         invoiceCreated: Bool? = nil, invoice: Invoice? = nil,
         billCreated: Bool? = nil, bill: Bill? = nil,
         accountCreated: Bool? = nil, account: Account? = nil) {
        self.id = id
        self.role = role
        self.content = content
        self.transactionPosted = transactionPosted
        self.transaction = transaction
        self.invoiceCreated = invoiceCreated
        self.invoice = invoice
        self.billCreated = billCreated
        self.bill = bill
        self.accountCreated = accountCreated
        self.account = account
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try? container.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        self.role = try container.decodeIfPresent(String.self, forKey: .role)
        self.content = try container.decodeIfPresent(String.self, forKey: .content)
        self.transactionPosted = try container.decodeIfPresent(Bool.self, forKey: .transactionPosted)
        self.transaction = try container.decodeIfPresent(Transaction.self, forKey: .transaction)
        self.invoiceCreated = try container.decodeIfPresent(Bool.self, forKey: .invoiceCreated)
        self.invoice = try container.decodeIfPresent(Invoice.self, forKey: .invoice)
        self.billCreated = try container.decodeIfPresent(Bool.self, forKey: .billCreated)
        self.bill = try container.decodeIfPresent(Bill.self, forKey: .bill)
        self.accountCreated = try container.decodeIfPresent(Bool.self, forKey: .accountCreated)
        self.account = try container.decodeIfPresent(Account.self, forKey: .account)
    }
}
