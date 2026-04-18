import Foundation

struct FeatureRequest: Codable, Identifiable {
    let id: String
    var title: String?
    var description: String?
    var category: String?
    var status: String?
    var votes: Int?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case title
        case description
        case category
        case status
        case votes
        case createdAt
    }
}
