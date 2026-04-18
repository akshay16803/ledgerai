import SwiftUI
import Charts

struct CashFlowView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CashFlowViewModel()

    private let statsColumns = [
        GridItem(.flexible(), spacing: SpentySpacing.md),
        GridItem(.flexible(), spacing: SpentySpacing.md)
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        statsGridSection
                        projectionChartSection
                        odInterestSection
                        recurringItemsSection
                        mandatesSection
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.vertical, SpentySpacing.md)
                    .padding(.bottom, 80)
                }
                .refreshable {
                    await viewModel.refresh()
                }
                .shimmer(isActive: viewModel.isLoading && viewModel.projection == nil)

                // FAB to add mandate
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button {
                            viewModel.showAddMandate = true
                        } label: {
                            Image(systemName: "plus")
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(.white)
                                .frame(width: 56, height: 56)
                                .background(SpentyColors.brandPrimary)
                                .clipShape(Circle())
                                .shadow(color: SpentyColors.brandPrimary.opacity(0.3), radius: 8, y: 4)
                        }
                        .padding(.trailing, SpentySpacing.lg)
                        .padding(.bottom, SpentySpacing.lg)
                    }
                }
            }
            .background(SpentyColors.bgPrimary)
            .navigationTitle("Cash Flow")
            .task {
                if viewModel.projection == nil {
                    await viewModel.loadAll()
                }
            }
            .overlay {
                LoadingOverlay(isPresented: .constant(viewModel.isSaving))
            }
            .sheet(isPresented: $viewModel.showAddMandate) {
                MandateFormSheet(
                    editingMandate: nil,
                    onSaved: { body in
                        Task { await viewModel.createMandate(body) }
                    }
                )
            }
            .sheet(item: $viewModel.showEditMandate) { mandate in
                MandateFormSheet(
                    editingMandate: mandate,
                    onSaved: { body in
                        Task { await viewModel.updateMandate(mandate.mandateId, body) }
                    }
                )
            }
            .alert("Delete Mandate", isPresented: .init(
                get: { viewModel.showDeleteConfirm != nil },
                set: { if !$0 { viewModel.showDeleteConfirm = nil } }
            )) {
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = nil
                }
                Button("Delete", role: .destructive) {
                    if let mandate = viewModel.showDeleteConfirm {
                        Task { await viewModel.deleteMandate(mandate.mandateId) }
                    }
                }
            } message: {
                if let mandate = viewModel.showDeleteConfirm {
                    Text("Are you sure you want to delete the mandate for \(mandate.merchant ?? "this merchant")?")
                }
            }
        }
    }

    // MARK: - Stats Grid

    @ViewBuilder
    private var statsGridSection: some View {
        let proj = viewModel.projection
        let mandateTotal = proj?.mandateItems?.compactMap(\.amount).reduce(0, +) ?? 0
        let odTotal = proj?.odInterestItems?.compactMap(\.estimatedInterest).reduce(0, +) ?? 0
        let monthlyNet = proj?.monthlyNet ?? 0

        LazyVGrid(columns: statsColumns, spacing: SpentySpacing.md) {
            StatCard(
                title: "Monthly Income",
                value: formatCurrency(proj?.monthlyIncome),
                subtitle: "Inflows",
                icon: "arrow.down.circle",
                iconColor: SpentyColors.success
            )

            StatCard(
                title: "Monthly Expense",
                value: formatCurrency(proj?.monthlyExpense),
                subtitle: "Outflows",
                icon: "arrow.up.circle",
                iconColor: SpentyColors.danger
            )

            StatCard(
                title: "Monthly Mandates",
                value: formatCurrency(mandateTotal),
                subtitle: "Auto-debits",
                icon: "arrow.triangle.2.circlepath",
                iconColor: SpentyColors.info
            )

            StatCard(
                title: "OD Interest",
                value: formatCurrency(odTotal),
                subtitle: "Estimated",
                icon: "percent",
                iconColor: SpentyColors.warning
            )
        }

        // Full-width net card
        StatCard(
            title: "Monthly Net",
            value: formatCurrency(monthlyNet),
            subtitle: monthlyNet >= 0 ? "Surplus" : "Deficit",
            icon: monthlyNet >= 0 ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis",
            iconColor: monthlyNet >= 0 ? SpentyColors.success : SpentyColors.danger
        )
    }

    // MARK: - 24-Month Projection Chart

    @ViewBuilder
    private var projectionChartSection: some View {
        if let entries = viewModel.projection?.projection, !entries.isEmpty {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                SectionHeader( "24-Month Projection", actionTitle: nil, action: nil)

                SpentyCard {
                    ScrollView(.horizontal, showsIndicators: false) {
                        Chart {
                            ForEach(Array(entries.enumerated()), id: \.offset) { index, entry in
                                let label = entry.label ?? entry.month ?? "M\(index + 1)"

                                BarMark(
                                    x: .value("Month", label),
                                    y: .value("Amount", entry.projectedIncome ?? 0)
                                )
                                .foregroundStyle(SpentyColors.success)
                                .position(by: .value("Type", "Income"))

                                BarMark(
                                    x: .value("Month", label),
                                    y: .value("Amount", entry.projectedExpense ?? 0)
                                )
                                .foregroundStyle(SpentyColors.danger)
                                .position(by: .value("Type", "Expense"))
                            }
                        }
                        .chartForegroundStyleScale([
                            "Income": SpentyColors.success,
                            "Expense": SpentyColors.danger
                        ])
                        .chartLegend(position: .top, alignment: .leading)
                        .chartYAxis {
                            AxisMarks(position: .leading) { value in
                                AxisGridLine()
                                AxisValueLabel {
                                    if let amount = value.as(Double.self) {
                                        Text(shortCurrency(amount))
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textMuted)
                                    }
                                }
                            }
                        }
                        .chartXAxis {
                            AxisMarks { value in
                                AxisValueLabel {
                                    if let label = value.as(String.self) {
                                        Text(label)
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textMuted)
                                            .rotationEffect(.degrees(-45))
                                    }
                                }
                            }
                        }
                        .frame(width: max(CGFloat(entries.count) * 60, 300), height: 250)
                    }
                }
            }
        }
    }

    // MARK: - OD Interest Section

    @ViewBuilder
    private var odInterestSection: some View {
        if let items = viewModel.projection?.odInterestItems, !items.isEmpty {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                SectionHeader( "OD Interest", actionTitle: nil, action: nil)

                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    SpentyCard {
                        HStack {
                            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                Text(item.accountName ?? "Account")
                                    .font(SpentyFonts.body)
                                    .foregroundStyle(SpentyColors.textPrimary)
                            }
                            Spacer()
                            Text(formatCurrency(item.estimatedInterest))
                                .font(SpentyFonts.stat)
                                .foregroundStyle(SpentyColors.warning)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Recurring Items Section

    @ViewBuilder
    private var recurringItemsSection: some View {
        if let items = viewModel.projection?.recurringItems, !items.isEmpty {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                SectionHeader( "Recurring Items", actionTitle: nil, action: nil)

                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    SpentyCard {
                        HStack {
                            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                Text(item.description ?? "Untitled")
                                    .font(SpentyFonts.body)
                                    .foregroundStyle(SpentyColors.textPrimary)

                                HStack(spacing: SpentySpacing.sm) {
                                    Text(item.frequency ?? "")
                                        .font(SpentyFonts.caption)
                                        .foregroundStyle(SpentyColors.textMuted)

                                    if let type = item.type {
                                        Text(type.capitalized)
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(type == "income" ? SpentyColors.success : SpentyColors.danger)
                                            .padding(.horizontal, SpentySpacing.sm)
                                            .padding(.vertical, 2)
                                            .background(
                                                (type == "income" ? SpentyColors.success : SpentyColors.danger)
                                                    .opacity(0.1)
                                            )
                                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.sm))
                                    }
                                }
                            }
                            Spacer()
                            Text(formatCurrency(item.amount))
                                .font(SpentyFonts.stat)
                                .foregroundStyle(
                                    item.type == "income" ? SpentyColors.success : SpentyColors.danger
                                )
                        }
                    }
                }
            }
        }
    }

    // MARK: - Mandates Section

    @ViewBuilder
    private var mandatesSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader(
                title: "Mandates",
                actionTitle: "Add",
                action: { viewModel.showAddMandate = true }
            )

            if viewModel.mandates.isEmpty && !viewModel.isLoading {
                EmptyState(
                    icon: "doc.text.magnifyingglass",
                    title: "No Mandates",
                    message: "Add mandates to track your recurring auto-debits."
                )
            } else {
                ForEach(viewModel.mandates) { mandate in
                    SpentyCard {
                        HStack {
                            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                Text(mandate.merchant ?? "Unknown Merchant")
                                    .font(SpentyFonts.body)
                                    .foregroundStyle(SpentyColors.textPrimary)

                                HStack(spacing: SpentySpacing.sm) {
                                    if let frequency = mandate.frequency {
                                        Text(frequency.capitalized)
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textMuted)
                                    }

                                    if let day = mandate.debitDay {
                                        Text("Day \(day)")
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textSecondary)
                                    }

                                    if let status = mandate.status {
                                        Text(status.capitalized)
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(statusColor(status))
                                            .padding(.horizontal, SpentySpacing.sm)
                                            .padding(.vertical, 2)
                                            .background(statusColor(status).opacity(0.1))
                                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.sm))
                                    }
                                }
                            }
                            Spacer()
                            Text(formatCurrency(mandate.amount))
                                .font(SpentyFonts.stat)
                                .foregroundStyle(SpentyColors.textPrimary)
                        }
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            viewModel.showDeleteConfirm = mandate
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }

                        Button {
                            viewModel.showEditMandate = mandate
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        .tint(SpentyColors.info)
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private func formatCurrency(_ amount: Double?) -> String {
        guard let amount else { return "--" }
        return CurrencyFormatter.format(
            amount: amount,
            currencyCode: appState.user?.settings?.baseCurrency ?? "INR"
        )
    }

    private func formatCurrency(_ amount: Double) -> String {
        CurrencyFormatter.format(
            amount: amount,
            currencyCode: appState.user?.settings?.baseCurrency ?? "INR"
        )
    }

    private func shortCurrency(_ amount: Double) -> String {
        if abs(amount) >= 10_000_000 {
            return String(format: "%.1fCr", amount / 10_000_000)
        } else if abs(amount) >= 100_000 {
            return String(format: "%.1fL", amount / 100_000)
        } else if abs(amount) >= 1_000 {
            return String(format: "%.1fK", amount / 1_000)
        }
        return String(format: "%.0f", amount)
    }

    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "active": return SpentyColors.success
        case "paused", "pending": return SpentyColors.warning
        case "cancelled", "expired": return SpentyColors.danger
        default: return SpentyColors.textMuted
        }
    }
}
