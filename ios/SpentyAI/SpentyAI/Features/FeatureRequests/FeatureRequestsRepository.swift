import Foundation

// MARK: - Models

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
