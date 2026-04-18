import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DashboardViewModel()

    private let statsColumns = [
        GridItem(.flexible(), spacing: SpentySpacing.md),
        GridItem(.flexible(), spacing: SpentySpacing.md)
    ]

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView {
                VStack(spacing: SpentySpacing.xl) {
                    statsGridSection
                    quickActionsSection
                    accountsSection
                    recentTransactionsSection
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
                .padding(.bottom, 80) // Space for floating button
            }
            .refreshable {
                await viewModel.refresh()
            }
            .shimmer(isActive: viewModel.isLoading && viewModel.summary == nil)

            floatingAIChatButton
        }
        .background(SpentyColors.bgPrimary)
        .navigationTitle("Dashboard")
        .task {
            if viewModel.summary == nil {
                await viewModel.loadDashboard()
            }
        }
        .sheet(isPresented: $viewModel.showNewTransaction) {
            EditTransactionSheet(transaction: nil, onSaved: {
                Task { await viewModel.refresh() }
            })
        }
        .sheet(isPresented: $viewModel.showSalesInvoice) {
            SalesInvoiceSheet(editingInvoice: nil, settings: appState.user?.settings, onSaved: { _ in
                Task { await viewModel.refresh() }
            })
        }
        .sheet(isPresented: $viewModel.showPurchaseBill) {
            PurchaseBillSheet(settings: appState.user?.settings, onSaved: {
                await viewModel.refresh()
            })
        }
        .sheet(isPresented: $viewModel.showAIChat) {
            AIChatSheet()
        }
    }

    // MARK: - Stats Grid

    @ViewBuilder
    private var statsGridSection: some View {
        let summary = viewModel.summary
        LazyVGrid(columns: statsColumns, spacing: SpentySpacing.md) {
            StatCard(
                title: "Net Worth",
                value: formatCurrency(summary?.netWorth),
                subtitle: "Assets - Liabilities",
                icon: "wallet.pass",
                iconColor: SpentyColors.info
            )

            StatCard(
                title: "Income This Month",
                value: formatCurrency(summary?.incomeThisMonth),
                subtitle: "Revenue",
                icon: "arrow.down.circle",
                iconColor: SpentyColors.success
            )

            StatCard(
                title: "Expenses This Month",
                value: formatCurrency(summary?.expenseThisMonth),
                subtitle: "Spending",
                icon: "arrow.up.circle",
                iconColor: SpentyColors.danger
            )

            StatCard(
                title: "Pending Review",
                value: "\(summary?.pendingReview ?? 0)",
                subtitle: "Needs attention",
                icon: "clock",
                iconColor: SpentyColors.warning
            )
        }
    }

    // MARK: - Quick Actions

    @ViewBuilder
    private var quickActionsSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SpentySpacing.md) {
                quickActionButton(
                    title: "New Transaction",
                    icon: "plus.circle.fill",
                    color: SpentyColors.brandPrimary
                ) {
                    viewModel.showNewTransaction = true
                }

                if appState.hasInvoices {
                    quickActionButton(
                        title: "Sales Invoice",
                        icon: "doc.text.fill",
                        color: SpentyColors.success
                    ) {
                        viewModel.showSalesInvoice = true
                    }
                }

                if appState.hasBills {
                    quickActionButton(
                        title: "Purchase Bill",
                        icon: "doc.plaintext.fill",
                        color: SpentyColors.info
                    ) {
                        viewModel.showPurchaseBill = true
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func quickActionButton(
        title: String,
        icon: String,
        color: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: SpentySpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                Text(title)
                    .font(SpentyFonts.caption)
            }
            .foregroundStyle(color)
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.md)
                    .stroke(color.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Accounts Section

    @ViewBuilder
    private var accountsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Accounts", actionTitle: "View All") {
                // Navigate to accounts list
            }

            let accounts = viewModel.summary?.accounts ?? []

            if accounts.isEmpty {
                SpentyCard {
                    EmptyState(
                        icon: "building.columns",
                        title: "No Accounts",
                        message: "Add your first account to track balances."
                    )
                    .frame(height: 140)
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: SpentySpacing.md) {
                        ForEach(accounts) { account in
                            accountCard(account)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func accountCard(_ account: Account) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                Text(account.name)
                    .font(SpentyFonts.subheading)
                    .foregroundStyle(SpentyColors.textPrimary)
                    .lineLimit(1)

                StatusBadge(accountTypeBadge(account.accountType))

                Spacer()

                MoneyText(
                    account.currentBalance ?? 0,
                    currency: account.currency ?? "INR",
                    showSign: true,
                    size: SpentyFonts.subheading
                )
            }
            .frame(width: 160, height: 100)
        }
    }

    // MARK: - Recent Transactions Section

    @ViewBuilder
    private var recentTransactionsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Recent Transactions", actionTitle: "View All") {
                // Navigate to transactions list
            }

            let transactions = Array((viewModel.summary?.recentTransactions ?? []).prefix(5))

            if transactions.isEmpty {
                SpentyCard {
                    EmptyState(
                        icon: "arrow.left.arrow.right",
                        title: "No Transactions",
                        message: "Your recent transactions will appear here."
                    )
                    .frame(height: 140)
                }
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(transactions.enumerated()), id: \.element.id) { index, transaction in
                        transactionRow(transaction)

                        if index < transactions.count - 1 {
                            Divider()
                                .foregroundStyle(SpentyColors.borderSubtle)
                        }
                    }
                }
                .cardStyle()
            }
        }
    }

    @ViewBuilder
    private func transactionRow(_ transaction: Transaction) -> some View {
        HStack(spacing: SpentySpacing.md) {
            // Type icon
            Circle()
                .fill(transactionColor(transaction.transactionType).opacity(0.15))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: transactionIcon(transaction.transactionType))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(transactionColor(transaction.transactionType))
                )

            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                HStack(spacing: SpentySpacing.sm) {
                    Text(transaction.description ?? transaction.transactionType.rawValue.capitalized)
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textPrimary)
                        .lineLimit(1)

                    if transaction.source == "ai" || transaction.source == "email" || transaction.source == "sms" {
                        AIBadge()
                    }
                }

                HStack(spacing: SpentySpacing.sm) {
                    Text(formatDate(transaction.date))
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textMuted)

                    transactionTypeBadge(transaction.transactionType)
                }
            }

            Spacer()

            MoneyText(
                transaction.transactionType == .expense ? -transaction.amount : transaction.amount,
                showSign: true,
                size: SpentyFonts.body
            )
        }
        .padding(.vertical, SpentySpacing.md)
    }

    // MARK: - Floating AI Chat Button

    @ViewBuilder
    private var floatingAIChatButton: some View {
        Button {
            viewModel.showAIChat = true
        } label: {
            Image(systemName: "sparkles")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(SpentyColors.brandAccent)
                .clipShape(Circle())
                .shadow(color: SpentyColors.brandAccent.opacity(0.4), radius: 8, y: 4)
        }
        .padding(.trailing, SpentySpacing.xl)
        .padding(.bottom, SpentySpacing.xl)
    }

    // MARK: - Helpers

    private func formatCurrency(_ amount: Double?) -> String {
        guard let amount else { return "--" }
        return CurrencyFormatter.format(amount: amount, currencyCode: appState.user?.settings?.baseCurrency ?? "INR")
    }

    private func formatDate(_ dateString: String) -> String {
        let inputFormatter = DateFormatter()
        inputFormatter.dateFormat = "yyyy-MM-dd"
        inputFormatter.locale = Locale(identifier: "en_US_POSIX")

        let outputFormatter = DateFormatter()
        outputFormatter.dateFormat = "dd MMM"

        if let date = inputFormatter.date(from: dateString) {
            return outputFormatter.string(from: date)
        }

        // Try ISO format
        let isoFormatter = ISO8601DateFormatter()
        if let date = isoFormatter.date(from: dateString) {
            return outputFormatter.string(from: date)
        }

        return dateString
    }

    private func transactionColor(_ type: TransactionType) -> Color {
        switch type {
        case .income: SpentyColors.success
        case .expense: SpentyColors.danger
        case .transfer: SpentyColors.info
        }
    }

    private func transactionIcon(_ type: TransactionType) -> String {
        switch type {
        case .income: "arrow.down.left"
        case .expense: "arrow.up.right"
        case .transfer: "arrow.left.arrow.right"
        }
    }

    @ViewBuilder
    private func transactionTypeBadge(_ type: TransactionType) -> some View {
        let color = transactionColor(type)
        Text(type.rawValue.capitalized)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, SpentySpacing.sm)
            .padding(.vertical, 2)
            .background(color.opacity(0.1))
            .clipShape(Capsule())
    }

    private func accountTypeBadge(_ type: String) -> StatusType {
        switch type.lowercased() {
        case "bank", "savings": .active
        case "credit_card", "credit card": .partial
        case "loan": .pending
        case "investment", "demat": .processing
        default: .active
        }
    }
}

#Preview {
    NavigationStack {
        DashboardView()
    }
    .environment(AppState())
}
