import Foundation

struct CategoryRepository {

    func getCategories(type: String? = nil) async throws -> [Category] {
        var query: [String: String]? = nil
        if let type {
            query = ["type": type]
        }
        return try await APIClient.shared.get(APIEndpoints.Categories.list, query: query)
    }

    func createCategory(_ cat: CategoryCreate) async throws -> Category {
        try await APIClient.shared.post(APIEndpoints.Categories.create, body: cat)
    }

    func updateCategory(_ id: String, name: String) async throws -> Category {
        let body = ["name": name]
        return try await APIClient.shared.put(APIEndpoints.Categories.update(id), body: body)
    }

    func deleteCategory(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Categories.delete(id))
    }
}
