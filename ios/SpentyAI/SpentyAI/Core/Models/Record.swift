import Foundation

struct Record: Codable, Identifiable, Hashable {
    var id: String { archiveId }

    let archiveId: String
    let userId: String?
    var subject: String?
    var sender: String?
    var date: String?
    var amount: Double?
    var attachmentCount: Int?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case archiveId = "archive_id"
        case userId = "user_id"
        case subject
        case sender
        case date
        case amount
        case attachmentCount = "attachment_count"
        case createdAt = "created_at"
    }
}
