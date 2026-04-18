import Foundation
import SwiftUI

@Observable
final class FeatureRequestsViewModel {

    // MARK: - State

    var requests: [FeatureRequest] = []
    var isLoading = false
    var showForm = false
    var errorMessage: String?

    // MARK: - Dependencies

    private let repository: FeatureRequestsRepository

    // MARK: - Init

    init(repository: FeatureRequestsRepository = .shared) {
        self.repository = repository
    }

    // MARK: - Actions

    @MainActor
    func loadRequests() async {
        isLoading = true
        errorMessage = nil

        do {
            requests = try await repository.getAll()
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Failed to load feature requests."
        }

        isLoading = false
    }

    @MainActor
    func submitRequest(title: String, description: String, category: FeatureRequestCategory) async {
        errorMessage = nil

        do {
            let newRequest = try await repository.create(
                title: title,
                description: description,
                category: category
            )
            requests.insert(newRequest, at: 0)
            showForm = false
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Failed to submit your request."
        }
    }

    @MainActor
    func voteForRequest(id: String) async {
        errorMessage = nil

        do {
            let response = try await repository.vote(id: id)
            if let index = requests.firstIndex(where: { $0.id == id }) {
                let old = requests[index]
                requests[index] = FeatureRequest(
                    id: old.id,
                    title: old.title,
                    description: old.description,
                    category: old.category,
                    status: old.status,
                    votes: response.votes,
                    createdAt: old.createdAt
                )
            }
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Failed to register your vote."
        }
    }
}
