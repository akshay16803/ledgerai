import Foundation

struct ChatMessage: Codable, Identifiable {
    let id: String
    var role: String?
    var content: String?
    var transactionPosted: Bool?
    var transaction: Transaction?
    var invoiceCreated: Bool?
    var invoice: Invoice?
    var billCreated: Bool?
    var bill: Bill?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case role
        case content
        case transactionPosted
        case transaction
        case invoiceCreated
        case invoice
        case billCreated
        case bill
    }
}
