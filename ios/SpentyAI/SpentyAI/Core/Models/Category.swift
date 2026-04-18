import Foundation

enum CategoryType: String, Codable, CaseIterable {
    case income
    case expense
}

struct Category: Codable, Identifiable, Hashable {
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

    // Hashable by id only (children are recursive)
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: Category, rhs: Category) -> Bool { lhs.id == rhs.id }
}
