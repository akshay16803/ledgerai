import SwiftUI

struct TransactionListView: View {

    @State private var viewModel = TransactionsViewModel()
    @State private var showDateFilter = false
    @State private var showDeleteConfirm = false
    @State private var deleteTargetId: String?
    @State private var selectedTransaction: Transaction?

    // MARK: - Date Formatting

    private static let rowDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    viewModeToggle
                    searchSection
                    filterSection
                    bulkBar
                    contentArea
                }
            }
            .navigationTitle("Transactions")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { toolbarContent }
            .sheet(isPresented: $viewModel.showForm) {
                UnifiedTransactionForm(
                    mode: viewModel.editingTransaction != nil
                        ? .edit(viewModel.editingTransaction!)
                        : .create,
                    onComplete: { Task { await viewModel.refresh() } }
                )
            }
            .sheet(item: $selectedTransaction) { txn in
                UnifiedTransactionForm(
                    mode: .edit(txn),
                    onComplete: { Task { await viewModel.refresh() } }
                )
            }
            .confirmationDialog(
                "Delete Transaction",
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    if let id = deleteTargetId {
                        Task { await viewModel.deleteTransaction(id: id) }
                    }
                }
            } message: {
                Text("This action cannot be undone.")
            }
            .task { await viewModel.loadInitial() }
            .alert(
                "Error",
                isPresented: Binding(
                    get: { viewModel.errorMessage != nil },
                    set: { if !$0 { viewModel.errorMessage = nil } }
                )
            ) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    // MARK: - View Mode Toggle

    private var viewModeToggle: some View {
        Picker("View", selection: $viewModel.viewMode) {
            ForEach(TransactionViewMode.allCases, id: \.self) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Search

    private var searchSection: some View {
        SearchBar(
            placeholder: "Search transactions...",
            text: $viewModel.searchQuery,
            onCommit: {
                Task { await viewModel.performSearch() }
            },
            onDebounced: { _ in
                Task { await viewModel.performSearch() }
            }
        )
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Filters

    private var filterSection: some View {
        VStack(spacing: 8) {
            FilterBar(
                filters: ["All", "Income", "Expense", "Transfer"],
                selected: Binding(
                    get: { viewModel.filterType },
                    set: { newValue in
                        viewModel.filterType = newValue
                        Task { await viewModel.refresh() }
                    }
                )
            )

            HStack(spacing: 8) {
                accountPicker
                dateRangeButton
            }
            .padding(.horizontal, 16)
        }
        .padding(.top, 8)
    }

    private var accountPicker: some View {
        Menu {
            Button("All Accounts") {
                viewModel.filterAccountId = ""
                Task { await viewModel.refresh() }
            }
            ForEach(viewModel.accounts) { account in
                Button(account.name ?? "Unnamed") {
                    viewModel.filterAccountId = account.id
                    Task { await viewModel.refresh() }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "building.columns")
                    .font(.system(size: 12))
                Text(selectedAccountLabel)
                    .font(SpentyFonts.footnote)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10))
            }
            .foregroundColor(viewModel.filterAccountId.isEmpty ? .spentyTextSecondary : .spentyPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(viewModel.filterAccountId.isEmpty ? Color.spentyBgPrimary : Color.spentyPrimary.opacity(0.1))
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(viewModel.filterAccountId.isEmpty ? Color.spentyBorder : Color.spentyPrimary.opacity(0.3), lineWidth: 1)
            )
        }
    }

    private var selectedAccountLabel: String {
        if viewModel.filterAccountId.isEmpty { return "Account" }
        return viewModel.accountName(for: viewModel.filterAccountId)
    }

    private var dateRangeButton: some View {
        Button {
            showDateFilter.toggle()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "calendar")
                    .font(.system(size: 12))
                Text(dateRangeLabel)
                    .font(SpentyFonts.footnote)
                if viewModel.filterDateFrom != nil || viewModel.filterDateTo != nil {
                    Button {
                        viewModel.filterDateFrom = nil
                        viewModel.filterDateTo = nil
                        Task { await viewModel.refresh() }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                    }
                }
            }
            .foregroundColor(hasDateFilter ? .spentyPrimary : .spentyTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(hasDateFilter ? Color.spentyPrimary.opacity(0.1) : Color.spentyBgPrimary)
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(hasDateFilter ? Color.spentyPrimary.opacity(0.3) : Color.spentyBorder, lineWidth: 1)
            )
        }
        .popover(isPresented: $showDateFilter) {
            dateFilterPopover
        }
    }

    private var hasDateFilter: Bool {
        viewModel.filterDateFrom != nil || viewModel.filterDateTo != nil
    }

    private var dateRangeLabel: String {
        if hasDateFilter { return "Date Set" }
        return "Date Range"
    }

    private var dateFilterPopover: some View {
        VStack(spacing: 16) {
            Text("Date Range")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            VStack(alignment: .leading, spacing: 6) {
                Text("From")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                DatePicker(
                    "From",
                    selection: Binding(
                        get: { viewModel.filterDateFrom ?? Date() },
                        set: { viewModel.filterDateFrom = $0 }
                    ),
                    displayedComponents: .date
                )
                .labelsHidden()
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("To")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                DatePicker(
                    "To",
                    selection: Binding(
                        get: { viewModel.filterDateTo ?? Date() },
                        set: { viewModel.filterDateTo = $0 }
                    ),
                    displayedComponents: .date
                )
                .labelsHidden()
            }

            Button("Apply") {
                showDateFilter = false
                Task { await viewModel.refresh() }
            }
            .primaryButtonStyle()
        }
        .padding(20)
        .presentationCompactAdaptation(.popover)
    }

    // MARK: - Bulk Bar

    @ViewBuilder
    private var bulkBar: some View {
        if viewModel.isSelecting {
            HStack(spacing: 12) {
                Text("\(viewModel.selectedIds.count) selected")
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                Button { Task { await viewModel.bulkDelete() } } label: {
                    Label("Delete", systemImage: "trash")
                        .font(SpentyFonts.footnote)
                }
                .tint(Color.spentyError)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.spentyCardBg)
            .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
        }
    }

    // MARK: - Content

    private var contentArea: some View {
        Group {
            if viewModel.isLoading && viewModel.transactions.isEmpty {
                LoadingView()
            } else if viewModel.transactions.isEmpty {
                EmptyStateView(
                    icon: "arrow.left.arrow.right",
                    title: "No Approved Transactions",
                    subtitle: viewModel.pendingCount > 0
                        ? "You have \(viewModel.pendingCount) transaction\(viewModel.pendingCount == 1 ? "" : "s") pending review."
                        : "Add your first transaction to start tracking.",
                    buttonTitle: "Add Transaction"
                ) {
                    viewModel.beginCreate()
                }
            } else {
                switch viewModel.viewMode {
                case .list:
                    transactionsList
                case .ledger:
                    TransactionLedgerView(viewModel: viewModel)
                }
            }
        }
    }

    // MARK: - List

    private var transactionsList: some View {
        List {
            ForEach(viewModel.transactions) { txn in
                transactionRow(txn)
                    .listRowBackground(Color.spentyCardBg)
                    .listRowSeparatorTint(.spentyBorder)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            deleteTargetId = txn.id
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }

                        Button {
                            viewModel.beginEdit(txn)
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        .tint(Color.spentyInfo)
                    }
                    .onAppear {
                        if txn.id == viewModel.transactions.last?.id {
                            Task { await viewModel.loadMore() }
                        }
                    }
                    .onTapGesture {
                        if viewModel.isSelecting {
                            viewModel.toggleSelection(txn.id)
                        } else {
                            selectedTransaction = txn
                        }
                    }
                    .onLongPressGesture {
                        if !viewModel.isSelecting {
                            viewModel.isSelecting = true
                        }
                        viewModel.toggleSelection(txn.id)
                    }
            }

            if viewModel.isLoadingMore {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Color.spentyPrimary)
                    Spacer()
                }
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.plain)
        .refreshable { await viewModel.refresh() }
    }

    // MARK: - Row

    private func transactionRow(_ txn: Transaction) -> some View {
        HStack(spacing: 12) {
            if viewModel.isSelecting {
                Image(systemName: viewModel.selectedIds.contains(txn.id) ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(viewModel.selectedIds.contains(txn.id) ? .spentyPrimary : .spentyTextSecondary)
                    .font(.system(size: 20))
            }

            typeIcon(txn.transactionType)

            VStack(alignment: .leading, spacing: 4) {
                Text(txn.description ?? "No description")
                    .font(SpentyFonts.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(txn.categoryName ?? viewModel.categoryName(for: txn.categoryId))
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)

                    Text("·")
                        .foregroundColor(.spentyTextSecondary)

                    Text(txn.accountName ?? viewModel.accountName(for: txn.accountId))
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }

                if let date = txn.date {
                    Text(Self.rowDateFormatter.string(from: date))
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyTextSecondary.opacity(0.7))
                }
            }

            Spacer()

            CurrencyText(
                amount: txn.amount ?? 0,
                font: SpentyFonts.amountSmall,
                color: amountColor(for: txn.transactionType)
            )
        }
        .padding(.vertical, 4)
    }

    // MARK: - Helpers

    private func typeIcon(_ type: String?) -> some View {
        let (icon, color): (String, Color) = {
            switch type?.lowercased() {
            case "income":
                return ("arrow.down.left.circle.fill", .spentySuccess)
            case "expense":
                return ("arrow.up.right.circle.fill", .spentyError)
            case "transfer":
                return ("arrow.left.arrow.right.circle.fill", .spentyInfo)
            default:
                return ("circle.fill", .spentyTextSecondary)
            }
        }()

        return Image(systemName: icon)
            .font(.system(size: 28))
            .foregroundColor(color)
    }

    private func amountColor(for type: String?) -> Color {
        switch type?.lowercased() {
        case "income": return .spentySuccess
        case "expense": return .spentyError
        case "transfer": return .spentyInfo
        default: return .spentyTextPrimary
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button {
                viewModel.beginCreate()
            } label: {
                Image(systemName: "plus.circle.fill")
                    .foregroundColor(.spentyPrimary)
                    .font(.system(size: 22))
            }
        }

        ToolbarItem(placement: .topBarLeading) {
            if viewModel.isSelecting {
                HStack(spacing: 12) {
                    Button("Select All") { viewModel.selectAll() }
                        .font(SpentyFonts.footnote)
                    Button("Cancel") { viewModel.clearSelection() }
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyError)
                }
            }
        }
    }
}

#Preview {
    TransactionListView()
}
