import Foundation

struct SupportTicket: Codable {
    var subject: String?
    var category: String?
    var priority: String?
    var message: String?
}

struct FAQItem: Codable, Identifiable {
    var id: String { question ?? UUID().uuidString }
    var question: String?
    var answer: String?
    var category: String?

    enum CodingKeys: String, CodingKey {
        case question
        case answer
        case category
    }
}
