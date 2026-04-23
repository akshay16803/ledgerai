import SwiftUI

struct AccountListView: View {

    @State private var viewModel = AccountsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                if viewModel.isLoading && viewModel.accounts.isEmpty {
                    LoadingView(message: "Loading accounts...")
                } else if viewModel.filteredAccounts.isEmpty && !viewModel.searchText.isEmpty {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "No Results",
                        subtitle: "No accounts match \"\(viewModel.searchText)\"."
                    )
                } else if viewModel.accounts.isEmpty {
                    EmptyStateView(
                        icon: "building.columns",
                        title: "No Accounts Yet",
                        subtitle: "Add your first account to start tracking your finances.",
                        buttonTitle: "Add Account"
                    ) {
                        viewModel.editingAccount = nil
                        viewModel.showingForm = true
                    }
                } else {
                    accountList
                }
            }
            .navigationTitle("Accounts")
            .searchable(text: $viewModel.searchText, prompt: "Search accounts")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.editingAccount = nil
                        viewModel.showingForm = true
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                            .foregroundColor(.spentyPrimary)
                    }
                }
            }
            .refreshable {
                await viewModel.loadAccounts()
            }
            .sheet(isPresented: $viewModel.showingForm) {
                AccountFormView(viewModel: viewModel, account: viewModel.editingAccount)
            }
            .overlay(alignment: .top) {
                if let error = viewModel.errorMessage {
                    ErrorBanner(message: error) {
                        viewModel.dismissError()
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .animation(.easeInOut, value: viewModel.errorMessage)
                }
            }
            .navigationDestination(for: String.self) { accountId in
                AccountDetailView(accountId: accountId)
            }
            .task {
                if viewModel.accounts.isEmpty {
                    await viewModel.loadAccounts()
                    await viewModel.loadSubTypes()
                }
            }
        }
    }

    // MARK: - Account List

    private var accountList: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Total balance header
                totalBalanceCard
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 16)

                // Grouped sections
                ForEach(viewModel.groupedAccounts, id: \.type) { group in
                    sectionView(type: group.type, accounts: group.accounts)
                }
            }
            .padding(.bottom, 20)
        }
    }

    // MARK: - Total Balance Card

    private var totalBalanceCard: some View {
        VStack(spacing: 6) {
            Text("Total Balance")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)

            CurrencyText(
                amount: viewModel.totalBalance,
                font: SpentyFonts.amountLarge
            )
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .cardStyle()
    }

    // MARK: - Section View

    private func sectionView(type: String, accounts: [Account]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header
            HStack(spacing: 8) {
                Image(systemName: AccountsViewModel.iconForAccountType(type))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AccountsViewModel.colorForAccountType(type))

                Text(type.capitalized)
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                let sectionTotal = accounts.reduce(0.0) { $0 + ($1.balance ?? 0) }
                CurrencyText(amount: sectionTotal, font: SpentyFonts.footnote)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            // Account rows
            VStack(spacing: 0) {
                ForEach(accounts) { account in
                    NavigationLink(value: account.id) {
                        accountRow(account)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { await viewModel.deleteAccount(account.id) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }

                        Button {
                            viewModel.editingAccount = account
                            viewModel.showingForm = true
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        .tint(Color.spentyInfo)
                    }

                    if account.id != accounts.last?.id {
                        Divider()
                            .padding(.leading, 56)
                    }
                }
            }
            .background(Color.spentyCardBg)
            .cornerRadius(12)
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
    }

    // MARK: - Account Row

    private func accountRow(_ account: Account) -> some View {
        HStack(spacing: 12) {
            // Type icon
            Circle()
                .fill(AccountsViewModel.colorForAccountType(account.accountType ?? "").opacity(0.12))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: Self.iconForSubType(account.subType))
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(AccountsViewModel.colorForAccountType(account.accountType ?? ""))
                }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(account.displayName)
                        .font(SpentyFonts.callout)
                        .fontWeight(.medium)
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)

                    if account.aiCreated == true {
                        HStack(spacing: 2) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 9, weight: .bold))
                            Text("AI")
                                .font(.system(size: 9, weight: .bold))
                        }
                        .foregroundColor(.spentyPrimary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.spentyPrimary.opacity(0.12))
                        .cornerRadius(4)
                    }
                }

                if let subType = account.subType, !subType.isEmpty {
                    Text(Self.friendlySubType(subType))
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyTextSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.spentyBgSecondary)
                        .cornerRadius(4)
                }
            }

            Spacer()

            CurrencyText(
                amount: account.balance ?? 0,
                currencyCode: account.currency ?? "INR",
                font: SpentyFonts.amountSmall
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
    private static func friendlySubType(_ subType: String) -> String {
        switch subType.lowercased() {
        case "bank": return "Bank"
        case "cash": return "Cash"
        case "credit_card", "credit card": return "Credit Card"
        case "digital_wallet", "wallet": return "Digital Wallet"
        case "overdraft", "od": return "Overdraft"
        case "demat": return "Demat"
        case "loan": return "Loan"
        case "savings": return "Savings"
        case "current": return "Current"
        case "fixed_deposit", "fd": return "Fixed Deposit"
        default: return subType.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private static func iconForSubType(_ subType: String?) -> String {
        switch subType?.lowercased() {
        case "bank", "savings", "current": return "building.columns.fill"
        case "credit_card", "credit card": return "creditcard.fill"
        case "cash": return "banknote.fill"
        case "wallet", "digital_wallet": return "wallet.pass.fill"
        case "investment", "demat": return "chart.line.uptrend.xyaxis"
        case "loan": return "percent"
        case "overdraft", "od": return "arrow.triangle.2.circlepath"
        case "fixed_deposit", "fd": return "lock.fill"
        default: return "building.columns.fill"
        }
    }
}

#Preview {
    AccountListView()
}
