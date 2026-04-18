import Foundation
import os

enum CategoryTab: String, CaseIterable {
    case expense = "Expense"
    case income = "Income"

    var categoryType: CategoryType {
        switch self {
        case .expense: .expense
        case .income: .income
        }
    }
}

@Observable
final class CategoriesViewModel {

    // MARK: - State

    var expenseCategories: [Category] = []
    var incomeCategories: [Category] = []
    var selectedTab: CategoryTab = .expense

    var isLoading = false
    var errorMessage: String?

    var showAddCategory = false
    var showAddSubcategory = false
    var parentForSubcategory: Category?
    var newCategoryName = ""
    var expandedParents: Set<String> = []

    // MARK: - Computed

    var currentCategories: [Category] {
        switch selectedTab {
        case .expense: expenseCategories
        case .income: incomeCategories
        }
    }

    var parentCategories: [Category] {
        currentCategories.filter { $0.parentId == nil }
    }

    func subcategories(for parentId: String) -> [Category] {
        currentCategories.filter { $0.parentId == parentId }
    }

    // MARK: - Private

    private let repository = CategoryRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "categories")

    // MARK: - Methods

    @MainActor
    func loadCategories() async {
        isLoading = true
        errorMessage = nil

        do {
            let all = try await repository.getCategories()
            expenseCategories = all.filter { $0.categoryType == .expense }
            incomeCategories = all.filter { $0.categoryType == .income }
            logger.info("Loaded \(all.count) categories")
        } catch {
            errorMessage = "Failed to load categories."
            logger.error("Load categories error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func addCategory() async {
        let trimmed = newCategoryName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        do {
            let create = CategoryCreate(
                name: trimmed,
                categoryType: selectedTab.categoryType,
                parentId: parentForSubcategory?.categoryId
            )
            let created = try await repository.createCategory(create)

            switch selectedTab {
            case .expense: expenseCategories.append(created)
            case .income: incomeCategories.append(created)
            }

            // If adding a subcategory, ensure parent is expanded
            if let parentId = parentForSubcategory?.categoryId {
                expandedParents.insert(parentId)
            }

            newCategoryName = ""
            showAddCategory = false
            showAddSubcategory = false
            parentForSubcategory = nil
            logger.info("Created category: \(created.name)")
        } catch {
            errorMessage = "Failed to create category."
            logger.error("Create category error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func deleteCategory(_ category: Category) async {
        do {
            try await repository.deleteCategory(category.categoryId)

            switch selectedTab {
            case .expense:
                expenseCategories.removeAll { $0.categoryId == category.categoryId }
            case .income:
                incomeCategories.removeAll { $0.categoryId == category.categoryId }
            }
            logger.info("Deleted category: \(category.name)")
        } catch {
            errorMessage = "Failed to delete category."
            logger.error("Delete category error: \(error.localizedDescription)")
        }
    }

    func toggleExpanded(_ parentId: String) {
        if expandedParents.contains(parentId) {
            expandedParents.remove(parentId)
        } else {
            expandedParents.insert(parentId)
        }
    }

    func cancelAdd() {
        newCategoryName = ""
        showAddCategory = false
        showAddSubcategory = false
        parentForSubcategory = nil
    }

    func startAddSubcategory(parent: Category) {
        parentForSubcategory = parent
        showAddSubcategory = true
        showAddCategory = false
        newCategoryName = ""
    }

    func startAddCategory() {
        parentForSubcategory = nil
        showAddCategory = true
        showAddSubcategory = false
        newCategoryName = ""
    }
}
