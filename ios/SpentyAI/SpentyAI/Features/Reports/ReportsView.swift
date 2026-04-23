import SwiftUI
import Charts

struct ReportsView: View {

    @Environment(LocalizationManager.self) var lang
    @State private var vm = ReportsViewModel()
    @State private var expandedCategoryId: UUID?
    @State private var selectedDrillDown: ReportDrillDown?

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
            .navigationTitle(lang.s("reports"))
            .refreshable {
                await vm.loadData()
            }
            .task {
                await vm.loadData()
            }
            .overlay {
                if vm.isLoading && !vm.hasData {
                    ProgressView()
                        .tint(Color.spentyPrimary)
                }
            }
            .alert(lang.s("error"), isPresented: $vm.showError) {
                Button(lang.s("ok"), role: .cancel) {}
            } message: {
                Text(vm.errorMessage)
            }
            .sheet(isPresented: $vm.showShareSheet) {
                if let url = vm.exportedFileURL {
                    ShareSheet(items: [url])
                }
            }
            .sheet(item: $selectedDrillDown) { drillDown in
                ReportTransactionsView(
                    drillDown: drillDown,
                    startDate: vm.startDate,
                    endDate: vm.endDate,
                    transactionType: drillDown.transactionTypeOverride ?? vm.catType.rawValue.lowercased()
                )
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
                Text(lang.s("from"))
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                DatePicker("", selection: $vm.startDate, displayedComponents: .date)
                    .labelsHidden()
                    .tint(Color.spentyPrimary)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(lang.s("to"))
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                DatePicker("", selection: $vm.endDate, displayedComponents: .date)
                    .labelsHidden()
                    .tint(Color.spentyPrimary)
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
            Button {
                selectedDrillDown = ReportDrillDown(
                    categoryId: nil, categoryName: "Income",
                    subcategoryId: nil, subcategoryName: nil,
                    transactionTypeOverride: "income"
                )
            } label: {
                StatCard(
                    label: lang.s("total_income"),
                    value: formatCurrency(vm.totalIncome),
                    icon: "arrow.down.circle.fill",
                    color: .spentySuccess
                )
            }
            .buttonStyle(.plain)

            Button {
                selectedDrillDown = ReportDrillDown(
                    categoryId: nil, categoryName: "Expense",
                    subcategoryId: nil, subcategoryName: nil,
                    transactionTypeOverride: "expense"
                )
            } label: {
                StatCard(
                    label: lang.s("total_expense"),
                    value: formatCurrency(abs(vm.totalExpense)),
                    icon: "arrow.up.circle.fill",
                    color: .spentyError
                )
            }
            .buttonStyle(.plain)

            Button {
                selectedDrillDown = ReportDrillDown(
                    categoryId: nil, categoryName: "All",
                    subcategoryId: nil, subcategoryName: nil,
                    transactionTypeOverride: "all"
                )
            } label: {
                StatCard(
                    label: lang.s("net"),
                    value: formatCurrency(vm.net),
                    icon: "equal.circle.fill",
                    color: vm.net >= 0 ? .spentySuccess : .spentyError
                )
            }
            .buttonStyle(.plain)

            Button {
                selectedDrillDown = ReportDrillDown(
                    categoryId: nil, categoryName: "All",
                    subcategoryId: nil, subcategoryName: nil,
                    transactionTypeOverride: "all"
                )
            } label: {
                StatCard(
                    label: lang.s("transactions"),
                    value: "\(vm.transactionCount)",
                    icon: "list.bullet.rectangle.fill",
                    color: .spentyInfo
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Category Section (Toggle + Donut)

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Toggle between Expense / Income
            HStack(spacing: 0) {
                ForEach(ReportCategoryType.allCases) { type in
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
            Text(lang.s("category_details"))
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            if vm.categories.isEmpty {
                Text(lang.s("no_categories_display"))
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
            // Category header row
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

            // Subcategory rows (when expanded)
            if expandedCategoryId == category.id {
                let subs = category.subcategories ?? []
                if subs.isEmpty {
                    // No subcategories — tapping category shows all transactions in that category
                    Button {
                        selectedDrillDown = ReportDrillDown(
                            categoryId: category.categoryId,
                            categoryName: category.name ?? "Unknown",
                            subcategoryId: nil,
                            subcategoryName: nil
                        )
                    } label: {
                        HStack {
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.system(size: 12))
                                .foregroundColor(.spentyPrimary)
                            Text(lang.s("view_all_transactions"))
                                .font(SpentyFonts.footnote)
                                .foregroundColor(.spentyPrimary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10))
                                .foregroundColor(.spentyTextSecondary)
                        }
                        .padding(.vertical, 8)
                        .padding(.leading, 16)
                    }
                } else {
                    VStack(spacing: 0) {
                        ForEach(subs) { sub in
                            Button {
                                selectedDrillDown = ReportDrillDown(
                                    categoryId: category.categoryId,
                                    categoryName: category.name ?? "Unknown",
                                    subcategoryId: sub.subcategoryId,
                                    subcategoryName: sub.subcategoryName
                                )
                            } label: {
                                subcategoryRow(sub, categoryTotal: abs(category.amount ?? 0))
                            }
                        }
                        // "View all" row at bottom
                        Button {
                            selectedDrillDown = ReportDrillDown(
                                categoryId: category.categoryId,
                                categoryName: category.name ?? "Unknown",
                                subcategoryId: nil,
                                subcategoryName: nil
                            )
                        } label: {
                            HStack {
                                Image(systemName: "doc.text.magnifyingglass")
                                    .font(.system(size: 12))
                                    .foregroundColor(.spentyPrimary)
                                Text("View all in \(category.name ?? "category")")
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 10))
                                    .foregroundColor(.spentyTextSecondary)
                            }
                            .padding(.vertical, 8)
                            .padding(.leading, 16)
                        }
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }

            Divider()
                .padding(.top, 8)
        }
    }

    private func subcategoryRow(_ sub: ReportSubcategory, categoryTotal: Double) -> some View {
        HStack {
            Circle()
                .fill(Color.spentyPrimary.opacity(0.3))
                .frame(width: 6, height: 6)

            VStack(alignment: .leading, spacing: 1) {
                Text(sub.subcategoryName ?? "Unknown")
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextPrimary)
                Text("\(sub.count ?? 0) transactions")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyTextSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 1) {
                Text(formatCurrency(abs(sub.total ?? 0)))
                    .font(SpentyFonts.footnote.weight(.medium))
                    .foregroundColor(.spentyTextPrimary)
                if categoryTotal > 0 {
                    let pct = abs(sub.total ?? 0) / categoryTotal * 100
                    Text(String(format: "%.1f%%", pct))
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyTextSecondary)
                }
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 10))
                .foregroundColor(.spentyTextSecondary)
        }
        .padding(.vertical, 6)
        .padding(.leading, 16)
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
                            .tint(Color.spentyPrimary)
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "tablecells")
                    }
                    Text(lang.s("export_csv"))
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
                    Text(lang.s("export_pdf"))
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

