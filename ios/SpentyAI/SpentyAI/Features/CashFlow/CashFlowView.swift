import SwiftUI

enum CashFlowDrillDown: Identifiable {
    case income, expense, mandates, odInterest, net, emi

    var id: String {
        switch self {
        case .income: return "income"
        case .expense: return "expense"
        case .mandates: return "mandates"
        case .odInterest: return "odInterest"
        case .net: return "net"
        case .emi: return "emi"
        }
    }

    var title: String {
        switch self {
        case .income: return "Monthly Income Items"
        case .expense: return "Monthly Expense Items"
        case .mandates: return "Active Mandates"
        case .odInterest: return "OD Interest Breakdown"
        case .net: return "Monthly Net Summary"
        case .emi: return "EMI Schedule"
        }
    }
}

struct CashFlowView: View {

    @State private var viewModel = CashFlowViewModel()
    @State private var activeDrillDown: CashFlowDrillDown?

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
            .sheet(item: $activeDrillDown) { drillDown in
                CashFlowDrillDownSheet(
                    drillDown: drillDown,
                    viewModel: viewModel
                )
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
            Button { activeDrillDown = .income } label: {
                StatCard(
                    label: "Monthly Income",
                    value: formatCurrency(viewModel.monthlyIncome),
                    icon: "arrow.down.circle.fill",
                    color: .spentySuccess
                )
            }
            .buttonStyle(.plain)

            Button { activeDrillDown = .expense } label: {
                StatCard(
                    label: "Monthly Expense",
                    value: formatCurrency(viewModel.monthlyExpense),
                    icon: "arrow.up.circle.fill",
                    color: .spentyAccent1
                )
            }
            .buttonStyle(.plain)

            Button { activeDrillDown = .mandates } label: {
                StatCard(
                    label: "Monthly Mandates",
                    value: formatCurrency(viewModel.monthlyMandates),
                    icon: "doc.text.fill",
                    color: .spentyWarning
                )
            }
            .buttonStyle(.plain)

            Button { activeDrillDown = .odInterest } label: {
                StatCard(
                    label: "OD Interest",
                    value: formatCurrency(viewModel.monthlyODInterest),
                    icon: "percent",
                    color: .spentyError
                )
            }
            .buttonStyle(.plain)

            Button { activeDrillDown = .emi } label: {
                StatCard(
                    label: "Monthly EMI",
                    value: formatCurrency(viewModel.monthlyEMI),
                    icon: "creditcard.fill",
                    color: .spentyAccent3
                )
            }
            .buttonStyle(.plain)

            Button { activeDrillDown = .net } label: {
                StatCard(
                    label: "Monthly Net",
                    value: formatCurrency(viewModel.monthlyNet),
                    icon: "equal.circle.fill",
                    color: viewModel.monthlyNet >= 0 ? .spentySuccess : .spentyError
                )
            }
            .buttonStyle(.plain)
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

// MARK: - Drill-Down Sheet

// MARK: - Detail Item Types for non-transaction sheets

enum DrillDownDetailItem: Identifiable {
    case mandate(MandateItem)
    case emi(EMIItem)
    case odInterest(ODInterestItem)

    var id: String {
        switch self {
        case .mandate(let item): return "mandate-\(item.id)"
        case .emi(let item): return "emi-\(item.id)"
        case .odInterest(let item): return "od-\(item.id)"
        }
    }
}

struct CashFlowDrillDownSheet: View {

    let drillDown: CashFlowDrillDown
    let viewModel: CashFlowViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTransaction: Transaction?
    @State private var isLoadingTransaction = false
    @State private var selectedDetailItem: DrillDownDetailItem?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 12) {
                        switch drillDown {
                        case .income:
                            incomeList
                        case .expense:
                            expenseList
                        case .mandates:
                            mandatesList
                        case .odInterest:
                            odInterestList
                        case .net:
                            netSummary
                        case .emi:
                            emiList
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle(drillDown.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyPrimary)
                }
            }
            .overlay {
                if isLoadingTransaction {
                    ZStack {
                        Color.black.opacity(0.3).ignoresSafeArea()
                        VStack(spacing: 12) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .spentyPrimary))
                                .scaleEffect(1.2)
                            Text("Loading transaction...")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                        }
                        .padding(24)
                        .background(Color.spentyCardBg)
                        .cornerRadius(16)
                    }
                }
            }
            .sheet(item: $selectedTransaction) { transaction in
                UnifiedTransactionForm(mode: .edit(transaction))
            }
            .sheet(item: $selectedDetailItem) { detailItem in
                detailSheet(for: detailItem)
            }
        }
    }

    // MARK: - Income Items

    private var incomeList: some View {
        Group {
            if viewModel.incomeItems.isEmpty {
                emptyState(icon: "arrow.down.circle", message: "No recurring income items found")
            } else {
                ForEach(viewModel.incomeItems) { item in
                    recurringItemButton(item, color: .spentySuccess)
                }
            }
        }
    }

    // MARK: - Expense Items

    private var expenseList: some View {
        Group {
            if viewModel.expenseItems.isEmpty {
                emptyState(icon: "arrow.up.circle", message: "No recurring expense items found")
            } else {
                ForEach(viewModel.expenseItems) { item in
                    recurringItemButton(item, color: .spentyError)
                }
            }
        }
    }

    // MARK: - Mandates List

    private var mandatesList: some View {
        Group {
            if viewModel.mandateItemsList.isEmpty {
                emptyState(icon: "doc.text", message: "No active mandates")
            } else {
                ForEach(viewModel.mandateItemsList) { item in
                    Button {
                        selectedDetailItem = .mandate(item)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.merchant ?? "Unknown Merchant")
                                    .font(SpentyFonts.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.spentyTextPrimary)

                                HStack(spacing: 6) {
                                    if let type = item.mandateType, !type.isEmpty {
                                        Text(type.capitalized)
                                            .font(SpentyFonts.caption1)
                                            .foregroundColor(.spentyTextSecondary)
                                    }
                                    if let freq = item.frequency, !freq.isEmpty {
                                        Text("·")
                                            .foregroundColor(.spentyTextSecondary)
                                        Text(freq.capitalized)
                                            .font(SpentyFonts.caption1)
                                            .foregroundColor(.spentyTextSecondary)
                                    }
                                }
                            }

                            Spacer()

                            VStack(alignment: .trailing, spacing: 2) {
                                CurrencyText(
                                    amount: item.amount ?? 0,
                                    font: SpentyFonts.amountSmall,
                                    color: .spentyWarning
                                )
                                if let monthly = item.monthlyEquivalent, monthly != item.amount {
                                    Text("\(formatCurrency(monthly))/mo")
                                        .font(SpentyFonts.caption2)
                                        .foregroundColor(.spentyTextSecondary)
                                }
                            }

                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.spentyTextSecondary.opacity(0.5))
                                .padding(.leading, 4)
                        }
                        .padding(12)
                        .background(Color.spentyCardBg)
                        .cornerRadius(12)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - OD Interest List

    private var odInterestList: some View {
        Group {
            if viewModel.odInterestItemsList.isEmpty {
                emptyState(icon: "percent", message: "No overdraft interest charges")
            } else {
                ForEach(viewModel.odInterestItemsList) { item in
                    Button {
                        selectedDetailItem = .odInterest(item)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.accountName ?? "OD Account")
                                    .font(SpentyFonts.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.spentyTextPrimary)

                                if let rate = item.rate {
                                    Text("Rate: \(String(format: "%.2f", rate))%")
                                        .font(SpentyFonts.caption1)
                                        .foregroundColor(.spentyTextSecondary)
                                }

                                if let balance = item.balance {
                                    Text("Balance: \(formatCurrency(balance))")
                                        .font(SpentyFonts.caption1)
                                        .foregroundColor(.spentyTextSecondary)
                                }
                            }

                            Spacer()

                            CurrencyText(
                                amount: item.monthlyInterest ?? 0,
                                font: SpentyFonts.amountSmall,
                                color: .spentyError
                            )

                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.spentyTextSecondary.opacity(0.5))
                                .padding(.leading, 4)
                        }
                        .padding(12)
                        .background(Color.spentyCardBg)
                        .cornerRadius(12)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - EMI List

    private var emiList: some View {
        Group {
            if viewModel.emiItemsList.isEmpty {
                emptyState(icon: "creditcard", message: "No active EMIs")
            } else {
                ForEach(viewModel.emiItemsList) { item in
                    Button {
                        selectedDetailItem = .emi(item)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.accountName ?? "Loan Account")
                                    .font(SpentyFonts.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.spentyTextPrimary)

                                HStack(spacing: 6) {
                                    if let day = item.emiDay {
                                        Text("Due: \(ordinal(day)) of month")
                                            .font(SpentyFonts.caption1)
                                            .foregroundColor(.spentyTextSecondary)
                                    }
                                }

                                HStack(spacing: 6) {
                                    if let rate = item.loanInterestRate {
                                        Text("\(String(format: "%.1f", rate))% p.a.")
                                            .font(SpentyFonts.caption1)
                                            .foregroundColor(.spentyTextSecondary)
                                    }
                                    if let tenure = item.loanTenureMonths {
                                        Text("·")
                                            .foregroundColor(.spentyTextSecondary)
                                        Text("\(tenure) months")
                                            .font(SpentyFonts.caption1)
                                            .foregroundColor(.spentyTextSecondary)
                                    }
                                }
                            }

                            Spacer()

                            CurrencyText(
                                amount: item.emiAmount ?? 0,
                                font: SpentyFonts.amountSmall,
                                color: .spentyAccent3
                            )

                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.spentyTextSecondary.opacity(0.5))
                                .padding(.leading, 4)
                        }
                        .padding(12)
                        .background(Color.spentyCardBg)
                        .cornerRadius(12)
                    }
                    .buttonStyle(.plain)
                }

                // Total row
                HStack {
                    Text("Total Monthly EMI")
                        .font(SpentyFonts.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.spentyTextPrimary)
                    Spacer()
                    CurrencyText(
                        amount: viewModel.monthlyEMI,
                        font: SpentyFonts.amountMedium,
                        color: .spentyAccent3
                    )
                }
                .padding(12)
                .background(Color.spentyPrimary.opacity(0.08))
                .cornerRadius(12)
            }
        }
    }

    // MARK: - Net Summary

    private var netSummary: some View {
        VStack(spacing: 12) {
            summaryRow(label: "Recurring Income", amount: viewModel.monthlyIncome, color: .spentySuccess, prefix: "+")
            summaryRow(label: "Recurring Expense", amount: viewModel.monthlyExpense, color: .spentyError, prefix: "-")
            summaryRow(label: "Mandates", amount: viewModel.monthlyMandates, color: .spentyWarning, prefix: "-")
            summaryRow(label: "OD Interest", amount: viewModel.monthlyODInterest, color: .spentyError, prefix: "-")

            Divider().background(Color.spentyBorder)

            HStack {
                Text("Net Cash Flow")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)
                Spacer()
                Text(formatCurrency(viewModel.monthlyNet))
                    .font(SpentyFonts.amountMedium)
                    .foregroundColor(viewModel.monthlyNet >= 0 ? .spentySuccess : .spentyError)
            }
            .padding(12)
            .background(Color.spentyPrimary.opacity(0.08))
            .cornerRadius(12)
        }
    }

    // MARK: - Helpers

    private func recurringItemButton(_ item: RecurringItem, color: Color) -> some View {
        Button {
            guard let transactionId = item.transactionId, !transactionId.isEmpty else { return }
            isLoadingTransaction = true
            Task {
                do {
                    let transaction = try await TransactionRepository.shared.fetchTransaction(id: transactionId)
                    await MainActor.run {
                        isLoadingTransaction = false
                        selectedTransaction = transaction
                    }
                } catch {
                    await MainActor.run {
                        isLoadingTransaction = false
                    }
                }
            }
        } label: {
            recurringItemRow(item, color: color)
        }
        .buttonStyle(.plain)
        .disabled(item.transactionId == nil || (item.transactionId?.isEmpty ?? true))
        .opacity(item.transactionId != nil && !(item.transactionId?.isEmpty ?? true) ? 1.0 : 0.7)
    }

    private func recurringItemRow(_ item: RecurringItem, color: Color) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.description ?? "Unnamed")
                    .font(SpentyFonts.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.spentyTextPrimary)

                if let freq = item.effectiveFrequency, !freq.isEmpty {
                    Text(freq.capitalized)
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                CurrencyText(
                    amount: item.amount ?? 0,
                    font: SpentyFonts.amountSmall,
                    color: color
                )
                if let monthly = item.monthlyAmount, monthly != item.amount {
                    Text("\(formatCurrency(monthly))/mo")
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyTextSecondary)
                }
            }

            if item.transactionId != nil && !(item.transactionId?.isEmpty ?? true) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.spentyTextSecondary.opacity(0.5))
                    .padding(.leading, 4)
            }
        }
        .padding(12)
        .background(Color.spentyCardBg)
        .cornerRadius(12)
    }

    private func summaryRow(label: String, amount: Double, color: Color, prefix: String) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextPrimary)
            Spacer()
            Text("\(prefix)\(formatCurrency(amount))")
                .font(SpentyFonts.subheadline)
                .fontWeight(.medium)
                .foregroundColor(color)
        }
        .padding(12)
        .background(Color.spentyCardBg)
        .cornerRadius(12)
    }

    private func emptyState(icon: String, message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundColor(.spentyTextSecondary.opacity(0.5))
            Text(message)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Detail Sheets

    @ViewBuilder
    private func detailSheet(for item: DrillDownDetailItem) -> some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                ScrollView {
                    switch item {
                    case .mandate(let mandate):
                        mandateDetailContent(mandate)
                    case .emi(let emi):
                        emiDetailContent(emi)
                    case .odInterest(let od):
                        odDetailContent(od)
                    }
                }
            }
            .navigationTitle(detailSheetTitle(for: item))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { selectedDetailItem = nil }
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyPrimary)
                }
            }
        }
    }

    private func detailSheetTitle(for item: DrillDownDetailItem) -> String {
        switch item {
        case .mandate: return "Mandate Details"
        case .emi: return "EMI Details"
        case .odInterest: return "OD Interest Details"
        }
    }

    private func mandateDetailContent(_ item: MandateItem) -> some View {
        VStack(spacing: 16) {
            // Header card
            VStack(spacing: 12) {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 36))
                    .foregroundColor(.spentyWarning)

                Text(item.merchant ?? "Unknown Merchant")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                CurrencyText(
                    amount: item.amount ?? 0,
                    font: SpentyFonts.amountLarge,
                    color: .spentyWarning
                )

                if let monthly = item.monthlyEquivalent, monthly != item.amount {
                    Text("\(formatCurrency(monthly))/mo equivalent")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(20)
            .background(Color.spentyCardBg)
            .cornerRadius(12)

            // Info rows
            VStack(spacing: 0) {
                if let type = item.mandateType, !type.isEmpty {
                    detailInfoRow(label: "Type", value: type.capitalized, icon: "tag.fill")
                    Divider().padding(.leading, 44)
                }

                if let freq = item.frequency, !freq.isEmpty {
                    detailInfoRow(label: "Frequency", value: freq.capitalized, icon: "calendar.badge.clock")
                    Divider().padding(.leading, 44)
                }

                if let source = item.source, !source.isEmpty {
                    detailInfoRow(label: "Source", value: source, icon: "building.columns.fill")
                    Divider().padding(.leading, 44)
                }

                if let mandateId = item.mandateId, !mandateId.isEmpty {
                    detailInfoRow(label: "Mandate ID", value: mandateId, icon: "number")
                }
            }
            .background(Color.spentyCardBg)
            .cornerRadius(12)

            // View Latest Transaction button
            if let merchant = item.merchant, !merchant.isEmpty {
                Button {
                    selectedDetailItem = nil
                    isLoadingTransaction = true
                    Task {
                        do {
                            let result = try await TransactionRepository.shared.search(
                                query: merchant,
                                page: 1,
                                limit: 1
                            )
                            await MainActor.run {
                                isLoadingTransaction = false
                                if let first = result.transactions.first {
                                    selectedTransaction = first
                                }
                            }
                        } catch {
                            await MainActor.run {
                                isLoadingTransaction = false
                            }
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: "doc.text.image")
                            .font(.system(size: 14, weight: .medium))
                        Text("View Latest Transaction")
                            .font(SpentyFonts.subheadline)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.spentyPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(Color.spentyPrimary.opacity(0.1))
                    .cornerRadius(12)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
    }

    private func emiDetailContent(_ item: EMIItem) -> some View {
        VStack(spacing: 16) {
            // Header card
            VStack(spacing: 12) {
                Image(systemName: "creditcard.fill")
                    .font(.system(size: 36))
                    .foregroundColor(.spentyAccent3)

                Text(item.accountName ?? "Loan Account")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                CurrencyText(
                    amount: item.emiAmount ?? 0,
                    font: SpentyFonts.amountLarge,
                    color: .spentyAccent3
                )

                Text("Monthly EMI")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(20)
            .background(Color.spentyCardBg)
            .cornerRadius(12)

            // Info rows
            VStack(spacing: 0) {
                if let day = item.emiDay {
                    detailInfoRow(label: "Due Date", value: "\(ordinal(day)) of every month", icon: "calendar")
                    Divider().padding(.leading, 44)
                }

                if let rate = item.loanInterestRate {
                    detailInfoRow(label: "Interest Rate", value: "\(String(format: "%.2f", rate))% p.a.", icon: "percent")
                    Divider().padding(.leading, 44)
                }

                if let tenure = item.loanTenureMonths {
                    detailInfoRow(label: "Loan Tenure", value: "\(tenure) months", icon: "clock.fill")
                    Divider().padding(.leading, 44)
                }

                if let accountId = item.accountId, !accountId.isEmpty {
                    detailInfoRow(label: "Account ID", value: accountId, icon: "number")
                }
            }
            .background(Color.spentyCardBg)
            .cornerRadius(12)
        }
        .padding(16)
    }

    private func odDetailContent(_ item: ODInterestItem) -> some View {
        VStack(spacing: 16) {
            // Header card
            VStack(spacing: 12) {
                Image(systemName: "percent")
                    .font(.system(size: 36))
                    .foregroundColor(.spentyError)

                Text(item.accountName ?? "OD Account")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                CurrencyText(
                    amount: item.monthlyInterest ?? 0,
                    font: SpentyFonts.amountLarge,
                    color: .spentyError
                )

                Text("Monthly Interest Charge")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(20)
            .background(Color.spentyCardBg)
            .cornerRadius(12)

            // Info rows
            VStack(spacing: 0) {
                if let rate = item.rate {
                    detailInfoRow(label: "Interest Rate", value: "\(String(format: "%.2f", rate))%", icon: "percent")
                    Divider().padding(.leading, 44)
                }

                if let balance = item.balance {
                    detailInfoRow(label: "Outstanding Balance", value: formatCurrency(balance), icon: "indianrupeesign.circle.fill")
                    Divider().padding(.leading, 44)
                }

                if let accountId = item.accountId, !accountId.isEmpty {
                    detailInfoRow(label: "Account ID", value: accountId, icon: "number")
                }
            }
            .background(Color.spentyCardBg)
            .cornerRadius(12)
        }
        .padding(16)
    }

    private func detailInfoRow(label: String, value: String, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(.spentyPrimary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                Text(value)
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "₹0.00"
    }

    private func ordinal(_ day: Int) -> String {
        let suffix: String
        switch day {
        case 1, 21, 31: suffix = "st"
        case 2, 22: suffix = "nd"
        case 3, 23: suffix = "rd"
        default: suffix = "th"
        }
        return "\(day)\(suffix)"
    }
}

// MARK: - Preview

#Preview {
    CashFlowView()
}
