import Foundation

// MARK: - API Models

struct SupportTicketResponse: Codable {
    let success: Bool
    let message: String?
    let ticketId: String?

    enum CodingKeys: String, CodingKey {
        case success, message
        case ticketId
    }
}

struct FAQResponse: Codable {
    let faqs: [FAQItem]
}

// MARK: - Endpoints

private enum SupportEndpoints {
    static let ticket = "/api/support/ticket"
    static let faq    = "/api/support/faq"
}

// MARK: - Repository

final class SupportRepository {

    static let shared = SupportRepository()
    private init() {}

    // MARK: - Submit Ticket

    func submitTicket(_ ticket: SupportTicket) async throws -> SupportTicketResponse {
        try await APIClient.shared.post(SupportEndpoints.ticket, body: ticket)
    }

    // MARK: - FAQ

    func getFAQ() async throws -> [FAQItem] {
        let response: FAQResponse = try await APIClient.shared.get(SupportEndpoints.faq)
        return response.faqs
    }
}