// MARK: - Drill-Down Data Model

struct ReportDrillDown: Identifiable {
    let id = UUID()
    let categoryId: String?
    let categoryName: String
    let subcategoryId: String?
    let subcategoryName: String?
    let transactionTypeOverride: String?

    init(categoryId: String?, categoryName: String, subcategoryId: String?, subcategoryName: String?, transactionTypeOverride: String? = nil) {
        self.categoryId = categoryId
        self.categoryName = categoryName
        self.subcategoryId = subcategoryId
        self.subcategoryName = subcategoryName
        self.transactionTypeOverride = transactionTypeOverride
    }

    var title: String {
        if let override = transactionTypeOverride {
            switch override {
            case "income": return "Income Transactions"
            case "expense": return "Expense Transactions"
            default: return "All Transactions"
            }
        }
        if let sub = subcategoryName {
            return sub
        }
        return categoryName
    }
}

// MARK: - Transaction Drill-Down View

struct ReportTransactionsView: View {
    @Environment(LocalizationManager.self) var lang
    let drillDown: ReportDrillDown
    let startDate: Date
    let endDate: Date
    let transactionType: String

    @Environment(\.dismiss) private var dismiss
    @State private var transactions: [Transaction] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var filterDateFrom: Date
    @State private var filterDateTo: Date
    @State private var showDateFilter = false
    @State private var selectedTransaction: Transaction?

