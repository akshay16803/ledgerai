import SwiftUI

struct DashboardView: View {

    @State private var viewModel = DashboardViewModel()

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
            .sheet(isPresented: $viewModel.showAIChat, onDismiss: {
                Task { await viewModel.refresh() }
            }) {
                AIChatView()
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
            StatCard(
                label: "Net Worth",
                value: formatCurrency(viewModel.netWorth),
                icon: "banknote.fill",
                color: viewModel.netWorth >= 0 ? .spentySuccess : .spentyError
            )

            StatCard(
                label: "Income This Month",
                value: formatCurrency(viewModel.incomeThisMonth),
                icon: "arrow.down.circle.fill",
                color: .spentySuccess
            )

            StatCard(
                label: "Expenses This Month",
                value: formatCurrency(viewModel.expenseThisMonth),
                icon: "arrow.up.circle.fill",
                color: .spentyAccent1
            )

            StatCard(
                label: "Pending Review",
                value: "\(viewModel.pendingReview)",
                icon: "clock.fill",
                color: .spentyWarning
            )
        }
    }

    // MARK: - Accounts Section

    private var accountsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(title: "Accounts", icon: "building.columns.fill")

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
            sectionHeader(title: "Recent Transactions", icon: "clock.arrow.circlepath")

            VStack(spacing: 0) {
                ForEach(viewModel.recentTransactions) { txn in
                    transactionRow(txn)

                    if txn.id != viewModel.recentTransactions.last?.id {
                        Divider()
                            .padding(.leading, 48)
                    }
                }
            }
            .cardStyle()
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

    // MARK: - Section Header

    private func sectionHeader(title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.spentyPrimary)

            Text(title)
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            Spacer()
        }
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        if abs(value) >= 100_000 {
            formatter.maximumFractionDigits = 0
        } else {
            formatter.maximumFractionDigits = 2
            formatter.minimumFractionDigits = 2
        }
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

// MARK: - Preview

#Preview {
    DashboardView()
}
