import Foundation
import SwiftUI

@Observable
final class AIChatViewModel {

    // MARK: - State

    var messages: [ChatMessage] = []
    var input: String = ""
    var isSending = false
    var suggestions: [String] = []
    var errorMessage: String?
    var scrollToBottomTrigger = 0

    // MARK: - Dependencies

    private let repository: AIChatRepository

    // MARK: - Init

    init(repository: AIChatRepository = .shared) {
        self.repository = repository
    }

    // MARK: - Computed

    var canSend: Bool {
        !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    // MARK: - Actions

    @MainActor
    func sendMessage() async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        // Add user message immediately
        let userMessage = ChatMessage(
            id: UUID().uuidString,
            role: "user",
            content: text,
            transactionPosted: nil,
            transaction: nil,
            invoiceCreated: nil,
            invoice: nil,
            billCreated: nil,
            bill: nil
        )
        messages.append(userMessage)
        input = ""
        isSending = true
        errorMessage = nil
        scrollToBottom()

        do {
            let response = try await repository.sendMessage(text, conversation: messages)
            messages.append(response)
            scrollToBottom()
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Failed to get a response. Please try again."
        }

        isSending = false
    }

    @MainActor
    func sendSuggestion(_ suggestion: String) async {
        input = suggestion
        await sendMessage()
    }

    @MainActor
    func loadHistory() async {
        do {
            messages = try await repository.loadHistory()
            scrollToBottom()
        } catch {
            // Silently fail — user starts fresh
        }
    }

    @MainActor
    func clearHistory() async {
        do {
            try await repository.clearHistory()
            messages.removeAll()
            errorMessage = nil
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Could not clear history. Please try again."
        }
    }

    @MainActor
    func loadSuggestions() async {
        do {
            suggestions = try await repository.loadSuggestions()
        } catch {
            // Use defaults if API fails
            suggestions = [
                "What did I spend this month?",
                "Show my top expenses",
                "What's my net worth?",
                "Create an invoice for..."
            ]
        }
    }

    // MARK: - Helpers

    func dismissError() {
        errorMessage = nil
    }

    private func scrollToBottom() {
        scrollToBottomTrigger += 1
    }
}