    private let repository = TransactionRepository.shared
    private static let queryDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    init(drillDown: ReportDrillDown, startDate: Date, endDate: Date, transactionType: String) {
        self.drillDown = drillDown
        self.startDate = startDate
        self.endDate = endDate
        self.transactionType = transactionType
        self._filterDateFrom = State(initialValue: startDate)
        self._filterDateTo = State(initialValue: endDate)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Date filter bar
                dateFilterBar

                if isLoading {
                    Spacer()
                    ProgressView()
                        .tint(Color.spentyPrimary)
                    Spacer()
                } else if let error = errorMessage {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 32))
                            .foregroundColor(.spentyWarning)
                        Text(error)
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                    Spacer()
                } else if transactions.isEmpty {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "tray")
                            .font(.system(size: 32))
                            .foregroundColor(.spentyTextSecondary)
                        Text(lang.s("no_transactions_found"))
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextSecondary)
                    }
                    Spacer()
                } else {
                    // Summary header
                    summaryHeader

                    // Transactions list
                    List {
                        ForEach(transactions) { txn in
                            Button {
                                selectedTransaction = txn
                            } label: {
                                transactionRow(txn)
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(Color.spentyCardBg)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .background(Color.spentyBgPrimary.ignoresSafeArea())
            .navigationTitle(drillDown.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(lang.s("close")) { dismiss() }
                        .foregroundColor(.spentyPrimary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        withAnimation { showDateFilter.toggle() }
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .foregroundColor(.spentyPrimary)
                    }
                }
            }
            .task {
                await loadTransactions()
            }
            .sheet(item: $selectedTransaction) { txn in
                UnifiedTransactionForm(
                    mode: .edit(txn),
                    onComplete: { Task { await loadTransactions() } }
                )
            }
        }
    }

    private var dateFilterBar: some View {
        VStack(spacing: 0) {
            if drillDown.transactionTypeOverride != nil {
                // Tile drill-down breadcrumb
                HStack {
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyPrimary)
                    Text(drillDown.title)
                        .font(SpentyFonts.caption1.weight(.medium))
                        .foregroundColor(.spentyTextPrimary)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.spentyPrimary.opacity(0.08))
            } else if drillDown.subcategoryId == nil {
                // Show breadcrumb: Category name
                HStack {
                    Image(systemName: "folder.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyPrimary)
                    Text("All transactions in \(drillDown.categoryName)")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.spentyPrimary.opacity(0.08))
            } else {
                // Show breadcrumb: Category > Subcategory
                HStack {
                    Image(systemName: "folder.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyPrimary)
                    Text(drillDown.categoryName)
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 8))
                        .foregroundColor(.spentyTextSecondary)
                    Text(drillDown.subcategoryName ?? "")
                        .font(SpentyFonts.caption1.weight(.medium))
                        .foregroundColor(.spentyTextPrimary)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.spentyPrimary.opacity(0.08))
            }

            if showDateFilter {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(lang.s("from"))
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                        DatePicker("", selection: $filterDateFrom, displayedComponents: .date)
                            .labelsHidden()
                            .tint(Color.spentyPrimary)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(lang.s("to"))
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                        DatePicker("", selection: $filterDateTo, displayedComponents: .date)
                            .labelsHidden()
                            .tint(Color.spentyPrimary)
                    }
                    Button {
                        Task { await loadTransactions() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.spentyPrimary)
                            .cornerRadius(8)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private var summaryHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(transactions.count) transactions")
                    .font(SpentyFonts.footnote.weight(.medium))
                    .foregroundColor(.spentyTextPrimary)
                let total = transactions.reduce(0.0) { $0 + abs($1.amount ?? 0) }
                Text("\(lang.s("total")): \(formatCurrency(total))")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func transactionRow(_ txn: Transaction) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(txn.description ?? lang.s("no_description"))
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)
                if let date = txn.date {
                    Text(date, style: .date)
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyTextSecondary)
                }
            }
            Spacer()
            Text(formatCurrency(abs(txn.amount ?? 0)))
                .font(SpentyFonts.amountSmall)
                .foregroundColor(txn.transactionType == "income" ? .spentySuccess : .spentyError)
        }
        .padding(.vertical, 4)
    }

    private func loadTransactions() async {
        isLoading = true
        errorMessage = nil
        do {
            let fromStr = Self.queryDateFormatter.string(from: filterDateFrom)
            let toStr = Self.queryDateFormatter.string(from: filterDateTo)
            let typeParam: String? = transactionType == "all" ? nil : transactionType
            let response = try await repository.fetchTransactions(
                page: 1,
                limit: 500,
                type: typeParam,
                categoryId: drillDown.categoryId,
                subcategoryId: drillDown.subcategoryId,
                dateFrom: fromStr,
                dateTo: toStr,
                status: "approved"
            )
            transactions = response.transactions
        } catch {
            if let apiError = error as? APIError {
                errorMessage = apiError.localizedDescription
            } else {
                errorMessage = error.localizedDescription
            }
        }
        isLoading = false
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
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
