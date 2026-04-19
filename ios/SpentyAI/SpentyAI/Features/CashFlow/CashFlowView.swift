import SwiftUI

struct CashFlowView: View {

    @State private var viewModel = CashFlowViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && !viewModel.hasData {
                    LoadingView(message: "Loading cash flow...")
                } else {
                    mainContent
                }
            }
            .background(Color.spentyBgPrimary)
            .navigationTitle("Cash Flow")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await viewModel.loadAll()
            }
        }
    }

    // MARK: - Main Content

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

                // Summary stat cards
                statsGrid
                    .padding(.horizontal, 16)

                // 24-month projection chart
                CashFlowChartView(projectionMonths: viewModel.projectionMonths)
                    .padding(.horizontal, 16)

                // Recurring transactions
                RecurringListView(viewModel: viewModel)

                // Mandates
                MandatesListView(viewModel: viewModel)

                // Monthly breakdown table
                if !viewModel.projectionMonths.isEmpty {
                    monthlyBreakdown
                        .padding(.horizontal, 16)
                }

                Spacer().frame(height: 40)
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
                label: "Monthly Income",
                value: formatCurrency(viewModel.monthlyIncome),
                icon: "arrow.down.circle.fill",
                color: .spentySuccess
            )

            StatCard(
                label: "Monthly Expense",
                value: formatCurrency(viewModel.monthlyExpense),
                icon: "arrow.up.circle.fill",
                color: .spentyAccent1
            )

            StatCard(
                label: "Monthly Mandates",
                value: formatCurrency(viewModel.monthlyMandates),
                icon: "doc.text.fill",
                color: .spentyWarning
            )

            StatCard(
                label: "OD Interest",
                value: formatCurrency(viewModel.monthlyODInterest),
                icon: "percent",
                color: .spentyError
            )

            StatCard(
                label: "Monthly Net",
                value: formatCurrency(viewModel.monthlyNet),
                icon: "equal.circle.fill",
                color: viewModel.monthlyNet >= 0 ? .spentySuccess : .spentyError
            )
        }
    }

    // MARK: - Monthly Breakdown Table

    private var monthlyBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "tablecells")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.spentyPrimary)

                Text("Monthly Breakdown")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()
            }

            ScrollView(.horizontal, showsIndicators: false) {
                VStack(spacing: 0) {
                    // Header row
                    tableHeaderRow

                    Divider()

                    // Data rows
                    ForEach(Array(viewModel.projectionMonths.prefix(24).enumerated()), id: \.offset) { index, month in
                        tableDataRow(month, isEven: index % 2 == 0)

                        if index < min(viewModel.projectionMonths.count, 24) - 1 {
                            Divider()
                        }
                    }
                }
            }
            .cardStyle()
        }
    }

    private var tableHeaderRow: some View {
        HStack(spacing: 0) {
            tableCell("Month", width: 70, isHeader: true, alignment: .leading)
            tableCell("Income", width: 80, isHeader: true)
            tableCell("Expense", width: 80, isHeader: true)
            tableCell("Mandates", width: 80, isHeader: true)
            tableCell("OD Int.", width: 70, isHeader: true)
            tableCell("Net", width: 80, isHeader: true)
        }
        .padding(.vertical, 8)
    }

    private func tableDataRow(_ month: ProjectionMonth, isEven: Bool) -> some View {
        HStack(spacing: 0) {
            tableCell(formattedMonth(month.month), width: 70, alignment: .leading)
            tableCell(shortCurrency(month.income ?? 0), width: 80, color: .spentySuccess)
            tableCell(shortCurrency(month.expense ?? 0), width: 80, color: .spentyAccent1)
            tableCell(shortCurrency(month.mandates ?? 0), width: 80, color: .spentyWarning)
            tableCell(shortCurrency(month.odInterest ?? 0), width: 70, color: .spentyError)
            tableCell(shortCurrency(month.net ?? 0), width: 80, color: (month.net ?? 0) >= 0 ? .spentySuccess : .spentyError)
        }
        .padding(.vertical, 6)
        .background(isEven ? Color.spentyBgPrimary.opacity(0.5) : Color.clear)
    }

    private func tableCell(_ text: String, width: CGFloat, isHeader: Bool = false, color: Color = .spentyTextPrimary, alignment: Alignment = .trailing) -> some View {
        Text(text)
            .font(isHeader ? SpentyFonts.caption1.bold() : SpentyFonts.caption1)
            .foregroundColor(isHeader ? .spentyTextSecondary : color)
            .frame(width: width, alignment: alignment)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        if abs(value) < 100_000 {
            formatter.maximumFractionDigits = 2
            formatter.minimumFractionDigits = 2
        }
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func shortCurrency(_ value: Double) -> String {
        let abs = abs(value)
        let sign = value < 0 ? "-" : ""
        if abs >= 10_000_000 {
            return String(format: "%@%.1fCr", sign, abs / 10_000_000)
        } else if abs >= 100_000 {
            return String(format: "%@%.1fL", sign, abs / 100_000)
        } else if abs >= 1_000 {
            return String(format: "%@%.1fK", sign, abs / 1_000)
        }
        return String(format: "%@%.0f", sign, abs)
    }

    private func formattedMonth(_ raw: String?) -> String {
        guard let raw else { return "---" }
        let inFmt = DateFormatter()
        inFmt.locale = Locale(identifier: "en_US_POSIX")
        // Try common formats: "May 2026" (backend label), "2026-05", "2026-05-01"
        for fmt in ["MMM yyyy", "yyyy-MM", "yyyy-MM-dd"] {
            inFmt.dateFormat = fmt
            if let date = inFmt.date(from: raw) {
                let outFmt = DateFormatter()
                outFmt.dateFormat = "MMM yy"
                return outFmt.string(from: date)
            }
        }
        return String(raw.prefix(7))
    }
}

// MARK: - Preview

#Preview {
    CashFlowView()
}
