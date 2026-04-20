import SwiftUI

struct DashboardView: View {

    @State private var viewModel = DashboardViewModel()
    @State private var isAccountsExpanded = false
    @State private var isTransactionsExpanded = false
    @State private var isPendingExpanded = false
    @State private var selectedPendingTxn: PendingTransaction?
    @State private var showAllAccounts = false
    @State private var showIncomeList = false
    @State private var showExpenseList = false
    @State private var showAllPending = false
    @State private var selectedTransaction: Transaction?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Group {
                    if viewModel.isLoading && !viewModel.hasData {
                        LoadingView(message: "Loading your dashboard...")
                    } else {
                        mainContent
                    }
                }

                floatingButtons
            }
            .background(Color.spentyBgPrimary)
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.showAIChat = true
                    } label: {
                        Image(systemName: "sparkles")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(.spentyPrimary)
                    }
                }
            }
            .task {
                await viewModel.loadSummary()
            }
            .sheet(isPresented: $viewModel.showNewTransaction, onDismiss: {
                Task { await viewModel.refresh() }
            }) {
                NavigationStack {
                    TransactionFormView(viewModel: TransactionsViewModel())
                }
            }
            .navigationDestination(for: String.self) { accountId in
                AccountDetailView(accountId: accountId)
            }
            .sheet(isPresented: $viewModel.showAIChat, onDismiss: {
                Task { await viewModel.refresh() }
            }) {
                AIChatView()
            }
            .sheet(item: $selectedPendingTxn, onDismiss: {
                Task { await viewModel.refresh() }
            }) { txn in
                PendingTransactionDetailSheet(
                    transaction: txn,
                    viewModel: viewModel
                )
            }
            .sheet(isPresented: $showAllAccounts) {
                DashboardAccountsListView(accounts: viewModel.accounts)
            }
            .sheet(isPresented: $showIncomeList) {
                DashboardFilteredTransactionsView(
                    title: "Income This Month",
                    transactions: viewModel.recentTransactions.filter { $0.transactionType?.lowercased() == "income" },
                    emptyMessage: "No income transactions this month"
                )
            }
            .sheet(isPresented: $showExpenseList) {
                DashboardFilteredTransactionsView(
                    title: "Expenses This Month",
                    transactions: viewModel.recentTransactions.filter { $0.transactionType?.lowercased() == "expense" },
                    emptyMessage: "No expense transactions this month"
                )
            }
            .sheet(isPresented: $showAllPending) {
                DashboardAllPendingView(
                    viewModel: viewModel,
                    onTap: { txn in
                        showAllPending = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                            selectedPendingTxn = txn
                        }
                    }
                )
            }
            .sheet(item: $selectedTransaction) { txn in
                TransactionDetailView(
                    transaction: txn,
                    onTransactionUpdated: {
                        Task { await viewModel.refresh() }
                    }
                )
            }
        }
    }

    // MARK: - Main Scrollable Content

    private var mainContent: some View {
        ScrollView {
            VStack(spacing: 20) {

                // Error banner
                if viewModel.showError {
                    ErrorBanner(message: viewModel.errorMessage) {
                        viewModel.showError = false
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Stat cards grid
                statsGrid
                    .padding(.horizontal, 16)

                // Accounts section
                if !viewModel.accounts.isEmpty {
                    accountsSection
                        .padding(.horizontal, 16)
                }

                // Recent transactions section
                if !viewModel.recentTransactions.isEmpty {
                    recentTransactionsSection
                        .padding(.horizontal, 16)
                }

                // Pending approval section
                pendingApprovalSection
                    .padding(.horizontal, 16)

                // Bottom spacer for floating button clearance
                Spacer()
                    .frame(height: 80)
            }
            .padding(.top, 8)
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: - Stats Grid

    private var statsGrid: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ],
            spacing: 12
        ) {
            Button { showAllAccounts = true } label: {
                StatCard(
                    label: "Net Worth",
                    value: formatCurrency(viewModel.netWorth),
                    icon: "banknote.fill",
                    color: viewModel.netWorth >= 0 ? .spentySuccess : .spentyError
                )
            }
            .buttonStyle(.plain)

            Button { showIncomeList = true } label: {
                StatCard(
                    label: "Income This Month",
                    value: formatCurrency(viewModel.incomeThisMonth),
                    icon: "arrow.down.circle.fill",
                    color: .spentySuccess
                )
            }
            .buttonStyle(.plain)

            Button { showExpenseList = true } label: {
                StatCard(
                    label: "Expenses This Month",
                    value: formatCurrency(viewModel.expenseThisMonth),
                    icon: "arrow.up.circle.fill",
                    color: .spentyAccent1
                )
            }
            .buttonStyle(.plain)

            Button { showAllPending = true } label: {
                StatCard(
                    label: "Pending Review",
                    value: "\(viewModel.pendingReview)",
                    icon: "clock.fill",
                    color: .spentyWarning
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Accounts Section

    private var accountsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            collapsibleHeader(
                title: "Accounts",
                icon: "building.columns.fill",
                count: viewModel.accounts.count,
                isExpanded: $isAccountsExpanded
            )

            if isAccountsExpanded {
                VStack(spacing: 0) {
                    ForEach(viewModel.accounts) { account in
                        NavigationLink(value: account.id) {
                            accountRow(account)
                        }
                        .buttonStyle(.plain)

                        if account.id != viewModel.accounts.last?.id {
                            Divider()
                                .padding(.leading, 48)
                        }
                    }
                }
                .cardStyle()
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private func accountRow(_ account: Account) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.spentyPrimary.opacity(0.1))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: iconForAccountType(account.subType))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.spentyPrimary)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(account.name ?? "Unnamed Account")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                if let accountType = account.accountType {
                    Text(accountType.capitalized)
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }
            }

            Spacer()

            CurrencyText(
                amount: account.balance ?? 0,
                font: SpentyFonts.amountSmall
            )

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.spentyTextSecondary.opacity(0.5))
        }
        .padding(.vertical, 10)
    }

    // MARK: - Recent Transactions Section

    private var recentTransactionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            collapsibleHeader(
                title: "Recent Transactions",
                icon: "clock.arrow.circlepath",
                count: viewModel.recentTransactions.count,
                isExpanded: $isTransactionsExpanded
            )

            if isTransactionsExpanded {
                VStack(spacing: 0) {
                    ForEach(viewModel.recentTransactions) { txn in
                        Button {
                            selectedTransaction = txn
                        } label: {
                            transactionRow(txn)
                        }
                        .buttonStyle(.plain)

                        if txn.id != viewModel.recentTransactions.last?.id {
                            Divider()
                                .padding(.leading, 48)
                        }
                    }
                }
                .cardStyle()
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private func transactionRow(_ txn: Transaction) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(colorForTransactionType(txn.transactionType).opacity(0.12))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: iconForTransactionType(txn.transactionType))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(colorForTransactionType(txn.transactionType))
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(txn.description ?? "Transaction")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                if let date = txn.date {
                    Text(date, style: .date)
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                CurrencyText(
                    amount: txn.amount ?? 0,
                    font: SpentyFonts.amountSmall,
                    color: colorForTransactionType(txn.transactionType)
                )

                if let status = txn.status, status.lowercased() == "pending" {
                    Text("Pending")
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyWarning)
                }
            }
        }
        .padding(.vertical, 10)
    }

    // MARK: - Floating Buttons

    private var floatingButtons: some View {
        VStack(spacing: 12) {
            // New Transaction FAB
            Button {
                viewModel.showNewTransaction = true
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 56, height: 56)
                    .background(
                        Circle()
                            .fill(Color.spentyPrimary)
                            .shadow(color: Color.spentyPrimary.opacity(0.35), radius: 12, x: 0, y: 6)
                    )
            }
        }
        .padding(.trailing, 20)
        .padding(.bottom, 24)
    }

    // MARK: - Pending Approval Section

    private var pendingApprovalSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            collapsibleHeader(
                title: "Pending Approval",
                icon: "envelope.badge.fill",
                count: viewModel.pendingReview,
                isExpanded: $isPendingExpanded
            )

            if isPendingExpanded {
                if viewModel.isLoadingPending {
                    HStack {
                        Spacer()
                        ProgressView()
                            .padding(.vertical, 20)
                        Spacer()
                    }
                    .cardStyle()
                } else if viewModel.pendingTransactions.isEmpty {
                    HStack {
                        Spacer()
                        Text("No pending transactions")
                            .font(SpentyFonts.subheadline)
                            .foregroundColor(.spentyTextSecondary)
                            .padding(.vertical, 20)
                        Spacer()
                    }
                    .cardStyle()
                } else {
                    VStack(spacing: 0) {
                        ForEach(viewModel.pendingTransactions) { txn in
                            pendingRow(txn)

                            if txn.id != viewModel.pendingTransactions.last?.id {
                                Divider()
                                    .padding(.leading, 48)
                            }
                        }
                    }
                    .cardStyle()
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
    }

    private func pendingRow(_ txn: PendingTransaction) -> some View {
        Button {
            selectedPendingTxn = txn
        } label: {
            HStack(spacing: 12) {
                Circle()
                    .fill(Color.spentyWarning.opacity(0.12))
                    .frame(width: 36, height: 36)
                    .overlay(
                        Image(systemName: txn.source == "sms" ? "message.fill" : "envelope.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.spentyWarning)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(txn.description ?? "Transaction")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)

                    if let date = txn.date {
                        Text(date, style: .date)
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }

                Spacer()

                CurrencyText(
                    amount: txn.amount ?? 0,
                    font: SpentyFonts.amountSmall,
                    color: txn.transactionType == "income" ? .spentySuccess : .spentyAccent1
                )

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.spentyTextSecondary.opacity(0.5))
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Collapsible Section Header

    private func collapsibleHeader(title: String, icon: String, count: Int, isExpanded: Binding<Bool>) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.25)) {
                isExpanded.wrappedValue.toggle()
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.spentyPrimary)

                Text("\(title) (\(count))")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.spentyTextSecondary)
                    .rotationEffect(.degrees(isExpanded.wrappedValue ? 90 : 0))
                    .animation(.easeInOut(duration: 0.25), value: isExpanded.wrappedValue)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let absValue = abs(value)
        if absValue >= 1_00_00_000 {
            // 1 Cr+ : show compact like "₹1.2Cr"
            let crores = value / 1_00_00_000
            return String(format: "₹%.1fCr", crores)
        } else if absValue >= 1_00_000 {
            // 1L+ : show compact like "₹12.3L"
            let lakhs = value / 1_00_000
            return String(format: "₹%.1fL", lakhs)
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func iconForAccountType(_ type: String?) -> String {
        switch type?.lowercased() {
        case "bank": return "building.columns.fill"
        case "credit_card", "credit card": return "creditcard.fill"
        case "cash": return "banknote.fill"
        case "wallet", "digital_wallet": return "wallet.pass.fill"
        case "investment", "demat": return "chart.line.uptrend.xyaxis"
        case "loan": return "percent"
        default: return "building.columns.fill"
        }
    }

    private func iconForTransactionType(_ type: String?) -> String {
        switch type?.lowercased() {
        case "income": return "arrow.down.circle.fill"
        case "expense": return "arrow.up.circle.fill"
        case "transfer": return "arrow.left.arrow.right"
        default: return "arrow.up.circle.fill"
        }
    }

    private func colorForTransactionType(_ type: String?) -> Color {
        switch type?.lowercased() {
        case "income": return .spentySuccess
        case "expense": return .spentyAccent1
        case "transfer": return .spentyInfo
        default: return .spentyTextSecondary
        }
    }
}

// MARK: - Pending Transaction Detail Sheet

struct PendingTransactionDetailSheet: View {

    let transaction: PendingTransaction
    @Bindable var viewModel: DashboardViewModel

    @Environment(\.dismiss) private var dismiss

    @State private var editDescription: String = ""
    @State private var editAmount: String = ""
    @State private var editDate: Date = Date()
    @State private var editType: String = "expense"
    @State private var editCategory: String = ""
    @State private var isProcessing = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {

                        // Source badge
                        HStack {
                            Label(
                                transaction.source == "sms" ? "From SMS" : "From Email",
                                systemImage: transaction.source == "sms" ? "message.fill" : "envelope.fill"
                            )
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyWarning)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color.spentyWarning.opacity(0.1), in: Capsule())

                            Spacer()
                        }

                        // Edit fields
                        VStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Description")
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyTextSecondary)
                                TextField("Description", text: $editDescription)
                                    .font(SpentyFonts.body)
                                    .padding(12)
                                    .background(Color.spentyBgSecondary, in: RoundedRectangle(cornerRadius: 10))
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Amount")
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyTextSecondary)
                                TextField("Amount", text: $editAmount)
                                    .font(SpentyFonts.body)
                                    .keyboardType(.decimalPad)
                                    .padding(12)
                                    .background(Color.spentyBgSecondary, in: RoundedRectangle(cornerRadius: 10))
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Date")
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyTextSecondary)
                                DatePicker("", selection: $editDate, displayedComponents: .date)
                                    .datePickerStyle(.compact)
                                    .labelsHidden()
                                    .tint(.spentyPrimary)
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Type")
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyTextSecondary)
                                Picker("Type", selection: $editType) {
                                    Text("Income").tag("income")
                                    Text("Expense").tag("expense")
                                }
                                .pickerStyle(.segmented)
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Category")
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyTextSecondary)
                                TextField("Category (optional)", text: $editCategory)
                                    .font(SpentyFonts.body)
                                    .padding(12)
                                    .background(Color.spentyBgSecondary, in: RoundedRectangle(cornerRadius: 10))
                            }
                        }
                        .padding()
                        .background(Color.spentyCardBg, in: RoundedRectangle(cornerRadius: 14))
                        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)

                        // Action buttons
                        VStack(spacing: 12) {
                            // Approve button (primary)
                            Button {
                                Task { await approveTransaction() }
                            } label: {
                                HStack {
                                    if isProcessing {
                                        ProgressView()
                                            .tint(.white)
                                    } else {
                                        Image(systemName: "checkmark.circle.fill")
                                        Text("Approve Transaction")
                                            .fontWeight(.semibold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .foregroundColor(.white)
                                .background(Color.spentySuccess, in: RoundedRectangle(cornerRadius: 12))
                            }
                            .disabled(isProcessing)

                            // Reject button (secondary)
                            Button {
                                Task { await rejectTransaction() }
                            } label: {
                                HStack {
                                    Image(systemName: "xmark.circle.fill")
                                    Text("Reject Transaction")
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .foregroundColor(.spentyError)
                                .background(Color.spentyError.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                            }
                            .disabled(isProcessing)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Review Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .tint(.spentyPrimary)
                }
            }
            .onAppear {
                editDescription = transaction.description ?? ""
                editAmount = transaction.amount.map { String(format: "%.2f", $0) } ?? ""
                editDate = transaction.date ?? Date()
                editType = transaction.transactionType ?? "expense"
                editCategory = transaction.categoryName ?? ""
            }
        }
        .presentationDetents([.large])
    }

    private func approveTransaction() async {
        isProcessing = true

        // Save edits first if changed
        let update = PendingTransactionUpdate(
            description: editDescription.isEmpty ? nil : editDescription,
            amount: Double(editAmount),
            date: editDate
        )
        do {
            _ = try await EmailSyncRepository.shared.updateTransaction(transaction.id, body: update)
        } catch {
            // Continue to approve even if update fails
        }

        await viewModel.approvePendingTransaction(transaction.id)
        isProcessing = false
        dismiss()
    }

    private func rejectTransaction() async {
        isProcessing = true
        await viewModel.rejectPendingTransaction(transaction.id)
        isProcessing = false
        dismiss()
    }
}

// MARK: - Dashboard Accounts List View

struct DashboardAccountsListView: View {

    let accounts: [Account]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                if accounts.isEmpty {
                    ContentUnavailableView("No Accounts", systemImage: "building.columns", description: Text("No accounts found"))
                } else {
                    List(accounts) { account in
                        NavigationLink {
                            AccountDetailView(accountId: account.id)
                        } label: {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Color.spentyPrimary.opacity(0.1))
                                    .frame(width: 40, height: 40)
                                    .overlay(
                                        Image(systemName: "building.columns.fill")
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundColor(.spentyPrimary)
                                    )

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(account.name ?? "Unnamed")
                                        .font(SpentyFonts.subheadline)
                                        .foregroundColor(.spentyTextPrimary)
                                    if let type = account.accountType {
                                        Text(type.capitalized)
                                            .font(SpentyFonts.caption1)
                                            .foregroundColor(.spentyTextSecondary)
                                    }
                                }

                                Spacer()

                                CurrencyText(
                                    amount: account.balance ?? 0,
                                    font: SpentyFonts.amountSmall,
                                    color: (account.balance ?? 0) >= 0 ? .spentySuccess : .spentyError
                                )

                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(.spentyTextSecondary.opacity(0.5))
                            }
                        }
                        .listRowBackground(Color.spentyCardBg)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("All Accounts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .tint(.spentyPrimary)
                }
            }
        }
    }
}

