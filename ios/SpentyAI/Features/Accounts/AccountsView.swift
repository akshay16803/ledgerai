import SwiftUI

struct AccountsView: View {

    @State private var viewModel = AccountsViewModel()
    @Environment(AppState.self) private var appState

    var body: some View {
        ZStack {
            SpentyColors.bgPrimary
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.accounts.isEmpty {
                ProgressView()
                    .controlSize(.large)
                    .tint(SpentyColors.brandAccent)
            } else if viewModel.accounts.isEmpty {
                EmptyState(
                    icon: "building.columns",
                    title: "No Accounts Yet",
                    message: "Add your bank accounts, loans, and investments to start tracking your finances.",
                    actionTitle: "Add Account"
                ) {
                    viewModel.showAddAccount = true
                }
            } else {
                accountsList
            }
        }
        .navigationTitle("Accounts")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        viewModel.showSubTypeManager = true
                    } label: {
                        Label("Manage Sub-Types", systemImage: "tag")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(SpentyColors.textSecondary)
                }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if !viewModel.accounts.isEmpty {
                fabButton
            }
        }
        .task {
            await viewModel.loadAccounts()
        }
        .sheet(isPresented: $viewModel.showAddAccount) {
            AccountFormSheet(onSave: {
                Task { await viewModel.refresh() }
            })
            .environment(appState)
        }
        .sheet(isPresented: $viewModel.showEditAccount) {
            if let account = viewModel.editingAccount {
                AccountFormSheet(account: account, onSave: {
                    Task { await viewModel.refresh() }
                })
                .environment(appState)
            }
        }
        .sheet(isPresented: $viewModel.showSubTypeManager) {
            SubTypeManagerSheet()
        }
        .alert("Delete Account", isPresented: $viewModel.showDeleteConfirm) {
            Button("Cancel", role: .cancel) {
                viewModel.deletingAccount = nil
            }
            Button("Delete", role: .destructive) {
                if let account = viewModel.deletingAccount {
                    Task { await viewModel.deleteAccount(account) }
                }
            }
        } message: {
            if let account = viewModel.deletingAccount {
                Text("Are you sure you want to delete \"\(account.name)\"? This action cannot be undone.")
            }
        }
        .overlay {
            if let error = viewModel.errorMessage {
                errorBanner(error)
            }
        }
    }

    // MARK: - Accounts List

    private var accountsList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: SpentySpacing.xl) {
                ForEach(AccountsViewModel.groupOrder, id: \.self) { groupKey in
                    if let groupAccounts = viewModel.grouped[groupKey], !groupAccounts.isEmpty {
                        accountGroup(title: displayName(for: groupKey), accounts: groupAccounts)
                    }
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
            .padding(.bottom, 80) // Space for FAB
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    private func accountGroup(title: String, accounts: [Account]) -> some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader(title)

            LazyVStack(spacing: SpentySpacing.sm) {
                ForEach(accounts) { account in
                    accountCard(account)
                }
            }
        }
    }

    // MARK: - Account Card

    private func accountCard(_ account: Account) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                // Top row: name + sub-type
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text(account.name)
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(SpentyColors.textPrimary)

                        if let subType = account.subType, !subType.isEmpty {
                            Text(subType)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                    }

                    Spacer()

                    // Balance
                    if let balance = account.currentBalance ?? account.openingBalance {
                        MoneyText(
                            balance,
                            currency: account.currency ?? "INR",
                            showSign: true,
                            size: SpentyFonts.subheading
                        )
                    }
                }

                // Account number (masked)
                if let number = account.accountNumber, !number.isEmpty {
                    Text(maskedAccountNumber(number))
                        .font(SpentyFonts.mono)
                        .foregroundStyle(SpentyColors.textMuted)
                }

                // Loan details
                if isLoanAccount(account) {
                    loanDetails(account)
                }

                // OD account: calculate interest button
                if isODAccount(account) {
                    odDetails(account)
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            viewModel.editingAccount = account
            viewModel.showEditAccount = true
        }
        .contextMenu {
            Button {
                viewModel.editingAccount = account
                viewModel.showEditAccount = true
            } label: {
                Label("Edit", systemImage: "pencil")
            }

            Button {
                Task { await viewModel.recalculateBalance(account) }
            } label: {
                Label("Recalculate Balance", systemImage: "arrow.triangle.2.circlepath")
            }

            Divider()

            Button(role: .destructive) {
                viewModel.deletingAccount = account
                viewModel.showDeleteConfirm = true
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    // MARK: - Loan Details

    private func loanDetails(_ account: Account) -> some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            Divider()
                .overlay(SpentyColors.borderSubtle)

            HStack(spacing: SpentySpacing.lg) {
                if let emi = account.loanEmiAmount {
                    detailItem("EMI", value: formatCurrency(emi, currency: account.currency ?? "INR"))
                }
                if let rate = account.loanInterestRate {
                    detailItem("Rate", value: String(format: "%.2f%%", rate))
                }
                if let outstanding = account.loanOutstandingBalance {
                    detailItem("Outstanding", value: formatCurrency(outstanding, currency: account.currency ?? "INR"))
                }
            }
        }
    }

    // MARK: - OD Details

    private func odDetails(_ account: Account) -> some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            Divider()
                .overlay(SpentyColors.borderSubtle)

            HStack {
                if let rate = account.loanInterestRate {
                    detailItem("Rate", value: String(format: "%.2f%%", rate))
                }

                Spacer()

                NavigationLink {
                    ODInterestView(account: account)
                } label: {
                    HStack(spacing: SpentySpacing.xs) {
                        Image(systemName: "percent")
                            .font(.system(size: 11))
                        Text("Calculate Interest")
                            .font(SpentyFonts.caption)
                    }
                    .foregroundStyle(SpentyColors.brandAccent)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Helpers

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

    private func maskedAccountNumber(_ number: String) -> String {
        let suffix = String(number.suffix(4))
        return "****\(suffix)"
    }

    private func displayName(for type: String) -> String {
        switch type {
        case "Asset": return "Assets"
        case "Liability": return "Liabilities"
        case "Equity": return "Equity"
        case "Investment": return "Investments"
        default: return type
        }
    }

    private func isLoanAccount(_ account: Account) -> Bool {
        guard !isODAccount(account) else { return false }
        return account.loanEmiAmount != nil
            || account.loanInterestRate != nil
            || account.loanOutstandingBalance != nil
    }

    private func isODAccount(_ account: Account) -> Bool {
        let sub = (account.subType ?? "").lowercased()
        return sub.contains("overdraft") || sub.contains("od")
    }

    private func formatCurrency(_ amount: Double, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        if currency == "INR" {
            formatter.locale = Locale(identifier: "en_IN")
        }
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }

    // MARK: - FAB

    private var fabButton: some View {
        Button {
            viewModel.showAddAccount = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(SpentyColors.brandPrimary)
                .clipShape(Circle())
                .shadow(color: SpentyColors.brandPrimary.opacity(0.3), radius: 8, y: 4)
        }
        .padding(.trailing, SpentySpacing.xl)
        .padding(.bottom, SpentySpacing.xl)
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        VStack {
            HStack(spacing: SpentySpacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(SpentyColors.danger)
                    .font(.system(size: 14))
                Text(message)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textPrimary)
                Spacer()
                Button {
                    viewModel.errorMessage = nil
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12))
                        .foregroundStyle(SpentyColors.textMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(SpentySpacing.md)
            .background(SpentyColors.danger.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.top, SpentySpacing.sm)

            Spacer()
        }
    }
}

#Preview {
    NavigationStack {
        AccountsView()
            .environment(AppState())
    }
}
