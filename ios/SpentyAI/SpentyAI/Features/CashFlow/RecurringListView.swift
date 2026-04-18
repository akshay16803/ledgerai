import SwiftUI

struct RecurringListView: View {

    @Bindable var viewModel: CashFlowViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader

            if viewModel.recurringItems.isEmpty {
                emptyState
            } else {
                itemsList
            }
        }
    }

    // MARK: - Header

    private var sectionHeader: some View {
        HStack(spacing: 8) {
            Image(systemName: "repeat")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.spentyPrimary)

            Text("Recurring Transactions")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            Spacer()
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Items List

    private var itemsList: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.recurringItems) { item in
                recurringRow(item)

                if item.id != viewModel.recurringItems.last?.id {
                    Divider().padding(.leading, 48)
                }
            }
        }
        .cardStyle()
        .padding(.horizontal, 16)
    }

    // MARK: - Row

    private func recurringRow(_ item: RecurringItem) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(colorForType(item.type).opacity(0.12))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: iconForType(item.type))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(colorForType(item.type))
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(item.description ?? "Transaction")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let freq = item.frequency {
                        Text(freq.capitalized)
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyInfo)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.spentyInfo.opacity(0.1))
                            .clipShape(Capsule())
                    }

                    Text(typeLabel(item.type))
                        .font(SpentyFonts.caption2)
                        .foregroundColor(colorForType(item.type))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(colorForType(item.type).opacity(0.1))
                        .clipShape(Capsule())
                }
            }

            Spacer()

            CurrencyText(
                amount: item.amount ?? 0,
                font: SpentyFonts.amountSmall,
                color: colorForType(item.type)
            )
        }
        .padding(.vertical, 10)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "repeat.circle")
                .font(.system(size: 32))
                .foregroundColor(.spentyTextSecondary.opacity(0.4))

            Text("No recurring transactions")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)

            Text("Mark transactions as recurring to see them here")
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .padding(.horizontal, 16)
    }

    // MARK: - Helpers

    private func colorForType(_ type: String?) -> Color {
        switch type?.lowercased() {
        case "income": return .spentySuccess
        case "expense": return .spentyAccent1
        default: return .spentyTextSecondary
        }
    }

    private func iconForType(_ type: String?) -> String {
        switch type?.lowercased() {
        case "income": return "arrow.down.circle.fill"
        case "expense": return "arrow.up.circle.fill"
        default: return "arrow.left.arrow.right"
        }
    }

    private func typeLabel(_ type: String?) -> String {
        switch type?.lowercased() {
        case "income": return "Income"
        case "expense": return "Expense"
        default: return "Other"
        }
    }
}

#Preview {
    RecurringListView(viewModel: CashFlowViewModel())
}
