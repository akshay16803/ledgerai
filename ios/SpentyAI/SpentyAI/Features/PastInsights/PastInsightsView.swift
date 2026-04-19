import SwiftUI

struct PastInsightsView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary    = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

    // MARK: - State

    @State private var viewModel = PastInsightsViewModel()

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()

                Group {
                    if viewModel.isLoading && viewModel.summaries.isEmpty {
                        loadingView
                    } else if viewModel.summaries.isEmpty && !viewModel.isLoading {
                        emptyState
                    } else {
                        summaryList
                    }
                }
            }
            .navigationTitle("Past Insights")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        viewModel.startCreate()
                        Task { await viewModel.loadAvailableEmails() }
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                    .tint(Brand.primary)
                }
            }
            .sheet(isPresented: $viewModel.showCreateForm) {
                createFormSheet
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK") { viewModel.dismissError() }
            } message: {
                Text(viewModel.errorMessage)
            }
            .task {
                await viewModel.loadSummaries()
            }
        }
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Brand.primary)
            Text("Loading tax summaries...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Tax Summaries", systemImage: "doc.text.magnifyingglass")
                .foregroundStyle(Brand.primary)
        } description: {
            Text("Create a tax summary to analyze your income and expenses over a date range.")
        } actions: {
            Button {
                viewModel.startCreate()
                Task { await viewModel.loadAvailableEmails() }
            } label: {
                Text("Create Summary")
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Brand.primary, in: Capsule())
            }
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
                .listRowBackground(Color.white)
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
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                Spacer()

                statusBadge(summary.status ?? "unknown")
            }

            if let from = summary.dateFrom, let to = summary.dateTo {
                Text("\(formatDate(from)) - \(formatDate(to))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 16) {
                financialPill(label: "Income", value: summary.totalIncome, color: .green)
                financialPill(label: "Expense", value: summary.totalExpense, color: .red)
                financialPill(label: "Net", value: summary.net, color: Brand.primary)
            }
        }
        .padding(.vertical, 4)
    }

    private func statusBadge(_ status: String) -> some View {
        let color: Color = switch status.lowercased() {
        case "completed": .green
        case "processing": .orange
        case "failed": .red
        default: .secondary
        }

        return Text(status.capitalized)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.12), in: Capsule())
    }

    private func financialPill(label: String, value: Double?, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(formatCurrency(value ?? 0))
                .font(.caption.weight(.medium).monospacedDigit())
                .foregroundStyle(color)
        }
    }

    // MARK: - Create Form Sheet

    private var createFormSheet: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()

                Form {
                    Section("Summary Details") {
                        TextField("Name", text: $viewModel.createName)

                        DatePicker("From", selection: $viewModel.createDateFrom, displayedComponents: .date)
                            .tint(Brand.primary)

                        DatePicker("To", selection: $viewModel.createDateTo, displayedComponents: .date)
                            .tint(Brand.primary)
                    }

                    Section("Email Account") {
                        if viewModel.availableEmails.isEmpty {
                            HStack {
                                ProgressView()
                                    .tint(Brand.primary)
                                Text("Loading email accounts...")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        } else {
                            Picker("Email", selection: $viewModel.createSelectedEmail) {
                                ForEach(viewModel.availableEmails, id: \.email) { option in
                                    Text("\(option.email) (\(option.provider))").tag(option.email)
                                }
                            }
                            .pickerStyle(.menu)
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
                                    Text("Generate Tax Summary")
                                        .fontWeight(.semibold)
                                }
                                Spacer()
                            }
                            .padding(.vertical, 4)
                            .foregroundStyle(.white)
                        }
                        .listRowBackground(
                            Brand.primary.opacity(viewModel.isCreating ? 0.6 : 1)
                        )
                        .disabled(viewModel.isCreating)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("New Tax Summary")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.showCreateForm = false
                    }
                    .tint(Brand.primary)
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
    PastInsightsView()
}
