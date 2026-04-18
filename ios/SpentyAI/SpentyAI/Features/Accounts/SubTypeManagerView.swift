import SwiftUI

struct SubTypeManagerView: View {

    @Bindable var viewModel: AccountsViewModel
    @State private var selectedType = "asset"
    @State private var showDeleteConfirm = false
    @State private var deleteTarget: AccountSubType?

    private var filteredSubTypes: [AccountSubType] {
        viewModel.subTypesForType(selectedType)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    typeTabs
                    addBar
                    subTypeList
                }
            }
            .navigationTitle("Sub-Types")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                if viewModel.subTypes.isEmpty {
                    await viewModel.loadSubTypes()
                }
            }
            .alert("Delete Sub-Type", isPresented: $showDeleteConfirm, presenting: deleteTarget) { target in
                Button("Delete", role: .destructive) {
                    Task { await viewModel.deleteSubType(target.id) }
                }
                Button("Cancel", role: .cancel) {}
            } message: { target in
                Text("Are you sure you want to delete \"\(target.name ?? "this sub-type")\"?")
            }
            .overlay(alignment: .top) {
                if let error = viewModel.errorMessage {
                    ErrorBanner(message: error) { viewModel.dismissError() }
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
        }
    }

    // MARK: - Type Tabs

    private var typeTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(AccountsViewModel.accountTypes, id: \.self) { type in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedType = type
                            viewModel.newSubTypeAccountType = type
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: AccountsViewModel.iconForAccountType(type))
                                .font(.system(size: 12))
                            Text(type.capitalized)
                                .font(SpentyFonts.footnote)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(selectedType == type ? .white : .spentyTextPrimary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(selectedType == type ? Color.spentyPrimary : Color.spentyCardBg)
                        .cornerRadius(20)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    // MARK: - Add Bar

    private var addBar: some View {
        HStack(spacing: 10) {
            TextField("New sub-type name", text: $viewModel.newSubTypeName)
                .font(SpentyFonts.body)
                .inputStyle()

            Button {
                Task { await viewModel.createSubType() }
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 28))
                    .foregroundColor(viewModel.newSubTypeName.trimmingCharacters(in: .whitespaces).isEmpty
                                     ? .spentyTextSecondary.opacity(0.4)
                                     : .spentyPrimary)
            }
            .disabled(viewModel.newSubTypeName.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    // MARK: - List

    private var subTypeList: some View {
        Group {
            if viewModel.isLoadingSubTypes && viewModel.subTypes.isEmpty {
                LoadingView(message: "Loading sub-types...")
            } else if filteredSubTypes.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "tag")
                        .font(.system(size: 32))
                        .foregroundColor(.spentyTextSecondary.opacity(0.4))
                    Text("No sub-types for \(selectedType.capitalized)")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextSecondary)
                    Text("Add one above to get started.")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary.opacity(0.7))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(filteredSubTypes) { subType in
                        subTypeRow(subType)
                            .listRowBackground(Color.spentyCardBg)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
    }

    // MARK: - Sub-Type Row

    private func subTypeRow(_ subType: AccountSubType) -> some View {
        Group {
            if viewModel.editingSubType?.id == subType.id {
                HStack(spacing: 10) {
                    TextField("Name", text: $viewModel.editingSubTypeName)
                        .font(SpentyFonts.body)
                        .inputStyle()

                    Button {
                        Task { await viewModel.updateSubType(subType.id) }
                    } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.spentyPrimary)
                    }

                    Button {
                        viewModel.editingSubType = nil
                        viewModel.editingSubTypeName = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
            } else {
                HStack {
                    if let icon = subType.icon, !icon.isEmpty {
                        Image(systemName: icon)
                            .font(.system(size: 14))
                            .foregroundColor(AccountsViewModel.colorForAccountType(selectedType))
                    }

                    Text(subType.name ?? "Unnamed")
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyTextPrimary)

                    Spacer()
                }
                .contentShape(Rectangle())
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        deleteTarget = subType
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }

                    Button {
                        viewModel.editingSubType = subType
                        viewModel.editingSubTypeName = subType.name ?? ""
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    .tint(Color.spentyInfo)
                }
            }
        }
    }
}

#Preview {
    SubTypeManagerView(viewModel: AccountsViewModel())
}
