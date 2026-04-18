import Foundation

struct ReceiptParsedData: Codable, Hashable {
    var amount: Double?
    var date: String?
    var description: String?
    var categoryName: String?
    var paymentMethod: String?
    var vendor: String?

    enum CodingKeys: String, CodingKey {
        case amount
        case date
        case description
        case categoryName = "category_name"
        case paymentMethod = "payment_method"
        case vendor
    }
}

struct Receipt: Codable, Identifiable, Hashable {
    var id: String { receiptId }

    let receiptId: String
    let userId: String?
    var filename: String?
    var fileExt: String?
    var mimeType: String?
    var uploadedAt: String?
    var parsedData: ReceiptParsedData?

    enum CodingKeys: String, CodingKey {
        case receiptId = "receipt_id"
        case userId = "user_id"
        case filename
        case fileExt = "file_ext"
        case mimeType = "mime_type"
        case uploadedAt = "uploaded_at"
        case parsedData = "parsed_data"
    }
}
