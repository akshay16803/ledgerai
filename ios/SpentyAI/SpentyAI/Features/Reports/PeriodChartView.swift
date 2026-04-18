import SwiftUI
import Charts

struct PeriodChartView: View {

    let periods: [ReportPeriod]

    @State private var selectedPeriod: ReportPeriod?

    // MARK: - Chart Data

    private struct BarEntry: Identifiable {
        let id = UUID()
        let month: String
        let type: String
        let amount: Double
        let color: Color
    }

    private var entries: [BarEntry] {
        periods.flatMap { period in
            let label = shortMonth(period.period ?? "")
            return [
                BarEntry(month: label, type: "Income", amount: period.income ?? 0, color: .spentySuccess),
                BarEntry(month: label, type: "Expense", amount: abs(period.expense ?? 0), color: .spentyError),
            ]
        }
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Income vs Expense")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            if periods.isEmpty {
                Text("No data for this period")
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextSecondary)
                    .frame(maxWidth: .infinity, minHeight: 200)
            } else {
                Chart(entries) { entry in
                    BarMark(
                        x: .value("Month", entry.month),
                        y: .value("Amount", entry.amount)
                    )
                    .foregroundStyle(by: .value("Type", entry.type))
                    .position(by: .value("Type", entry.type))
                    .cornerRadius(4)
                }
                .chartForegroundStyleScale([
                    "Income": Color.spentySuccess,
                    "Expense": Color.spentyError,
                ])
                .chartLegend(position: .top, alignment: .leading)
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel()
                            .font(SpentyFonts.caption2)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            .foregroundStyle(Color.spentyBorder)
                        AxisValueLabel {
                            if let v = value.as(Double.self) {
                                Text(abbreviatedAmount(v))
                                    .font(SpentyFonts.caption2)
                                    .foregroundColor(.spentyTextSecondary)
                            }
                        }
                    }
                }
                .chartOverlay { proxy in
                    GeometryReader { geo in
                        Rectangle()
                            .fill(Color.clear)
                            .contentShape(Rectangle())
                            .onTapGesture { location in
                                guard let month: String = proxy.value(atX: location.x) else { return }
                                selectedPeriod = periods.first { shortMonth($0.period ?? "") == month }
                            }
                    }
                }
                .frame(height: 220)

                if let sel = selectedPeriod {
                    HStack(spacing: 16) {
                        Label {
                            Text(formatAmount(sel.income ?? 0))
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentySuccess)
                        } icon: {
                            Circle().fill(Color.spentySuccess).frame(width: 8, height: 8)
                        }
                        Label {
                            Text(formatAmount(abs(sel.expense ?? 0)))
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyError)
                        } icon: {
                            Circle().fill(Color.spentyError).frame(width: 8, height: 8)
                        }
                        Spacer()
                        Text(sel.period ?? "")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                    .padding(.top, 4)
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Helpers

    private func shortMonth(_ period: String) -> String {
        // period comes as "2025-01" or similar
        let parts = period.split(separator: "-")
        guard parts.count >= 2, let monthNum = Int(parts[1]) else { return period }
        let symbols = Calendar.current.shortMonthSymbols
        let index = max(0, min(monthNum - 1, symbols.count - 1))
        if parts.count >= 1 {
            let year = String(parts[0].suffix(2))
            return "\(symbols[index]) '\(year)"
        }
        return symbols[index]
    }

    private func abbreviatedAmount(_ value: Double) -> String {
        if value >= 10_000_000 {
            return String(format: "%.1fCr", value / 10_000_000)
        } else if value >= 100_000 {
            return String(format: "%.1fL", value / 100_000)
        } else if value >= 1_000 {
            return String(format: "%.1fK", value / 1_000)
        }
        return String(format: "%.0f", value)
    }

    private func formatAmount(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}

#Preview {
    PeriodChartView(periods: [
        ReportPeriod(period: "2025-01", income: 50000, expense: -35000, net: 15000, transactionCount: 42),
        ReportPeriod(period: "2025-02", income: 55000, expense: -40000, net: 15000, transactionCount: 38),
        ReportPeriod(period: "2025-03", income: 48000, expense: -32000, net: 16000, transactionCount: 45),
    ])
    .padding()
}
