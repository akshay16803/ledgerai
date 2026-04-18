import SwiftUI

struct TransactionsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = TransactionsViewModel()
    @State private var accounts: [Account] = []

    private var currency: String {
        appState.user?.settings?.baseCurrency ?? "INR"
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                VStack(spacing: 0) {
                    viewModePicker
                    filterBar
                    content
                }
                .background(SpentyColors.bgPrimary.ignoresSafeArea())

                fab
            }
            .navigationTitle("Transactions")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await viewModel.loadTransactions()
                await loadAccounts()
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $viewModel.showEditTransaction) {
                EditTransactionSheet(
                    transaction: viewModel.editingTransaction,
                    onSaved: {
                        Task { await viewModel.refresh() }
                    }
                )
                .environment(appState)
            }
            .alert(
                "Delete Transaction",
                isPresented: $viewModel.showDeleteConfirm,
                presenting: viewModel.deletingTransaction
            ) { txn in
                Button("Delete", role: .destructive) {
                    Task { await viewModel.deleteTransaction(txn) }
                }
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = false
                    viewModel.deletingTransaction = nil
                }
            } message: { _ in
                Text("Are you sure you want to delete this transaction? This action cannot be undone.")
            }
        }
    }

    // MARK: - View Mode Picker

    private var viewModePicker: some View {
        Picker("View Mode", selection: $viewModel.viewMode) {
            ForEach(TransactionsViewModel.ViewMode.allCases, id: \.self) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, SpentySpacing.lg)
        .padding(.vertical, SpentySpacing.sm)
        .background(SpentyColors.surface)
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        VStack(spacing: SpentySpacing.sm) {
            // Type chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: SpentySpacing.sm) {
                    FilterChip("All", isSelected: viewModel.selectedType == nil) {
                        viewModel.selectedType = nil
                        Task { await viewModel.applyFilters() }
                    }
                    FilterChip("Income", isSelected: viewModel.selectedType == .income) {
                        viewModel.selectedType = .income
                        Task { await viewModel.applyFilters() }
                    }
                    FilterChip("Expense", isSelected: viewModel.selectedType == .expense) {
                        viewModel.selectedType = .expense
                        Task { await viewModel.applyFilters() }
                    }
                    FilterChip("Transfer", isSelected: viewModel.selectedType == .transfer) {
                        viewModel.selectedType = .transfer
                        Task { await viewModel.applyFilters() }
                    }
                }
                .padding(.horizontal, SpentySpacing.lg)
            }

            // Account + Date filters
            HStack(spacing: SpentySpacing.sm) {
                // Account picker
                Menu {
                    Button("All Accounts") {
                        viewModel.selectedAccountId = nil
                        Task { await viewModel.applyFilters() }
                    }
                    ForEach(accounts) { account in
                        Button(account.name) {
                            viewModel.selectedAccountId = account.accountId
                            Task { await viewModel.applyFilters() }
                        }
                    }
                } label: {
                    HStack(spacing: SpentySpacing.xs) {
                        Image(systemName: "building.columns")
                            .font(.system(size: 12))
                        Text(
                            accounts.first(where: { $0.accountId == viewModel.selectedAccountId })?.name
                                ?? "All Accounts"
                        )
                        .font(SpentyFonts.caption)
                        .lineLimit(1)
                    }
                    .foregroundStyle(
                        viewModel.selectedAccountId != nil
                            ? SpentyColors.brandAccent
                            : SpentyColors.textSecondary
                    )
                    .padding(.horizontal, SpentySpacing.md)
                    .padding(.vertical, SpentySpacing.sm)
                    .background(SpentyColors.surface)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule().stroke(SpentyColors.borderSubtle, lineWidth: 1)
                    )
                }

                // Date From
                dateFilterButton(
                    label: viewModel.dateFrom.map { DateFormatting.shortDate(from: iso8601String(from: $0)) } ?? "From",
                    icon: "calendar",
                    isActive: viewModel.dateFrom != nil
                ) {
                    // Use DatePicker in overlay
                }
                .overlay {
                    DatePicker(
                        "",
                        selection: Binding(
                            get: { viewModel.dateFrom ?? Date() },
                            set: { newDate in
                                viewModel.dateFrom = newDate
                                Task { await viewModel.applyFilters() }
                            }
                        ),
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .blendMode(.destinationOver)
                    .opacity(0.015)
                }

                // Date To
                dateFilterButton(
                    label: viewModel.dateTo.map { DateFormatting.shortDate(from: iso8601String(from: $0)) } ?? "To",
                    icon: "calendar.badge.clock",
                    isActive: viewModel.dateTo != nil
                ) {
                    // Use DatePicker in overlay
                }
                .overlay {
                    DatePicker(
                        "",
                        selection: Binding(
                            get: { viewModel.dateTo ?? Date() },
                            set: { newDate in
                                viewModel.dateTo = newDate
                                Task { await viewModel.applyFilters() }
                            }
                        ),
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .blendMode(.destinationOver)
                    .opacity(0.015)
                }

                Spacer()
            }
            .padding(.horizontal, SpentySpacing.lg)

            // Clear filters
            if viewModel.hasActiveFilters {
                HStack {
                    Spacer()
                    Button {
                        viewModel.clearFilters()
                    } label: {
                        HStack(spacing: SpentySpacing.xs) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 12))
                            Text("Clear Filters")
                                .font(SpentyFonts.caption)
                        }
                        .foregroundStyle(SpentyColors.danger)
                    }
                    .buttonStyle(.plain)
                    .padding(.trailing, SpentySpacing.lg)
                }
            }
        }
        .padding(.vertical, SpentySpacing.sm)
        .background(SpentyColors.surface)
        .overlay(alignment: .bottom) {
            Divider().overlay(SpentyColors.borderSubtle)
        }
    }

    private func dateFilterButton(
        label: String,
        icon: String,
        isActive: Bool,
        action: @escaping () -> Void
    ) -> some View {
        HStack(spacing: SpentySpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 11))
            Text(label)
                .font(SpentyFonts.caption)
                .lineLimit(1)
        }
        .foregroundStyle(isActive ? SpentyColors.brandAccent : SpentyColors.textSecondary)
        .padding(.horizontal, SpentySpacing.md)
        .padding(.vertical, SpentySpacing.sm)
        .background(SpentyColors.surface)
        .clipShape(Capsule())
        .overlay(
            Capsule().stroke(
                isActive ? SpentyColors.brandAccent : SpentyColors.borderSubtle,
                lineWidth: 1
            )
        )
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.transactions.isEmpty {
            ProgressView()
                .controlSize(.large)
                .tint(SpentyColors.brandAccent)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = viewModel.errorMessage, viewModel.transactions.isEmpty {
            EmptyState(
                icon: "exclamationmark.triangle",
                title: "Something Went Wrong",
                message: error,
                actionTitle: "Retry"
            ) {
                Task { await viewModel.loadTransactions() }
            }
        } else if viewModel.transactions.isEmpty {
            EmptyState(
                icon: "arrow.left.arrow.right",
                title: "No Transactions",
                message: "Start by adding your first transaction to track your finances.",
                actionTitle: "Add Transaction"
            ) {
                viewModel.editingTransaction = nil
                viewModel.showEditTransaction = true
            }
        } else {
            switch viewModel.viewMode {
            case .list:
                listView
            case .ledger:
                ledgerView
            }
        }
    }

    // MARK: - List View

    private var listView: some View {
        List {
            ForEach(viewModel.transactions) { txn in
                TransactionRow(transaction: txn, currency: currency)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                        if txn.status == .pendingReview {
                            Button {
                                Task { await viewModel.approveTransaction(txn) }
                            } label: {
                                Label("Approve", systemImage: "checkmark.seal")
                            }
                            .tint(SpentyColors.success)
                        }
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            viewModel.deletingTransaction = txn
                            viewModel.showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }

                        Button {
                            viewModel.editingTransaction = txn
                            viewModel.showEditTransaction = true
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        .tint(SpentyColors.brandAccent)
                    }
                    .onAppear {
                        if txn.id == viewModel.transactions.last?.id && viewModel.canLoadMore {
                            Task { await viewModel.loadMore() }
                        }
                    }
            }

            if viewModel.canLoadMore {
                ProgressView()
                    .controlSize(.regular)
                    .tint(SpentyColors.brandAccent)
                    .frame(maxWidth: .infinity)
                    .padding(SpentySpacing.xl)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Ledger View

    private var ledgerView: some View {
        ScrollView {
            LedgerView(transactions: viewModel.transactions, currency: currency)
                .padding(SpentySpacing.lg)
        }
    }

    // MARK: - FAB

    private var fab: some View {
        Button {
            viewModel.editingTransaction = nil
            viewModel.showEditTransaction = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(SpentyColors.brandPrimary)
                .clipShape(Circle())
                .shadow(color: SpentyColors.brandPrimary.opacity(0.3), radius: 8, y: 4)
        }
        .buttonStyle(.plain)
        .padding(.trailing, SpentySpacing.xl)
        .padding(.bottom, SpentySpacing.xl)
    }

    // MARK: - Helpers

    private func loadAccounts() async {
        do {
            accounts = try await AccountRepository().getAccounts()
        } catch {
            // Accounts are optional for filtering; fail silently
        }
    }

    private func iso8601String(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: date)
    }
}

#Preview {
    TransactionsView()
        .environment(AppState())
}
