import Foundation
import SwiftUI

@Observable
final class CategoriesViewModel {

    // MARK: - State

    var categories: [Category] = []
    var activeTab: CategoryType = .expense
    var isLoading = false
    var showForm = false
    var editingCategory: Category?
    var selectedParent: Category?
    var errorMessage = ""
    var showError = false

    // MARK: - Dependencies

    private let repository = CategoryRepository.shared

    // MARK: - Computed — Tree

    /// Top-level categories for the active tab, each with its children attached.
    var categoryTree: [Category] {
        let filtered = categories.filter { $0.categoryType == activeTab.rawValue }
        let topLevel = filtered.filter { $0.parentId == nil }

        return topLevel.map { parent in
            var copy = parent
            copy.children = filtered.filter { $0.parentId == parent.id }
            return copy
        }
        .sorted { ($0.name ?? "").localizedCaseInsensitiveCompare($1.name ?? "") == .orderedAscending }
    }

    /// Flat list of top-level categories (for parent picker in form).
    var topLevelCategories: [Category] {
        categories
            .filter { $0.categoryType == activeTab.rawValue && $0.parentId == nil }
            .sorted { ($0.name ?? "").localizedCaseInsensitiveCompare($1.name ?? "") == .orderedAscending }
    }

    // MARK: - Actions

    @MainActor
    func loadCategories() async {
        isLoading = true
        defer { isLoading = false }

        do {
            categories = try await repository.getCategories()
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func createCategory(name: String, type: CategoryType, parentId: String?) async {
        do {
            let created = try await repository.createCategory(name: name, type: type, parentId: parentId)
            categories.append(created)
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func updateCategory(id: String, name: String) async {
        do {
            let updated = try await repository.updateCategory(id: id, name: name)
            if let index = categories.firstIndex(where: { $0.id == id }) {
                categories[index] = updated
            }
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func deleteCategory(id: String) async {
        do {
            try await repository.deleteCategory(id: id)
            categories.removeAll { $0.id == id }
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func loadDefaults() async {
        do {
            let defaults = try await repository.loadDefaults()
            categories = defaults
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func mergeCategories(sourceId: String, targetId: String) async {
        do {
            _ = try await repository.mergeCategories(sourceId: sourceId, targetId: targetId)
            await loadCategories()
        } catch {
            handleError(error)
        }
    }

    // MARK: - Form Helpers

    func beginCreate(parent: Category? = nil) {
        editingCategory = nil
        selectedParent = parent
        showForm = true
    }

    func beginEdit(_ category: Category) {
        editingCategory = category
        selectedParent = categories.first { $0.id == category.parentId }
        showForm = true
    }

    func dismissError() {
        showError = false
        errorMessage = ""
    }

    // MARK: - Private

    private func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            errorMessage = apiError.localizedDescription
        } else {
            errorMessage = error.localizedDescription
        }
        showError = true
    }
}
