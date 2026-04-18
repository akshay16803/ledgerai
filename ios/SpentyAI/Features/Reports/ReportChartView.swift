import SwiftUI
import Charts

struct ReportChartView: View {

    let periods: [PeriodEntry]
    var height: CGFloat = 220

    private var needsScroll: Bool {
        periods.count > 6
    }

    private var chartWidth: CGFloat {
        if needsScroll {
            return CGFloat(periods.count) * 72
        }
        return .infinity
    }

    var body: some View {
        if needsScroll {
            ScrollView(.horizontal, showsIndicators: false) {
                chartContent
                    .frame(width: chartWidth, height: height)
            }
        } else {
            chartContent
                .frame(height: height)
        }
    }

    private var chartContent: some View {
        Chart {
            ForEach(periods, id: \.period) { entry in
                BarMark(
                    x: .value("Period", formatPeriodLabel(entry.period ?? "")),
                    y: .value("Amount", entry.income ?? 0)
                )
                .foregroundStyle(SpentyColors.success)
                .foregroundStyle(by: .value("Type", "Income"))
                .position(by: .value("Type", "Income"))

                BarMark(
                    x: .value("Period", formatPeriodLabel(entry.period ?? "")),
                    y: .value("Amount", entry.expense ?? 0)
                )
                .foregroundStyle(SpentyColors.danger)
                .foregroundStyle(by: .value("Type", "Expense"))
                .position(by: .value("Type", "Expense"))
            }
        }
        .chartForegroundStyleScale([
            "Income": SpentyColors.success,
            "Expense": SpentyColors.danger
        ])
        .chartLegend(position: .bottom, alignment: .center)
        .chartYAxis {
            AxisMarks(position: .leading)
        }
        .padding(.horizontal, SpentySpacing.sm)
    }

    private func formatPeriodLabel(_ period: String) -> String {
        // Attempt to parse "YYYY-MM" into "MMM YY" format
        let parts = period.split(separator: "-")
        guard parts.count >= 2,
              let month = Int(parts[1]) else {
            return period
        }

        let monthSymbols = Calendar.current.shortMonthSymbols
        let monthIndex = max(0, min(month - 1, monthSymbols.count - 1))
        let monthName = monthSymbols[monthIndex]

        if parts.count >= 1 {
            let year = String(parts[0].suffix(2))
            return "\(monthName) '\(year)"
        }

        return monthName
    }
}

#Preview {
    ReportChartView(
        periods: [
            PeriodEntry(period: "2026-01", income: 5000, expense: 3200, transfers: 0, net: 1800, transactionCount: 42),
            PeriodEntry(period: "2026-02", income: 4800, expense: 3500, transfers: 0, net: 1300, transactionCount: 38),
            PeriodEntry(period: "2026-03", income: 5200, expense: 2900, transfers: 0, net: 2300, transactionCount: 45),
            PeriodEntry(period: "2026-04", income: 5100, expense: 3800, transfers: 0, net: 1300, transactionCount: 40)
        ]
    )
    .padding()
}
