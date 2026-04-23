import SwiftUI

struct CategoryFormView: View {

    // MARK: - Environment & State


    @Environment(LocalizationManager.self) var lang
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
                        Text(lang.s("name"))
                    }

                    // ── Parent Picker ───────────────────────────
                    Section {
                        Picker(lang.s("parent"), selection: $selectedParentId) {
                            Text(lang.s("none_top_level"))
                                .tag(String?.none)

                            ForEach(viewModel.topLevelCategories) { parent in
                                Text(parent.name ?? "Unnamed")
                                    .tag(Optional(parent.id))
                            }
                        }
                    } header: {
                        Text(lang.s("parent"))
                    } footer: {
                        Text(lang.s("leave_empty_info"))
                    }

                    // ── Type (read-only, driven by active tab) ─
                    Section {
                        HStack {
                            Text(lang.s("type"))
                            Spacer()
                            Text(viewModel.activeTab.rawValue.capitalized)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(isEditing ? lang.s("edit_category") : (isSubcategory ? lang.s("new_subcategory") : lang.s("new_category")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(lang.s("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? lang.s("save") : lang.s("add")) {
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
