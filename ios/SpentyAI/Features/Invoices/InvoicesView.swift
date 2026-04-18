import SwiftUI

struct InvoicesView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = InvoicesViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary.ignoresSafeArea()

                if viewModel.needsSetup && !viewModel.isLoading {
                    setupBanner
                } else {
                    mainContent
                }
            }
            .navigationTitle("Invoices")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await viewModel.loadSettings()
                await viewModel.loadInvoices()
            }
            .refreshable {
                await viewModel.refresh()
            }
            .overlay(alignment: .bottomTrailing) {
                if !viewModel.needsSetup {
                    fabButton
                }
            }
            .sheet(isPresented: $viewModel.showNewInvoice) {
                Task { await viewModel.refresh() }
            } content: {
                invoiceSheet(editing: nil)
            }
            .sheet(item: $viewModel.showEditInvoice) { invoice in
                invoiceSheet(editing: invoice)
            } onDismiss: {
                Task { await viewModel.refresh() }
            }
            .sheet(item: $viewModel.showPreview) { invoice in
                InvoicePreviewView(
                    invoice: invoice,
                    settings: viewModel.settings,
                    onEdit: { inv in
                        viewModel.showPreview = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            viewModel.showEditInvoice = inv
                        }
                    },
                    onRecordPayment: { inv in
                        viewModel.showPreview = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            viewModel.showRecordPayment = inv
                        }
                    }
                )
            }
            .sheet(item: $viewModel.showRecordPayment) { invoice in
                RecordPaymentSheet(
                    invoice: invoice,
                    settings: viewModel.settings,
                    onSaved: {
                        viewModel.showRecordPayment = nil
                        Task { await viewModel.refresh() }
                    }
                )
                .presentationDetents([.medium])
            }
            .alert("Delete Invoice", isPresented: .init(
                get: { viewModel.showDeleteConfirm != nil },
                set: { if !$0 { viewModel.showDeleteConfirm = nil } }
            )) {
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = nil
                }
                Button("Delete", role: .destructive) {
                    if let invoice = viewModel.showDeleteConfirm {
                        Task {
                            let success = await viewModel.deleteInvoice(invoice)
                            if success && viewModel.invoices.isEmpty {
                                appState.hasInvoices = false
                            }
                        }
                    }
                }
            } message: {
                Text("Are you sure you want to delete this invoice? This action cannot be undone.")
            }
        }
    }

    // MARK: - Setup Banner

    private var setupBanner: some View {
        VStack(spacing: SpentySpacing.xl) {
            EmptyState(
                icon: "building.2",
                title: "Business Profile Required",
                message: "Complete your business profile to create invoices.",
                actionTitle: "Go to Settings",
                action: {
                    // Navigation to settings handled by parent tab coordinator
                }
            )
        }
    }

    // MARK: - Main Content

    private var mainContent: some View {
        VStack(spacing: 0) {
            filterBar
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.sm)

            if viewModel.isLoading && viewModel.invoices.isEmpty {
                Spacer()
                ProgressView()
                    .controlSize(.large)
                    .tint(SpentyColors.brandAccent)
                Spacer()
            } else if let error = viewModel.errorMessage, viewModel.invoices.isEmpty {
                EmptyState(
                    icon: "exclamationmark.triangle",
                    title: "Something Went Wrong",
                    message: error,
                    actionTitle: "Retry",
                    action: { Task { await viewModel.loadInvoices() } }
                )
            } else if viewModel.invoices.isEmpty {
                EmptyState(
                    icon: "doc.text.magnifyingglass",
                    title: "No Invoices Yet",
                    message: viewModel.statusFilter != nil
                        ? "No invoices match this filter."
                        : "Create your first invoice to start tracking payments.",
                    actionTitle: viewModel.statusFilter == nil ? "Create Invoice" : nil,
                    action: viewModel.statusFilter == nil ? { viewModel.showNewInvoice = true } : nil
                )
            } else {
                invoiceList
            }
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SpentySpacing.sm) {
                FilterChip("All", isSelected: viewModel.statusFilter == nil) {
                    viewModel.filterByStatus(nil)
                }
                FilterChip("Unpaid", isSelected: viewModel.statusFilter == "unpaid") {
                    viewModel.filterByStatus("unpaid")
                }
                FilterChip("Partial", isSelected: viewModel.statusFilter == "partial") {
                    viewModel.filterByStatus("partial")
                }
                FilterChip("Paid", isSelected: viewModel.statusFilter == "paid") {
                    viewModel.filterByStatus("paid")
                }
            }
        }
    }

    // MARK: - Invoice List

    private var invoiceList: some View {
        ScrollView {
            LazyVStack(spacing: SpentySpacing.sm) {
                ForEach(viewModel.invoices) { invoice in
                    invoiceRow(invoice)
                        .onTapGesture {
                            viewModel.showPreview = invoice
                        }
                        .contextMenu {
                            Button {
                                viewModel.showPreview = invoice
                            } label: {
                                Label("View", systemImage: "eye")
                            }

                            Button {
                                viewModel.showEditInvoice = invoice
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }

                            if invoice.paymentStatus?.lowercased() != "paid" {
                                Button {
                                    viewModel.showRecordPayment = invoice
                                } label: {
                                    Label("Record Payment", systemImage: "creditcard")
                                }
                            }

                            Divider()

                            Button(role: .destructive) {
                                viewModel.showDeleteConfirm = invoice
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .onAppear {
                            if invoice.id == viewModel.invoices.last?.id {
                                Task { await viewModel.loadMore() }
                            }
                        }
                }

                if viewModel.isLoadingMore {
                    ProgressView()
                        .padding(SpentySpacing.lg)
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.bottom, 80) // Space for FAB
        }
    }

    // MARK: - Invoice Row

    private func invoiceRow(_ invoice: Invoice) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text(invoice.invoiceNumber ?? "Draft")
                            .font(SpentyFonts.mono)
                            .foregroundStyle(SpentyColors.textPrimary)

                        Text(invoice.customerName ?? "Unknown Customer")
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }

                    Spacer()

                    MoneyText(
                        invoice.grandTotal ?? 0,
                        currency: viewModel.currencyCode,
                        size: SpentyFonts.subheading
                    )
                }

                HStack {
                    if let dateStr = invoice.invoiceDate {
                        Label(formatDisplayDate(dateStr), systemImage: "calendar")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                    }

                    if let dueStr = invoice.dueDate {
                        Text("Due: \(formatDisplayDate(dueStr))")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(isDueDatePast(dueStr) && invoice.paymentStatus != "paid"
                                ? SpentyColors.danger
                                : SpentyColors.textMuted)
                    }

                    Spacer()

                    StatusBadge(viewModel.statusType(for: invoice))
                }
            }
        }
    }

    // MARK: - FAB

    private var fabButton: some View {
        Button {
            viewModel.showNewInvoice = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(SpentyColors.brandAccent)
                .clipShape(Circle())
                .shadow(color: SpentyColors.brandAccent.opacity(0.4), radius: 8, x: 0, y: 4)
        }
        .padding(.trailing, SpentySpacing.xl)
        .padding(.bottom, SpentySpacing.xl)
    }

    // MARK: - Sheet Router

    @ViewBuilder
    private func invoiceSheet(editing invoice: Invoice?) -> some View {
        if viewModel.isIndia {
            SalesInvoiceSheet(
                editingInvoice: invoice,
                settings: viewModel.settings,
                onSaved: { _ in
                    viewModel.showNewInvoice = false
                    viewModel.showEditInvoice = nil
                    appState.hasInvoices = true
                    Task { await viewModel.refresh() }
                }
            )
        } else {
            InternationalInvoiceSheet(
                editingInvoice: invoice,
                settings: viewModel.settings,
                onSaved: { _ in
                    viewModel.showNewInvoice = false
                    viewModel.showEditInvoice = nil
                    appState.hasInvoices = true
                    Task { await viewModel.refresh() }
                }
            )
        }
    }

    // MARK: - Helpers

    private func formatDisplayDate(_ isoString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var date = isoFormatter.date(from: isoString)
        if date == nil {
            isoFormatter.formatOptions = [.withInternetDateTime]
            date = isoFormatter.date(from: isoString)
        }
        if date == nil {
            let fallback = DateFormatter()
            fallback.dateFormat = "yyyy-MM-dd"
            date = fallback.date(from: isoString)
        }

        guard let parsed = date else { return isoString }
        let display = DateFormatter()
        display.dateStyle = .medium
        return display.string(from: parsed)
    }

    private func isDueDatePast(_ isoString: String) -> Bool {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var date = isoFormatter.date(from: isoString)
        if date == nil {
            isoFormatter.formatOptions = [.withInternetDateTime]
            date = isoFormatter.date(from: isoString)
        }
        if date == nil {
            let fallback = DateFormatter()
            fallback.dateFormat = "yyyy-MM-dd"
            date = fallback.date(from: isoString)
        }

        guard let parsed = date else { return false }
        return parsed < Date()
    }
}
