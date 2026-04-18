import Foundation
import os

// MARK: - Request Types

struct FeatureRequestCreate: Codable {
    var title: String
    var description: String?
    var category: String?
}

@Observable
final class FeatureRequestsViewModel {

    // MARK: - Data

    var requests: [FeatureRequest] = []

    // MARK: - Loading State

    var isLoading = false
    var isRefreshing = false
    var isSubmitting = false
    var errorMessage: String?

    // MARK: - Sheet State

    var showSubmitForm = false

    // MARK: - Form State

    var title: String = ""
    var description: String = ""
    var category: String = "feature"

    static let categories = ["bug", "feature", "improvement", "other"]

    // MARK: - Private

    private let logger = Logger(subsystem: "com.spentyai", category: "featureRequests")

    // MARK: - Load Methods

    @MainActor
    func loadRequests() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            requests = try await APIClient.shared.get(APIEndpoints.FeatureRequests.list)
            logger.info("Feature requests loaded successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to load feature requests: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to load feature requests. Please try again."
            logger.error("Unexpected error loading feature requests: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func submitRequest() async {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Please enter a title."
            return
        }

        isSubmitting = true
        errorMessage = nil

        let body = FeatureRequestCreate(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : description.trimmingCharacters(in: .whitespacesAndNewlines),
            category: category
        )

        do {
            let created: FeatureRequest = try await APIClient.shared.post(
                APIEndpoints.FeatureRequests.create,
                body: body
            )
            requests.insert(created, at: 0)
            showSubmitForm = false
            resetForm()
            logger.info("Feature request submitted successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to submit feature request: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to submit request. Please try again."
            logger.error("Unexpected error submitting feature request: \(error.localizedDescription)")
        }

        isSubmitting = false
    }

    @MainActor
    func voteForRequest(_ id: String) async {
        do {
            let _: FeatureRequest = try await APIClient.shared.post(
                APIEndpoints.FeatureRequests.vote(id),
                body: EmptyBody()
            )
            logger.info("Vote registered for request \(id)")
            await loadRequests()
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to vote: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to register vote."
            logger.error("Unexpected error voting: \(error.localizedDescription)")
        }
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        errorMessage = nil

        do {
            requests = try await APIClient.shared.get(APIEndpoints.FeatureRequests.list)
            logger.info("Feature requests refreshed successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to refresh feature requests: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to refresh. Please try again."
            logger.error("Unexpected error refreshing feature requests: \(error.localizedDescription)")
        }

        isRefreshing = false
    }

    // MARK: - Helpers

    private func resetForm() {
        title = ""
        description = ""
        category = "feature"
    }
}

private struct EmptyBody: Codable {}
