import SwiftUI
import Charts

struct ReportsView: View {

    @State private var vm = ReportsViewModel()
    @State private var expandedCategoryId: String?

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    periodFilterSection
                    if vm.activePreset == .custom {
                        customDateSection
                    }
                    summaryCardsSection
                    PeriodChartView(periods: vm.periods)
                    categorySection
                    categoryTableSection
                    exportSection
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Color.spentyBgPrimary.ignoresSafeArea())
            .navigationTitle("Reports")
            .refreshable {
                await vm.loadData()
            }
            .task {
                await vm.loadData()
            }
            .overlay {
                if vm.isLoading && !vm.hasData {
                    ProgressView()
                        .tint(.spentyPrimary)
                }
            }
            .alert("Error", isPresented: $vm.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(vm.errorMessage)
            }
            .sheet(isPresented: $vm.showShareSheet) {
                if let url = vm.exportedFileURL {
                    ShareSheet(items: [url])
                }
            }
        }
    }

    // MARK: - Period Filter Chips

    private var periodFilterSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(PeriodPreset.allCases) { preset in
                    Button {
                        vm.applyPreset(preset)
                        if preset != .custom {
                            Task { await vm.loadData() }
                        }
                    } label: {
                        Text(preset.rawValue)
                            .font(SpentyFonts.footnote)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                vm.activePreset == preset
                                    ? Color.spentyPrimary
                                    : Color.spentyCardBg
                            )
                            .foregroundColor(
                                vm.activePreset == preset
                                    ? .white
                                    : .spentyTextPrimary
                            )
                            .cornerRadius(20)
                            .overlay(
                                RoundedRectangle(cornerRadius: 20)
                                    .stroke(
                                        vm.activePreset == preset
                                            ? Color.clear
                                            : Color.spentyBorder,
                                        lineWidth: 1
                                    )
                            )
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    // MARK: - Custom Date Picker

    private var customDateSection: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("From")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                DatePicker("", selection: $vm.startDate, displayedComponents: .date)
                    .labelsHidden()
                    .tint(.spentyPrimary)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("To")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                DatePicker("", selection: $vm.endDate, displayedComponents: .date)
                    .labelsHidden()
                    .tint(.spentyPrimary)
            }

            Spacer()

            Button {
                Task { await vm.loadData() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 40, height: 40)
                    .background(Color.spentyPrimary)
                    .cornerRadius(10)
            }
        }
        .cardStyle()
    }

    // MARK: - Summary Cards (2x2 Grid)

    private var summaryCardsSection: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12),
        ], spacing: 12) {
            StatCard(
                label: "Total Income",
                value: formatCurrency(vm.totalIncome),
                icon: "arrow.down.circle.fill",
                color: .spentySuccess
            )
            StatCard(
                label: "Total Expense",
                value: formatCurrency(abs(vm.totalExpense)),
                icon: "arrow.up.circle.fill",
                color: .spentyError
            )
            StatCard(
                label: "Net",
                value: formatCurrency(vm.net),
                icon: "equal.circle.fill",
                color: vm.net >= 0 ? .spentySuccess : .spentyError
            )
            StatCard(
                label: "Transactions",
                value: "\(vm.transactionCount)",
                icon: "list.bullet.rectangle.fill",
                color: .spentyInfo
            )
        }
    }

    // MARK: - Category Section (Toggle + Donut)

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Toggle between Expense / Income
            HStack(spacing: 0) {
                ForEach(CategoryType.allCases) { type in
                    Button {
                        vm.catType = type
                        Task { await vm.reloadCategories() }
                    } label: {
                        Text(type.rawValue)
                            .font(SpentyFonts.footnote.weight(.medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                vm.catType == type
                                    ? Color.spentyPrimary
                                    : Color.clear
                            )
                            .foregroundColor(
                                vm.catType == type ? .white : .spentyTextSecondary
                            )
                    }
                }
            }
            .background(Color.spentyBgPrimary)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.spentyBorder, lineWidth: 1)
            )

            DonutChartView(
                categories: vm.categories,
                totalAmount: vm.totalCategoryAmount,
                type: vm.catType
            )
        }
    }

    // MARK: - Category Table

    private var categoryTableSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Category Details")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            if vm.categories.isEmpty {
                Text("No categories to display")
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextSecondary)
                    .padding(.vertical, 12)
            } else {
                ForEach(vm.categories) { category in
                    categoryRow(category)
                }
            }
        }
        .cardStyle()
    }

    private func categoryRow(_ category: ReportCategory) -> some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    if expandedCategoryId == category.id {
                        expandedCategoryId = nil
                    } else {
                        expandedCategoryId = category.id
                    }
                }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(category.name ?? "Unknown")
                            .font(SpentyFonts.subheadline)
                            .foregroundColor(.spentyTextPrimary)
                        Text("\(category.transactionCount ?? 0) transactions")
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(formatCurrency(abs(category.amount ?? 0)))
                            .font(SpentyFonts.amountSmall)
                            .foregroundColor(.spentyTextPrimary)
                        Text(percentString(category))
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyTextSecondary)
                        .rotationEffect(.degrees(expandedCategoryId == category.id ? 90 : 0))
                }
                .padding(.vertical, 10)
            }

            // Progress bar
            GeometryReader { geo in
                let pct = percentValue(category)
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.spentyBorder)
                    .frame(height: 3)
                    .overlay(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.spentyPrimary)
                            .frame(width: geo.size.width * pct, height: 3)
                    }
            }
            .frame(height: 3)

            Divider()
                .padding(.top, 8)
        }
    }

    // MARK: - Export Section

    private var exportSection: some View {
        HStack(spacing: 12) {
            Button {
                Task { await vm.exportCSV() }
            } label: {
                HStack {
                    if vm.isExporting {
                        ProgressView()
                            .tint(.spentyPrimary)
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "tablecells")
                    }
                    Text("Export CSV")
                }
                .secondaryButtonStyle()
            }
            .disabled(vm.isExporting)

            Button {
                Task { await vm.exportPDF() }
            } label: {
                HStack {
                    if vm.isExporting {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "doc.richtext")
                    }
                    Text("Export PDF")
                }
                .primaryButtonStyle()
            }
            .disabled(vm.isExporting)
        }
    }

    // MARK: - Formatting Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func percentString(_ category: ReportCategory) -> String {
        if let pct = category.percentage {
            return String(format: "%.1f%%", pct)
        }
        guard vm.totalCategoryAmount > 0 else { return "0%" }
        let pct = abs(category.amount ?? 0) / vm.totalCategoryAmount * 100
        return String(format: "%.1f%%", pct)
    }

    private func percentValue(_ category: ReportCategory) -> Double {
        if let pct = category.percentage {
            return min(pct / 100.0, 1.0)
        }
        guard vm.totalCategoryAmount > 0 else { return 0 }
        return min(abs(category.amount ?? 0) / vm.totalCategoryAmount, 1.0)
    }
}

// MARK: - ShareSheet (UIKit Bridge)

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

#Preview {
    ReportsView()
}
