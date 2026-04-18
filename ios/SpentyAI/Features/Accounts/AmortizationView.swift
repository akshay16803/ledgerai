import SwiftUI
import os

struct AmortizationView: View {

    let account: Account

    @State private var schedule: AmortizationSchedule?
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let repository = AccountRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "amortization")

    private var currency: String { account.currency ?? "INR" }

    var body: some View {
        ZStack {
            SpentyColors.bgPrimary
                .ignoresSafeArea()

            if isLoading {
                ProgressView()
                    .controlSize(.large)
                    .tint(SpentyColors.brandAccent)
            } else if let error = errorMessage {
                errorState(error)
            } else if let schedule {
                scheduleContent(schedule)
            }
        }
        .navigationTitle("Amortization")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadSchedule()
        }
    }

    // MARK: - Content

    private func scheduleContent(_ schedule: AmortizationSchedule) -> some View {
        ScrollView {
            VStack(spacing: SpentySpacing.lg) {
                summarySection(schedule)
                scheduleTable(schedule)
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
        }
    }

    // MARK: - Summary

    private func summarySection(_ schedule: AmortizationSchedule) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                Text(account.name)
                    .font(SpentyFonts.heading)
                    .foregroundStyle(SpentyColors.textPrimary)

                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: SpentySpacing.md) {
                    summaryItem(
                        "Outstanding",
                        value: formatAmount(schedule.outstandingBalance)
                    )
                    summaryItem(
                        "Interest Rate",
                        value: schedule.interestRate.map { String(format: "%.2f%%", $0) } ?? "--"
                    )
                    summaryItem(
                        "Tenure",
                        value: schedule.tenureMonths.map { "\($0) months" } ?? "--"
                    )
                    summaryItem(
                        "EMI",
                        value: formatAmount(schedule.emiAmount)
                    )
                    summaryItem(
                        "Total Interest",
                        value: formatAmount(totalInterest(schedule))
                    )
                    summaryItem(
                        "Total Payment",
                        value: formatAmount(totalPayment(schedule))
                    )
                }
            }
        }
    }

    private func summaryItem(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(SpentyColors.textMuted)
                .textCase(.uppercase)
            Text(value)
                .font(SpentyFonts.mono)
                .foregroundStyle(SpentyColors.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Schedule Table

    private func scheduleTable(_ schedule: AmortizationSchedule) -> some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Schedule")

            // Header row
            tableHeaderRow

            // Data rows
            if let entries = schedule.schedule {
                ForEach(Array(entries.enumerated()), id: \.offset) { index, entry in
                    tableRow(entry, index: index)
                }
            }
        }
    }

    private var tableHeaderRow: some View {
        HStack(spacing: 0) {
            tableHeaderCell("Month", width: 50)
            tableHeaderCell("EMI", flex: true)
            tableHeaderCell("Principal", flex: true)
            tableHeaderCell("Interest", flex: true)
            tableHeaderCell("Outstanding", flex: true)
        }
        .padding(.vertical, SpentySpacing.sm)
        .padding(.horizontal, SpentySpacing.md)
        .background(SpentyColors.brandPrimary)
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.sm))
    }

    private func tableHeaderCell(_ title: String, width: CGFloat? = nil, flex: Bool = false) -> some View {
        Group {
            if let width {
                Text(title)
                    .frame(width: width, alignment: .leading)
            } else {
                Text(title)
                    .frame(maxWidth: flex ? .infinity : nil, alignment: .trailing)
            }
        }
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(.white)
    }

    private func tableRow(_ entry: AmortizationEntry, index: Int) -> some View {
        HStack(spacing: 0) {
            Text("\(entry.month ?? (index + 1))")
                .frame(width: 50, alignment: .leading)

            Text(formatCompact(entry.emiAmount))
                .frame(maxWidth: .infinity, alignment: .trailing)

            Text(formatCompact(entry.principalComponent))
                .frame(maxWidth: .infinity, alignment: .trailing)

            Text(formatCompact(entry.interestComponent))
                .frame(maxWidth: .infinity, alignment: .trailing)

            Text(formatCompact(entry.outstandingBalance))
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(SpentyFonts.mono)
        .font(.system(size: 12))
        .foregroundStyle(SpentyColors.textPrimary)
        .padding(.vertical, SpentySpacing.sm)
        .padding(.horizontal, SpentySpacing.md)
        .background(index.isMultiple(of: 2) ? SpentyColors.surface : SpentyColors.bgSecondary)
    }

    // MARK: - Error State

    private func errorState(_ message: String) -> some View {
        VStack(spacing: SpentySpacing.lg) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(SpentyColors.textMuted)

            Text(message)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
                .multilineTextAlignment(.center)

            SecondaryButton("Retry") {
                Task { await loadSchedule() }
            }
        }
        .padding(SpentySpacing.xxl)
    }

    // MARK: - Data Loading

    private func loadSchedule() async {
        isLoading = true
        errorMessage = nil

        do {
            schedule = try await repository.getAmortization(account.accountId)
        } catch {
            errorMessage = "Failed to load amortization schedule."
            logger.error("Amortization error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    // MARK: - Helpers

    private func formatAmount(_ value: Double?) -> String {
        guard let value else { return "--" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        if currency == "INR" {
            formatter.locale = Locale(identifier: "en_IN")
        }
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func formatCompact(_ value: Double?) -> String {
        guard let value else { return "--" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(Int(value))"
    }

    private func totalInterest(_ schedule: AmortizationSchedule) -> Double? {
        guard let entries = schedule.schedule else { return nil }
        let sum = entries.compactMap(\.interestComponent).reduce(0, +)
        return sum > 0 ? sum : nil
    }

    private func totalPayment(_ schedule: AmortizationSchedule) -> Double? {
        guard let entries = schedule.schedule else { return nil }
        let sum = entries.compactMap(\.emiAmount).reduce(0, +)
        return sum > 0 ? sum : nil
    }
}

#Preview {
    NavigationStack {
        AmortizationView(account: Account(
            accountId: "1",
            userId: nil,
            name: "Home Loan",
            accountType: "Liability",
            subType: "Home Loan",
            loanInterestRate: 8.5,
            loanTenureMonths: 240,
            loanEmiAmount: 45000
        ))
    }
}
