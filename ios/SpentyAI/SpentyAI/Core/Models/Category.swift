import Foundation

struct Category: Codable, Identifiable {
    let id: String
    var name: String?
    var categoryType: String?
    var parentId: String?
    var children: [Category]?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case categoryType
        case parentId
        case children
    }
}
