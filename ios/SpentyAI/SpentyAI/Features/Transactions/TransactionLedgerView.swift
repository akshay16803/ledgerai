import SwiftUI

struct TransactionLedgerView: View {

    var viewModel: TransactionsViewModel

    private static let ledgerDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "dd MMM yyyy"
        return f
    }()

    // MARK: - Computed

    private var sortedTransactions: [Transaction] {
        viewModel.transactions.sorted {
            ($0.date ?? .distantPast) < ($1.date ?? .distantPast)
        }
    }

    private var runningBalances: [String: Double] {
        var balances: [String: Double] = [:]
        var running: Double = openingBalance
        for txn in sortedTransactions {
            let amount = txn.amount ?? 0
            switch txn.transactionType?.lowercased() {
            case "income":
                running += amount
            case "expense":
                running -= amount
            case "transfer":
                if isFilteredByAccount {
                    if txn.accountId == viewModel.filterAccountId {
                        running -= amount
                    } else {
                        running += amount
                    }
                }
            default:
                break
            }
            balances[txn.id] = running
        }
        return balances
    }

    private var isFilteredByAccount: Bool {
        !viewModel.filterAccountId.isEmpty
    }

    private var openingBalance: Double {
        guard isFilteredByAccount else { return 0 }
        return viewModel.accounts.first(where: { $0.id == viewModel.filterAccountId })?.balance ?? 0
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            if !isFilteredByAccount {
                accountFilterHint
            }

            headerRow

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(sortedTransactions.enumerated()), id: \.element.id) { index, txn in
                        ledgerRow(txn, index: index)
                    }

                    if viewModel.isLoadingMore {
                        HStack {
                            Spacer()
                            ProgressView()
                                .tint(Color.spentyPrimary)
                                .padding()
                            Spacer()
                        }
                    }
                }
            }
            .refreshable { await viewModel.refresh() }
        }
    }

    // MARK: - Hint

    private var accountFilterHint: some View {
        HStack(spacing: 6) {
            Image(systemName: "info.circle")
                .font(.system(size: 13))
            Text("Select an account to see running balance")
                .font(SpentyFonts.caption1)
        }
        .foregroundColor(.spentyInfo)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.spentyInfo.opacity(0.08))
    }

    // MARK: - Header

    private var headerRow: some View {
        HStack(spacing: 0) {
            Text("Date")
                .frame(width: 80, alignment: .leading)
            Text("Description")
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Debit")
                .frame(width: 80, alignment: .trailing)
            Text("Credit")
                .frame(width: 80, alignment: .trailing)
            if isFilteredByAccount {
                Text("Balance")
                    .frame(width: 80, alignment: .trailing)
            }
        }
        .font(SpentyFonts.caption1)
        .fontWeight(.semibold)
        .foregroundColor(.spentyTextSecondary)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.spentyPrimary.opacity(0.08))
    }

    // MARK: - Row

    private func ledgerRow(_ txn: Transaction, index: Int) -> some View {
        let isAlternate = index % 2 == 1
        let amount = txn.amount ?? 0
        let isDebit = txn.transactionType?.lowercased() == "expense" ||
            (txn.transactionType?.lowercased() == "transfer" && txn.accountId == viewModel.filterAccountId)
        let isCredit = txn.transactionType?.lowercased() == "income" ||
            (txn.transactionType?.lowercased() == "transfer" && txn.toAccountId == viewModel.filterAccountId)

        return HStack(spacing: 0) {
            Text(txn.date.map { Self.ledgerDateFormatter.string(from: $0) } ?? "-")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
                .frame(width: 80, alignment: .leading)

            Text(txn.description ?? "-")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextPrimary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Debit column
            if isDebit {
                CurrencyText(
                    amount: amount,
                    font: SpentyFonts.caption1,
                    color: .spentyError
                )
                .frame(width: 80, alignment: .trailing)
            } else {
                Text("-")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary.opacity(0.4))
                    .frame(width: 80, alignment: .trailing)
            }

            // Credit column
            if isCredit {
                CurrencyText(
                    amount: amount,
                    font: SpentyFonts.caption1,
                    color: .spentySuccess
                )
                .frame(width: 80, alignment: .trailing)
            } else {
                Text("-")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary.opacity(0.4))
                    .frame(width: 80, alignment: .trailing)
            }

            // Balance column
            if isFilteredByAccount {
                let bal = runningBalances[txn.id] ?? 0
                CurrencyText(
                    amount: bal,
                    font: SpentyFonts.caption1,
                    color: bal >= 0 ? .spentyPrimary : .spentyError
                )
                .frame(width: 80, alignment: .trailing)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(isAlternate ? Color.spentyBgPrimary : Color.spentyCardBg)
        .onAppear {
            if txn.id == viewModel.transactions.last?.id {
                Task { await viewModel.loadMore() }
            }
        }
    }
}

#Preview {
    TransactionLedgerView(viewModel: TransactionsViewModel())
}
