import Foundation

// MARK: - Request / Response DTOs

struct ChatRequest: Codable {
    let message: String
    let conversation: [ChatMessageDTO]
}

struct ChatMessageDTO: Codable {
    let role: String
    let content: String
}

struct ChatResponse: Codable {
    let reply: String?
    let transactionPosted: Bool?
    let transaction: Transaction?
    let invoiceCreated: Bool?
    let invoice: Invoice?
    let billCreated: Bool?
    let bill: Bill?

    /// Convert the flat API response into a ChatMessage for the UI.
    var asChatMessage: ChatMessage {
        ChatMessage(
            role: "assistant",
            content: reply,
            transactionPosted: transactionPosted,
            transaction: transaction,
            invoiceCreated: invoiceCreated,
            invoice: invoice,
            billCreated: billCreated,
            bill: bill
        )
    }
}

struct ChatHistoryResponse: Codable {
    let messages: [ChatMessage]
}

struct ChatSuggestionsResponse: Codable {
    let suggestions: [String]
}

struct ChatClearResponse: Codable {
    let message: String?
    let deleted: Int?
}

// MARK: - Repository

final class AIChatRepository {

    static let shared = AIChatRepository()
    private init() {}

    // MARK: - Send Message

    func sendMessage(_ text: String, conversation: [ChatMessage]) async throws -> ChatMessage {
        let dto = conversation.map {
            ChatMessageDTO(role: $0.role ?? "user", content: $0.content ?? "")
        }
        let body = ChatRequest(message: text, conversation: dto)
        let response: ChatResponse = try await APIClient.shared.post(APIEndpoints.aiChat, body: body)
        return response.asChatMessage
    }

    // MARK: - History

    func loadHistory() async throws -> [ChatMessage] {
        let response: ChatHistoryResponse = try await APIClient.shared.get(APIEndpoints.aiChatHistory)
        return response.messages
    }

    // MARK: - Clear History

    @discardableResult
    func clearHistory() async throws -> ChatClearResponse {
        try await APIClient.shared.delete(APIEndpoints.aiChatClear)
    }

    // MARK: - Suggestions

    func loadSuggestions() async throws -> [String] {
        let response: ChatSuggestionsResponse = try await APIClient.shared.get(APIEndpoints.aiChatSuggestions)
        return response.suggestions
    }
}
