import SwiftUI

struct CategoryListView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary    = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

    // MARK: - State

    @State private var viewModel = CategoriesViewModel()

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // ── Segmented Control ────────────────────────
                    segmentedControl
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 4)

                    // ── Content ──────────────────────────────────
                    if viewModel.isLoading && viewModel.categories.isEmpty {
                        Spacer()
                        ProgressView()
                            .tint(Brand.primary)
                        Spacer()
                    } else if viewModel.categoryTree.isEmpty {
                        emptyState
                    } else {
                        categoryList
                    }
                }
            }
            .navigationTitle("Categories")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        viewModel.beginCreate()
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                    .tint(Brand.primary)
                }
            }
            .sheet(isPresented: $viewModel.showForm) {
                CategoryFormView(viewModel: viewModel)
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK") { viewModel.dismissError() }
            } message: {
                Text(viewModel.errorMessage)
            }
            .task {
                await viewModel.loadCategories()
            }
        }
    }

    // MARK: - Segmented Control

    private var segmentedControl: some View {
        Picker("Category type", selection: $viewModel.activeTab) {
            Text("Expense").tag(CategoryType.expense)
            Text("Income").tag(CategoryType.income)
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
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: viewModel.activeTab == .expense
                  ? "arrow.up.circle"
                  : "arrow.down.circle")
                .resizable()
                .scaledToFit()
                .frame(width: 56, height: 56)
                .foregroundStyle(Brand.primary.opacity(0.4))

            Text("No \(viewModel.activeTab.rawValue) categories yet")
                .font(.headline)
                .foregroundStyle(.secondary)

            Text("Tap + to create your first category.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)

            Spacer()
        }
        .padding(.horizontal, 32)
    }
}

// MARK: - Tree Row

private struct CategoryTreeRow: View {

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
    }

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
            .tint(Brand.primary)
        }
    }

    // MARK: - Row Content

    private func parentRow(_ cat: Category) -> some View {
        HStack {
            Image(systemName: "folder.fill")
                .foregroundStyle(Brand.primary)
                .frame(width: 24)

            Text(cat.name ?? "Unnamed")
                .font(.body.weight(.medium))

            Spacer()

            if let kids = cat.children, !kids.isEmpty {
                Text("\(kids.count)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Brand.primary.opacity(0.7), in: Capsule())
            }
        }
        .contentShape(Rectangle())
    }

    private func childRow(_ cat: Category) -> some View {
        HStack {
            Image(systemName: "tag.fill")
                .foregroundStyle(Brand.primary.opacity(0.6))
                .frame(width: 24)

            Text(cat.name ?? "Unnamed")
                .font(.subheadline)
        }
        .padding(.leading, 4)
    }

    // MARK: - Swipe Buttons

    private func deleteButton(for cat: Category) -> some View {
        Button(role: .destructive) {
            onDelete(cat)
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }

    private func editButton(for cat: Category) -> some View {
        Button {
            onEdit(cat)
        } label: {
            Label("Edit", systemImage: "pencil")
        }
        .tint(.orange)
    }

    private var addChildButton: some View {
        Button {
            onAddChild()
        } label: {
            Label("Add Sub", systemImage: "plus.circle")
        }
        .tint(Brand.primary)
    }
}

// MARK: - Preview

#Preview {
    CategoryListView()
}
