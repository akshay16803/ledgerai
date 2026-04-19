import SwiftUI

struct PaymentHistoryView: View {

    let orders: [PaymentOrder]

    private let brandPrimary = Color.spentyPrimary
    private let brandBg      = Color.spentyBgPrimary
    private let brandError   = Color.spentyError

    var body: some View {
        Group {
            if orders.isEmpty {
                emptyState
            } else {
                orderList
            }
        }
        .background(brandBg.ignoresSafeArea())
        .navigationTitle("Payment History")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("No Payments Yet")
                .font(.headline)
                .foregroundStyle(.secondary)

            Text("Your payment history will appear here once you subscribe.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Order List

    private var orderList: some View {
        List(orders) { order in
            HStack(spacing: 12) {
                // Icon
                Circle()
                    .fill(statusColor(order.status ?? "").opacity(0.12))
                    .frame(width: 40, height: 40)
                    .overlay {
                        Image(systemName: statusIcon(order.status ?? ""))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(statusColor(order.status ?? ""))
                    }

                // Details
                VStack(alignment: .leading, spacing: 3) {
                    Text(order.plan ?? "Unknown")
                        .font(.subheadline.weight(.medium))

                    HStack(spacing: 6) {
                        Text(order.createdAt ?? "")
                        Text("·")
                        Text((order.paymentProvider ?? "").capitalized)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Spacer()

                // Amount + Status
                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(order.currency ?? "") \(String(format: "%.0f", order.amount ?? 0))")
                        .font(.subheadline.weight(.semibold))

                    Text((order.status ?? "").capitalized)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(statusColor(order.status ?? ""))
                }
            }
            .padding(.vertical, 4)
            .listRowBackground(Color.spentyCardBg)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Helpers

    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "completed", "paid": return brandPrimary
        case "refunded":  return .orange
        case "pending":   return .yellow.opacity(0.8)
        default:          return .secondary
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status.lowercased() {
        case "completed", "paid": return "checkmark"
        case "refunded":  return "arrow.uturn.backward"
        case "pending":   return "clock"
        default:          return "questionmark"
        }
    }
}

#Preview {
    NavigationStack {
        PaymentHistoryView(orders: [
            PaymentOrder(
                id: "1",
                plan: "Yearly",
                amount: 1499,
                currency: "INR",
                status: "completed",
                paymentProvider: "apple",
                createdAt: "2026-03-15"
            ),
            PaymentOrder(
                id: "2",
                plan: "Monthly",
                amount: 199,
                currency: "INR",
                status: "refunded",
                paymentProvider: "apple",
                createdAt: "2026-02-10"
            ),
        ])
    }
}
