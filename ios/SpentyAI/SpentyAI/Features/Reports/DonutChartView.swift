import SwiftUI
import Charts

struct DonutChartView: View {

    let categories: [ReportCategory]
    let totalAmount: Double
    let type: CategoryType

    @State private var selectedCategory: ReportCategory?

    // MARK: - Colors

    private let palette: [Color] = [
        Color(hex: 0x3A5C4A),
        Color(hex: 0xC26D5C),
        Color(hex: 0x4A6E7D),
        Color(hex: 0xC28C3C),
        Color(hex: 0x7B5EA7),
        Color(hex: 0x5A9E6F),
        Color(hex: 0xD4856A),
        Color(hex: 0x6A8FA0),
        Color(hex: 0xB5A24C),
        Color(hex: 0x9A6B8C),
    ]

    private func colorFor(index: Int) -> Color {
        palette[index % palette.count]
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("By Category")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            if categories.isEmpty {
                Text("No category data")
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextSecondary)
                    .frame(maxWidth: .infinity, minHeight: 180)
            } else {
                HStack(alignment: .top, spacing: 20) {
                    // Donut Chart
                    ZStack {
                        Chart(Array(categories.enumerated()), id: \.element.id) { index, category in
                            SectorMark(
                                angle: .value("Amount", abs(category.amount ?? 0)),
                                innerRadius: .ratio(0.6),
                                angularInset: 1.5
                            )
                            .foregroundStyle(colorFor(index: index))
                            .opacity(selectedCategory == nil || selectedCategory?.id == category.id ? 1.0 : 0.4)
                            .cornerRadius(3)
                        }
                        .chartLegend(.hidden)
                        .onTapGesture {
                            // Deselect on tap
                            selectedCategory = nil
                        }
                        .frame(width: 150, height: 150)

                        // Center label
                        VStack(spacing: 2) {
                            if let sel = selectedCategory {
                                Text(sel.name ?? "")
                                    .font(SpentyFonts.caption2)
                                    .foregroundColor(.spentyTextSecondary)
                                    .lineLimit(1)
                                Text(formatAmount(abs(sel.amount ?? 0)))
                                    .font(SpentyFonts.caption1.weight(.semibold))
                                    .foregroundColor(.spentyTextPrimary)
                            } else {
                                Text("Total")
                                    .font(SpentyFonts.caption2)
                                    .foregroundColor(.spentyTextSecondary)
                                Text(formatAmount(totalAmount))
                                    .font(SpentyFonts.caption1.weight(.semibold))
                                    .foregroundColor(.spentyTextPrimary)
                            }
                        }
                        .frame(width: 80)
                    }

                    // Legend
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(categories.prefix(6).enumerated()), id: \.element.id) { index, category in
                            legendRow(category: category, color: colorFor(index: index))
                                .onTapGesture {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        if selectedCategory?.id == category.id {
                                            selectedCategory = nil
                                        } else {
                                            selectedCategory = category
                                        }
                                    }
                                }
                        }
                        if categories.count > 6 {
                            Text("+\(categories.count - 6) more")
                                .font(SpentyFonts.caption2)
                                .foregroundColor(.spentyTextSecondary)
                        }
                    }
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Legend Row

    private func legendRow(category: ReportCategory, color: Color) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)

            Text(category.name ?? "Unknown")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextPrimary)
                .lineLimit(1)

            Spacer()

            Text(percentString(category))
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary)
        }
    }

    // MARK: - Helpers

    private func percentString(_ category: ReportCategory) -> String {
        if let pct = category.percentage {
            return String(format: "%.0f%%", pct)
        }
        guard totalAmount > 0 else { return "0%" }
        let pct = abs(category.amount ?? 0) / totalAmount * 100
        return String(format: "%.0f%%", pct)
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
    DonutChartView(
        categories: [
            ReportCategory(categoryId: "1", name: "Food", amount: 12000, percentage: 35, transactionCount: 20),
            ReportCategory(categoryId: "2", name: "Transport", amount: 8000, percentage: 23, transactionCount: 15),
            ReportCategory(categoryId: "3", name: "Shopping", amount: 6000, percentage: 17, transactionCount: 10),
            ReportCategory(categoryId: "4", name: "Bills", amount: 5000, percentage: 14, transactionCount: 8),
            ReportCategory(categoryId: "5", name: "Other", amount: 3500, percentage: 11, transactionCount: 5),
        ],
        totalAmount: 34500,
        type: .expense
    )
    .padding()
}
