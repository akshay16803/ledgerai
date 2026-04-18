import SwiftUI

struct CategoriesView: View {

    @State private var viewModel = CategoriesViewModel()
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
            // Segmented control
            Picker("Category Type", selection: $viewModel.selectedTab) {
                ForEach(CategoryTab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)

            // Content
            if viewModel.isLoading && viewModel.currentCategories.isEmpty {
                Spacer()
                ProgressView()
                    .controlSize(.large)
                Spacer()
            } else if let error = viewModel.errorMessage, viewModel.currentCategories.isEmpty {
                Spacer()
                errorView(error)
                Spacer()
            } else {
                categoryList
            }
        }
        .background(SpentyColors.bgPrimary)
        .navigationTitle("Categories")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.startAddCategory()
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(SpentyColors.brandAccent)
                }
            }
        }
        .task {
            await viewModel.loadCategories()
        }
    }

    // MARK: - Category List

    private var categoryList: some View {
        List {
            // Inline add form
            if viewModel.showAddCategory || viewModel.showAddSubcategory {
                Section {
                    addCategoryForm
                }
                .listRowInsets(EdgeInsets(
                    top: SpentySpacing.sm,
                    leading: SpentySpacing.lg,
                    bottom: SpentySpacing.sm,
                    trailing: SpentySpacing.lg
                ))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            if viewModel.parentCategories.isEmpty {
                Section {
                    EmptyState(
                        icon: "folder",
                        title: "No \(viewModel.selectedTab.rawValue) Categories",
                        message: "Tap + to create your first \(viewModel.selectedTab.rawValue.lowercased()) category.",
                        actionTitle: "Add Category"
                    ) {
                        viewModel.startAddCategory()
                    }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            } else {
                ForEach(viewModel.parentCategories) { parent in
                    let subs = viewModel.subcategories(for: parent.categoryId)
                    let isExpanded = viewModel.expandedParents.contains(parent.categoryId)

                    Section {
                        // Parent row
                        parentRow(parent, subcategoryCount: subs.count, isExpanded: isExpanded)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                if subs.isEmpty {
                                    Button(role: .destructive) {
                                        Task { await viewModel.deleteCategory(parent) }
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                            }

                        // Expanded subcategories
                        if isExpanded {
                            ForEach(subs) { sub in
                                subcategoryRow(sub)
                            }
                            .onDelete { indexSet in
                                for index in indexSet {
                                    let sub = subs[index]
                                    Task { await viewModel.deleteCategory(sub) }
                                }
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.loadCategories()
        }
    }

    // MARK: - Add Category Form

    private var addCategoryForm: some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                if let parent = viewModel.parentForSubcategory {
                    Text("Adding under: \(parent.name)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                HStack(spacing: SpentySpacing.sm) {
                    TextField("Category name", text: $viewModel.newCategoryName)
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textPrimary)
                        .padding(.horizontal, SpentySpacing.md)
                        .padding(.vertical, SpentySpacing.sm + 2)
                        .background(SpentyColors.bgSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                        .submitLabel(.done)
                        .onSubmit {
                            Task { await viewModel.addCategory() }
                        }

                    Button {
                        Task { await viewModel.addCategory() }
                    } label: {
                        Text("Save")
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(.white)
                            .padding(.horizontal, SpentySpacing.lg)
                            .padding(.vertical, SpentySpacing.sm + 2)
                            .background(SpentyColors.brandPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    }
                    .disabled(viewModel.newCategoryName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    Button {
                        viewModel.cancelAdd()
                    } label: {
                        Text("Cancel")
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }
                }
            }
        }
    }

    // MARK: - Parent Row

    private func parentRow(_ parent: Category, subcategoryCount: Int, isExpanded: Bool) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                viewModel.toggleExpanded(parent.categoryId)
            }
        } label: {
            HStack(spacing: SpentySpacing.md) {
                Image(systemName: "folder.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(SpentyColors.brandAccent)

                Text(parent.name)
                    .font(SpentyFonts.subheading)
                    .foregroundStyle(SpentyColors.textPrimary)

                if subcategoryCount > 0 {
                    Text("\(subcategoryCount)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.brandAccent)
                        .padding(.horizontal, SpentySpacing.sm)
                        .padding(.vertical, 2)
                        .background(SpentyColors.brandAccent.opacity(0.1))
                        .clipShape(Capsule())
                }

                Spacer()

                // Add subcategory button
                Button {
                    viewModel.startAddSubcategory(parent: parent)
                } label: {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 18))
                        .foregroundStyle(SpentyColors.textMuted)
                }
                .buttonStyle(.plain)

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(SpentyColors.textMuted)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    .animation(.easeInOut(duration: 0.2), value: isExpanded)
            }
        }
        .buttonStyle(.plain)
        .listRowBackground(SpentyColors.surface)
    }

    // MARK: - Subcategory Row

    private func subcategoryRow(_ subcategory: Category) -> some View {
        HStack(spacing: SpentySpacing.md) {
            Image(systemName: "tag")
                .font(.system(size: 13))
                .foregroundStyle(SpentyColors.textMuted)

            Text(subcategory.name)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)

            Spacer()
        }
        .listRowBackground(SpentyColors.bgSecondary.opacity(0.5))
        .listRowInsets(EdgeInsets(
            top: SpentySpacing.sm,
            leading: SpentySpacing.lg + SpentySpacing.xl,
            bottom: SpentySpacing.sm,
            trailing: SpentySpacing.lg
        ))
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        VStack(spacing: SpentySpacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(SpentyColors.danger)

            Text(message)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
                .multilineTextAlignment(.center)

            Button("Retry") {
                Task { await viewModel.loadCategories() }
            }
            .font(SpentyFonts.subheading)
            .foregroundStyle(SpentyColors.brandAccent)
        }
        .padding(SpentySpacing.xxl)
    }
}

#Preview {
    NavigationStack {
        CategoriesView()
            .environment(AppState())
    }
}
