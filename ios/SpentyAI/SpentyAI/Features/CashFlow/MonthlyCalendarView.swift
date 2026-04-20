import SwiftUI

// MARK: - Calendar Entry Model

struct CalendarDayEntry: Identifiable {
    let id = UUID()
    let label: String
    let amount: Double
    let type: CalendarEntryType
}

enum CalendarEntryType {
    case income, expense, mandate, emi, odInterest

    var color: Color {
        switch self {
        case .income: return .spentySuccess
        case .expense: return .spentyAccent1
        case .mandate: return .spentyAccent1
        case .emi: return .spentyAccent3
        case .odInterest: return .spentyError
        }
    }

    var icon: String {
        switch self {
        case .income: return "arrow.down.circle.fill"
        case .expense: return "arrow.up.circle.fill"
        case .mandate: return "doc.text.fill"
        case .emi: return "creditcard.fill"
        case .odInterest: return "percent"
        }
    }
}

// MARK: - Monthly Calendar View

struct MonthlyCalendarView: View {

    let viewModel: CashFlowViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedDay: Int?

    // Next month info
    private var nextMonthDate: Date {
        Calendar.current.date(byAdding: .month, value: 1, to: Date()) ?? Date()
    }

    private var nextMonthName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: nextMonthDate)
    }

    private var daysInNextMonth: Int {
        let cal = Calendar.current
        return cal.range(of: .day, in: .month, for: nextMonthDate)?.count ?? 30
    }

    /// Weekday of the 1st day (0 = Sunday … 6 = Saturday)
    private var firstWeekday: Int {
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: nextMonthDate)
        guard let firstDay = cal.date(from: comps) else { return 0 }
        return (cal.component(.weekday, from: firstDay) + 5) % 7 // Mon=0
    }

    // MARK: - Data Aggregation

    private var dayEntries: [Int: [CalendarDayEntry]] {
        var result: [Int: [CalendarDayEntry]] = [:]

        // Recurring income & expenses
        for item in viewModel.incomeItems {
            if let day = item.recurrenceDate, day >= 1, day <= daysInNextMonth {
                let entry = CalendarDayEntry(
                    label: item.description ?? "Income",
                    amount: item.monthlyAmount ?? item.amount ?? 0,
                    type: .income
                )
                result[day, default: []].append(entry)
            }
        }

        for item in viewModel.expenseItems {
            if let day = item.recurrenceDate, day >= 1, day <= daysInNextMonth {
                let entry = CalendarDayEntry(
                    label: item.description ?? "Expense",
                    amount: item.monthlyAmount ?? item.amount ?? 0,
                    type: .expense
                )
                result[day, default: []].append(entry)
            }
        }

        // Mandates
        for item in viewModel.mandateItemsList {
            if let day = item.dayOfMonth, day >= 1, day <= daysInNextMonth {
                let entry = CalendarDayEntry(
                    label: item.merchant ?? "Mandate",
                    amount: item.monthlyEquivalent ?? item.amount ?? 0,
                    type: .mandate
                )
                result[day, default: []].append(entry)
            }
        }

        // EMIs
        for item in viewModel.emiItemsList {
            if let day = item.emiDay, day >= 1, day <= daysInNextMonth {
                let entry = CalendarDayEntry(
                    label: item.accountName ?? "EMI",
                    amount: item.emiAmount ?? 0,
                    type: .emi
                )
                result[day, default: []].append(entry)
            }
        }

        // OD Interest
        for item in viewModel.odInterestItemsList {
            if let day = item.interestChargeDay, day >= 1, day <= daysInNextMonth {
                let entry = CalendarDayEntry(
                    label: item.accountName ?? "OD Interest",
                    amount: item.monthlyInterest ?? 0,
                    type: .odInterest
                )
                result[day, default: []].append(entry)
            }
        }

        return result
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    summaryBar
                    legend
                    calendarGrid
                    if let day = selectedDay, let entries = dayEntries[day], !entries.isEmpty {
                        dayDetail(day: day, entries: entries)
                    }
                    Spacer().frame(height: 30)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
            .background(Color.spentyBgPrimary)
            .navigationTitle(nextMonthName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.spentyTextSecondary)
                            .font(.title3)
                    }
                }
            }
        }
    }

    // MARK: - Summary Bar

    private var summaryBar: some View {
        let allEntries = dayEntries.values.flatMap { $0 }
        let totalIncome = allEntries.filter { $0.type == .income }.reduce(0) { $0 + $1.amount }
        let totalOutflow = allEntries.filter { $0.type != .income }.reduce(0) { $0 + $1.amount }
        let net = totalIncome - totalOutflow

        return HStack(spacing: 12) {
            miniSummaryCard(label: "Inflow", amount: totalIncome, color: .spentySuccess)
            miniSummaryCard(label: "Outflow", amount: totalOutflow, color: .spentyAccent1)
            miniSummaryCard(label: "Net", amount: net, color: net >= 0 ? .spentySuccess : .spentyError)
        }
    }

    private func miniSummaryCard(label: String, amount: Double, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(label)
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary)
            Text(shortCurrency(amount))
                .font(SpentyFonts.caption1.bold())
                .foregroundColor(color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color.spentyCardBg)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.03), radius: 4, x: 0, y: 1)
    }

    // MARK: - Legend

    private var legend: some View {
        HStack(spacing: 16) {
            legendDot(color: .spentySuccess, label: "Income")
            legendDot(color: .spentyAccent1, label: "Expense")
            legendDot(color: .spentyAccent3, label: "EMI")
            legendDot(color: .spentyError, label: "OD Int.")
        }
        .font(SpentyFonts.caption2)
        .foregroundColor(.spentyTextSecondary)
        .padding(.vertical, 4)
    }

    private func legendDot(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
        }
    }

    // MARK: - Calendar Grid

    private let weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    private var calendarGrid: some View {
        VStack(spacing: 4) {
            // Weekday headers
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(weekdays, id: \.self) { day in
                    Text(day)
                        .font(SpentyFonts.caption2.bold())
                        .foregroundColor(.spentyTextSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 24)
                }
            }

            // Day cells
            LazyVGrid(columns: columns, spacing: 4) {
                // Empty cells before the 1st
                ForEach(0..<firstWeekday, id: \.self) { _ in
                    Color.clear
                        .frame(height: 64)
                }

                // Actual day cells
                ForEach(1...daysInNextMonth, id: \.self) { day in
                    dayCell(day: day)
                }
            }
        }
        .padding(12)
        .background(Color.spentyCardBg)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private func dayCell(day: Int) -> some View {
        let entries = dayEntries[day] ?? []
        let isSelected = selectedDay == day
        let hasItems = !entries.isEmpty
        let dayIncome = entries.filter { $0.type == .income }.reduce(0) { $0 + $1.amount }
        let dayExpense = entries.filter { $0.type != .income }.reduce(0) { $0 + $1.amount }

        return Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                selectedDay = selectedDay == day ? nil : day
            }
        } label: {
            VStack(spacing: 2) {
                Text("\(day)")
                    .font(SpentyFonts.caption1.bold())
                    .foregroundColor(isSelected ? .white : .spentyTextPrimary)

                if hasItems {
                    // Colored dots showing entry types
                    HStack(spacing: 2) {
                        ForEach(uniqueTypes(entries), id: \.self) { type in
                            Circle()
                                .fill(colorForType(type))
                                .frame(width: 5, height: 5)
                        }
                    }

                    if dayIncome > 0 {
                        Text("+\(compactCurrency(dayIncome))")
                            .font(.system(size: 8, weight: .semibold, design: .monospaced))
                            .foregroundColor(isSelected ? .white.opacity(0.9) : .spentySuccess)
                            .lineLimit(1)
                    }

                    if dayExpense > 0 {
                        Text("-\(compactCurrency(dayExpense))")
                            .font(.system(size: 8, weight: .semibold, design: .monospaced))
                            .foregroundColor(isSelected ? .white.opacity(0.9) : .spentyAccent1)
                            .lineLimit(1)
                    }
                } else {
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 64)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.spentyPrimary : (hasItems ? Color.spentyBgSecondary : Color.clear))
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Day Detail

    private func dayDetail(day: Int, entries: [CalendarDayEntry]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Day \(day) — \(nextMonthName)")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            ForEach(entries) { entry in
                HStack(spacing: 12) {
                    Image(systemName: entry.type.icon)
                        .font(.system(size: 14))
                        .foregroundColor(entry.type.color)
                        .frame(width: 28, height: 28)
                        .background(entry.type.color.opacity(0.12))
                        .cornerRadius(8)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.label)
                            .font(SpentyFonts.subheadline)
                            .foregroundColor(.spentyTextPrimary)
                            .lineLimit(1)

                        Text(entryTypeLabel(entry.type))
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    Spacer()

                    Text(formatCurrency(entry.amount))
                        .font(SpentyFonts.amountSmall)
                        .foregroundColor(entry.type == .income ? .spentySuccess : .spentyAccent1)
                }
                .padding(.vertical, 6)

                if entry.id != entries.last?.id {
                    Divider()
                        .background(Color.spentyBorder)
                }
            }
        }
        .padding(16)
        .background(Color.spentyCardBg)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    // MARK: - Helpers

    private func uniqueTypes(_ entries: [CalendarDayEntry]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for e in entries {
            let key = "\(e.type)"
            if !seen.contains(key) {
                seen.insert(key)
                result.append(key)
            }
        }
        return result
    }

    private func colorForType(_ typeString: String) -> Color {
        switch typeString {
        case "income": return .spentySuccess
        case "expense", "mandate": return .spentyAccent1
        case "emi": return .spentyAccent3
        case "odInterest": return .spentyError
        default: return .spentyTextSecondary
        }
    }

    private func entryTypeLabel(_ type: CalendarEntryType) -> String {
        switch type {
        case .income: return "Recurring Income"
        case .expense: return "Recurring Expense"
        case .mandate: return "Mandate"
        case .emi: return "Loan EMI"
        case .odInterest: return "OD Interest"
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "₹0"
    }

    private func shortCurrency(_ value: Double) -> String {
        let abs = abs(value)
        let sign = value < 0 ? "-" : ""
        if abs >= 10_000_000 {
            return String(format: "%@₹%.1fCr", sign, abs / 10_000_000)
        } else if abs >= 100_000 {
            return String(format: "%@₹%.1fL", sign, abs / 100_000)
        } else if abs >= 1_000 {
            return String(format: "%@₹%.1fK", sign, abs / 1_000)
        } else {
            return String(format: "%@₹%.0f", sign, abs)
        }
    }

    private func compactCurrency(_ value: Double) -> String {
        if value >= 10_000_000 {
            return String(format: "%.0fCr", value / 10_000_000)
        } else if value >= 100_000 {
            return String(format: "%.0fL", value / 100_000)
        } else if value >= 1_000 {
            return String(format: "%.0fK", value / 1_000)
        } else {
            return String(format: "%.0f", value)
        }
    }
}
