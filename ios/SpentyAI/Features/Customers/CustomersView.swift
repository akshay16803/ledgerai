import SwiftUI

struct CustomersView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CustomersViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    tabBar
                        .padding(.horizontal, SpentySpacing.lg)
                        .padding(.vertical, SpentySpacing.sm)

                    if viewModel.isLoading && viewModel.customers.isEmpty {
                        Spacer()
                        ProgressView()
                            .controlSize(.large)
                            .tint(SpentyColors.brandAccent)
                        Spacer()
                    } else if let error = viewModel.errorMessage,
                              viewModel.customers.isEmpty {
                        EmptyState(
                            icon: "exclamationmark.triangle",
                            title: "Something Went Wrong",
                            message: error,
                            actionTitle: "Retry",
                            action: { Task { await viewModel.loadAll() } }
                        )
                    } else {
                        tabContent
                    }
                }

                LoadingOverlay(isPresented: .init(
                    get: { viewModel.isSaving },
                    set: { _ in }
                ))
            }
            .navigationTitle("Customers")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await viewModel.loadAll()
            }
            .refreshable {
                await viewModel.refresh()
            }
            .overlay(alignment: .bottomTrailing) {
                if viewModel.selectedTab == .customers {
                    fabButton
                }
            }
            .sheet(isPresented: $viewModel.showAddCustomer) {
                Task { await viewModel.refresh() }
            } content: {
                CustomerFormSheet(viewModel: viewModel, editing: nil)
            }
            .sheet(item: $viewModel.showEditCustomer) { customer in
                CustomerFormSheet(viewModel: viewModel, editing: customer)
            } onDismiss: {
                Task { await viewModel.refresh() }
            }
            .alert("Delete Customer", isPresented: .init(
                get: { viewModel.showDeleteConfirm != nil },
                set: { if !$0 { viewModel.showDeleteConfirm = nil } }
            )) {
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = nil
                }
                Button("Delete", role: .destructive) {
                    if let customer = viewModel.showDeleteConfirm {
                        Task {
                            _ = await viewModel.deleteCustomer(customer.customerId)
                        }
                    }
                }
            } message: {
                Text("Are you sure you want to delete this customer? This action cannot be undone.")
            }
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SpentySpacing.sm) {
                ForEach(CustomersViewModel.Tab.allCases) { tab in
                    FilterChip(tab.label, isSelected: viewModel.selectedTab == tab) {
                        viewModel.selectedTab = tab
                    }
                }
            }
        }
    }

    // MARK: - Tab Content

    @ViewBuilder
    private var tabContent: some View {
        switch viewModel.selectedTab {
        case .customers:
            customersTab
        case .debtors:
            debtorsTab
        case .aging:
            agingTab
        case .salesByCustomer:
            salesByCustomerTab
        }
    }

    // MARK: - Customers Tab

    private var customersTab: some View {
        VStack(spacing: 0) {
            SearchBar(text: $viewModel.searchText, placeholder: "Search customers...")
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.bottom, SpentySpacing.sm)

            if viewModel.filteredCustomers.isEmpty {
                EmptyState(
                    icon: "person.3",
                    title: "No Customers Yet",
                    message: viewModel.searchText.isEmpty
                        ? "Add your first customer to get started."
                        : "No customers match your search.",
                    actionTitle: viewModel.searchText.isEmpty ? "Add Customer" : nil,
                    action: viewModel.searchText.isEmpty ? { viewModel.showAddCustomer = true } : nil
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: SpentySpacing.sm) {
                        ForEach(viewModel.filteredCustomers) { customer in
                            customerRow(customer)
                                .contextMenu {
                                    Button {
                                        viewModel.showEditCustomer = customer
                                    } label: {
                                        Label("Edit", systemImage: "pencil")
                                    }

                                    Divider()

                                    Button(role: .destructive) {
                                        viewModel.showDeleteConfirm = customer
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        viewModel.showDeleteConfirm = customer
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }

                                    Button {
                                        viewModel.showEditCustomer = customer
                                    } label: {
                                        Label("Edit", systemImage: "pencil")
                                    }
                                    .tint(SpentyColors.brandAccent)
                                }
                        }
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.bottom, 80)
                }
            }
        }
    }

    private func customerRow(_ customer: Customer) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                Text(customer.name)
                    .font(SpentyFonts.subheading)
                    .foregroundStyle(SpentyColors.textPrimary)

                if let gstin = customer.gstin, !gstin.isEmpty {
                    Label(gstin, systemImage: "building.2")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                HStack(spacing: SpentySpacing.md) {
                    if let phone = customer.phone, !phone.isEmpty {
                        Label(phone, systemImage: "phone")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                    }

                    if let email = customer.email, !email.isEmpty {
                        Label(email, systemImage: "envelope")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                            .lineLimit(1)
                    }
                }
            }
        }
    }

    // MARK: - Debtors Tab

    private var debtorsTab: some View {
        Group {
            if viewModel.debtors.isEmpty {
                EmptyState(
                    icon: "checkmark.circle",
                    title: "No Outstanding Debtors",
                    message: "All customers are up to date with their payments."
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: SpentySpacing.sm) {
                        ForEach(viewModel.debtors) { debtor in
                            debtorRow(debtor)
                        }
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.bottom, SpentySpacing.xl)
                }
            }
        }
    }

    private func debtorRow(_ debtor: DebtorItem) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack(alignment: .top) {
                    Text(debtor.customerName)
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Spacer()

                    MoneyText(
                        debtor.totalOutstanding,
                        showSign: false,
                        size: SpentyFonts.subheading
                    )
                    .foregroundStyle(SpentyColors.danger)
                }

                HStack(spacing: SpentySpacing.md) {
                    Label(
                        "\(debtor.invoiceCount) invoice\(debtor.invoiceCount == 1 ? "" : "s")",
                        systemImage: "doc.text"
                    )
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)

                    if let oldest = debtor.oldestDate {
                        Label("Since \(formatDisplayDate(oldest))", systemImage: "calendar")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                    }
                }
            }
        }
    }

    // MARK: - Aging Tab

    private var agingTab: some View {
        Group {
            if let aging = viewModel.agingReport {
                ScrollView {
                    VStack(spacing: SpentySpacing.sm) {
                        agingBucketCard(
                            title: "Current",
                            icon: "clock",
                            iconColor: SpentyColors.success,
                            bucket: aging.current
                        )
                        agingBucketCard(
                            title: "1 - 30 Days",
                            icon: "clock.badge.exclamationmark",
                            iconColor: SpentyColors.brandAccent,
                            bucket: aging.period1_30
                        )
                        agingBucketCard(
                            title: "31 - 60 Days",
                            icon: "exclamationmark.circle",
                            iconColor: SpentyColors.warning,
                            bucket: aging.period31_60
                        )
                        agingBucketCard(
                            title: "61 - 90 Days",
                            icon: "exclamationmark.triangle",
                            iconColor: .orange,
                            bucket: aging.period61_90
                        )
                        agingBucketCard(
                            title: "90+ Days",
                            icon: "exclamationmark.octagon",
                            iconColor: SpentyColors.danger,
                            bucket: aging.period90Plus
                        )
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.bottom, SpentySpacing.xl)
                }
            } else {
                EmptyState(
                    icon: "chart.bar",
                    title: "No Aging Data",
                    message: "Aging data will appear once you have outstanding invoices."
                )
            }
        }
    }

    private func agingBucketCard(
        title: String,
        icon: String,
        iconColor: Color,
        bucket: AgingBucket
    ) -> some View {
        StatCard(
            title: title,
            value: formatCurrency(bucket.amount),
            subtitle: "\(bucket.count) invoice\(bucket.count == 1 ? "" : "s")",
            icon: icon,
            iconColor: iconColor
        )
    }

    // MARK: - Sales by Customer Tab

    private var salesByCustomerTab: some View {
        Group {
            if viewModel.salesByCustomer.isEmpty {
                EmptyState(
                    icon: "chart.line.uptrend.xyaxis",
                    title: "No Sales Data",
                    message: "Sales data will appear once you create invoices."
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: SpentySpacing.sm) {
                        ForEach(viewModel.salesByCustomer) { item in
                            salesRow(item)
                        }
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.bottom, SpentySpacing.xl)
                }
            }
        }
    }

    private func salesRow(_ item: SalesByCustomerItem) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack(alignment: .top) {
                    Text(item.customerName)
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Spacer()

                    MoneyText(
                        item.totalSales,
                        showSign: false,
                        size: SpentyFonts.subheading
                    )
                    .foregroundStyle(SpentyColors.success)
                }

                HStack(spacing: SpentySpacing.md) {
                    Label(
                        "\(item.invoiceCount) invoice\(item.invoiceCount == 1 ? "" : "s")",
                        systemImage: "doc.text"
                    )
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)

                    if let lastDate = item.lastInvoiceDate {
                        Label("Last: \(formatDisplayDate(lastDate))", systemImage: "calendar")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                    }
                }
            }
        }
    }

    // MARK: - FAB

    private var fabButton: some View {
        Button {
            viewModel.showAddCustomer = true
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

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.locale = Locale(identifier: "en_IN")
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }
}

