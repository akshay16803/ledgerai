import SwiftUI

struct PastInsightDetailView: View {

    // MARK: - State

    @Bindable var viewModel: PastInsightsViewModel
    let summary: TaxSummary

    @Environment(\.dismiss) private var dismiss

    private var displaySummary: TaxSummary {
        viewModel.selectedSummary ?? summary
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    summaryHeader
                    statsCards
                    actionsRow
                    transactionsSection
                }
                .padding()
            }
        }
        .navigationTitle(displaySummary.name ?? "Past Insight Summary")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.startAddTransaction()
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                }
                .tint(Color.spentyPrimary)
            }
        }
        .sheet(isPresented: $viewModel.showAddTransaction) {
            transactionFormSheet
        }
        .sheet(item: $viewModel.shareItem) { item in
            InsightShareSheet(items: [item.url])
        }
        .task {
            await viewModel.loadDetail(for: summary)
        }
    }

    // MARK: - Summary Header

    private var summaryHeader: some View {
        VStack(spacing: 8) {
            if let status = displaySummary.status {
                statusBadge(status)
            }

            if let from = displaySummary.dateFrom, let to = displaySummary.dateTo {
                Text("\(formatDate(from)) - \(formatDate(to))")
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyTextSecondary)
            }

            if let email = displaySummary.emailAddress, !email.isEmpty {
                Label(email, systemImage: "envelope.fill")
                    .font(SpentyFonts.caption1)
                    .foregroundStyle(Color.spentyTextSecondary)
            }
        }
        .frame(maxWidth: .infinity)
        .cardStyle()
    }

    // MARK: - Stats Cards

    private var statsCards: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Summary")
                .font(SpentyFonts.headline)
                .padding(.horizontal, 4)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                statCard(
                    title: "Total Income",
                    value: formatCurrency(displaySummary.totalIncome ?? 0),
                    icon: "arrow.down.circle.fill",
                    color: .spentySuccess
                )
                statCard(
                    title: "Total Expense",
                    value: formatCurrency(displaySummary.totalExpense ?? 0),
                    icon: "arrow.up.circle.fill",
                    color: .spentyError
                )
                statCard(
                    title: "Net",
                    value: formatCurrency(displaySummary.net ?? 0),
                    icon: "equal.circle.fill",
                    color: .spentyPrimary
                )
                statCard(
                    title: "Transactions",
                    value: "\(displaySummary.transactionCount ?? viewModel.detailTransactions.count)",
                    icon: "list.bullet.rectangle.fill",
                    color: .spentyInfo
                )
            }
        }
    }

    private func statCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(SpentyFonts.title2)
                .foregroundStyle(color)

            Text(value)
                .font(SpentyFonts.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(Color.spentyTextPrimary)

            Text(title)
                .font(SpentyFonts.caption2)
                .foregroundStyle(Color.spentyTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Color.spentyCardBg, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
    }

    // MARK: - Actions Row

    private var actionsRow: some View {
        HStack(spacing: 12) {
            Button {
                Task { await viewModel.exportCSV() }
            } label: {
                Label("Export CSV", systemImage: "tablecells")
                    .font(SpentyFonts.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(Color.spentyPrimary)
                    .background(Color.spentyPrimary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            Button {
                Task { await viewModel.downloadCSV() }
            } label: {
                Label("Download CSV", systemImage: "arrow.down.doc.fill")
                    .font(SpentyFonts.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(Color.spentyPrimary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    // MARK: - Transactions Section

    private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Transactions")
                    .font(SpentyFonts.headline)

                Spacer()

                Text("\(viewModel.detailTransactions.count)")
                    .font(SpentyFonts.subheadline.weight(.medium).monospacedDigit())
                    .foregroundStyle(Color.spentyTextSecondary)
            }
            .padding(.horizontal, 4)

            if viewModel.isLoadingTransactions {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Color.spentyPrimary)
                    Spacer()
                }
                .padding(.vertical, 24)
            } else if viewModel.detailTransactions.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "tray")
                            .font(.largeTitle)
                            .foregroundStyle(Color.spentyPrimary.opacity(0.4))
                        Text("No transactions found")
                            .font(SpentyFonts.subheadline)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 24)
                .background(Color.spentyCardBg, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(viewModel.detailTransactions.enumerated()), id: \.element.id) { index, txn in
                        transactionRow(txn)

                        if index < viewModel.detailTransactions.count - 1 {
                            Divider().padding(.horizontal)
                        }
                    }
                }
                .background(Color.spentyCardBg, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
            }
        }
    }

    private func transactionRow(_ txn: TaxSummaryTransaction) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(txn.description ?? "Transaction")
                    .font(SpentyFonts.subheadline.weight(.medium))
                    .lineLimit(2)

                HStack(spacing: 8) {
                    if let date = txn.date {
                        Text(formatDate(date))
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }

                    if let category = txn.categoryName, !category.isEmpty {
                        Text(category)
                            .font(SpentyFonts.caption2.weight(.medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .foregroundStyle(Color.spentyPrimary)
                            .background(Color.spentyPrimary.opacity(0.1), in: Capsule())
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(txn.amount ?? 0))
                    .font(SpentyFonts.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(transactionColor(txn.transactionType))

                if let type = txn.transactionType {
                    Text(type.capitalized)
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(transactionColor(type))
                }
            }
        }
        .padding()
        .contentShape(Rectangle())
        .contextMenu {
            Button {
                viewModel.startEditTransaction(txn)
            } label: {
                Label("Edit", systemImage: "pencil")
            }

            Button(role: .destructive) {
                Task { await viewModel.deleteTransaction(txn) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task { await viewModel.deleteTransaction(txn) }
            } label: {
                Label("Delete", systemImage: "trash")
            }

            Button {
                viewModel.startEditTransaction(txn)
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            .tint(Color.spentyPrimary)
        }
    }

    private func transactionColor(_ type: String?) -> Color {
        switch type?.lowercased() {
        case "income":  .spentySuccess
        case "expense": .spentyError
        default:        .spentyTextPrimary
        }
    }

    // MARK: - Transaction Form Sheet

    private var transactionFormSheet: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    Section("Transaction Details") {
                        TextField("Description", text: $viewModel.txnDescription)

                        TextField("Amount", text: $viewModel.txnAmount)
                            .keyboardType(.decimalPad)

                        DatePicker("Date", selection: $viewModel.txnDate, displayedComponents: .date)
                            .tint(Color.spentyPrimary)

                        Picker("Type", selection: $viewModel.txnType) {
                            Text("Income").tag("income")
                            Text("Expense").tag("expense")
                        }
                        .pickerStyle(.segmented)
                    }

                    Section("Category (optional)") {
                        TextField("Category name", text: $viewModel.txnCategory)
                    }

                    Section {
                        Button {
                            Task {
                                if viewModel.editingTransaction != nil {
                                    await viewModel.updateTransaction()
                                } else {
                                    await viewModel.addTransaction()
                                }
                            }
                        } label: {
                            HStack {
                                Spacer()
                                Text(viewModel.editingTransaction != nil ? "Update Transaction" : "Add Transaction")
                                    .fontWeight(.semibold)
                                Spacer()
                            }
                            .padding(.vertical, 4)
                            .foregroundStyle(.white)
                        }
                        .listRowBackground(Color.spentyPrimary)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(viewModel.editingTransaction != nil ? "Edit Transaction" : "Add Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.editingTransaction = nil
                        viewModel.showAddTransaction = false
                    }
                    .tint(Color.spentyPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Status Badge

    private func statusBadge(_ status: String) -> some View {
        let color: Color = switch status.lowercased() {
        case "completed":  .spentySuccess
        case "processing": .spentyWarning
        case "failed":     .spentyError
        default:           .spentyTextSecondary
        }

        return Text(status.capitalized)
            .font(SpentyFonts.caption1.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(color)
            .background(color.opacity(0.12), in: Capsule())
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func formatDate(_ dateString: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        if let date = parser.date(from: dateString) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .none
            return display.string(from: date)
        }
        return dateString
    }
}

// MARK: - Share Sheet

private struct InsightShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

#Preview {
    NavigationStack {
        PastInsightDetailView(
            viewModel: PastInsightsViewModel(),
            summary: TaxSummary(
                id: "1",
                name: "FY 2024-25",
                dateFrom: "2025-04-19",
                dateTo: "2026-04-19",
                status: "completed",
                totalIncome: 850000,
                totalExpenses: 620000,
                net: 230000,
                transactionCount: 142,
                emailAddress: "user@example.com",
                provider: "gmail"
            )
        )
    }
}
