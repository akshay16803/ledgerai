import SwiftUI

struct LedgerView: View {
    let transactions: [Transaction]
    let currency: String

    // MARK: - Computed

    private struct LedgerRow: Identifiable {
        let id: String
        let date: String
        let description: String
        let accountName: String
        let debit: Double?
        let credit: Double?
        let balance: Double
    }

    private var ledgerRows: [LedgerRow] {
        var runningBalance: Double = 0
        return transactions.map { txn in
            var debit: Double?
            var credit: Double?

            switch txn.transactionType {
            case .expense:
                debit = txn.amount
                runningBalance -= txn.amount
            case .income:
                credit = txn.amount
                runningBalance += txn.amount
            case .transfer:
                debit = txn.amount
                runningBalance -= txn.amount
            }

            return LedgerRow(
                id: txn.transactionId,
                date: DateFormatting.shortDate(from: txn.date),
                description: txn.description ?? "—",
                accountName: txn.accountName ?? "—",
                debit: debit,
                credit: credit,
                balance: runningBalance
            )
        }
    }

    private var totalDebit: Double {
        ledgerRows.compactMap(\.debit).reduce(0, +)
    }

    private var totalCredit: Double {
        ledgerRows.compactMap(\.credit).reduce(0, +)
    }

    // MARK: - Body

    var body: some View {
        ScrollView(.horizontal, showsIndicators: true) {
            VStack(spacing: 0) {
                headerRow
                ForEach(Array(ledgerRows.enumerated()), id: \.element.id) { index, row in
                    dataRow(row, isAlternate: index.isMultiple(of: 2))
                }
                totalsRow
            }
            .frame(minWidth: 600)
        }
    }

    // MARK: - Header

    private var headerRow: some View {
        HStack(spacing: 0) {
            headerCell("Date", width: 90)
            headerCell("Description", width: 160, alignment: .leading)
            headerCell("Account", width: 120, alignment: .leading)
            headerCell("Debit", width: 100, alignment: .trailing)
            headerCell("Credit", width: 100, alignment: .trailing)
            headerCell("Balance", width: 110, alignment: .trailing)
        }
        .background(SpentyColors.brandPrimary)
    }

    private func headerCell(
        _ title: String,
        width: CGFloat,
        alignment: Alignment = .leading
    ) -> some View {
        Text(title)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: width, alignment: alignment)
            .padding(.vertical, SpentySpacing.sm)
            .padding(.horizontal, SpentySpacing.sm)
    }

    // MARK: - Data Row

    private func dataRow(_ row: LedgerRow, isAlternate: Bool) -> some View {
        HStack(spacing: 0) {
            dataCell(row.date, width: 90)
            dataCell(row.description, width: 160, alignment: .leading, font: SpentyFonts.caption)
            dataCell(row.accountName, width: 120, alignment: .leading, font: SpentyFonts.caption)
            moneyCell(row.debit, width: 100)
            moneyCell(row.credit, width: 100)
            balanceCell(row.balance, width: 110)
        }
        .background(isAlternate ? SpentyColors.surface : SpentyColors.bgPrimary)
        .overlay(alignment: .bottom) {
            Divider().overlay(SpentyColors.borderSubtle)
        }
    }

    private func dataCell(
        _ text: String,
        width: CGFloat,
        alignment: Alignment = .leading,
        font: Font = SpentyFonts.caption
    ) -> some View {
        Text(text)
            .font(font)
            .foregroundStyle(SpentyColors.textPrimary)
            .lineLimit(1)
            .frame(width: width, alignment: alignment)
            .padding(.vertical, SpentySpacing.sm)
            .padding(.horizontal, SpentySpacing.sm)
    }

    private func moneyCell(_ amount: Double?, width: CGFloat) -> some View {
        Group {
            if let amount {
                MoneyText(amount, currency: currency, size: SpentyFonts.mono)
            } else {
                Text("—")
                    .font(SpentyFonts.mono)
                    .foregroundStyle(SpentyColors.textMuted)
            }
        }
        .frame(width: width, alignment: .trailing)
        .padding(.vertical, SpentySpacing.sm)
        .padding(.horizontal, SpentySpacing.sm)
    }

    private func balanceCell(_ balance: Double, width: CGFloat) -> some View {
        MoneyText(balance, currency: currency, showSign: true, size: SpentyFonts.mono)
            .frame(width: width, alignment: .trailing)
            .padding(.vertical, SpentySpacing.sm)
            .padding(.horizontal, SpentySpacing.sm)
    }

    // MARK: - Totals

    private var totalsRow: some View {
        HStack(spacing: 0) {
            Text("Totals")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(SpentyColors.textPrimary)
                .frame(width: 370, alignment: .trailing)
                .padding(.vertical, SpentySpacing.sm)
                .padding(.horizontal, SpentySpacing.sm)

            MoneyText(totalDebit, currency: currency, size: .system(size: 14, weight: .bold, design: .monospaced))
                .frame(width: 100, alignment: .trailing)
                .padding(.vertical, SpentySpacing.sm)
                .padding(.horizontal, SpentySpacing.sm)

            MoneyText(totalCredit, currency: currency, size: .system(size: 14, weight: .bold, design: .monospaced))
                .frame(width: 100, alignment: .trailing)
                .padding(.vertical, SpentySpacing.sm)
                .padding(.horizontal, SpentySpacing.sm)

            MoneyText(
                totalCredit - totalDebit,
                currency: currency,
                showSign: true,
                size: .system(size: 14, weight: .bold, design: .monospaced)
            )
            .frame(width: 110, alignment: .trailing)
            .padding(.vertical, SpentySpacing.sm)
            .padding(.horizontal, SpentySpacing.sm)
        }
        .background(SpentyColors.bgSecondary)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(SpentyColors.borderStrong)
                .frame(height: 2)
        }
    }
}

#Preview {
    LedgerView(
        transactions: [
            Transaction(
                transactionId: "1", userId: nil,
                transactionType: .income, amount: 50000, date: "2026-04-10",
                accountId: nil, toAccountId: nil, categoryId: nil, subcategoryId: nil,
                description: "Client Payment", paymentMethod: nil,
                isRecurring: nil, recurringFrequency: nil, source: nil,
                status: .approved, receiptId: nil, createdAt: nil,
                accountName: "HDFC Current", categoryName: "Sales"
            ),
            Transaction(
                transactionId: "2", userId: nil,
                transactionType: .expense, amount: 3000, date: "2026-04-12",
                accountId: nil, toAccountId: nil, categoryId: nil, subcategoryId: nil,
                description: "Office Rent", paymentMethod: nil,
                isRecurring: nil, recurringFrequency: nil, source: nil,
                status: .approved, receiptId: nil, createdAt: nil,
                accountName: "HDFC Current", categoryName: "Rent"
            ),
        ],
        currency: "INR"
    )
    .padding()
}
