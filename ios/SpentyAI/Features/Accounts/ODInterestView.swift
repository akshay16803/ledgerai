import SwiftUI
import os

struct ODInterestView: View {

    let account: Account

    @State private var selectedMonth: Date = Date()
    @State private var report: ODInterestReport?
    @State private var isLoading = false
    @State private var isPosting = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    private let repository = AccountRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "od-interest")

    private var currency: String { account.currency ?? "INR" }

    private var monthString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: selectedMonth)
    }

    var body: some View {
        ZStack {
            SpentyColors.bgPrimary
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: SpentySpacing.lg) {
                    monthPickerSection
                    messagesSection

                    if isLoading {
                        ProgressView()
                            .controlSize(.large)
                            .tint(SpentyColors.brandAccent)
                            .padding(.vertical, SpentySpacing.xxl)
                    } else if let report {
                        summarySection(report)
                        breakdownTable(report)
                        postButton
                    }
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
        }
        .navigationTitle("OD Interest")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadReport()
        }
    }

    // MARK: - Month Picker

    private var monthPickerSection: some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                Text("Select Month")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                HStack {
                    DatePicker(
                        "",
                        selection: $selectedMonth,
                        displayedComponents: .date
                    )
                    .labelsHidden()
                    .tint(SpentyColors.brandAccent)

                    Spacer()

                    Text(monthString)
                        .font(SpentyFonts.mono)
                        .foregroundStyle(SpentyColors.textPrimary)
                }
                .onChange(of: monthString) { _, _ in
                    Task { await loadReport() }
                }
            }
        }
    }

    // MARK: - Messages

    @ViewBuilder
    private var messagesSection: some View {
        if let error = errorMessage {
            HStack(spacing: SpentySpacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(SpentyColors.danger)
                    .font(.system(size: 14))
                Text(error)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textPrimary)
            }
            .padding(SpentySpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SpentyColors.danger.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        }

        if let success = successMessage {
            HStack(spacing: SpentySpacing.sm) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(SpentyColors.success)
                    .font(.system(size: 14))
                Text(success)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textPrimary)
            }
            .padding(SpentySpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SpentyColors.success.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        }
    }

    // MARK: - Summary

    private func summarySection(_ report: ODInterestReport) -> some View {
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
                        "Interest Rate",
                        value: report.interestRate.map { String(format: "%.2f%%", $0) } ?? "--"
                    )
                    summaryItem(
                        "Daily Rate",
                        value: report.dailyRate.map { String(format: "%.6f%%", $0) } ?? "--"
                    )
                    summaryItem(
                        "Total Interest",
                        value: formatAmount(report.totalInterest)
                    )
                    summaryItem(
                        "Closing Outstanding",
                        value: formatAmount(report.closingOutstanding)
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

    // MARK: - Breakdown Table

    private func breakdownTable(_ report: ODInterestReport) -> some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Daily Breakdown")

            // Header
            HStack(spacing: 0) {
                Text("Date")
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("Outstanding")
                    .frame(maxWidth: .infinity, alignment: .trailing)
                Text("Interest")
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.vertical, SpentySpacing.sm)
            .padding(.horizontal, SpentySpacing.md)
            .background(SpentyColors.brandPrimary)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.sm))

            // Rows
            if let breakdown = report.dailyBreakdown {
                ForEach(Array(breakdown.enumerated()), id: \.offset) { index, entry in
                    dailyRow(entry, index: index)
                }
            }
        }
    }

    private func dailyRow(_ entry: ODDailyBreakdown, index: Int) -> some View {
        HStack(spacing: 0) {
            Text(formatDate(entry.date))
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(formatCompact(entry.outstandingBalance))
                .frame(maxWidth: .infinity, alignment: .trailing)

            Text(formatCompact(entry.interest))
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(SpentyFonts.mono)
        .font(.system(size: 12))
        .foregroundStyle(SpentyColors.textPrimary)
        .padding(.vertical, SpentySpacing.sm)
        .padding(.horizontal, SpentySpacing.md)
        .background(index.isMultiple(of: 2) ? SpentyColors.surface : SpentyColors.bgSecondary)
    }

    // MARK: - Post Button

    private var postButton: some View {
        PrimaryButton(
            "Post Interest",
            icon: "arrow.up.doc",
            isLoading: isPosting,
            isFullWidth: true
        ) {
            Task { await postInterest() }
        }
        .padding(.top, SpentySpacing.sm)
    }

    // MARK: - Actions

    private func loadReport() async {
        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            report = try await repository.getODInterest(account.accountId, month: monthString)
        } catch {
            errorMessage = "Failed to load interest report."
            logger.error("OD interest error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    private func postInterest() async {
        isPosting = true
        errorMessage = nil
        successMessage = nil

        let body = ODInterestPost(
            month: monthString,
            interestRate: report?.interestRate
        )

        do {
            try await repository.postODInterest(account.accountId, body: body)
            successMessage = "Interest posted successfully for \(monthString)."
            logger.info("Posted OD interest for \(self.monthString)")
        } catch {
            errorMessage = "Failed to post interest."
            logger.error("Post OD interest error: \(error.localizedDescription)")
        }

        isPosting = false
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
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.2f", value)
    }

    private func formatDate(_ dateString: String?) -> String {
        guard let dateString else { return "--" }
        // Input: yyyy-MM-dd, output: dd MMM
        let input = DateFormatter()
        input.dateFormat = "yyyy-MM-dd"
        guard let date = input.date(from: dateString) else { return dateString }
        let output = DateFormatter()
        output.dateFormat = "dd MMM"
        return output.string(from: date)
    }
}

#Preview {
    NavigationStack {
        ODInterestView(account: Account(
            accountId: "1",
            userId: nil,
            name: "HDFC OD Account",
            accountType: "Liability",
            subType: "Overdraft",
            loanInterestRate: 9.5
        ))
    }
}
