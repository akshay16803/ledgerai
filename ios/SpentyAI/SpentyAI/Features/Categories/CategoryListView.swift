import SwiftUI

struct CategoryListView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @State private var viewModel = CategoriesViewModel()

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                // -- Segmented Control --
                segmentedControl
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 4)

                // -- Content --
                if viewModel.isLoading && viewModel.categories.isEmpty {
                    Spacer()
                    LoadingView(message: "Loading categories...")
                    Spacer()
                } else if viewModel.categoryTree.isEmpty {
                    emptyState
                } else {
                    categoryList
                }
            }
        }
        .navigationTitle(lang.s("categories"))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.beginCreate()
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                }
                .tint(Color.spentyPrimary)
            }
        }
        .sheet(isPresented: $viewModel.showForm) {
            CategoryFormView(viewModel: viewModel)
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button(lang.s("ok")) { viewModel.dismissError() }
        } message: {
            Text(viewModel.errorMessage)
        }
        .task {
            await viewModel.loadCategories()
        }
    }

    // MARK: - Segmented Control

    private var segmentedControl: some View {
        Picker(lang.s("type"), selection: $viewModel.activeTab) {
            Text(lang.s("expense_tab")).tag(CategoryType.expense)
            Text(lang.s("income_tab")).tag(CategoryType.income)
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Category List

    private var categoryList: some View {
        List {
            ForEach(viewModel.categoryTree) { parent in
                CategoryTreeRow(
                    category: parent,
                    onAddChild: {
                        viewModel.beginCreate(parent: parent)
                    },
                    onEdit: { cat in
                        viewModel.beginEdit(cat)
                    },
                    onDelete: { cat in
                        Task { await viewModel.deleteCategory(id: cat.id) }
                    }
                )
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.loadCategories()
        }
        .animation(.easeInOut(duration: 0.25), value: viewModel.categoryTree.map(\.id))
    }

    // MARK: - Empty State

    private var emptyState: some View {
        EmptyStateView(
            icon: viewModel.activeTab == .expense ? "arrow.up.circle" : "arrow.down.circle",
            title: "No \(viewModel.activeTab.rawValue) categories yet",
            subtitle: "Tap + to create your first category."
        )
    }
}

// MARK: - Tree Row

private struct CategoryTreeRow: View {

    @Environment(LocalizationManager.self) var lang

    let category: Category
    let onAddChild: () -> Void
    let onEdit: (Category) -> Void
    let onDelete: (Category) -> Void

    @State private var isExpanded = true

    var body: some View {
        let children = category.children ?? []

        if children.isEmpty {
            parentRow(category)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    deleteButton(for: category)
                    editButton(for: category)
                }
                .swipeActions(edge: .leading, allowsFullSwipe: false) {
                    addChildButton
                }
        } else {
            DisclosureGroup(isExpanded: $isExpanded) {
                ForEach(children) { child in
                    childRow(child)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            deleteButton(for: child)
                            editButton(for: child)
                        }
                }

                // Visible "Add Subcategory" button
                addSubcategoryRow
            } label: {
                parentRow(category)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        deleteButton(for: category)
                        editButton(for: category)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        addChildButton
                    }
            }
            .tint(Color.spentyPrimary)
        }
    }

    // MARK: - Row Content

    private func parentRow(_ cat: Category) -> some View {
        HStack {
            Image(systemName: "folder.fill")
                .foregroundStyle(Color.spentyPrimary)
                .frame(width: 24)

            Text(cat.name ?? "Unnamed")
                .font(SpentyFonts.body.weight(.medium))

            Spacer()

            if let kids = cat.children, !kids.isEmpty {
                Text("\(kids.count)")
                    .font(SpentyFonts.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Color.spentyPrimary.opacity(0.7), in: Capsule())
            }

            Button {
                onAddChild()
            } label: {
                Image(systemName: "plus.circle")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.spentyPrimary.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .contentShape(Rectangle())
    }

    private func childRow(_ cat: Category) -> some View {
        HStack {
            Image(systemName: "tag.fill")
                .foregroundStyle(Color.spentyPrimary.opacity(0.6))
                .frame(width: 24)

            Text(cat.name ?? "Unnamed")
                .font(SpentyFonts.subheadline)
        }
        .padding(.leading, 4)
    }

    // MARK: - Add Subcategory Row

    private var addSubcategoryRow: some View {
        Button {
            onAddChild()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(Color.spentyPrimary.opacity(0.7))
                    .frame(width: 24)

                Text(lang.s("add_subcategory"))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyPrimary)
            }
            .padding(.leading, 4)
        }
    }

    // MARK: - Swipe Buttons

    private func deleteButton(for cat: Category) -> some View {
        Button(role: .destructive) {
            onDelete(cat)
        } label: {
            Label(lang.s("delete"), systemImage: "trash")
        }
    }

    private func editButton(for cat: Category) -> some View {
        Button {
            onEdit(cat)
        } label: {
            Label(lang.s("edit"), systemImage: "pencil")
        }
        .tint(Color.spentyWarning)
    }

    private var addChildButton: some View {
        Button {
            onAddChild()
        } label: {
            Label("Add Sub", systemImage: "plus.circle")
        }
        .tint(Color.spentyPrimary)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CategoryListView()
    }
}
