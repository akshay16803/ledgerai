import SwiftUI
import Charts

struct ReportsView: View {

    @State private var viewModel = ReportsViewModel()

    private let statColumns = [
        GridItem(.flexible(), spacing: SpentySpacing.md),
        GridItem(.flexible(), spacing: SpentySpacing.md)
    ]

    private let categoryColors: [Color] = [
        SpentyColors.brandPrimary,
        SpentyColors.brandAccent,
        SpentyColors.success,
        SpentyColors.danger,
        SpentyColors.warning,
        SpentyColors.info
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        periodSelector
                        summaryCards
                        periodChart
                        categoryBreakdown
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.vertical, SpentySpacing.md)
                }
                .refreshable {
                    await viewModel.refresh()
                }

                if viewModel.isLoading {
                    LoadingOverlay(isPresented: .constant(true))
                }
            }
            .navigationTitle("Reports")
        }
        .task {
            await viewModel.loadAll()
        }
        .onChange(of: viewModel.selectedPeriod) { _, _ in
            Task { await viewModel.loadAll() }
        }
        .onChange(of: viewModel.selectedType) { _, _ in
            Task { await viewModel.loadCategoryReport() }
        }
        .onChange(of: viewModel.customStartDate) { _, _ in
            guard viewModel.selectedPeriod == .custom else { return }
            Task { await viewModel.loadAll() }
        }
        .onChange(of: viewModel.customEndDate) { _, _ in
            guard viewModel.selectedPeriod == .custom else { return }
            Task { await viewModel.loadAll() }
        }
    }

    // MARK: - Period Selector

    private var periodSelector: some View {
        VStack(spacing: SpentySpacing.sm) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: SpentySpacing.sm) {
                    ForEach(ReportPeriod.allCases) { period in
                        FilterChip(
                            period.rawValue,
                            isSelected: viewModel.selectedPeriod == period
                        ) {
                            viewModel.selectedPeriod = period
                        }
                    }
                }
                .padding(.horizontal, SpentySpacing.xs)
            }

            if viewModel.selectedPeriod == .custom {
                HStack(spacing: SpentySpacing.md) {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("From")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                        DatePicker(
                            "",
                            selection: $viewModel.customStartDate,
                            displayedComponents: .date
                        )
                        .labelsHidden()
                    }

                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("To")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                        DatePicker(
                            "",
                            selection: $viewModel.customEndDate,
                            displayedComponents: .date
                        )
                        .labelsHidden()
                    }
                }
                .padding(.horizontal, SpentySpacing.xs)
            }
        }
    }

    // MARK: - Summary Stat Cards

    private var summaryCards: some View {
        LazyVGrid(columns: statColumns, spacing: SpentySpacing.md) {
            StatCard(
                title: "Income",
                value: formattedMoney(viewModel.summary?.totalIncome),
                icon: "arrow.down.circle",
                iconColor: SpentyColors.success
            )

            StatCard(
                title: "Expenses",
                value: formattedMoney(viewModel.summary?.totalExpense),
                icon: "arrow.up.circle",
                iconColor: SpentyColors.danger
            )

            StatCard(
                title: "Net Savings",
                value: formattedMoney(viewModel.summary?.net),
                icon: "chart.line.uptrend.xyaxis",
                iconColor: (viewModel.summary?.net ?? 0) >= 0
                    ? SpentyColors.success
                    : SpentyColors.danger
            )

            StatCard(
                title: "Transactions",
                value: "\(viewModel.summary?.transactionCount ?? 0)",
                icon: "list.bullet.rectangle",
                iconColor: SpentyColors.textPrimary
            )
        }
    }

    // MARK: - Period Chart

    @ViewBuilder
    private var periodChart: some View {
        let periods = viewModel.periodReport?.periods ?? []

        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                SectionHeader( "Income vs Expense")

                if periods.isEmpty {
                    EmptyState(
                        title: "No period data",
                        message: "Adjust your date range to see trends."
                    )
                } else {
                    ReportChartView(periods: periods, height: 220)
                }
            }
            .padding(SpentySpacing.lg)
        }
    }

    // MARK: - Category Breakdown

    private var categoryBreakdown: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            HStack {
                SectionHeader( "By Category")
                Spacer()
            }

            // Type toggle
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: SpentySpacing.sm) {
                    ForEach(ReportTransactionType.allCases) { type in
                        FilterChip(
                            type.rawValue,
                            isSelected: viewModel.selectedType == type
                        ) {
                            viewModel.selectedType = type
                        }
                    }
                }
            }

            let categories = viewModel.categoryReport?.categories ?? []

            if categories.isEmpty {
                SpentyCard {
                    EmptyState(
                        title: "No categories",
                        message: "No category data for the selected filters."
                    )
                    .padding(SpentySpacing.lg)
                }
            } else {
                VStack(spacing: SpentySpacing.xs) {
                    ForEach(Array(categories.enumerated()), id: \.element.id) { index, category in
                        categoryRow(category: category, colorIndex: index)
                    }
                }
            }
        }
    }

    // MARK: - Category Row

    private func categoryRow(category: CategoryBreakdown, colorIndex: Int) -> some View {
        let color = categoryColors[colorIndex % categoryColors.count]
        let isExpanded = viewModel.expandedCategories.contains(category.id)

        return SpentyCard {
            VStack(spacing: 0) {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        viewModel.toggleCategory(id: category.id)
                    }
                } label: {
                    HStack(spacing: SpentySpacing.md) {
                        Circle()
                            .fill(color)
                            .frame(width: 10, height: 10)

                        Text(category.name ?? "Unknown")
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textPrimary)

                        Spacer()

                        VStack(alignment: .trailing, spacing: 2) {
                            MoneyText( category.amount ?? 0)
                            Text("\(formattedPercent(category.percentage))")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textMuted)
                        }

                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                    }
                    .padding(SpentySpacing.lg)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if isExpanded, let subcategories = category.subcategories, !subcategories.isEmpty {
                    Divider()
                        .background(SpentyColors.borderSubtle)

                    VStack(spacing: 0) {
                        ForEach(subcategories) { sub in
                            HStack(spacing: SpentySpacing.md) {
                                Text(sub.name ?? "Unknown")
                                    .font(SpentyFonts.caption)
                                    .foregroundStyle(SpentyColors.textSecondary)

                                Spacer()

                                VStack(alignment: .trailing, spacing: 2) {
                                    MoneyText( sub.amount ?? 0)
                                    Text(formattedPercent(sub.percentage))
                                        .font(SpentyFonts.caption)
                                        .foregroundStyle(SpentyColors.textMuted)
                                }
                            }
                            .padding(.horizontal, SpentySpacing.xl)
                            .padding(.vertical, SpentySpacing.sm)
                        }
                    }
                    .padding(.leading, SpentySpacing.lg)
                }
            }
        }
    }

    // MARK: - Helpers

    private func formattedMoney(_ value: Double?) -> String {
        guard let value else { return "$0.00" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: value)) ?? "$0.00"
    }

    private func formattedPercent(_ value: Double?) -> String {
        guard let value else { return "0%" }
        return String(format: "%.1f%%", value)
    }
}

#Preview {
    ReportsView()
}