// MARK: - Dashboard Filtered Transactions View

struct DashboardFilteredTransactionsView: View {

    let title: String
    let transactions: [Transaction]
    let emptyMessage: String
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTransaction: Transaction?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                if transactions.isEmpty {
                    ContentUnavailableView(emptyMessage, systemImage: "tray", description: nil)
                } else {
                    List(transactions) { txn in
                        Button {
                            selectedTransaction = txn
                        } label: {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(colorForType(txn.transactionType).opacity(0.12))
                                    .frame(width: 40, height: 40)
                                    .overlay(
                                        Image(systemName: txn.transactionType?.lowercased() == "income" ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundColor(colorForType(txn.transactionType))
                                    )

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(txn.description ?? "Transaction")
                                        .font(SpentyFonts.subheadline)
                                        .foregroundColor(.spentyTextPrimary)
                                        .lineLimit(1)
                                    if let date = txn.date {
                                        Text(date, style: .date)
                                            .font(SpentyFonts.caption1)
                                            .foregroundColor(.spentyTextSecondary)
                                    }
                                }

                                Spacer()

                                CurrencyText(
                                    amount: txn.amount ?? 0,
                                    font: SpentyFonts.amountSmall,
                                    color: colorForType(txn.transactionType)
                                )
                            }
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.spentyCardBg)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .tint(.spentyPrimary)
                }
            }
            .sheet(item: $selectedTransaction) { txn in
                TransactionDetailView(transaction: txn)
            }
        }
    }

    private func colorForType(_ type: String?) -> Color {
        switch type?.lowercased() {
        case "income": return .spentySuccess
        case "expense": return .spentyAccent1
        default: return .spentyTextSecondary
        }
    }
}

