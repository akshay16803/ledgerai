import Foundation

// MARK: - Inline Response Types

struct AIChatResponse: Codable, Hashable {
    var reply: String?
    var transactionPosted: Bool?
    var transaction: Transaction?
    var invoiceCreated: Bool?
    var invoice: Invoice?
    var billCreated: Bool?
    var bill: Bill?

    enum CodingKeys: String, CodingKey {
        case reply
        case transactionPosted = "transaction_posted"
        case transaction
        case invoiceCreated = "invoice_created"
        case invoice
        case billCreated = "bill_created"
        case bill
    }
}

// MARK: - Request Body

private struct AIChatRequest: Codable {
    var message: String
    var conversation: [[String: String]]?
}

// MARK: - Repository

struct AIChatRepository {

    func sendMessage(
        message: String,
        conversation: [[String: String]]? = nil
    ) async throws -> AIChatResponse {
        let body = AIChatRequest(message: message, conversation: conversation)
        return try await APIClient.shared.post(APIEndpoints.AIChat.send, body: body)
    }
}
