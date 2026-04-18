import SwiftUI

struct TransactionRow: View {
    let transaction: Transaction
    let currency: String

    // MARK: - Computed Properties

    private var typeIcon: String {
        switch transaction.transactionType {
        case .income:
            return "arrow.down"
        case .expense:
            return "arrow.up"
        case .transfer:
            return "arrow.left.arrow.right"
        }
    }

    private var typeColor: Color {
        switch transaction.transactionType {
        case .income:
            return SpentyColors.success
        case .expense:
            return SpentyColors.danger
        case .transfer:
            return SpentyColors.info
        }
    }

    private var signedAmount: Double {
        switch transaction.transactionType {
        case .income:
            return transaction.amount
        case .expense:
            return -transaction.amount
        case .transfer:
            return transaction.amount
        }
    }

    private var isAISourced: Bool {
        guard let source = transaction.source?.lowercased() else { return false }
        return source.contains("ai") || source.contains("email") || source.contains("sms")
    }

    private var displayDescription: String {
        let desc = transaction.description ?? ""
        return desc.isEmpty ? "No description" : desc
    }

    private var formattedDate: String {
        DateFormatting.shortDate(from: transaction.date)
    }

    // MARK: - Body

    var body: some View {
        HStack(spacing: SpentySpacing.md) {
            // Type icon
            Circle()
                .fill(typeColor.opacity(0.12))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: typeIcon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(typeColor)
                }

            // Center: description + account + category
            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                HStack(spacing: SpentySpacing.xs) {
                    Text(displayDescription)
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textPrimary)
                        .lineLimit(1)

                    if isAISourced {
                        AIBadge()
                    }

                    if transaction.status == .pendingReview {
                        StatusBadge(.pending)
                    }
                }

                HStack(spacing: SpentySpacing.sm) {
                    if let accountName = transaction.accountName, !accountName.isEmpty {
                        Text(accountName)
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                            .lineLimit(1)
                    }

                    if let categoryName = transaction.categoryName, !categoryName.isEmpty {
                        Text(categoryName)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(SpentyColors.textSecondary)
                            .padding(.horizontal, SpentySpacing.sm - 2)
                            .padding(.vertical, 2)
                            .background(SpentyColors.bgSecondary)
                            .clipShape(Capsule())
                    }
                }
            }

            Spacer(minLength: SpentySpacing.sm)

            // Right: amount + date
            VStack(alignment: .trailing, spacing: SpentySpacing.xs) {
                MoneyText(
                    signedAmount,
                    currency: currency,
                    showSign: true,
                    size: SpentyFonts.body
                )

                Text(formattedDate)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
            }
        }
        .padding(.vertical, SpentySpacing.md)
        .padding(.horizontal, SpentySpacing.lg)
        .background(SpentyColors.surface)
        .overlay(alignment: .bottom) {
            Divider()
                .overlay(SpentyColors.borderSubtle)
                .padding(.leading, 64)
        }
    }
}

#Preview {
    VStack(spacing: 0) {
        TransactionRow(
            transaction: Transaction(
                transactionId: "1",
                userId: nil,
                transactionType: .income,
                amount: 50000,
                date: "2026-04-15",
                accountId: nil, toAccountId: nil,
                categoryId: nil, subcategoryId: nil,
                description: "Client Payment",
                paymentMethod: "Bank Transfer",
                isRecurring: false, recurringFrequency: nil,
                source: "ai_email",
                status: .approved,
                receiptId: nil, createdAt: nil,
                accountName: "HDFC Current",
                categoryName: "Sales"
            ),
            currency: "INR"
        )

        TransactionRow(
            transaction: Transaction(
                transactionId: "2",
                userId: nil,
                transactionType: .expense,
                amount: 1200,
                date: "2026-04-14",
                accountId: nil, toAccountId: nil,
                categoryId: nil, subcategoryId: nil,
                description: "Office Supplies",
                paymentMethod: "UPI",
                isRecurring: false, recurringFrequency: nil,
                source: "manual",
                status: .pendingReview,
                receiptId: nil, createdAt: nil,
                accountName: "ICICI Savings",
                categoryName: "Office"
            ),
            currency: "INR"
        )
    }
}