// MARK: - Dashboard All Pending View

struct DashboardAllPendingView: View {

    @Bindable var viewModel: DashboardViewModel
    let onTap: (PendingTransaction) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                if viewModel.pendingTransactions.isEmpty {
                    ContentUnavailableView("All Caught Up", systemImage: "checkmark.circle", description: Text("No pending transactions"))
                } else {
                    List(viewModel.pendingTransactions) { txn in
                        Button {
                            onTap(txn)
                        } label: {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Color.spentyWarning.opacity(0.12))
                                    .frame(width: 40, height: 40)
                                    .overlay(
                                        Image(systemName: txn.source == "sms" ? "message.fill" : "envelope.fill")
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundColor(.spentyWarning)
                                    )

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(txn.description ?? "Transaction")
                                        .font(SpentyFonts.subheadline)
                                        .foregroundColor(.spentyTextPrimary)
                                        .lineLimit(1)
                                    if let date = txn.date {
                                        Text(date, style: .date)
                                            .font(SpentyFonts.caption1)
                                            .foregroundColor(.spentyTextSecondary)
                                    }
                                }

                                Spacer()

                                CurrencyText(
                                    amount: txn.amount ?? 0,
                                    font: SpentyFonts.amountSmall,
                                    color: txn.transactionType == "income" ? .spentySuccess : .spentyAccent1
                                )

                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(.spentyTextSecondary.opacity(0.5))
                            }
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.spentyCardBg)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Pending Approval")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .tint(.spentyPrimary)
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    DashboardView()
}
