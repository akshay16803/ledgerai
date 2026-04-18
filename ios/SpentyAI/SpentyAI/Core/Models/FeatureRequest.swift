import Foundation

enum FeatureRequestCategory: String, Codable, CaseIterable {
    case ui = "UI"
    case performance = "Performance"
    case feature = "Feature"
    case integration = "Integration"
    case other = "Other"
}

enum FeatureRequestStatus: String, Codable {
    case pending
    case inProgress = "in_progress"
    case completed
}

struct FeatureRequest: Codable, Identifiable {
    let id: String
    var title: String?
    var description: String?
    var category: String?
    var status: String?
    var votes: Int?
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id = "requestId"
        case title
        case description
        case category
        case status
        case votes
        case createdAt
    }
}