// MARK: - Customer Form Sheet

struct CustomerFormSheet: View {
    let viewModel: CustomersViewModel
    let editing: Customer?

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var gstin = ""
    @State private var pan = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var billingAddress = ""
    @State private var city = ""
    @State private var state = ""
    @State private var pincode = ""
    @State private var notes = ""
    @State private var isSaving = false

    private var isEditing: Bool { editing != nil }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary.ignoresSafeArea()

                Form {
                    Section("Basic Information") {
                        TextField("Customer Name *", text: $name)
                        TextField("GSTIN", text: $gstin)
                            .textInputAutocapitalization(.characters)
                        TextField("PAN", text: $pan)
                            .textInputAutocapitalization(.characters)
                    }

                    Section("Contact") {
                        TextField("Phone", text: $phone)
                            .keyboardType(.phonePad)
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                    }

                    Section("Address") {
                        TextField("Billing Address", text: $billingAddress, axis: .vertical)
                            .lineLimit(2...4)
                        TextField("City", text: $city)
                        TextField("State", text: $state)
                        TextField("Pincode", text: $pincode)
                            .keyboardType(.numberPad)
                    }

                    Section("Notes") {
                        TextField("Notes", text: $notes, axis: .vertical)
                            .lineLimit(3...6)
                    }
                }
                .scrollContentBackground(.hidden)

