import SwiftUI

struct InvoiceListView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @Environment(AuthManager.self) var authManager
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = InvoicesViewModel()
    @State private var paymentInvoice: Invoice?
    @State private var debtorsExpanded = false
    @State private var agingExpanded = false

    // Premium gate — Invoices is the paid Premium tier. If the user
    // isn't subscribed, present the PremiumFeatureSheet on entry.
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
                if viewModel.isLoading && viewModel.invoices.isEmpty {
                    LoadingView(message: "Loading invoices...")
                } else if viewModel.filteredInvoices.isEmpty && viewModel.invoices.isEmpty {
                    emptyState
                } else {
                    invoiceContent
                }
            }
        }
        .navigationTitle(lang.s("invoices"))
        .searchable(text: $viewModel.searchText, prompt: lang.s("search_invoice"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.startCreate()
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.spentyPrimary)
                }
            }
        }
        .refreshable {
            await viewModel.loadAll()
        }
        .sheet(isPresented: $viewModel.showForm) {
            InvoiceFormView(viewModel: viewModel)
        }
        .sheet(item: $paymentInvoice) { invoice in
            RecordPaymentView(viewModel: viewModel, invoice: invoice)
        }
        .alert("Error", isPresented: .init(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button(lang.s("ok")) { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .task {
            if !hasPremium {
                showPremiumSheet = true
                return  // Skip data fetch — backend 402s for free users.
            }
            await viewModel.loadAll()
            await viewModel.loadCustomers()
            await viewModel.loadAccounts()
        }
        .sheet(isPresented: $showPremiumSheet, onDismiss: {
            if !justSubscribed && !hasPremium { dismiss() }
        }) {
            PremiumFeatureSheet.bundle(
                onClose: { showPremiumSheet = false },
                onSubscribed: { justSubscribed = true }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled(false)
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
                statCard(title: "Total Invoiced", amount: stats.totalInvoiced ?? 0, color: .spentyPrimary)
                statCard(title: "Paid", amount: stats.totalPaid ?? 0, color: .spentySuccess)
                statCard(title: "Outstanding", amount: stats.totalOutstanding ?? 0, color: .spentyWarning)
                statCard(title: "Overdue", amount: stats.totalOverdue ?? 0, color: .spentyError)
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
    }

    private func statCard(title: String, amount: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(SpentyFonts.caption1)
                .foregroundStyle(Color.spentyTextSecondary)
            Text(formatCurrency(amount))
                .font(SpentyFonts.subheadline.weight(.bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.spentyCardBg, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
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
                                .font(SpentyFonts.subheadline.weight(.medium))
                                .fixedSize(horizontal: true, vertical: false)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 7)
                                .background(
                                    viewModel.statusFilter == filter
                                        ? Color.spentyPrimary
                                        : Color.spentyBgSecondary,
                                    in: Capsule()
                                )
                                .foregroundStyle(
                                    viewModel.statusFilter == filter
                                        ? .white
                                        : Color.spentyTextPrimary
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
                Text(lang.s("no_invoices_match"))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyTextSecondary)
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
                            Label(lang.s("delete"), systemImage: "trash")
                        }

                        Button {
                            viewModel.startEdit(invoice)
                        } label: {
                            Label(lang.s("edit"), systemImage: "pencil")
                        }
                        .tint(Color.spentyPrimary)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        if (invoice.paymentStatus ?? "").lowercased() != "paid" {
                            Button {
                                Task { await viewModel.markPaid(id: invoice.id) }
                            } label: {
                                Label("Mark Paid", systemImage: "checkmark.circle")
                            }
                            .tint(Color.spentySuccess)
                        }

                        Button {
                            Task { await viewModel.duplicateInvoice(id: invoice.id) }
                        } label: {
                            Label("Duplicate", systemImage: "doc.on.doc")
                        }
                        .tint(Color.spentyWarning)
                    }
                    .listRowBackground(Color.spentyCardBg)
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
                    .font(SpentyFonts.body.weight(.semibold))
                Spacer()
                statusBadge(invoice.paymentStatus)
            }

            Text(invoice.customerName ?? "Unknown Customer")
                .font(SpentyFonts.subheadline)
                .foregroundStyle(Color.spentyTextSecondary)

            HStack {
                Label(formatDate(invoice.date), systemImage: "calendar")
                    .font(SpentyFonts.caption1)
                    .foregroundStyle(Color.spentyTextSecondary)

                Spacer()

                if let dueDate = invoice.dueDate {
                    Label("Due: \(formatDate(dueDate))", systemImage: "clock")
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(isOverdue(invoice) ? Color.spentyError : Color.spentyTextSecondary)
                }
            }

            HStack {
                Text(formatCurrency(invoice.grandTotal ?? 0))
                    .font(SpentyFonts.subheadline.weight(.bold))
                    .foregroundStyle(Color.spentyPrimary)

                Spacer()

                if let paid = invoice.amountPaid, paid > 0, paid < (invoice.grandTotal ?? 0) {
                    Text("Paid: \(formatCurrency(paid))")
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(Color.spentyTextSecondary)
                }

                if (invoice.paymentStatus ?? "").lowercased() != "paid" {
                    Button {
                        paymentInvoice = invoice
                    } label: {
                        Label(lang.s("record_payment"), systemImage: "indianrupeesign.circle")
                            .font(SpentyFonts.caption2.weight(.medium))
                            .foregroundStyle(Color.spentyPrimary)
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
                return ("Paid", Color.spentySuccess.opacity(0.15), .spentySuccess)
            case "partial":
                return ("Partial", Color.spentyWarning.opacity(0.15), .spentyWarning)
            case "overdue":
                return ("Overdue", Color.spentyError.opacity(0.15), .spentyError)
            default:
                return ("Unpaid", Color.spentyError.opacity(0.1), .spentyError)
            }
        }()

        Text(text)
            .font(SpentyFonts.caption2.weight(st == "overdue" ? .bold : .semibold))
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
                            .font(SpentyFonts.subheadline.weight(.medium))
                        Text("\(debtor.invoiceCount ?? 0) invoices")
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                    Spacer()
                    Text(formatCurrency(debtor.totalOutstanding ?? 0))
                        .font(SpentyFonts.subheadline.weight(.semibold))
                        .foregroundStyle(Color.spentyError)
                }
                .listRowBackground(Color.spentyCardBg)
            }
        } header: {
            Button {
                withAnimation { debtorsExpanded.toggle() }
            } label: {
                HStack {
                    Text(lang.s("debtors_summary"))
                    Spacer()
                    Image(systemName: debtorsExpanded ? "chevron.up" : "chevron.down")
                        .font(SpentyFonts.caption1)
                }
                .foregroundStyle(Color.spentyTextSecondary)
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
                            .font(SpentyFonts.subheadline.weight(.medium))
                        Text("\(bucket.count ?? 0) invoices")
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                    Spacer()
                    Text(formatCurrency(bucket.amount ?? 0))
                        .font(SpentyFonts.subheadline.weight(.semibold))
                        .foregroundStyle(Color.spentyWarning)
                }
                .listRowBackground(Color.spentyCardBg)
            }
        } header: {
            Button {
                withAnimation { agingExpanded.toggle() }
            } label: {
                HStack {
                    Text(lang.s("aging_analysis"))
                    Spacer()
                    Image(systemName: agingExpanded ? "chevron.up" : "chevron.down")
                        .font(SpentyFonts.caption1)
                }
                .foregroundStyle(Color.spentyTextSecondary)
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        EmptyStateView(
            icon: "doc.text.magnifyingglass",
            title: lang.s("no_invoices"),
            subtitle: "Tap the + button to create your first invoice.",
            buttonTitle: lang.s("create_invoice")
        ) {
            viewModel.startCreate()
        }
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
        formatter.locale = Locale(identifier: "en_IN")
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "₹0"
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
    NavigationStack {
        InvoiceListView()
    }
}
