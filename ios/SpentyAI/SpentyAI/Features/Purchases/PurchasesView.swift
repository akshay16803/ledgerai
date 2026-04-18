import SwiftUI

struct PurchasesView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = PurchasesViewModel()
    @State private var accounts: [Account] = []

    var body: some View {
        ZStack {
            SpentyColors.bgPrimary.ignoresSafeArea()

            if viewModel.needsSetup {
                setupGuard
            } else {
                mainContent
            }
        }
        .navigationTitle("Purchases")
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadInitialData() }
        .task { await loadAccounts() }
        .refreshable { await viewModel.refresh() }
        .fullScreenCover(isPresented: $viewModel.showNewBill) {
            if viewModel.isIndia {
                PurchaseBillSheet(
                    settings: viewModel.settings,
                    onSaved: { await viewModel.refresh(); appState.hasBills = true }
                )
            } else {
                InternationalBillSheet(
                    settings: viewModel.settings,
                    onSaved: { await viewModel.refresh(); appState.hasBills = true }
                )
            }
        }
        .fullScreenCover(isPresented: $viewModel.showEditBill) {
            if let bill = viewModel.selectedBill {
                if viewModel.isIndia {
                    PurchaseBillSheet(
                        settings: viewModel.settings,
                        editBill: bill,
                        onSaved: { await viewModel.refresh() }
                    )
                } else {
                    InternationalBillSheet(
                        settings: viewModel.settings,
                        editBill: bill,
                        onSaved: { await viewModel.refresh() }
                    )
                }
            }
        }
        .fullScreenCover(isPresented: $viewModel.showPreview) {
            if let bill = viewModel.selectedBill {
                BillPreviewView(
                    bill: bill,
                    settings: viewModel.settings,
                    onEdit: { viewModel.openEdit(bill) },
                    onRecordPayment: { viewModel.openRecordPayment(bill) }
                )
            }
        }
        .sheet(isPresented: $viewModel.showRecordPayment) {
            recordPaymentSheet
        }
        .alert("Delete Bill", isPresented: $viewModel.showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteBill() }
            }
        } message: {
            Text("Are you sure you want to delete this bill? This action cannot be undone.")
        }
    }

    // MARK: - Setup Guard

    private var setupGuard: some View {
        EmptyState(
            icon: "gearshape",
            title: "Setup Required",
            message: "Please complete your business settings before creating purchase bills.",
            actionTitle: "Go to Settings",
            action: {}
        )
    }

    // MARK: - Main Content

    private var mainContent: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: 0) {
                filterBar
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.vertical, SpentySpacing.sm)

                if viewModel.isLoading && viewModel.bills.isEmpty {
                    Spacer()
                    ProgressView()
                        .controlSize(.large)
                    Spacer()
                } else if let error = viewModel.errorMessage, viewModel.bills.isEmpty {
                    EmptyState(
                        icon: "exclamationmark.triangle",
                        title: "Something Went Wrong",
                        message: error,
                        actionTitle: "Retry",
                        action: { Task { await viewModel.loadInitialData() } }
                    )
                } else if viewModel.bills.isEmpty {
                    EmptyState(
                        icon: "doc.text",
                        title: "No Purchase Bills",
                        message: "Create your first purchase bill to start tracking expenses from vendors.",
                        actionTitle: "New Bill",
                        action: { viewModel.showNewBill = true }
                    )
                } else {
                    billList
                }
            }

            // FAB
            if !viewModel.bills.isEmpty || viewModel.statusFilter != nil {
                fab
            }
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SpentySpacing.sm) {
                FilterChip("All", isSelected: viewModel.statusFilter == nil) {
                    Task { await viewModel.applyFilter(nil) }
                }
                FilterChip("Unpaid", isSelected: viewModel.statusFilter == "unpaid") {
                    Task { await viewModel.applyFilter("unpaid") }
                }
                FilterChip("Partial", isSelected: viewModel.statusFilter == "partial") {
                    Task { await viewModel.applyFilter("partial") }
                }
                FilterChip("Paid", isSelected: viewModel.statusFilter == "paid") {
                    Task { await viewModel.applyFilter("paid") }
                }
            }
        }
    }

    // MARK: - Bill List

    private var billList: some View {
        ScrollView {
            LazyVStack(spacing: SpentySpacing.sm) {
                ForEach(viewModel.bills) { bill in
                    billRow(bill)
                        .onTapGesture { viewModel.openPreview(bill) }
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.sm)
            .padding(.bottom, 80) // Space for FAB
        }
    }

    // MARK: - Bill Row

    private func billRow(_ bill: Bill) -> some View {
        SpentyCard {
            VStack(spacing: SpentySpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text(bill.vendorName ?? "Unknown Vendor")
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(SpentyColors.textPrimary)
                            .lineLimit(1)

                        if let billNumber = bill.billNumber {
                            Text(billNumber)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                    }

                    Spacer()

                    MoneyText(bill.grandTotal ?? 0, currency: viewModel.currency)
                }

                HStack {
                    if let dateStr = bill.billDate {
                        Text(DateFormatting.shortDate(from: dateStr))
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }

                    if let ref = bill.poNumber, !ref.isEmpty {
                        Text("Ref: \(ref)")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }

                    Spacer()

                    StatusBadge(viewModel.statusType(for: bill))
                }
            }
        }
        .contextMenu {
            Button { viewModel.openPreview(bill) } label: {
                Label("Preview", systemImage: "eye")
            }
            Button { viewModel.openEdit(bill) } label: {
                Label("Edit", systemImage: "pencil")
            }
            if bill.paymentStatus?.lowercased() != "paid" {
                Button { viewModel.openRecordPayment(bill) } label: {
                    Label("Record Payment", systemImage: "banknote")
                }
            }
            Divider()
            Button(role: .destructive) { viewModel.openDeleteConfirm(bill) } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    // MARK: - FAB

    private var fab: some View {
        Button { viewModel.showNewBill = true } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(SpentyColors.brandPrimary)
                .clipShape(Circle())
                .shadow(color: SpentyColors.brandPrimary.opacity(0.3), radius: 8, y: 4)
        }
        .padding(.trailing, SpentySpacing.xl)
        .padding(.bottom, SpentySpacing.xl)
    }

    // MARK: - Record Payment Sheet

    private var recordPaymentSheet: some View {
        NavigationStack {
            VStack(spacing: SpentySpacing.lg) {
                SheetHeader("Record Payment", onClose: { viewModel.showRecordPayment = false })

                ScrollView {
                    VStack(spacing: SpentySpacing.lg) {
                        if let bill = viewModel.selectedBill {
                            SpentyCard {
                                VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                                    Text(bill.vendorName ?? "Vendor")
                                        .font(SpentyFonts.subheading)
                                        .foregroundStyle(SpentyColors.textPrimary)
                                    HStack {
                                        Text("Total:")
                                            .font(SpentyFonts.body)
                                            .foregroundStyle(SpentyColors.textSecondary)
                                        MoneyText(bill.grandTotal ?? 0, currency: viewModel.currency)
                                    }
                                    HStack {
                                        Text("Paid:")
                                            .font(SpentyFonts.body)
                                            .foregroundStyle(SpentyColors.textSecondary)
                                        MoneyText(bill.amountPaid ?? 0, currency: viewModel.currency)
                                    }
                                    HStack {
                                        Text("Balance:")
                                            .font(SpentyFonts.body)
                                            .foregroundStyle(SpentyColors.textSecondary)
                                        MoneyText(
                                            (bill.grandTotal ?? 0) - (bill.amountPaid ?? 0),
                                            currency: viewModel.currency
                                        )
                                    }
                                }
                            }
                        }

                        FormField(
                            "Payment Amount",
                            text: $viewModel.paymentAmount,
                            placeholder: "0.00",
                            keyboardType: .decimalPad,
                            isRequired: true
                        )

                        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                            Text("Payment Method")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)

                            Picker("Method", selection: $viewModel.paymentMethod) {
                                Text("Bank Transfer").tag("bank_transfer")
                                Text("Cash").tag("cash")
                                Text("UPI").tag("upi")
                                Text("Cheque").tag("cheque")
                                Text("Card").tag("card")
                                Text("Other").tag("other")
                            }
                            .pickerStyle(.menu)
                            .tint(SpentyColors.textPrimary)
                        }

                        if !accounts.isEmpty {
                            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                Text("Payment Account")
                                    .font(SpentyFonts.caption)
                                    .foregroundStyle(SpentyColors.textSecondary)

                                Picker("Account", selection: Binding(
                                    get: { viewModel.paymentAccountId ?? "" },
                                    set: { viewModel.paymentAccountId = $0.isEmpty ? nil : $0 }
                                )) {
                                    Text("Select Account").tag("")
                                    ForEach(accounts) { account in
                                        Text(account.name).tag(account.accountId)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(SpentyColors.textPrimary)
                            }
                        }

                        DatePicker(
                            "Payment Date",
                            selection: $viewModel.paymentDate,
                            displayedComponents: .date
                        )
                        .font(SpentyFonts.body)
                        .tint(SpentyColors.brandAccent)

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.danger)
                        }

                        PrimaryButton(
                            "Record Payment",
                            icon: "checkmark",
                            isLoading: viewModel.isRecordingPayment,
                            isFullWidth: true
                        ) {
                            Task { await viewModel.recordPayment() }
                        }
                    }
                    .padding(SpentySpacing.lg)
                }
            }
            .background(SpentyColors.bgPrimary)
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Helpers

    private func loadAccounts() async {
        do {
            accounts = try await AccountRepository().getAccounts()
        } catch {
            // Accounts are optional for payment recording
        }
    }
}

#Preview {
    NavigationStack {
        PurchasesView()
            .environment(AppState())
    }
}
