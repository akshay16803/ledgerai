import SwiftUI

struct PastInsightDetailView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary    = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let primaryDark = Color(red: 0x2C / 255, green: 0x46 / 255, blue: 0x38 / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

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
            Brand.background.ignoresSafeArea()

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
        .navigationTitle(displaySummary.name ?? "Tax Summary")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.startAddTransaction()
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                }
                .tint(Brand.primary)
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
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if let email = displaySummary.emailAddress, !email.isEmpty {
                Label(email, systemImage: "envelope.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
    }

    // MARK: - Stats Cards

    private var statsCards: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Summary")
                .font(.headline)
                .padding(.horizontal, 4)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                statCard(
                    title: "Total Income",
                    value: formatCurrency(displaySummary.totalIncome ?? 0),
                    icon: "arrow.down.circle.fill",
                    color: .green
                )
                statCard(
                    title: "Total Expense",
                    value: formatCurrency(displaySummary.totalExpense ?? 0),
                    icon: "arrow.up.circle.fill",
                    color: .red
                )
                statCard(
                    title: "Net",
                    value: formatCurrency(displaySummary.net ?? 0),
                    icon: "equal.circle.fill",
                    color: Brand.primary
                )
                statCard(
                    title: "Transactions",
                    value: "\(displaySummary.transactionCount ?? viewModel.detailTransactions.count)",
                    icon: "list.bullet.rectangle.fill",
                    color: .blue
                )
            }
        }
    }

    private func statCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)

            Text(value)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.primary)

            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
    }

    // MARK: - Actions Row

    private var actionsRow: some View {
        HStack(spacing: 12) {
            Button {
                Task { await viewModel.exportCSV() }
            } label: {
                Label("Export CSV", systemImage: "tablecells")
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(Brand.primary)
                    .background(Brand.primary.opacity(0.1), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            Button {
                Task { await viewModel.downloadCSV() }
            } label: {
                Label("Download CSV", systemImage: "arrow.down.doc.fill")
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(.white)
                    .background(Brand.primary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    // MARK: - Transactions Section

    private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Transactions")
                    .font(.headline)

                Spacer()

                Text("\(viewModel.detailTransactions.count)")
                    .font(.subheadline.weight(.medium).monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 4)

            if viewModel.isLoadingTransactions {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Brand.primary)
                    Spacer()
                }
                .padding(.vertical, 24)
            } else if viewModel.detailTransactions.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "tray")
                            .font(.largeTitle)
                            .foregroundStyle(Brand.primary.opacity(0.4))
                        Text("No transactions found")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 24)
                .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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
                .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
            }
        }
    }

    private func transactionRow(_ txn: TaxSummaryTransaction) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(txn.description ?? "Transaction")
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)

                HStack(spacing: 8) {
                    if let date = txn.date {
                        Text(formatDate(date))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if let category = txn.categoryName, !category.isEmpty {
                        Text(category)
                            .font(.caption2.weight(.medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .foregroundStyle(Brand.primary)
                            .background(Brand.primary.opacity(0.1), in: Capsule())
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(txn.amount ?? 0))
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(transactionColor(txn.transactionType))

                if let type = txn.transactionType {
                    Text(type.capitalized)
                        .font(.caption2)
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
            .tint(Brand.primary)
        }
    }

    private func transactionColor(_ type: String?) -> Color {
        switch type?.lowercased() {
        case "income":  .green
        case "expense": .red
        default:        .primary
        }
    }

    // MARK: - Transaction Form Sheet

    private var transactionFormSheet: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()

                Form {
                    Section("Transaction Details") {
                        TextField("Description", text: $viewModel.txnDescription)

                        TextField("Amount", text: $viewModel.txnAmount)
                            .keyboardType(.decimalPad)

                        DatePicker("Date", selection: $viewModel.txnDate, displayedComponents: .date)
                            .tint(Brand.primary)

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
                        .listRowBackground(Brand.primary)
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
                    .tint(Brand.primary)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Status Badge

    private func statusBadge(_ status: String) -> some View {
        let color: Color = switch status.lowercased() {
        case "completed":  .green
        case "processing": .orange
        case "failed":     .red
        default:           .secondary
        }

        return Text(status.capitalized)
            .font(.caption.weight(.semibold))
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
                dateFrom: Calendar.current.date(byAdding: .year, value: -1, to: Date()),
                dateTo: Date(),
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
