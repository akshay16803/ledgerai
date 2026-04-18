import Foundation

struct FeatureRequest: Codable, Identifiable, Hashable {
    var id: String { requestId }

    let requestId: String
    var title: String
    var description: String?
    var category: String?
    var status: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case requestId = "request_id"
        case title
        case description
        case category
        case status
        case createdAt = "created_at"
    }
}
