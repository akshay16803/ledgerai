import SwiftUI
import Charts

struct CashFlowChartView: View {

    let projectionMonths: [ProjectionMonth]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader

            if projectionMonths.isEmpty {
                emptyState
            } else {
                chartContent
                legend
            }
        }
        .cardStyle()
    }

    // MARK: - Header

    private var sectionHeader: some View {
        HStack(spacing: 8) {
            Image(systemName: "chart.bar.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.spentyPrimary)

            Text("24-Month Projection")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            Spacer()
        }
    }

    // MARK: - Chart

    private var chartContent: some View {
        let data = Array(projectionMonths.prefix(24))

        return ScrollView(.horizontal, showsIndicators: false) {
            Chart {
                ForEach(Array(data.enumerated()), id: \.offset) { index, month in
                    BarMark(
                        x: .value("Month", formattedMonth(month.month)),
                        y: .value("Amount", month.income ?? 0)
                    )
                    .foregroundStyle(Color.spentySuccess)
                    .position(by: .value("Type", "Income"))

                    BarMark(
                        x: .value("Month", formattedMonth(month.month)),
                        y: .value("Amount", abs(month.expense ?? 0) + abs(month.mandates ?? 0))
                    )
                    .foregroundStyle(Color.spentyError)
                    .position(by: .value("Type", "Expense"))
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic) { value in
                    AxisValueLabel(anchor: .top) {
                        if let label = value.as(String.self) {
                            Text(label)
                                .font(.system(size: 9))
                                .foregroundColor(.spentyTextSecondary)
                                .rotationEffect(.degrees(-45))
                        }
                    }
                    AxisGridLine()
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisValueLabel {
                        if let amount = value.as(Double.self) {
                            Text(abbreviatedAmount(amount))
                                .font(.system(size: 10))
                                .foregroundColor(.spentyTextSecondary)
                        }
                    }
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                }
            }
            .frame(width: max(CGFloat(data.count) * 56, 300), height: 220)
            .padding(.vertical, 4)
        }
    }

    // MARK: - Legend

    private var legend: some View {
        HStack(spacing: 20) {
            legendItem(color: .spentySuccess, label: "Income")
            legendItem(color: .spentyError, label: "Expense")
        }
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 3)
                .fill(color)
                .frame(width: 12, height: 12)

            Text(label)
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
        }
    }

    // MARK: - Empty

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 32))
                .foregroundColor(.spentyTextSecondary.opacity(0.4))

            Text("No projection data yet")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 160)
    }

    // MARK: - Helpers

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

    private func abbreviatedAmount(_ value: Double) -> String {
        let abs = abs(value)
        if abs >= 10_000_000 {
            return String(format: "%.0fCr", value / 10_000_000)
        } else if abs >= 100_000 {
            return String(format: "%.1fL", value / 100_000)
        } else if abs >= 1_000 {
            return String(format: "%.0fK", value / 1_000)
        }
        return String(format: "%.0f", value)
    }
}

#Preview {
    CashFlowChartView(projectionMonths: [])
        .padding()
}
