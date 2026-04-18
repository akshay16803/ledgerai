import SwiftUI
import os

struct SubTypeManagerSheet: View {

    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab = "Asset"
    @State private var subTypes: [AccountSubType] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    // Add new sub-type
    @State private var newSubTypeName = ""
    @State private var isAdding = false
    @State private var isSavingNew = false

    // Inline rename
    @State private var editingSubTypeId: String?
    @State private var editingName = ""

    private let repository = AccountRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "subtypes")

    private let tabs = AccountFormViewModel.accountTypes

    // Known default sub-types that cannot be edited or deleted
    private let defaultSubTypeNames: Set<String> = [
        "Savings", "Current", "Cash", "Fixed Deposit", "Recurring Deposit",
        "Home Loan", "Personal Loan", "Car Loan", "Education Loan", "Credit Card",
        "Overdraft", "Mortgage", "Stocks", "Mutual Funds", "PPF", "NPS", "EPF",
        "Gold", "Real Estate", "Crypto", "Bonds", "Owner Equity", "Retained Earnings",
        "Capital"
    ]

    private var filteredSubTypes: [AccountSubType] {
        subTypes.filter { $0.accountType == selectedTab }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Tab bar
                    tabBar

                    if isLoading {
                        Spacer()
                        ProgressView()
                            .controlSize(.large)
                            .tint(SpentyColors.brandAccent)
                        Spacer()
                    } else {
                        subTypeList
                    }
                }
            }
            .safeAreaInset(edge: .top) {
                SheetHeader("Manage Sub-Types", onClose: { dismiss() })
                    .background(SpentyColors.surface)
            }
        }
        .task {
            await loadSubTypes()
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SpentySpacing.sm) {
                ForEach(tabs, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedTab = tab
                        }
                        isAdding = false
                        editingSubTypeId = nil
                    } label: {
                        Text(tab)
                            .font(SpentyFonts.caption)
                            .foregroundStyle(selectedTab == tab ? .white : SpentyColors.textSecondary)
                            .padding(.horizontal, SpentySpacing.md)
                            .padding(.vertical, SpentySpacing.sm)
                            .background(selectedTab == tab ? SpentyColors.brandPrimary : SpentyColors.bgSecondary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
        }
        .background(SpentyColors.surface)
    }

    // MARK: - Sub-Type List

    private var subTypeList: some View {
        ScrollView {
            LazyVStack(spacing: SpentySpacing.sm) {
                ForEach(filteredSubTypes) { subType in
                    subTypeRow(subType)
                }

                if isAdding {
                    addSubTypeRow
                }

                // Add button
                if !isAdding {
                    Button {
                        isAdding = true
                        newSubTypeName = ""
                    } label: {
                        HStack(spacing: SpentySpacing.sm) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 16))
                            Text("Add Sub-Type")
                                .font(SpentyFonts.body)
                        }
                        .foregroundStyle(SpentyColors.brandAccent)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(SpentySpacing.lg)
                    }
                    .buttonStyle(.plain)
                }

                if let error = errorMessage {
                    Text(error)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.danger)
                        .padding(.horizontal, SpentySpacing.lg)
                }
            }
            .padding(.vertical, SpentySpacing.sm)
        }
    }

    // MARK: - Sub-Type Row

    private func subTypeRow(_ subType: AccountSubType) -> some View {
        let isDefault = defaultSubTypeNames.contains(subType.name ?? "")
        let isBeingEdited = editingSubTypeId == subType.subTypeId

        return SpentyCard {
            HStack(spacing: SpentySpacing.md) {
                if isDefault {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(SpentyColors.textMuted)
                }

                if isBeingEdited {
                    TextField("Sub-type name", text: $editingName)
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textPrimary)
                        .textFieldStyle(.plain)
                        .onSubmit {
                            Task { await renameSubType(subType) }
                        }

                    Spacer()

                    Button {
                        Task { await renameSubType(subType) }
                    } label: {
                        Text("Save")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.brandAccent)
                    }
                    .buttonStyle(.plain)

                    Button {
                        editingSubTypeId = nil
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12))
                            .foregroundStyle(SpentyColors.textMuted)
                    }
                    .buttonStyle(.plain)
                } else {
                    Text(subType.name ?? "")
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Spacer()

                    if !isDefault {
                        Button {
                            editingSubTypeId = subType.subTypeId
                            editingName = subType.name ?? ""
                        } label: {
                            Image(systemName: "pencil")
                                .font(.system(size: 14))
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.horizontal, SpentySpacing.lg)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if !isDefault {
                Button(role: .destructive) {
                    Task { await deleteSubType(subType) }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
    }

    // MARK: - Add Row

    private var addSubTypeRow: some View {
        SpentyCard {
            HStack(spacing: SpentySpacing.md) {
                Image(systemName: "tag")
                    .font(.system(size: 14))
                    .foregroundStyle(SpentyColors.brandAccent)

                TextField("New sub-type name", text: $newSubTypeName)
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textPrimary)
                    .textFieldStyle(.plain)
                    .onSubmit {
                        Task { await addSubType() }
                    }

                Spacer()

                if isSavingNew {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Button {
                        Task { await addSubType() }
                    } label: {
                        Text("Save")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.brandAccent)
                    }
                    .buttonStyle(.plain)
                    .disabled(newSubTypeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    Button {
                        isAdding = false
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12))
                            .foregroundStyle(SpentyColors.textMuted)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, SpentySpacing.lg)
    }

    // MARK: - Actions

    private func loadSubTypes() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await repository.getSubTypes()
            subTypes = response.subTypes ?? []
        } catch {
            errorMessage = "Failed to load sub-types."
            logger.error("Load sub-types error: \(error.localizedDescription)")
        }
        isLoading = false
    }

    private func addSubType() async {
        let name = newSubTypeName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }

        isSavingNew = true
        errorMessage = nil
        do {
            try await repository.createSubType(name: name, accountType: selectedTab)
            isAdding = false
            newSubTypeName = ""
            await loadSubTypes()
        } catch {
            errorMessage = "Failed to add sub-type."
            logger.error("Add sub-type error: \(error.localizedDescription)")
        }
        isSavingNew = false
    }

    private func renameSubType(_ subType: AccountSubType) async {
        let name = editingName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let id = subType.subTypeId else { return }

        errorMessage = nil
        do {
            try await repository.updateSubType(id, name: name)
            editingSubTypeId = nil
            await loadSubTypes()
        } catch {
            errorMessage = "Failed to rename sub-type."
            logger.error("Rename sub-type error: \(error.localizedDescription)")
        }
    }

    private func deleteSubType(_ subType: AccountSubType) async {
        guard let id = subType.subTypeId else { return }

        errorMessage = nil
        do {
            try await repository.deleteSubType(id)
            await loadSubTypes()
        } catch {
            errorMessage = "Failed to delete sub-type."
            logger.error("Delete sub-type error: \(error.localizedDescription)")
        }
    }
}

#Preview {
    SubTypeManagerSheet()
}
