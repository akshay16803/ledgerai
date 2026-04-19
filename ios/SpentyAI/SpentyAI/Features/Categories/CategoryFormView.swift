import SwiftUI

struct CategoryFormView: View {

    // MARK: - Environment & State

    @Environment(\.dismiss) private var dismiss
    @Bindable var viewModel: CategoriesViewModel

    @State private var name: String = ""
    @State private var selectedParentId: String?
    @State private var isSaving = false

    private var isEditing: Bool { viewModel.editingCategory != nil }
    private var isSubcategory: Bool { selectedParentId != nil }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    // ── Name ────────────────────────────────────
                    Section {
                        TextField(isSubcategory ? "Subcategory name" : "Category name", text: $name)
                            .autocorrectionDisabled()
                    } header: {
                        Text("Name")
                    }

                    // ── Parent Picker ───────────────────────────
                    Section {
                        Picker("Parent category", selection: $selectedParentId) {
                            Text("None (top-level)")
                                .tag(String?.none)

                            ForEach(viewModel.topLevelCategories) { parent in
                                Text(parent.name ?? "Unnamed")
                                    .tag(Optional(parent.id))
                            }
                        }
                    } header: {
                        Text("Parent")
                    } footer: {
                        Text("Leave empty to create a top-level category.")
                    }

                    // ── Type (read-only, driven by active tab) ─
                    Section {
                        HStack {
                            Text("Type")
                            Spacer()
                            Text(viewModel.activeTab.rawValue.capitalized)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(isEditing ? "Edit Category" : (isSubcategory ? "New Subcategory" : "New Category"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Add") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .tint(Color.spentyPrimary)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
            .onAppear(perform: prefill)
            .interactiveDismissDisabled(isSaving)
        }
    }

    // MARK: - Helpers

    private func prefill() {
        if let editing = viewModel.editingCategory {
            name = editing.name ?? ""
            selectedParentId = editing.parentId
        } else {
            selectedParentId = viewModel.selectedParent?.id
        }
    }

    private func save() async {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        isSaving = true
        defer { isSaving = false }

        if let editing = viewModel.editingCategory {
            await viewModel.updateCategory(id: editing.id, name: trimmed)
        } else {
            await viewModel.createCategory(
                name: trimmed,
                type: viewModel.activeTab,
                parentId: selectedParentId
            )
        }

        dismiss()
    }
}

// MARK: - Preview

#Preview {
    CategoryFormView(viewModel: CategoriesViewModel())
}
