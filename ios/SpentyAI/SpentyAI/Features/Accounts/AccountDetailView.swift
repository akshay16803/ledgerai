import SwiftUI
import Charts

struct AccountDetailView: View {

    @State private var viewModel = AccountsViewModel()
    let accountId: String

    @State private var showEditSheet = false
    @State private var selectedTab = 0
    @State private var selectedTransaction: Transaction?
    @State private var isEditingOpeningBalance = false
    @State private var editOpeningBalance = ""
    @State private var editAsOfDate = Date()
    @State private var isSavingBalance = false

    private var account: Account? { viewModel.selectedAccount }
    private var isLoan: Bool { account?.accountType?.lowercased() == "liability" }
    private var isOD: Bool {
        let sub = account?.subType?.lowercased() ?? ""
        return sub.contains("od") || sub.contains("overdraft")
    }
    private var isDemat: Bool {
        account?.accountType?.lowercased() == "investment" &&
        (account?.subType?.lowercased().contains("demat") ?? false)
    }

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            if viewModel.isDetailLoading && account == nil {
                LoadingView(message: "Loading account...")
            } else if let account {
                ScrollView {
                    VStack(spacing: 16) {
                        infoCard(account)
                        tabSelector(account)
                        tabContent(account)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 32)
                }
            }
        }
        .navigationTitle(account?.name ?? "Account")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.editingAccount = account
                    showEditSheet = true
                } label: {
                    Image(systemName: "pencil.circle")
                        .font(.system(size: 18))
                        .foregroundColor(.spentyPrimary)
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
            AccountFormView(viewModel: viewModel, account: account)
        }
        .sheet(item: $selectedTransaction) { txn in
            TransactionDetailView(
                transaction: txn,
                onTransactionUpdated: { Task { await viewModel.loadAccountDetail(accountId) } }
            )
        }
        .task {
            await viewModel.loadAccountDetail(accountId)
            viewModel.filteredTransactionTotal = viewModel.accountTransactions.count
            if isLoan {
                await viewModel.loadAmortization(accountId)
            }
            await viewModel.loadFilterCategories()
        }
        .overlay(alignment: .top) {
            if let error = viewModel.errorMessage {
                ErrorBanner(message: error) { viewModel.dismissError() }
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    // MARK: - Info Card

    private func infoCard(_ account: Account) -> some View {
        VStack(spacing: 16) {
            // Icon and type
            HStack(spacing: 12) {
                Circle()
                    .fill(AccountsViewModel.colorForAccountType(account.accountType ?? "").opacity(0.12))
                    .frame(width: 48, height: 48)
                    .overlay {
                        Image(systemName: AccountsViewModel.iconForAccountType(account.accountType ?? ""))
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(AccountsViewModel.colorForAccountType(account.accountType ?? ""))
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(account.name ?? "Unnamed")
                        .font(SpentyFonts.title3)
                        .foregroundColor(.spentyTextPrimary)

                    HStack(spacing: 6) {
                        Text(account.accountType?.capitalized ?? "")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)

                        if let subType = account.subType, !subType.isEmpty {
                            StatusBadge(status: subType)
                        }
                    }
                }

                Spacer()
            }

            // Balance
            VStack(spacing: 4) {
                Text("Current Balance")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)

                CurrencyText(
                    amount: account.balance ?? 0,
                    currencyCode: account.currency ?? "INR",
                    font: SpentyFonts.amountLarge
                )
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)

            // Opening Balance Editor
            openingBalanceSection(account)

            // Detail grid
            detailGrid(account)
        }
        .cardStyle()
    }

    private func openingBalanceSection(_ account: Account) -> some View {
        VStack(spacing: 0) {
            Divider()
                .padding(.bottom, 12)

            if isEditingOpeningBalance {
                // Editing mode
                VStack(spacing: 12) {
                    HStack {
                        Text("Set Opening Balance")
                            .font(SpentyFonts.subheadline.weight(.semibold))
                            .foregroundColor(.spentyTextPrimary)
                        Spacer()
                        Button {
                            withAnimation { isEditingOpeningBalance = false }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.spentyTextSecondary)
                        }
                    }

                    HStack(spacing: 12) {
                        Image(systemName: "indianrupeesign.circle")
                            .font(.system(size: 16))
                            .foregroundColor(.spentyPrimary)
                            .frame(width: 24)
                        Text("Amount")
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyTextPrimary)
                        Spacer()
                        TextField("0.00", text: $editOpeningBalance)
                            .keyboardType(.decimalPad)
                            .font(SpentyFonts.amountSmall)
                            .foregroundColor(.spentyTextPrimary)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 150)
                    }
                    .padding(.vertical, 8)

                    Divider().padding(.leading, 48)

                    HStack(spacing: 12) {
                        Image(systemName: "calendar")
                            .font(.system(size: 16))
                            .foregroundColor(.spentyPrimary)
                            .frame(width: 24)
                        Text("As-of Date")
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyTextPrimary)
                        Spacer()
                        DatePicker("", selection: $editAsOfDate, displayedComponents: .date)
                            .labelsHidden()
                            .tint(Color.spentyPrimary)
                    }
                    .padding(.vertical, 4)

                    Text("Balance will be recalculated: opening balance + income − expenses ± transfers from this date onward.")
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyTextSecondary)
                        .padding(.top, 4)

                    Button {
                        Task { await saveOpeningBalance() }
                    } label: {
                        HStack {
                            if isSavingBalance {
                                ProgressView()
                                    .tint(.white)
                                    .scaleEffect(0.8)
                            }
                            Text(isSavingBalance ? "Saving..." : "Save & Recalculate")
                        }
                        .primaryButtonStyle()
                    }
                    .disabled(isSavingBalance || editOpeningBalance.isEmpty)
                    .padding(.top, 4)
                }
                .padding(12)
                .background(Color.spentyBgPrimary)
                .cornerRadius(12)
                .transition(.opacity.combined(with: .move(edge: .top)))
            } else {
                // Display mode — tappable row
                Button {
                    editOpeningBalance = account.openingBalance.map { String(format: "%.2f", $0) } ?? ""
                    editAsOfDate = account.balanceAsOfDate ?? Date()
                    withAnimation { isEditingOpeningBalance = true }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "banknote")
                            .font(.system(size: 16))
                            .foregroundColor(.spentyPrimary)
                            .frame(width: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Opening Balance")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                            if let opening = account.openingBalance {
                                Text(formatCurrency(opening, account.currency))
                                    .font(SpentyFonts.subheadline.weight(.medium))
                                    .foregroundColor(.spentyTextPrimary)
                            } else {
                                Text("Not set — tap to add")
                                    .font(SpentyFonts.subheadline)
                                    .foregroundColor(.spentyTextSecondary)
                            }
                        }
                        Spacer()
                        if let asOfDate = account.balanceAsOfDate {
                            Text("as-of \(asOfDate, style: .date)")
                                .font(SpentyFonts.caption2)
                                .foregroundColor(.spentyTextSecondary)
                        }
                        Image(systemName: "pencil.circle")
                            .font(.system(size: 18))
                            .foregroundColor(.spentyPrimary)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }

    private func saveOpeningBalance() async {
        guard let amount = Double(editOpeningBalance) else { return }
        isSavingBalance = true
        let success = await viewModel.updateOpeningBalance(accountId, amount: amount, asOfDate: editAsOfDate)
        isSavingBalance = false
        if success {
            withAnimation { isEditingOpeningBalance = false }
        }
    }

    private func detailGrid(_ account: Account) -> some View {
        let items: [(String, String)] = {
            var list: [(String, String)] = []
            if let num = account.accountNumber, !num.isEmpty {
                list.append(("Account No.", num))
            }
            if let currency = account.currency {
                list.append(("Currency", currency))
            }
            // Opening Balance is shown in the dedicated section above
            if isLoan {
                if let rate = account.loanInterestRate { list.append(("Interest Rate", "\(rate)%")) }
                if let tenure = account.loanTenureMonths { list.append(("Tenure", "\(tenure) months")) }
                if let emi = account.loanEmiAmount { list.append(("EMI", formatCurrency(emi, account.currency))) }
                if let day = account.loanEmiDay { list.append(("EMI Day", "\(day)")) }
                if let sanctioned = account.loanSanctionedAmount { list.append(("Sanctioned", formatCurrency(sanctioned, account.currency))) }
            }
            if let broker = account.brokerName, !broker.isEmpty {
                list.append(("Broker", broker))
            }
            return list
        }()

        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.0)
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                    Text(item.1)
                        .font(SpentyFonts.callout)
                        .fontWeight(.medium)
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - Tab Selector

    private func tabSelector(_ account: Account) -> some View {
        let tabs: [(String, String)] = {
            var t: [(String, String)] = [("Transactions", "list.bullet")]
            if isLoan { t.append(("Amortization", "chart.bar.fill")) }
            if isOD { t.append(("OD Interest", "percent")) }
            if isDemat { t.append(("Demat", "doc.text.fill")) }
            return t
        }()

        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { selectedTab = index }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: tab.1)
                                .font(.system(size: 12))
                            Text(tab.0)
                                .font(SpentyFonts.footnote)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(selectedTab == index ? .white : .spentyTextPrimary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(selectedTab == index ? Color.spentyPrimary : Color.spentyCardBg)
                        .cornerRadius(20)
                    }
                }
            }
        }
    }

    // MARK: - Tab Content

    @ViewBuilder
    private func tabContent(_ account: Account) -> some View {
        let tabLabels = buildTabLabels()

        if selectedTab < tabLabels.count {
            switch tabLabels[selectedTab] {
            case "Transactions":
                transactionsSection
            case "Amortization":
                amortizationSection
            case "OD Interest":
                odInterestSection
            case "Demat":
                DematUploadView(viewModel: viewModel, accountId: account.id)
            default:
                transactionsSection
            }
        } else {
            transactionsSection
        }
    }

    private func buildTabLabels() -> [String] {
        var tabs = ["Transactions"]
        if isLoan { tabs.append("Amortization") }
        if isOD { tabs.append("OD Interest") }
        if isDemat { tabs.append("Demat") }
        return tabs
    }

    // MARK: - Transactions Section

    @State private var showDateFilters = false

    private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text("Transactions")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                if hasActiveFilters {
                    Button {
                        viewModel.resetFilters()
                        Task { await viewModel.loadFilteredTransactions(accountId) }
                    } label: {
                        Text("Clear Filters")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyError)
                    }
                }

                Text("\(viewModel.filteredTransactionTotal) results")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }

            // Search bar
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundColor(.spentyTextSecondary)

                TextField("Search transactions...", text: $viewModel.filterSearch)
                    .font(SpentyFonts.body)
                    .textFieldStyle(.plain)
                    .onSubmit {
                        Task { await viewModel.loadFilteredTransactions(accountId) }
                    }

                if !viewModel.filterSearch.isEmpty {
                    Button {
                        viewModel.filterSearch = ""
                        Task { await viewModel.loadFilteredTransactions(accountId) }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.spentyCardBg)
            .cornerRadius(10)

            // Transaction type segmented control
            HStack(spacing: 0) {
                ForEach(["All", "Income", "Expense", "Transfer"], id: \.self) { type in
                    let value = type == "All" ? "" : type.lowercased()
                    Button {
                        viewModel.filterTransactionType = value
                        Task { await viewModel.loadFilteredTransactions(accountId) }
                    } label: {
                        Text(type)
                            .font(SpentyFonts.caption1)
                            .fontWeight(.semibold)
                            .foregroundColor(viewModel.filterTransactionType == value ? .white : .spentyTextPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(viewModel.filterTransactionType == value ? Color.spentyPrimary : Color.clear)
                    }
                }
            }
            .background(Color.spentyCardBg)
            .cornerRadius(8)

            // Advanced filters toggle
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { showDateFilters.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "line.3.horizontal.decrease")
                        .font(.system(size: 12))
                    Text("More Filters")
                        .font(SpentyFonts.caption1)
                        .fontWeight(.medium)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .rotationEffect(.degrees(showDateFilters ? 90 : 0))
                }
                .foregroundColor(hasActiveFilters ? .spentyPrimary : .spentyTextSecondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.spentyCardBg)
                .cornerRadius(8)
            }

            if showDateFilters {
                VStack(spacing: 12) {
                    // Date range
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("From")
                                .font(SpentyFonts.caption2)
                                .foregroundColor(.spentyTextSecondary)
                            DatePicker("", selection: Binding(
                                get: { viewModel.filterStartDate ?? Calendar.current.date(byAdding: .year, value: -1, to: Date())! },
                                set: { viewModel.filterStartDate = $0 }
                            ), displayedComponents: .date)
                            .labelsHidden()
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("To")
                                .font(SpentyFonts.caption2)
                                .foregroundColor(.spentyTextSecondary)
                            DatePicker("", selection: Binding(
                                get: { viewModel.filterEndDate ?? Date() },
                                set: { viewModel.filterEndDate = $0 }
                            ), displayedComponents: .date)
                            .labelsHidden()
                        }
                    }

                    // Category picker
                    if !viewModel.filterCategories.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Category")
                                .font(SpentyFonts.caption2)
                                .foregroundColor(.spentyTextSecondary)
                            Picker("Category", selection: $viewModel.filterCategoryId) {
                                Text("All Categories").tag("")
                                ForEach(viewModel.filterCategories, id: \.id) { cat in
                                    Text(cat.name).tag(cat.id)
                                }
                            }
                            .pickerStyle(.menu)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    // Amount range
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Min Amount")
                                .font(SpentyFonts.caption2)
                                .foregroundColor(.spentyTextSecondary)
                            TextField("0", text: $viewModel.filterMinAmount)
                                .font(SpentyFonts.body)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(.roundedBorder)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Max Amount")
                                .font(SpentyFonts.caption2)
                                .foregroundColor(.spentyTextSecondary)
                            TextField("No limit", text: $viewModel.filterMaxAmount)
                                .font(SpentyFonts.body)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(.roundedBorder)
                        }
                    }

                    // Apply button
                    Button {
                        Task { await viewModel.loadFilteredTransactions(accountId) }
                    } label: {
                        Text("Apply Filters")
                            .primaryButtonStyle()
                    }
                }
                .padding(14)
                .background(Color.spentyCardBg)
                .cornerRadius(10)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            // Loading state
            if viewModel.isLoadingFilteredTransactions {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Color.spentyPrimary)
                    Spacer()
                }
                .padding(.vertical, 24)
            } else if viewModel.accountTransactions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "tray")
                        .font(.system(size: 32))
                        .foregroundColor(.spentyTextSecondary.opacity(0.4))
                    Text(hasActiveFilters ? "No transactions match your filters" : "No transactions found")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(viewModel.accountTransactions) { txn in
                        Button {
                            selectedTransaction = txn
                        } label: {
                            transactionRow(txn)
                        }
                        .buttonStyle(.plain)
                        if txn.id != viewModel.accountTransactions.last?.id {
                            Divider().padding(.leading, 48)
                        }
                    }
                }
                .background(Color.spentyCardBg)
                .cornerRadius(12)
            }
        }
    }

    private var hasActiveFilters: Bool {
        !viewModel.filterTransactionType.isEmpty ||
        !viewModel.filterCategoryId.isEmpty ||
        viewModel.filterStartDate != nil ||
        viewModel.filterEndDate != nil ||
        !viewModel.filterMinAmount.isEmpty ||
        !viewModel.filterMaxAmount.isEmpty ||
        !viewModel.filterSearch.isEmpty
    }

    private func transactionRow(_ txn: Transaction) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(txn.transactionType?.lowercased() == "income" ? Color.spentySuccess.opacity(0.12) : Color.spentyError.opacity(0.12))
                .frame(width: 36, height: 36)
                .overlay {
                    Image(systemName: txn.transactionType?.lowercased() == "income" ? "arrow.down.left" : "arrow.up.right")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(txn.transactionType?.lowercased() == "income" ? .spentySuccess : .spentyError)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(txn.description ?? "Transaction")
                    .font(SpentyFonts.callout)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                if let date = txn.date {
                    Text(formatDate(date))
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }
            }

            Spacer()

            if let amount = txn.amount {
                CurrencyText(
                    amount: txn.transactionType?.lowercased() == "income" ? amount : -amount,
                    font: SpentyFonts.amountSmall
                )
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    // MARK: - Amortization Section

    private var amortizationSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Amortization Schedule")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            if viewModel.amortizationSchedule.isEmpty {
                VStack(spacing: 8) {
                    ProgressView()
                        .tint(Color.spentyPrimary)
                    Text("Loading schedule...")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else {
                // Summary cards
                HStack(spacing: 12) {
                    amortizationStat("Total Payment", value: viewModel.amortizationTotalPayment, color: .spentyPrimary)
                    amortizationStat("Total Interest", value: viewModel.amortizationTotalInterest, color: .spentyError)
                }

                // Chart
                amortizationChart

                // Table
                amortizationTable
            }
        }
    }

    private func amortizationStat(_ title: String, value: Double, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(title)
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
            CurrencyText(
                amount: value,
                currencyCode: account?.currency ?? "INR",
                font: SpentyFonts.amountSmall,
                color: color
            )
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.spentyCardBg)
        .cornerRadius(10)
    }

    private var amortizationChart: some View {
        Chart(viewModel.amortizationSchedule) { entry in
            BarMark(
                x: .value("Month", entry.month),
                y: .value("Amount", entry.principalComponent)
            )
            .foregroundStyle(Color.spentyPrimary)

            BarMark(
                x: .value("Month", entry.month),
                y: .value("Amount", entry.interestComponent)
            )
            .foregroundStyle(Color.spentyWarning.opacity(0.7))
        }
        .chartForegroundStyleScale([
            "Principal": Color.spentyPrimary,
            "Interest": Color.spentyWarning.opacity(0.7)
        ])
        .frame(height: 200)
        .padding(12)
        .background(Color.spentyCardBg)
        .cornerRadius(12)
    }

    private var amortizationTable: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("#")
                    .frame(width: 32, alignment: .leading)
                Text("EMI")
                    .frame(maxWidth: .infinity, alignment: .trailing)
                Text("Principal")
                    .frame(maxWidth: .infinity, alignment: .trailing)
                Text("Interest")
                    .frame(maxWidth: .infinity, alignment: .trailing)
                Text("Balance")
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .font(SpentyFonts.caption1)
            .fontWeight(.semibold)
            .foregroundColor(.spentyTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.spentyBgPrimary)

            // Rows (show first 24 or all)
            let displayEntries = Array(viewModel.amortizationSchedule.prefix(24))
            ForEach(displayEntries) { entry in
                HStack {
                    Text("\(entry.month)")
                        .frame(width: 32, alignment: .leading)
                    Text(shortCurrency(entry.emiAmount))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    Text(shortCurrency(entry.principalComponent))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .foregroundColor(.spentyPrimary)
                    Text(shortCurrency(entry.interestComponent))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .foregroundColor(.spentyWarning)
                    Text(shortCurrency(entry.outstandingBalance))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextPrimary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)

                if entry.id != displayEntries.last?.id {
                    Divider()
                }
            }

            if viewModel.amortizationSchedule.count > 24 {
                Text("Showing first 24 of \(viewModel.amortizationSchedule.count) months")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyTextSecondary)
                    .padding(.vertical, 8)
            }
        }
        .background(Color.spentyCardBg)
        .cornerRadius(12)
    }

    // MARK: - OD Interest Section

    private var odInterestSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("OD Interest Calculator")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            VStack(spacing: 12) {
                DatePicker("From Date", selection: $viewModel.odFromDate, displayedComponents: .date)
                    .font(SpentyFonts.body)

                DatePicker("To Date", selection: $viewModel.odToDate, displayedComponents: .date)
                    .font(SpentyFonts.body)

                Button {
                    Task { await viewModel.calculateODInterest(accountId) }
                } label: {
                    HStack {
                        if viewModel.isCalculatingOD {
                            ProgressView()
                                .tint(.white)
                        }
                        Text("Calculate Interest")
                    }
                    .primaryButtonStyle()
                }
                .disabled(viewModel.isCalculatingOD)
            }
            .padding(16)
            .background(Color.spentyCardBg)
            .cornerRadius(12)

            if let result = viewModel.odInterestResult {
                VStack(spacing: 12) {
                    odResultRow("Interest Amount", value: formatCurrency(result.interest, account?.currency), color: .spentyError)
                    Divider()
                    odResultRow("Number of Days", value: "\(result.days)", color: .spentyTextPrimary)
                    if let avg = result.averageBalance {
                        Divider()
                        odResultRow("Average Balance", value: formatCurrency(avg, account?.currency), color: .spentyInfo)
                    }
                    if let rate = result.rate {
                        Divider()
                        odResultRow("Effective Rate", value: String(format: "%.2f%%", rate), color: .spentyWarning)
                    }
                }
                .padding(16)
                .background(Color.spentyCardBg)
                .cornerRadius(12)
            }
        }
    }

    private func odResultRow(_ label: String, value: String, color: Color) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.callout)
                .foregroundColor(.spentyTextSecondary)
            Spacer()
            Text(value)
                .font(SpentyFonts.headline)
                .foregroundColor(color)
        }
    }

    // MARK: - Formatters

    private func formatCurrency(_ amount: Double, _ code: String?) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code ?? "INR"
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }

    private func shortCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\(Int(amount))"
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        AccountDetailView(accountId: "test-id")
    }
}
