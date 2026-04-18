import Foundation

// MARK: - Models

struct FeatureRequest: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let category: FeatureRequestCategory
    let status: FeatureRequestStatus
    let votes: Int
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, title, description, category, status, votes
        case createdAt = "created_at"
    }
}

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

struct CreateFeatureRequestBody: Codable {
    let title: String
    let description: String
    let category: String
}

struct VoteResponse: Codable {
    let votes: Int
}

// MARK: - Repository

final class FeatureRequestsRepository {

    static let shared = FeatureRequestsRepository()
    private init() {}

    func getAll() async throws -> [FeatureRequest] {
        try await APIClient.shared.get(APIEndpoints.featureRequests)
    }

    func create(title: String, description: String, category: FeatureRequestCategory) async throws -> FeatureRequest {
        let body = CreateFeatureRequestBody(
            title: title,
            description: description,
            category: category.rawValue
        )
        return try await APIClient.shared.post(APIEndpoints.featureRequests, body: body)
    }

    func vote(id: String) async throws -> VoteResponse {
        try await APIClient.shared.post(APIEndpoints.featureRequestVote(id))
    }
}
