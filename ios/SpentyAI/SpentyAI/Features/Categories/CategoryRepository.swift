import Foundation

// MARK: - Models

enum CategoryType: String, Codable, CaseIterable {
    case income
    case expense
}

struct Category: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var categoryType: CategoryType
    var parentId: String?
    var children: [Category]?

    enum CodingKeys: String, CodingKey {
        case id, name, children
        case categoryType = "category_type"
        case parentId     = "parent_id"
    }

    // Hashable by id only (children are recursive)
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: Category, rhs: Category) -> Bool { lhs.id == rhs.id }
}

struct CreateCategoryRequest: Codable {
    let name: String
    let categoryType: CategoryType
    let parentId: String?

    enum CodingKeys: String, CodingKey {
        case name
        case categoryType = "category_type"
        case parentId     = "parent_id"
    }
}

struct UpdateCategoryRequest: Codable {
    let name: String
}

struct MergeCategoriesRequest: Codable {
    let sourceId: String
    let targetId: String

    enum CodingKeys: String, CodingKey {
        case sourceId = "source_id"
        case targetId = "target_id"
    }
}

struct MergeCategoriesResponse: Codable {
    let success: Bool
    let message: String?
}

// MARK: - Repository

final class CategoryRepository {

    static let shared = CategoryRepository()
    private init() {}

    // MARK: - CRUD

    func getCategories() async throws -> [Category] {
        try await APIClient.shared.get(APIEndpoints.categories)
    }

    func createCategory(name: String, type: CategoryType, parentId: String?) async throws -> Category {
        let body = CreateCategoryRequest(name: name, categoryType: type, parentId: parentId)
        return try await APIClient.shared.post(APIEndpoints.categories, body: body)
    }

    func updateCategory(id: String, name: String) async throws -> Category {
        let body = UpdateCategoryRequest(name: name)
        return try await APIClient.shared.put(APIEndpoints.category(id), body: body)
    }

    func deleteCategory(id: String) async throws {
        let _: EmptyResponse = try await APIClient.shared.delete(APIEndpoints.category(id))
    }

    // MARK: - Defaults & Merge

    func loadDefaults() async throws -> [Category] {
        try await APIClient.shared.get(APIEndpoints.categoriesDefaults)
    }

    func mergeCategories(sourceId: String, targetId: String) async throws -> MergeCategoriesResponse {
        let body = MergeCategoriesRequest(sourceId: sourceId, targetId: targetId)
        return try await APIClient.shared.post(APIEndpoints.categoriesMerge, body: body)
    }
}

// Placeholder for empty-body DELETE responses
private struct EmptyResponse: Codable {}
