import SwiftUI

struct StatementDetailView: View {

    let statement: Statement
    @Bindable var viewModel: ReconciliationViewModel
    let accounts: [Account]

    @State private var categories: [Category] = []
    @State private var editingEntryIndex: Int?
    @State private var selectedCategoryId: String?
    @State private var selectedSubcategoryId: String?
    @State private var selectedTransactionType: String?

    var body: some View {
        ZStack {
            SpentyColors.bgPrimary
                .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: SpentySpacing.xl) {
                    headerSection
                    actionSection
                    reconciliationResultSection
                    entriesSection
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
        }
        .navigationTitle("Statement Details")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadCategories()
        }
        .sheet(item: editingEntryBinding) { wrapper in
            entryCategorySheet(entryIndex: wrapper.index)
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text(currentStatement.filename ?? "Statement")
                            .font(SpentyFonts.heading)
                            .foregroundStyle(SpentyColors.textPrimary)

                        if let accountName = accountName(for: currentStatement.accountId) {
                            Text(accountName)
                                .font(SpentyFonts.body)
                                .foregroundStyle(SpentyColors.textSecondary)
                        }
                    }

                    Spacer()

                    statusBadge(for: currentStatement.status)
                }

                Divider()
                    .overlay(SpentyColors.borderSubtle)

                HStack(spacing: SpentySpacing.xl) {
                    if let from = currentStatement.periodFrom, let to = currentStatement.periodTo {
                        detailItem("Period", value: "\(from) - \(to)")
                    }

                    if let entries = currentStatement.parsedEntries {
                        detailItem("Entries", value: "\(entries.count)")
                    }

                    if let type = currentStatement.statementType {
                        detailItem("Type", value: type.capitalized)
                    }
                }
            }
        }
    }

    // MARK: - Actions

    @ViewBuilder
    private var actionSection: some View {
        if currentStatement.status == .ready {
            VStack(spacing: SpentySpacing.md) {
                PrimaryButton(
                    "Reconcile",
                    icon: "checkmark.circle",
                    isLoading: viewModel.isReconciling,
                    isFullWidth: true
                ) {
                    Task {
                        await viewModel.reconcile(currentStatement.statementId)
                    }
                }

                if hasUncategorizedEntries {
                    SecondaryButton(
                        "Bulk Categorize",
                        icon: "tag.fill"
                    ) {
                        Task { await performBulkCategorize() }
                    }
                }
            }
        }
    }

    // MARK: - Reconciliation Result

    @ViewBuilder
    private var reconciliationResultSection: some View {
        if currentStatement.status == .reconciled, let result = viewModel.lastReconciliationResult {
            SpentyCard {
                VStack(alignment: .leading, spacing: SpentySpacing.md) {
                    SectionHeader("Reconciliation Results")

                    HStack(spacing: SpentySpacing.lg) {
                        StatCard(
                            title: "Matched",
                            value: "\(result.matchedCount ?? 0)",
                            icon: "checkmark.circle.fill",
                            iconColor: SpentyColors.success
                        )

                        StatCard(
                            title: "Missing",
                            value: "\(result.missingCount ?? 0)",
                            icon: "questionmark.circle.fill",
                            iconColor: SpentyColors.warning
                        )

                        StatCard(
                            title: "Conflicts",
                            value: "\(result.conflictCount ?? 0)",
                            icon: "exclamationmark.triangle.fill",
                            iconColor: SpentyColors.danger
                        )
                    }
                }
            }
        }
    }

    // MARK: - Entries

    private var entriesSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Parsed Entries")

            if let entries = currentStatement.parsedEntries, !entries.isEmpty {
                ParsedEntriesView(
                    entries: entries,
                    categories: categories,
                    onEditEntry: { index in
                        let entry = entries[index]
                        selectedCategoryId = entry.categoryId
                        selectedSubcategoryId = entry.subcategoryId
                        selectedTransactionType = entry.transactionType
                        editingEntryIndex = index
                    }
                )
            } else {
                SpentyCard {
                    HStack {
                        Spacer()
                        VStack(spacing: SpentySpacing.sm) {
                            Image(systemName: "doc.text")
                                .font(.system(size: 32))
                                .foregroundStyle(SpentyColors.textMuted)
                            Text("No entries parsed yet")
                                .font(SpentyFonts.body)
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                        .padding(.vertical, SpentySpacing.xl)
                        Spacer()
                    }
                }
            }
        }
    }

    // MARK: - Entry Category Sheet

    private func entryCategorySheet(entryIndex: Int) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: SpentySpacing.xl) {
                    SheetHeader("Assign Category") {
                        editingEntryIndex = nil
                    }

                    if let entries = currentStatement.parsedEntries,
                       entryIndex < entries.count {
                        let entry = entries[entryIndex]

                        // Entry summary
                        SpentyCard {
                            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                                if let desc = entry.description {
                                    Text(desc)
                                        .font(SpentyFonts.body)
                                        .foregroundStyle(SpentyColors.textPrimary)
                                }
                                HStack {
                                    if let date = entry.date {
                                        Text(date)
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textMuted)
                                    }
                                    Spacer()
                                    if let debit = entry.debit, debit > 0 {
                                        MoneyText(-debit, showSign: true, size: SpentyFonts.subheading)
                                    } else if let credit = entry.credit, credit > 0 {
                                        MoneyText(credit, showSign: true, size: SpentyFonts.subheading)
                                    }
                                }
                            }
                        }
                    }

                    // Category picker
                    VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                        Text("Category")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker("Category", selection: $selectedCategoryId) {
                            Text("None")
                                .tag(String?.none)

                            ForEach(categories) { category in
                                Text(category.name)
                                    .tag(Optional(category.categoryId))
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(SpentyColors.textPrimary)
                        .padding(SpentySpacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(SpentyColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: SpentyRadius.md)
                                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                        )
                    }

                    // Subcategory picker
                    if let parentId = selectedCategoryId,
                       let parent = categories.first(where: { $0.categoryId == parentId }),
                       let subcategories = parent.subcategories, !subcategories.isEmpty {
                        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                            Text("Subcategory")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)

                            Picker("Subcategory", selection: $selectedSubcategoryId) {
                                Text("None")
                                    .tag(String?.none)

                                ForEach(subcategories) { sub in
                                    Text(sub.name)
                                        .tag(Optional(sub.categoryId))
                                }
                            }
                            .pickerStyle(.menu)
                            .tint(SpentyColors.textPrimary)
                            .padding(SpentySpacing.md)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(SpentyColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: SpentyRadius.md)
                                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                            )
                        }
                    }

                    // Transaction type picker
                    VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                        Text("Transaction Type")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker("Type", selection: $selectedTransactionType) {
                            Text("Auto")
                                .tag(String?.none)
                            Text("Debit")
                                .tag(Optional("debit"))
                            Text("Credit")
                                .tag(Optional("credit"))
                        }
                        .pickerStyle(.segmented)
                    }

                    // Save button
                    PrimaryButton(
                        "Save",
                        icon: "checkmark",
                        isFullWidth: true
                    ) {
                        Task {
                            await viewModel.updateEntry(
                                statementId: currentStatement.statementId,
                                entryIndex: entryIndex,
                                categoryId: selectedCategoryId,
                                subcategoryId: selectedSubcategoryId,
                                transactionType: selectedTransactionType
                            )
                            editingEntryIndex = nil
                        }
                    }
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
            .background(SpentyColors.bgPrimary)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") {
                        editingEntryIndex = nil
                    }
                    .foregroundStyle(SpentyColors.brandAccent)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Helpers

    /// Return the freshest copy of the statement from the view model, falling back to the init value.
    private var currentStatement: Statement {
        viewModel.statements.first(where: { $0.statementId == statement.statementId })
            ?? viewModel.selectedStatement
            ?? statement
    }

    private var hasUncategorizedEntries: Bool {
        guard let entries = currentStatement.parsedEntries else { return false }
        return entries.contains(where: { $0.categoryId == nil })
    }

    private func performBulkCategorize() async {
        // Send all uncategorized entries for bulk auto-categorization
        guard let entries = currentStatement.parsedEntries else { return }
        var bulkEntries: [BulkCategoryEntry] = []

        for (index, entry) in entries.enumerated() {
            if entry.categoryId == nil {
                // Server will auto-assign categories
                bulkEntries.append(BulkCategoryEntry(
                    entryIndex: index,
                    categoryId: "auto",
                    subcategoryId: nil
                ))
            }
        }

        guard !bulkEntries.isEmpty else { return }
        await viewModel.bulkCategorize(currentStatement.statementId, entries: bulkEntries)
    }

    private func accountName(for accountId: String?) -> String? {
        guard let accountId else { return nil }
        return accounts.first(where: { $0.accountId == accountId })?.name
    }

    private func statusBadge(for status: StatementStatus?) -> some View {
        let (label, bgColor, fgColor) = statusInfo(status)

        return Text(label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(fgColor)
            .padding(.horizontal, SpentySpacing.sm)
            .padding(.vertical, SpentySpacing.xs)
            .background(bgColor)
            .clipShape(Capsule())
    }

    private func statusInfo(_ status: StatementStatus?) -> (String, Color, Color) {
        switch status {
        case .parsing:
            return ("Parsing", SpentyColors.info.opacity(0.15), SpentyColors.info)
        case .ready:
            return ("Ready", SpentyColors.warning.opacity(0.15), SpentyColors.warning)
        case .reconciled:
            return ("Reconciled", SpentyColors.success.opacity(0.15), SpentyColors.success)
        case .failed:
            return ("Failed", SpentyColors.danger.opacity(0.15), SpentyColors.danger)
        case .passwordNeeded:
            return ("Locked", SpentyColors.warning.opacity(0.15), SpentyColors.warning)
        case .none:
            return ("Unknown", SpentyColors.textMuted.opacity(0.15), SpentyColors.textMuted)
        }
    }

    private func detailItem(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(SpentyColors.textMuted)
                .textCase(.uppercase)
            Text(value)
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textSecondary)
        }
    }

    private func loadCategories() async {
        do {
            let repo = CategoryRepository()
            categories = try await repo.getCategories()
        } catch {
            // Categories will be empty; category pickers won't populate
        }
    }

    // MARK: - Entry Binding Wrapper

    private var editingEntryBinding: Binding<EntryIndexWrapper?> {
        Binding(
            get: {
                guard let index = editingEntryIndex else { return nil }
                return EntryIndexWrapper(index: index)
            },
            set: { wrapper in
                editingEntryIndex = wrapper?.index
            }
        )
    }
}

/// Wrapper to make an entry index `Identifiable` for `.sheet(item:)`.
struct EntryIndexWrapper: Identifiable {
    let index: Int
    var id: Int { index }
}

#Preview {
    NavigationStack {
        StatementDetailView(
            statement: Statement(
                statementId: "preview-1",
                userId: nil,
                accountId: nil,
                filename: "HDFC_March_2026.pdf",
                statementType: "bank",
                periodFrom: "2026-03-01",
                periodTo: "2026-03-31",
                status: .ready,
                parsedEntries: [
                    ParsedEntry(date: "2026-03-01", description: "ATM Withdrawal", debit: 5000, credit: nil),
                    ParsedEntry(date: "2026-03-05", description: "Salary Credit", debit: nil, credit: 85000),
                ],
                createdAt: nil
            ),
            viewModel: ReconciliationViewModel(),
            accounts: []
        )
        .environment(AppState())
    }
}