                LoadingOverlay(isPresented: $isSaving)
            }
            .navigationTitle(isEditing ? "Edit Customer" : "New Customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Update" : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isValid || isSaving)
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                if let customer = editing {
                    name = customer.name
                    gstin = customer.gstin ?? ""
                    pan = customer.pan ?? ""
                    phone = customer.phone ?? ""
                    email = customer.email ?? ""
                    billingAddress = customer.billingAddress ?? ""
                    city = customer.city ?? ""
                    state = customer.state ?? ""
                    pincode = customer.pincode ?? ""
                    notes = customer.notes ?? ""
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        let create = CustomerCreate(
            name: name.trimmingCharacters(in: .whitespaces),
            gstin: gstin.isEmpty ? nil : gstin,
            pan: pan.isEmpty ? nil : pan,
            phone: phone.isEmpty ? nil : phone,
            email: email.isEmpty ? nil : email,
            billingAddress: billingAddress.isEmpty ? nil : billingAddress,
            city: city.isEmpty ? nil : city,
            state: state.isEmpty ? nil : state,
            pincode: pincode.isEmpty ? nil : pincode,
            notes: notes.isEmpty ? nil : notes
        )

        let success: Bool
        if let customer = editing {
            success = await viewModel.updateCustomer(customer.customerId, create)
        } else {
            success = await viewModel.createCustomer(create)
        }

        if success {
            dismiss()
        }
    }
}
