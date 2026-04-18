import SwiftUI

struct InvoiceListView: View {

    // MARK: - Brand

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
        static let error = Color(red: 0x96 / 255, green: 0x45 / 255, blue: 0x3A / 255)
        static let warning = Color(red: 0xC2 / 255, green: 0x8C / 255, blue: 0x3C / 255)
    }

    // MARK: - State

    @State private var viewModel = InvoicesViewModel()
    @State private var showPaymentSheet = false
    @State private var paymentInvoice: Invoice?
    @State private var debtorsExpanded = false
    @State private var agingExpanded = false

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()

                Group {
                    if viewModel.isLoading && viewModel.invoices.isEmpty {
                        ProgressView()
                            .tint(Brand.primary)
                    } else if viewModel.filteredInvoices.isEmpty && viewModel.invoices.isEmpty {
                        emptyState
                    } else {
                        invoiceContent
                    }
                }
            }
            .navigationTitle("Invoices")
            .searchable(text: $viewModel.searchText, prompt: "Search by number or customer")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.startCreate()
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                            .foregroundStyle(Brand.primary)
                    }
                }
            }
            .refreshable {
                await viewModel.loadAll()
            }
            .sheet(isPresented: $viewModel.showForm) {
                InvoiceFormView(viewModel: viewModel)
            }
            .sheet(isPresented: $showPaymentSheet) {
                if let invoice = paymentInvoice {
                    RecordPaymentView(viewModel: viewModel, invoice: invoice)
                }
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .task {
                await viewModel.loadAll()
                await viewModel.loadCustomers()
                await viewModel.loadAccounts()
            }
        }
    }

    // MARK: - Content

    private var invoiceContent: some View {
        List {
            // Stats cards
            if let stats = viewModel.stats {
                statsSection(stats)
            }

            // Status filter
            filterSection

            // Invoice list
            invoiceListSection

            // Debtors
            if !viewModel.debtors.isEmpty {
                debtorsSection
            }

            // Aging
            if !viewModel.aging.isEmpty {
                agingSection
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Stats Cards

    private func statsSection(_ stats: InvoiceStats) -> some View {
        Section {
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                statCard(title: "Total Invoiced", amount: stats.totalInvoiced ?? 0, color: Brand.primary)
                statCard(title: "Paid", amount: stats.totalPaid ?? 0, color: .green)
                statCard(title: "Outstanding", amount: stats.totalOutstanding ?? 0, color: Brand.warning)
                statCard(title: "Overdue", amount: stats.totalOverdue ?? 0, color: Brand.error)
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
    }

    private func statCard(title: String, amount: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(formatCurrency(amount))
                .font(.subheadline.weight(.bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: - Filter

    private var filterSection: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(InvoicesViewModel.StatusFilter.allCases) { filter in
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                viewModel.statusFilter = filter
                            }
                        } label: {
                            Text(filter.displayName)
                                .font(.subheadline.weight(.medium))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 7)
                                .background(
                                    viewModel.statusFilter == filter
                                        ? Brand.primary
                                        : Color(.systemGray5),
                                    in: Capsule()
                                )
                                .foregroundStyle(
                                    viewModel.statusFilter == filter
                                        ? .white
                                        : .primary
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
    }

    // MARK: - Invoice List

    private var invoiceListSection: some View {
        Section {
            if viewModel.filteredInvoices.isEmpty {
                Text("No invoices match your filters.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                ForEach(viewModel.filteredInvoices) { invoice in
                    NavigationLink {
                        InvoicePreviewView(viewModel: viewModel, invoice: invoice)
                    } label: {
                        invoiceRow(invoice)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { await viewModel.deleteInvoice(id: invoice.id) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }

                        Button {
                            viewModel.startEdit(invoice)
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        .tint(Brand.primary)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        if (invoice.paymentStatus ?? "").lowercased() != "paid" {
                            Button {
                                Task { await viewModel.markPaid(id: invoice.id) }
                            } label: {
                                Label("Mark Paid", systemImage: "checkmark.circle")
                            }
                            .tint(.green)
                        }

                        Button {
                            Task { await viewModel.duplicateInvoice(id: invoice.id) }
                        } label: {
                            Label("Duplicate", systemImage: "doc.on.doc")
                        }
                        .tint(Brand.warning)
                    }
                    .listRowBackground(Color.white)
                }
            }
        } header: {
            Text("Invoices (\(viewModel.filteredInvoices.count))")
        }
    }

    private func invoiceRow(_ invoice: Invoice) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(invoice.invoiceNumber ?? "—")
                    .font(.body.weight(.semibold))
                Spacer()
                statusBadge(invoice.paymentStatus)
            }

            Text(invoice.customerName ?? "Unknown Customer")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack {
                Label(formatDate(invoice.date), systemImage: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()

                if let dueDate = invoice.dueDate {
                    Label("Due: \(formatDate(dueDate))", systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(isOverdue(invoice) ? Brand.error : .secondary)
                }
            }

            HStack {
                Text(formatCurrency(invoice.grandTotal ?? 0))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Brand.primary)

                Spacer()

                if let paid = invoice.amountPaid, paid > 0, paid < (invoice.grandTotal ?? 0) {
                    Text("Paid: \(formatCurrency(paid))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if (invoice.paymentStatus ?? "").lowercased() != "paid" {
                    Button {
                        paymentInvoice = invoice
                        showPaymentSheet = true
                    } label: {
                        Label("Record Payment", systemImage: "indianrupeesign.circle")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Brand.primary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func statusBadge(_ status: String?) -> some View {
        let st = (status ?? "unpaid").lowercased()
        let (text, bg, fg): (String, Color, Color) = {
            switch st {
            case "paid":
                return ("Paid", Color.green.opacity(0.15), .green)
            case "partial":
                return ("Partial", Brand.warning.opacity(0.15), Brand.warning)
            case "overdue":
                return ("Overdue", Brand.error.opacity(0.15), Brand.error)
            default:
                return ("Unpaid", Brand.error.opacity(0.1), Brand.error)
            }
        }()

        Text(text)
            .font(.caption2.weight(st == "overdue" ? .bold : .semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(bg, in: Capsule())
            .foregroundStyle(fg)
    }

    // MARK: - Debtors Section

    private var debtorsSection: some View {
        Section(isExpanded: $debtorsExpanded) {
            ForEach(viewModel.debtors) { debtor in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(debtor.customerName ?? "—")
                            .font(.subheadline.weight(.medium))
                        Text("\(debtor.invoiceCount ?? 0) invoices")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(formatCurrency(debtor.totalOutstanding ?? 0))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Brand.error)
                }
                .listRowBackground(Color.white)
            }
        } header: {
            Button {
                withAnimation { debtorsExpanded.toggle() }
            } label: {
                HStack {
                    Text("Debtors Summary")
                    Spacer()
                    Image(systemName: debtorsExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Aging Section

    private var agingSection: some View {
        Section(isExpanded: $agingExpanded) {
            ForEach(viewModel.aging) { bucket in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(bucket.label ?? "—")
                            .font(.subheadline.weight(.medium))
                        Text("\(bucket.count ?? 0) invoices")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(formatCurrency(bucket.amount ?? 0))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Brand.warning)
                }
                .listRowBackground(Color.white)
            }
        } header: {
            Button {
                withAnimation { agingExpanded.toggle() }
            } label: {
                HStack {
                    Text("Aging Analysis")
                    Spacer()
                    Image(systemName: agingExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text.magnifyingglass")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .foregroundStyle(Brand.primary.opacity(0.4))

            Text("No Invoices Yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Text("Tap the + button to create your first invoice.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button {
                viewModel.startCreate()
            } label: {
                Label("Create Invoice", systemImage: "plus")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Brand.primary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(32)
    }

    // MARK: - Helpers

    private func isOverdue(_ invoice: Invoice) -> Bool {
        guard let due = invoice.dueDate else { return false }
        let status = (invoice.paymentStatus ?? "").lowercased()
        return due < Date() && status != "paid"
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\u{20B9}0"
    }

    private func formatDate(_ date: Date?) -> String {
        guard let date else { return "—" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

// MARK: - Preview

#Preview {
    InvoiceListView()
}
