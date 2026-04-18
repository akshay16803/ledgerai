import SwiftUI

struct PastInsightsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = PastInsightsViewModel()
    @State private var selectedSummary: TaxSummary?

    private var currency: String {
        appState.user?.settings?.baseCurrency ?? "INR"
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                content
            }
            .background(SpentyColors.bgPrimary.ignoresSafeArea())
            .navigationTitle("Past Insights")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.showCreateForm = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(SpentyColors.brandAccent)
                    }
                }
            }
            .task {
                await viewModel.loadSummaries()
            }
            .refreshable {
                await viewModel.refresh()
            }
            .overlay {
                LoadingOverlay(isPresented: .constant(viewModel.isLoading && viewModel.summaries.isEmpty))
            }
            .sheet(isPresented: $viewModel.showCreateForm) {
                createFormSheet
            }
            .sheet(item: $selectedSummary) { summary in
                summaryDetailSheet(summary)
            }
            .alert(
                "Delete Insight",
                isPresented: .init(
                    get: { viewModel.showDeleteConfirm != nil },
                    set: { if !$0 { viewModel.showDeleteConfirm = nil } }
                ),
                presenting: viewModel.showDeleteConfirm
            ) { summary in
                Button("Delete", role: .destructive) {
                    Task { await viewModel.deleteSummary(summary.summaryId) }
                }
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = nil
                }
            } message: { _ in
                Text("Are you sure you want to delete this insight? This action cannot be undone.")
            }
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if let error = viewModel.errorMessage, viewModel.summaries.isEmpty {
            EmptyState(
                icon: "exclamationmark.triangle",
                title: "Something Went Wrong",
                message: error,
                actionTitle: "Retry"
            ) {
                Task { await viewModel.loadSummaries() }
            }
        } else if viewModel.summaries.isEmpty && !viewModel.isLoading {
            EmptyState(
                icon: "chart.bar.doc.horizontal",
                title: "No Insights Yet",
                message: "Create your first insight to get a summary of your income, expenses, and tax-related data.",
                actionTitle: "New Insight"
            ) {
                viewModel.showCreateForm = true
            }
        } else {
            summariesList
        }
    }

    // MARK: - Summaries List

    private var summariesList: some View {
        List {
            ForEach(viewModel.summaries) { summary in
                summaryRow(summary)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if summary.status == "ready" {
                            selectedSummary = summary
                        }
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            viewModel.showDeleteConfirm = summary
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    private func summaryRow(_ summary: TaxSummary) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack {
                    Text(summary.name ?? "Untitled")
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    statusBadge(for: summary.status)
                }

                // Date range
                if let from = summary.dateFrom, let to = summary.dateTo {
                    HStack(spacing: SpentySpacing.xs) {
                        Image(systemName: "calendar")
                            .font(.system(size: 11))
                        Text("\(DateFormatting.shortDate(from: from)) - \(DateFormatting.shortDate(from: to))")
                            .font(SpentyFonts.caption)
                    }
                    .foregroundStyle(SpentyColors.textMuted)
                }

                // Totals if ready
                if summary.status == "ready", let totals = summary.totals {
                    Divider().overlay(SpentyColors.borderSubtle)

                    HStack(spacing: SpentySpacing.lg) {
                        totalItem(label: "Income", amount: totals.income, color: SpentyColors.success)
                        totalItem(label: "Expense", amount: totals.expense, color: SpentyColors.danger)
                        totalItem(label: "Net", amount: totals.net, color: SpentyColors.brandAccent)
                    }
                }

                // Provider info
                if let provider = summary.provider {
                    HStack(spacing: SpentySpacing.xs) {
                        Image(systemName: "server.rack")
                            .font(.system(size: 11))
                        Text(provider)
                            .font(SpentyFonts.caption)
                    }
                    .foregroundStyle(SpentyColors.textMuted)
                }
            }
        }
        .shimmer(isActive: summary.status == "processing")
        .padding(.horizontal, SpentySpacing.lg)
        .padding(.vertical, SpentySpacing.xs)
    }

    @ViewBuilder
    private func statusBadge(for status: String?) -> some View {
        switch status {
        case "processing":
            StatusBadge(.processing)
        case "ready":
            StatusBadge(.active)
        case "failed":
            StatusBadge(.failed)
        default:
            StatusBadge(.pending)
        }
    }

    private func totalItem(label: String, amount: Double?, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textMuted)

            if let amount {
                MoneyText(amount, currency: currency, size: SpentyFonts.caption)
            } else {
                Text("--")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
            }
        }
    }

    // MARK: - Create Form Sheet

    private var createFormSheet: some View {
        NavigationStack {
            Form {
                Section("Insight Details") {
                    TextField("Name", text: $viewModel.formName)
                        .font(SpentyFonts.body)
                }

                Section("Date Range") {
                    DatePicker("From", selection: $viewModel.formDateFrom, displayedComponents: .date)
                        .font(SpentyFonts.body)

                    DatePicker("To", selection: $viewModel.formDateTo, displayedComponents: .date)
                        .font(SpentyFonts.body)
                }

                Section("Source") {
                    TextField("Email Address", text: $viewModel.formSelectedEmail)
                        .font(SpentyFonts.body)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)

                    Picker("Provider", selection: $viewModel.formSelectedProvider) {
                        Text("Select Provider").tag("")
                        Text("Gmail").tag("gmail")
                        Text("Outlook").tag("outlook")
                        Text("Yahoo").tag("yahoo")
                        Text("Other").tag("other")
                    }
                    .font(SpentyFonts.body)
                }
            }
            .scrollContentBackground(.hidden)
            .background(SpentyColors.bgPrimary)
            .navigationTitle("New Insight")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        viewModel.showCreateForm = false
                    }
                    .foregroundStyle(SpentyColors.textSecondary)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") {
                        Task { await viewModel.createSummary() }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(SpentyColors.brandAccent)
                    .disabled(!viewModel.isFormValid || viewModel.isCreating)
                }
            }
            .overlay {
                LoadingOverlay(isPresented: .constant(viewModel.isCreating))
            }
        }
    }

    // MARK: - Detail Sheet

    private func summaryDetailSheet(_ summary: TaxSummary) -> some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: SpentySpacing.lg) {
                    // Header
                    SpentyCard {
                        VStack(alignment: .leading, spacing: SpentySpacing.md) {
                            Text(summary.name ?? "Untitled")
                                .font(SpentyFonts.heading)
                                .foregroundStyle(SpentyColors.textPrimary)

                            if let from = summary.dateFrom, let to = summary.dateTo {
                                HStack(spacing: SpentySpacing.xs) {
                                    Image(systemName: "calendar")
                                        .font(.system(size: 12))
                                    Text("\(DateFormatting.shortDate(from: from)) - \(DateFormatting.shortDate(from: to))")
                                        .font(SpentyFonts.body)
                                }
                                .foregroundStyle(SpentyColors.textSecondary)
                            }

                            if let email = summary.emailAddress {
                                HStack(spacing: SpentySpacing.xs) {
                                    Image(systemName: "envelope")
                                        .font(.system(size: 12))
                                    Text(email)
                                        .font(SpentyFonts.body)
                                }
                                .foregroundStyle(SpentyColors.textSecondary)
                            }
                        }
                    }

                    // Totals breakdown
                    if let totals = summary.totals {
                        SectionHeader("Summary Breakdown")

                        HStack(spacing: SpentySpacing.md) {
                            StatCard(
                                title: "Income",
                                value: formatCurrency(totals.income),
                                icon: "arrow.down.circle.fill",
                                iconColor: SpentyColors.success
                            )

                            StatCard(
                                title: "Expense",
                                value: formatCurrency(totals.expense),
                                icon: "arrow.up.circle.fill",
                                iconColor: SpentyColors.danger
                            )
                        }

                        StatCard(
                            title: "Net",
                            value: formatCurrency(totals.net),
                            icon: "equal.circle.fill",
                            iconColor: SpentyColors.brandAccent
                        )
                    }

                    // Export button
                    PrimaryButton(
                        "Share / Export",
                        icon: "square.and.arrow.up",
                        isFullWidth: true
                    ) {
                        // Export action handled via share sheet
                    }
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
            .background(SpentyColors.bgPrimary.ignoresSafeArea())
            .navigationTitle("Insight Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        selectedSummary = nil
                    }
                    .foregroundStyle(SpentyColors.brandAccent)
                }
            }
        }
    }

    // MARK: - Helpers

    private func formatCurrency(_ amount: Double?) -> String {
        guard let amount else { return "--" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        if currency == "INR" {
            formatter.locale = Locale(identifier: "en_IN")
        }
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }
}

#Preview {
    PastInsightsView()
        .environment(AppState())
}
