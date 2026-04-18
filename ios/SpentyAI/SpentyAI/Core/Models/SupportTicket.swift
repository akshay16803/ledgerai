import Foundation

struct SupportTicketCreate: Codable {
    var subject: String
    var message: String
    var category: String?
    var priority: String?
}

struct SupportTicketResponse: Codable, Hashable {
    let success: Bool
    let ticketId: String?
    let emailSent: Bool?

    enum CodingKeys: String, CodingKey {
        case success
        case ticketId = "ticket_id"
        case emailSent = "email_sent"
    }
}
