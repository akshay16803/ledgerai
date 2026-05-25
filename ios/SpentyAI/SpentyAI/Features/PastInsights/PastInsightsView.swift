import SwiftUI

struct PastInsightsView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @Environment(AuthManager.self) var authManager
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = PastInsightsViewModel()

    // Premium gate — Past Insights is the paid Premium tier.
    @State private var showPremiumSheet = false
    @State private var justSubscribed = false

    private var hasPremium: Bool {
        authManager.user?.hasActiveSubscription == true
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            Group {
                if viewModel.isLoading && viewModel.summaries.isEmpty {
                    LoadingView(message: "Loading past insight summaries...")
                } else if viewModel.summaries.isEmpty && !viewModel.isLoading {
                    emptyState
                } else {
                    summaryList
                }
            }
        }
        .navigationTitle(lang.s("past_insights"))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.startCreate()
                    Task { await viewModel.loadAvailableEmails() }
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                }
                .tint(Color.spentyPrimary)
            }
        }
        .sheet(isPresented: $viewModel.showCreateForm) {
            createFormSheet
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button(lang.s("ok")) { viewModel.dismissError() }
        } message: {
            Text(viewModel.errorMessage)
        }
        .task {
            if !hasPremium {
                showPremiumSheet = true
            }
            await viewModel.loadSummaries()
        }
        .sheet(isPresented: $showPremiumSheet, onDismiss: {
            if !justSubscribed && !hasPremium { dismiss() }
        }) {
            PremiumFeatureSheet.pastInsights(
                onClose: { showPremiumSheet = false },
                onSubscribed: { justSubscribed = true }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled(false)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        EmptyStateView(
            icon: "doc.text.magnifyingglass",
            title: lang.s("no_past_insights"),
            subtitle: "Create a past insight summary to analyze your income and expenses over a date range.",
            buttonTitle: lang.s("generate_insight")
        ) {
            viewModel.startCreate()
            Task { await viewModel.loadAvailableEmails() }
        }
    }

    // MARK: - Summary List

    private var summaryList: some View {
        List {
            ForEach(viewModel.summaries) { summary in
                NavigationLink {
                    PastInsightDetailView(viewModel: viewModel, summary: summary)
                } label: {
                    summaryRow(summary)
                }
                .listRowBackground(Color.spentyCardBg)
            }
            .onDelete { offsets in
                Task { await viewModel.deleteSummary(at: offsets) }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.refresh()
        }
    }

    private func summaryRow(_ summary: TaxSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(summary.name ?? "Untitled")
                    .font(SpentyFonts.body.weight(.semibold))
                    .foregroundStyle(Color.spentyTextPrimary)
                    .lineLimit(1)

                Spacer()

                statusBadge(summary.status ?? "unknown")
            }

            if let from = summary.dateFrom, let to = summary.dateTo {
                Text("\(formatDate(from)) - \(formatDate(to))")
                    .font(SpentyFonts.caption1)
                    .foregroundStyle(Color.spentyTextSecondary)
            }

            HStack(spacing: 16) {
                financialPill(label: "Income", value: summary.totalIncome, color: .spentySuccess)
                financialPill(label: "Expense", value: summary.totalExpense, color: .spentyError)
                financialPill(label: "Net", value: summary.net, color: .spentyPrimary)
            }
        }
        .padding(.vertical, 4)
    }

    private func statusBadge(_ status: String) -> some View {
        let color: Color = switch status.lowercased() {
        case "completed": .spentySuccess
        case "processing": .spentyWarning
        case "failed": .spentyError
        default: .spentyTextSecondary
        }

        return Text(status.capitalized)
            .font(SpentyFonts.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.12), in: Capsule())
    }

    private func financialPill(label: String, value: Double?, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(SpentyFonts.caption2)
                .foregroundStyle(Color.spentyTextSecondary)
            Text(formatCurrency(value ?? 0))
                .font(SpentyFonts.caption1.weight(.medium).monospacedDigit())
                .foregroundStyle(color)
        }
    }

    // MARK: - Create Form Sheet

    private var createFormSheet: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    Section(lang.s("details")) {
                        TextField("Name", text: $viewModel.createName)

                        DatePicker("From", selection: $viewModel.createDateFrom, displayedComponents: .date)
                            .tint(Color.spentyPrimary)

                        DatePicker("To", selection: $viewModel.createDateTo, displayedComponents: .date)
                            .tint(Color.spentyPrimary)
                    }

                    Section(lang.s("email")) {
                        if viewModel.availableEmails.isEmpty {
                            HStack {
                                ProgressView()
                                    .tint(Color.spentyPrimary)
                                Text(lang.s("loading_accounts"))
                                    .font(SpentyFonts.subheadline)
                                    .foregroundStyle(Color.spentyTextSecondary)
                            }
                        } else {
                            Picker("Email", selection: $viewModel.createSelectedEmail) {
                                ForEach(viewModel.availableEmails, id: \.email) { option in
                                    Text("\(option.email) (\(option.provider))").tag(option.email)
                                }
                            }
                            .pickerStyle(.menu)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    Section {
                        Button {
                            Task { await viewModel.createSummary() }
                        } label: {
                            HStack {
                                Spacer()
                                if viewModel.isCreating {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text(lang.s("generate_insight"))
                                        .fontWeight(.semibold)
                                }
                                Spacer()
                            }
                            .padding(.vertical, 4)
                            .foregroundStyle(.white)
                        }
                        .listRowBackground(
                            Color.spentyPrimary.opacity(viewModel.isCreating ? 0.6 : 1)
                        )
                        .disabled(viewModel.isCreating)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(lang.s("new_insight"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(lang.s("cancel")) {
                        viewModel.showCreateForm = false
                    }
                    .tint(Color.spentyPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func formatDate(_ dateString: String) -> String {
        // Try to parse the date string and format it nicely
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        if let date = parser.date(from: dateString) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .none
            return display.string(from: date)
        }
        // Fallback: return the raw string
        return dateString
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        PastInsightsView()
    }
}
