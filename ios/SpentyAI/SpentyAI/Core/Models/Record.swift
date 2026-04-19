import Foundation

struct Record: Codable, Identifiable {
    let id: String
    var subject: String?
    var fromEmail: String?
    var archivedAt: Date?
    var date: String?
    var source: String?
    var transactionAmount: Double?
    var transactionType: String?
    var hasAttachments: Bool?
    var attachments: [RecordAttachmentRef]?

    /// Convenience accessors used by the UI
    var sender: String? { fromEmail }
    var receivedDate: Date? { archivedAt }
    var amount: Double? { transactionAmount }
    var attachmentCount: Int? { attachments?.count }

    enum CodingKeys: String, CodingKey {
        case id = "archiveId"
        case subject
        case fromEmail
        case archivedAt
        case date
        case source
        case transactionAmount
        case transactionType
        case hasAttachments
        case attachments
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        subject = try? c.decode(String.self, forKey: .subject)
        fromEmail = try? c.decode(String.self, forKey: .fromEmail)
        archivedAt = try? c.decode(Date.self, forKey: .archivedAt)
        date = try? c.decode(String.self, forKey: .date)
        source = try? c.decode(String.self, forKey: .source)
        transactionAmount = try? c.decode(Double.self, forKey: .transactionAmount)
        transactionType = try? c.decode(String.self, forKey: .transactionType)
        hasAttachments = try? c.decode(Bool.self, forKey: .hasAttachments)
        attachments = try? c.decode([RecordAttachmentRef].self, forKey: .attachments)
    }
}

/// Lightweight attachment reference returned inside a Record list item
struct RecordAttachmentRef: Codable {
    let filename: String?
    let mimeType: String?
    let size: Int?
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
    var vendor: String?
    var amount: Double?
    var date: Date?
    var items: [ReceiptItem]?
    var tax: Double?
    var total: Double?
    var categoryName: String?
    var description: String?
    var paymentMethod: String?

    /// UI convenience – backend uses `vendor`, UI displays as merchant
    var merchant: String? { vendor }
}

struct ReceiptItem: Codable, Identifiable {
    var id: String { item ?? UUID().uuidString }
    var item: String?
    var amount: Double?
    var qty: Double?

    /// UI convenience accessors
    var description: String? { item }
    var quantity: Double? { qty }
}
