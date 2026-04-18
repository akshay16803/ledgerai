import Foundation

struct Record: Codable, Identifiable {
    let id: String
    var subject: String?
    var sender: String?
    var receivedDate: Date?
    var source: String?
    var amount: Double?
    var transactionType: String?
    var hasAttachments: Bool?
    var attachmentCount: Int?

    enum CodingKeys: String, CodingKey {
        case id = "emailId"
        case subject
        case sender
        case receivedDate
        case source
        case amount
        case transactionType
        case hasAttachments
        case attachmentCount
    }
}

struct Receipt: Codable, Identifiable {
    let id: String
    var filename: String?
    var mimeType: String?
    var uploadedAt: Date?
    var parsedData: ReceiptParsedData?
    var transactionId: String?
    var fileSize: Int?

    enum CodingKeys: String, CodingKey {
        case id = "receiptId"
        case filename
        case mimeType
        case uploadedAt
        case parsedData
        case transactionId
        case fileSize
    }
}

struct ReceiptParsedData: Codable {
    var merchant: String?
    var amount: Double?
    var date: Date?
    var items: [ReceiptItem]?
    var tax: Double?
    var total: Double?
}

struct ReceiptItem: Codable, Identifiable {
    var id: String { description ?? UUID().uuidString }
    var description: String?
    var amount: Double?
    var quantity: Double?
}
