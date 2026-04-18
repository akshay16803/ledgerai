import Foundation

enum CategoryType: String, Codable, Hashable, CaseIterable {
    case income
    case expense
}

struct Category: Codable, Identifiable, Hashable {
    var id: String { categoryId }

    let categoryId: String
    let userId: String?
    var name: String
    var categoryType: CategoryType
    var parentId: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case categoryId = "category_id"
        case userId = "user_id"
        case name
        case categoryType = "category_type"
        case parentId = "parent_id"
        case createdAt = "created_at"
    }
}

struct CategoryCreate: Codable {
    var name: String
    var categoryType: CategoryType
    var parentId: String?

    enum CodingKeys: String, CodingKey {
        case name
        case categoryType = "category_type"
        case parentId = "parent_id"
    }
}
