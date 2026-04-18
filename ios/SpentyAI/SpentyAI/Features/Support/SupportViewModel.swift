import Foundation
import SwiftUI

// MARK: - Enums

enum TicketCategory: String, CaseIterable, Identifiable {
    case bug      = "bug"
    case feature  = "feature"
    case billing  = "billing"
    case account  = "account"
    case data     = "data"
    case general  = "general"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .bug:     return "Bug Report"
        case .feature: return "Feature Request"
        case .billing: return "Billing"
        case .account: return "Account"
        case .data:    return "Data"
        case .general: return "General"
        }
    }

    var icon: String {
        switch self {
        case .bug:     return "ladybug.fill"
        case .feature: return "lightbulb.fill"
        case .billing: return "creditcard.fill"
        case .account: return "person.fill"
        case .data:    return "externaldrive.fill"
        case .general: return "questionmark.circle.fill"
        }
    }
}

enum TicketPriority: String, CaseIterable, Identifiable {
    case low    = "low"
    case medium = "medium"
    case high   = "high"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .low:    return "Low"
        case .medium: return "Medium"
        case .high:   return "High"
        }
    }

    var color: Color {
        switch self {
        case .low:    return .green
        case .medium: return .orange
        case .high:   return .red
        }
    }
}

// MARK: - ViewModel

@Observable
final class SupportViewModel {

    // MARK: - Form State

    var subject: String = ""
    var category: TicketCategory = .general
    var priority: TicketPriority = .medium
    var message: String = ""

    // MARK: - UI State

    var isSubmitting = false
    var isSubmitted = false
    var faqItems: [FAQItem] = []
    var errorMessage: String?
    var isLoadingFAQ = false

    // MARK: - Dependencies

    private let repository: SupportRepository

    // MARK: - Init

    init(repository: SupportRepository = .shared) {
        self.repository = repository
    }

    // MARK: - Validation

    var isFormValid: Bool {
        !subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Actions

    @MainActor
    func submitTicket() async {
        guard isFormValid else {
            errorMessage = "Please fill in both subject and message."
            return
        }

        isSubmitting = true
        errorMessage = nil

        let ticket = SupportTicket(
            subject: subject.trimmingCharacters(in: .whitespacesAndNewlines),
            category: category.rawValue,
            priority: priority.rawValue,
            message: message.trimmingCharacters(in: .whitespacesAndNewlines)
        )

        do {
            _ = try await repository.submitTicket(ticket)
            isSubmitted = true
            resetForm()
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Something went wrong. Please try again."
        }

        isSubmitting = false
    }

    @MainActor
    func loadFAQ() async {
        isLoadingFAQ = true

        do {
            faqItems = try await repository.getFAQ()
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Could not load FAQ. Please try again later."
        }

        isLoadingFAQ = false
    }

    // MARK: - Helpers

    func resetForm() {
        subject = ""
        category = .general
        priority = .medium
        message = ""
    }

    func dismissError() {
        errorMessage = nil
    }

    func dismissSuccess() {
        isSubmitted = false
    }
}
