import Foundation
import os

@Observable
final class SupportViewModel {

    // MARK: - Loading State

    var isSubmitting = false
    var showSuccess = false
    var errorMessage: String?

    // MARK: - Form State

    var subject: String = ""
    var message: String = ""
    var selectedCategory: String = "general"
    var selectedPriority: String = "medium"

    static let categories = ["general", "billing", "bug", "other"]
    static let categoryLabels: [String: String] = [
        "general": "General",
        "billing": "Billing",
        "bug": "Bug Report",
        "other": "Other"
    ]

    static let priorities = ["low", "medium", "high"]
    static let priorityLabels: [String: String] = [
        "low": "Low",
        "medium": "Medium",
        "high": "High"
    ]

    // MARK: - Private

    private let logger = Logger(subsystem: "com.spentyai", category: "support")

    // MARK: - Methods

    @MainActor
    func submitTicket() async -> Bool {
        guard !subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Please enter a subject."
            return false
        }

        guard !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Please enter a message."
            return false
        }

        isSubmitting = true
        errorMessage = nil

        let body = SupportTicketCreate(
            subject: subject.trimmingCharacters(in: .whitespacesAndNewlines),
            message: message.trimmingCharacters(in: .whitespacesAndNewlines),
            category: selectedCategory,
            priority: selectedPriority
        )

        do {
            let _: SupportTicketResponse = try await APIClient.shared.post(
                APIEndpoints.Support.create,
                body: body
            )
            showSuccess = true
            resetForm()
            logger.info("Support ticket submitted successfully")
            isSubmitting = false
            return true
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to submit ticket: \(error.localizedDescription)")
            isSubmitting = false
            return false
        } catch {
            errorMessage = "Failed to submit ticket. Please try again."
            logger.error("Unexpected error submitting ticket: \(error.localizedDescription)")
            isSubmitting = false
            return false
        }
    }

    func resetForm() {
        subject = ""
        message = ""
        selectedCategory = "general"
        selectedPriority = "medium"
    }
}
