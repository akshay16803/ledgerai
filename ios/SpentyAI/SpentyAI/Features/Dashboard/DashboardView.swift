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
                UnifiedTransactionForm(
                    mode: .create,
                    onComplete: { Task { await viewModel.refresh() } }
                )
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
                UnifiedTransactionForm(
                    mode: .approve(Transaction(from: txn)),
                    onComplete: { Task { await viewModel.refresh() } }
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
                UnifiedTransactionForm(
                    mode: .edit(txn),
                    onComplete: { Task { await viewModel.refresh() } }
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

                // Status badge removed — only approved transactions appear here
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

    // MARK: - Form State (mirrors TransactionFormView)

    @State private var editType: String = "expense"
    @State private var editAmount: String = ""
    @State private var editDate: Date = Date()
    @State private var editAccountId: String = ""
    @State private var editToAccountId: String = ""
    @State private var editCategoryId: String = ""
    @State private var editSubcategoryId: String = ""
    @State private var editDescription: String = ""
    @State private var editPaymentMethod: String = ""
    @State private var editIsRecurring: Bool = false
    @State private var editRecurringFrequency: String = "monthly"
    @State private var editRecurrenceDate: String = ""

    @State private var isProcessing = false

    // Data lists
    @State private var accounts: [Account] = []
    @State private var categories: [Category] = []

    // Inline creation state
    @State private var showNewAccountAlert: Bool = false
    @State private var showNewCategoryAlert: Bool = false
    @State private var showNewSubcategoryAlert: Bool = false
    @State private var newAccountName: String = ""
    @State private var newAccountType: String = "savings"
    @State private var newCategoryName: String = ""
    @State private var newSubcategoryName: String = ""

    // Source document states
    @State private var sourceContent: SourceContent?
    @State private var isLoadingSource = false
    @State private var sourceError: String?
    @State private var isSourceExpanded = false

    private let transactionTypes = ["income", "expense", "transfer"]
    private let paymentMethods = ["Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Net Banking", "Wallet", "Other"]
    private let frequencies = ["daily", "weekly", "monthly", "quarterly", "yearly"]
    private let frequencyLabels: [String: String] = ["daily": "Daily", "weekly": "Weekly", "monthly": "Monthly", "quarterly": "Quarterly", "yearly": "Yearly"]

    private static let paymentMethodMap: [String: String] = [
        "cash": "Cash", "upi": "UPI", "bank_transfer": "Bank Transfer",
        "credit_card": "Credit Card", "debit_card": "Debit Card",
        "cheque": "Cheque", "net_banking": "Net Banking",
        "wallet": "Wallet", "neft": "Bank Transfer", "rtgs": "Bank Transfer",
        "imps": "Bank Transfer", "other": "Other"
    ]

    private static func normalizePaymentMethod(_ raw: String) -> String {
        guard !raw.isEmpty else { return "" }
        let displayValues = ["Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Net Banking", "Wallet", "Other"]
        if displayValues.contains(raw) { return raw }
        return paymentMethodMap[raw.lowercased()] ?? raw
    }

    private var isTransfer: Bool { editType == "transfer" }

    private var filteredCategories: [Category] {
        categories.filter { cat in
            guard let catType = cat.categoryType?.lowercased() else { return true }
            if editType == "transfer" { return true }
            return catType == editType
        }
    }

    private var subcategories: [Category] {
        guard !editCategoryId.isEmpty else { return [] }
        return categories.first(where: { $0.id == editCategoryId })?.children ?? []
    }

    private var typeAccentColor: Color {
        switch editType {
        case "income": return .spentySuccess
        case "expense": return .spentyError
        case "transfer": return .spentyInfo
        default: return .spentyPrimary
        }
    }

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

                        // Source Document card
                        if transaction.sourceId != nil {
                            sourceDocumentCard
                        }

                        // MARK: Amount Hero
                        amountHeroSection

                        // MARK: Details Section
                        detailsSection

                        // MARK: Category Section
                        categorySection

                        // MARK: Note Section
                        noteSection

                        // MARK: Recurring Section
                        recurringSection

                        // Action buttons
                        VStack(spacing: 12) {
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
                    .padding(16)
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
            .task {
                await loadFormData()
                populateFields()
            }
        }
        .presentationDetents([.large])
    }

    // MARK: - Amount Hero

    private var amountHeroSection: some View {
        VStack(spacing: 20) {
            // Type picker
            HStack(spacing: 0) {
                ForEach(transactionTypes, id: \.self) { type in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            editType = type
                            editCategoryId = ""
                            editSubcategoryId = ""
                        }
                    } label: {
                        Text(type.capitalized)
                            .font(.system(size: 14, weight: editType == type ? .semibold : .regular))
                            .foregroundColor(editType == type ? .white : .spentyTextSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(editType == type ? typeAccentColor : Color.clear)
                            .cornerRadius(10)
                    }
                }
            }
            .padding(3)
            .background(Color.spentyBgSecondary)
            .cornerRadius(12)

            // Amount input
            VStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\u{20B9}")
                        .font(.system(size: 30, weight: .semibold, design: .rounded))
                        .foregroundColor(typeAccentColor)

                    TextField("0.00", text: $editAmount)
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(.spentyTextPrimary)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.5)
                }
                .frame(maxWidth: .infinity)

                let subtitle: String = {
                    switch editType {
                    case "transfer": return "Transfer amount"
                    case "income": return "Money received"
                    default: return "Money spent"
                    }
                }()
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundColor(.spentyTextSecondary)
            }
            .padding(.vertical, 4)
        }
        .padding(20)
        .background(Color.spentyCardBg)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    // MARK: - Details Section

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            reviewSectionLabel("Details")

            VStack(spacing: 0) {
                // Date
                reviewFormRow(icon: "calendar", label: "Date") {
                    DatePicker("", selection: $editDate, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .labelsHidden()
                }

                reviewFormDivider

                // Account
                HStack(spacing: 8) {
                    Image(systemName: "building.columns")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 22)

                    Text(isTransfer ? "From" : "Account")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)

                    Spacer(minLength: 4)

                    Picker("", selection: $editAccountId) {
                        Text("Select").tag("")
                        ForEach(accounts) { account in
                            Text(account.name ?? "Unnamed").tag(account.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)

                    Button {
                        newAccountName = ""
                        newAccountType = "savings"
                        showNewAccountAlert = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.spentyPrimary.opacity(0.7))
                    }
                }
                .padding(.vertical, 12)

                if isTransfer {
                    reviewFormDivider

                    reviewFormRow(icon: "arrow.right.circle", label: "To") {
                        Picker("", selection: $editToAccountId) {
                            Text("Select").tag("")
                            ForEach(accounts.filter { $0.id != editAccountId }) { account in
                                Text(account.name ?? "Unnamed").tag(account.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(.spentyTextPrimary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }

                reviewFormDivider

                // Payment method
                reviewFormRow(icon: "creditcard", label: "Payment") {
                    Picker("", selection: $editPaymentMethod) {
                        Text("Select").tag("")
                        ForEach(paymentMethods, id: \.self) { method in
                            Text(method).tag(method)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
            .cardStyle()
        }
    }

    // MARK: - Category Section

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            reviewSectionLabel("Category")

            VStack(spacing: 0) {
                // Category row
                HStack(spacing: 8) {
                    Image(systemName: "tag")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 22)

                    Text("Category")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)

                    Spacer(minLength: 4)

                    Picker("", selection: $editCategoryId) {
                        Text("Select").tag("")
                        ForEach(filteredCategories) { cat in
                            Text(cat.name ?? "Unnamed").tag(cat.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
                    .onChange(of: editCategoryId) { oldValue, newValue in
                        // Only clear subcategory when user manually changes category,
                        // not during initial population (old value was empty)
                        if !oldValue.isEmpty && oldValue != newValue {
                            editSubcategoryId = ""
                        }
                    }

                    Button {
                        newCategoryName = ""
                        showNewCategoryAlert = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.spentyPrimary.opacity(0.7))
                    }
                }
                .padding(.vertical, 12)

                if !subcategories.isEmpty || !editCategoryId.isEmpty {
                    reviewFormDivider

                    HStack(spacing: 8) {
                        Image(systemName: "tag.circle")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyPrimary.opacity(0.6))
                            .frame(width: 22)

                        Text("Subcategory")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .lineLimit(1)

                        Spacer(minLength: 4)

                        Picker("", selection: $editSubcategoryId) {
                            Text("None").tag("")
                            ForEach(subcategories) { sub in
                                Text(sub.name ?? "Unnamed").tag(sub.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(.spentyTextPrimary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .fixedSize(horizontal: false, vertical: true)

                        if !editCategoryId.isEmpty {
                            Button {
                                newSubcategoryName = ""
                                showNewSubcategoryAlert = true
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(.spentyPrimary.opacity(0.7))
                            }
                        }
                    }
                    .padding(.vertical, 12)
                }
            }
            .cardStyle()
            .alert("New Account", isPresented: $showNewAccountAlert) {
                TextField("Account name", text: $newAccountName)
                Picker("Type", selection: $newAccountType) {
                    Text("Savings").tag("savings")
                    Text("Current").tag("current")
                    Text("Credit Card").tag("credit_card")
                    Text("Cash").tag("cash")
                    Text("Wallet").tag("wallet")
                    Text("Loan").tag("loan")
                    Text("Investment").tag("investment")
                }
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineAccount() }
                }
                .disabled(newAccountName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name and type for the new account.")
            }
            .alert("New Category", isPresented: $showNewCategoryAlert) {
                TextField("Category name", text: $newCategoryName)
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineCategory() }
                }
                .disabled(newCategoryName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name for the new \(editType) category.")
            }
            .alert("New Subcategory", isPresented: $showNewSubcategoryAlert) {
                TextField("Subcategory name", text: $newSubcategoryName)
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineSubcategory() }
                }
                .disabled(newSubcategoryName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name for the new subcategory.")
            }
        }
    }

    // MARK: - Note Section

    private var noteSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            reviewSectionLabel("Note")

            HStack(spacing: 10) {
                Image(systemName: "text.alignleft")
                    .font(.system(size: 15))
                    .foregroundColor(.spentyPrimary)

                TextField("Add a note...", text: $editDescription)
                    .font(.system(size: 15))
                    .foregroundColor(.spentyTextPrimary)
            }
            .padding(14)
            .background(Color.spentyCardBg)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.spentyBorder, lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
        }
    }

    // MARK: - Recurring Section

    private var recurringSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            reviewSectionLabel("Recurring")

            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Image(systemName: "repeat")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 24)

                    Toggle(isOn: $editIsRecurring) {
                        Text("Repeat")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .lineLimit(1)
                    }
                    .tint(Color.spentyPrimary)
                }
                .padding(.vertical, 12)

                if editIsRecurring {
                    reviewFormDivider

                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            Image(systemName: "clock.arrow.2.circlepath")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyPrimary.opacity(0.6))
                                .frame(width: 24)

                            Text("Frequency")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyTextPrimary)
                                .lineLimit(1)
                        }
                        .padding(.top, 12)

                        HStack(spacing: 2) {
                            ForEach(frequencies, id: \.self) { freq in
                                Button {
                                    editRecurringFrequency = freq
                                } label: {
                                    Text(frequencyLabels[freq] ?? freq.capitalized)
                                        .font(.system(size: 12, weight: editRecurringFrequency == freq ? .semibold : .regular))
                                        .foregroundColor(editRecurringFrequency == freq ? .white : .spentyTextSecondary)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 9)
                                        .background(editRecurringFrequency == freq ? Color.spentyPrimary : Color.clear)
                                        .cornerRadius(10)
                                }
                            }
                        }
                        .padding(3)
                        .background(Color.spentyBgSecondary)
                        .cornerRadius(12)
                    }

                    reviewFormDivider

                    reviewFormRow(icon: "number", label: "Day") {
                        TextField("1-31", text: $editRecurrenceDate)
                            .keyboardType(.numberPad)
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }
            .cardStyle()
        }
    }

    // MARK: - Source Document Card

    private var sourceDocumentCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                if sourceContent == nil && !isLoadingSource {
                    Task { await loadSourceContent() }
                }
                withAnimation(.easeInOut(duration: 0.25)) {
                    isSourceExpanded.toggle()
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: transaction.source == "sms" ? "message.fill" : "envelope.open.fill")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.spentyInfo)
                        .frame(width: 32, height: 32)
                        .background(Color.spentyInfo.opacity(0.1), in: Circle())

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Source Document")
                            .font(SpentyFonts.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.spentyTextPrimary)

                        if let sc = sourceContent {
                            Text(sc.subject ?? sc.snippet ?? "View original content")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                                .lineLimit(1)
                        } else {
                            Text("Tap to view original \(transaction.source == "sms" ? "SMS" : "email")")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                        }
                    }

                    Spacer()

                    if isLoadingSource {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: isSourceExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
                .padding(14)
            }
            .buttonStyle(.plain)

            if isSourceExpanded {
                Divider().padding(.horizontal, 14)

                if isLoadingSource {
                    HStack {
                        Spacer()
                        VStack(spacing: 8) {
                            ProgressView()
                            Text("Loading source…")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 20)
                } else if let error = sourceError {
                    VStack(spacing: 8) {
                        Text(error)
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyError)
                            .multilineTextAlignment(.center)
                        Button("Retry") {
                            Task { await loadSourceContent() }
                        }
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyPrimary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                } else if let sc = sourceContent {
                    VStack(alignment: .leading, spacing: 12) {
                        if transaction.source != "sms" {
                            if let subject = sc.subject, !subject.isEmpty {
                                sourceRow(label: "Subject", value: subject)
                            }
                            if let from = sc.from, !from.isEmpty {
                                sourceRow(label: "From", value: from)
                            }
                        } else {
                            if let sender = sc.sender, !sender.isEmpty {
                                sourceRow(label: "Sender", value: sender)
                            }
                        }
                        if let date = sc.date, !date.isEmpty {
                            sourceRow(label: "Date", value: date)
                        }

                        if let body = sc.body, !body.isEmpty {
                            Divider()
                            VStack(alignment: .leading, spacing: 4) {
                                Text(transaction.source == "sms" ? "Message" : "Email Body")
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyTextSecondary)

                                Text(stripHTML(body))
                                    .font(SpentyFonts.footnote)
                                    .foregroundColor(.spentyTextPrimary)
                                    .lineLimit(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        } else if let snippet = sc.snippet, !snippet.isEmpty {
                            Divider()
                            Text(snippet)
                                .font(SpentyFonts.footnote)
                                .foregroundColor(.spentyTextPrimary)
                                .lineLimit(6)
                        }
                    }
                    .padding(14)
                }
            }
        }
        .background(Color.spentyCardBg, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
        .task {
            if sourceContent == nil {
                await loadSourceContent()
            }
        }
    }

    // MARK: - Shared Form Components

    private func reviewSectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(.spentyTextSecondary)
            .tracking(0.8)
            .padding(.leading, 4)
            .padding(.bottom, -4)
    }

    private func reviewFormRow<Content: View>(
        icon: String,
        label: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 15))
                .foregroundColor(.spentyPrimary)
                .frame(width: 22)

            Text(label)
                .font(.system(size: 15))
                .foregroundColor(.spentyTextPrimary)
                .lineLimit(1)

            Spacer(minLength: 4)

            content()
        }
        .padding(.vertical, 12)
    }

    private var reviewFormDivider: some View {
        Divider()
            .padding(.leading, 40)
    }

    private func sourceRow(label: String, value: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label)
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
                .frame(width: 55, alignment: .leading)
            Text(value)
                .font(SpentyFonts.footnote)
                .foregroundColor(.spentyTextPrimary)
                .lineLimit(2)
        }
    }

    // MARK: - Inline Creation

    private func createInlineAccount() async {
        let trimmed = newAccountName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        do {
            let payload: [String: Any] = ["name": trimmed, "accountType": newAccountType]
            let created = try await AccountRepository().createAccount(payload)
            accounts = try await TransactionRepository.shared.fetchAccounts()
            editAccountId = created.id
        } catch { }
    }

    private func createInlineCategory() async {
        let trimmed = newCategoryName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        let catType: CategoryType = editType == "income" ? .income : .expense
        do {
            let created = try await CategoryRepository.shared.createCategory(name: trimmed, type: catType, parentId: nil)
            categories = try await CategoryRepository.shared.getCategories()
            editCategoryId = created.id
            editSubcategoryId = ""
        } catch { }
    }

    private func createInlineSubcategory() async {
        let trimmed = newSubcategoryName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !editCategoryId.isEmpty else { return }
        let catType: CategoryType = editType == "income" ? .income : .expense
        do {
            let created = try await CategoryRepository.shared.createCategory(name: trimmed, type: catType, parentId: editCategoryId)
            categories = try await CategoryRepository.shared.getCategories()
            editSubcategoryId = created.id
        } catch { }
    }

    // MARK: - Data Loading

    private func loadFormData() async {
        do {
            let repo = TransactionRepository.shared
            async let fetchedAccounts = repo.fetchAccounts()
            async let fetchedCategories = repo.fetchCategories()
            accounts = try await fetchedAccounts
            categories = try await fetchedCategories
        } catch {
            // Graceful degradation — form still works with raw IDs
        }
    }

    private func populateFields() {
        editDescription = transaction.description ?? ""
        editAmount = transaction.amount.map { String(format: "%.2f", $0) } ?? ""
        editDate = transaction.date ?? Date()
        editType = transaction.transactionType ?? "expense"
        editAccountId = transaction.accountId ?? ""
        editCategoryId = transaction.categoryId ?? ""
        editSubcategoryId = transaction.subcategoryId ?? ""
        editPaymentMethod = Self.normalizePaymentMethod(transaction.paymentMethod ?? "")
        editIsRecurring = transaction.isRecurring ?? false
        editRecurringFrequency = transaction.recurringFrequency ?? "monthly"
        if let rd = transaction.recurrenceDate { editRecurrenceDate = String(rd) }
    }

    private func loadSourceContent() async {
        guard let sourceId = transaction.sourceId else { return }
        isLoadingSource = true
        sourceError = nil
        do {
            sourceContent = try await EmailSyncRepository.shared.sourceContent(id: sourceId)
        } catch {
            sourceError = "Could not load source document"
        }
        isLoadingSource = false
    }

    private func stripHTML(_ html: String) -> String {
        html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Actions

    private func approveTransaction() async {
        isProcessing = true

        let update = PendingTransactionUpdate(
            description: editDescription.isEmpty ? nil : editDescription,
            amount: Double(editAmount),
            accountId: editAccountId.isEmpty ? nil : editAccountId,
            toAccountId: editToAccountId.isEmpty ? nil : editToAccountId,
            categoryId: editCategoryId.isEmpty ? nil : editCategoryId,
            subcategoryId: editSubcategoryId.isEmpty ? nil : editSubcategoryId,
            date: editDate,
            transactionType: editType.isEmpty ? nil : editType,
            paymentMethod: editPaymentMethod.isEmpty ? nil : editPaymentMethod,
            isRecurring: editIsRecurring,
            recurringFrequency: editIsRecurring ? editRecurringFrequency : nil,
            recurrenceDate: editIsRecurring ? Int(editRecurrenceDate) : nil
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
                UnifiedTransactionForm(mode: .edit(txn))
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
