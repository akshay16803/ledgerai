import SwiftUI

struct SalesInvoiceSheet: View {
    let editingInvoice: Invoice?
    let settings: AppSettings?
    let onSaved: (Invoice) -> Void

    @Environment(\.dismiss) private var dismiss

    // MARK: - Form State

    @State private var invoiceType = "simple"
    @State private var invoiceDate = Date()
    @State private var dueDate = Date().addingTimeInterval(30 * 24 * 3600)

    // Customer
    @State private var customerQuery = ""
    @State private var customerSuggestions: [Customer] = []
    @State private var selectedCustomer: Customer?
    @State private var customerName = ""
    @State private var customerGstin = ""
    @State private var customerAddress = ""
    @State private var customerState = ""
    @State private var showCustomerSearch = true

    // Place of supply
    @State private var placeOfSupply = ""

    // Line items
    @State private var lineItems: [EditableLineItem] = [EditableLineItem()]

    // Payment
    @State private var paymentStatus = "unpaid"
    @State private var amountPaid = ""
    @State private var paymentMethod = "bank_transfer"
    @State private var paymentDate = Date()
    @State private var paymentAccountId = ""

    // Notes
    @State private var notes = ""
    @State private var termsConditions = ""

    // UI State
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showGstinWarning = false
    @State private var isSearchingCustomers = false

    private let invoiceRepo = InvoiceRepository()
    private let customerRepo = CustomerRepository()

    private var isEditing: Bool { editingInvoice != nil }

    // MARK: - Indian States

    static let indianStates = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
        "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
        "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
        "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
        "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
        "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
        "Andaman and Nicobar Islands", "Chandigarh",
        "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
        "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
    ]

    static let gstRates: [Double] = [0, 5, 12, 18, 28]

    static let paymentMethods = [
        ("bank_transfer", "Bank Transfer"),
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("cheque", "Cheque"),
        ("card", "Card"),
        ("other", "Other")
    ]

    // MARK: - Computed

    private var firmState: String {
        settings?.firmState ?? ""
    }

    private var isSameState: Bool {
        let supply = placeOfSupply.isEmpty ? customerState : placeOfSupply
        guard !supply.isEmpty, !firmState.isEmpty else { return true }
        return supply.lowercased() == firmState.lowercased()
    }

    private var subtotal: Double {
        lineItems.reduce(0) { $0 + $1.amount }
    }

    private var taxTotal: Double {
        lineItems.reduce(0) { $0 + $1.taxAmount }
    }

    private var grandTotal: Double {
        subtotal + taxTotal
    }

    private var cgstTotal: Double { taxTotal / 2 }
    private var sgstTotal: Double { taxTotal / 2 }
    private var igstTotal: Double { taxTotal }

    private var canSave: Bool {
        !customerName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lineItems.isEmpty
            && lineItems.allSatisfy { !($0.description.isEmpty) && $0.quantity > 0 && $0.rate > 0 }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: SpentySpacing.xl) {
                    invoiceTypeSection
                    customerSection
                    datesSection
                    lineItemsSection
                    totalsSection
                    paymentSection
                    notesSection
                    saveSection
                }
                .padding(SpentySpacing.lg)
            }
            .background(SpentyColors.bgPrimary)
            .safeAreaInset(edge: .top) {
                SheetHeader(
                    isEditing ? "Edit Invoice" : "New Sales Invoice",
                    subtitle: "India GST Invoice",
                    onClose: { dismiss() }
                )
                .background(SpentyColors.surface)
            }
            .onAppear { populateFromEdit() }
            .alert("GSTIN Not Set", isPresented: $showGstinWarning) {
                Button("Continue Anyway") { }
                Button("Cancel", role: .cancel) {
                    invoiceType = "simple"
                }
            } message: {
                Text("Your business GSTIN is not set in settings. GST invoices require a valid GSTIN.")
            }
        }
    }

    // MARK: - Invoice Type

    private var invoiceTypeSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Invoice Type")

            Picker("Type", selection: $invoiceType) {
                Text("Simple").tag("simple")
                Text("GST").tag("gst")
            }
            .pickerStyle(.segmented)
            .onChange(of: invoiceType) { _, newValue in
                if newValue == "gst" {
                    let gstin = settings?.firmGstin ?? ""
                    if gstin.trimmingCharacters(in: .whitespaces).isEmpty {
                        showGstinWarning = true
                    }
                }
            }
        }
    }

    // MARK: - Customer

    private var customerSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Customer")

            if showCustomerSearch {
                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    FormField(
                        "Search Customer",
                        text: $customerQuery,
                        placeholder: "Type customer name..."
                    )
                    .onChange(of: customerQuery) { _, query in
                        searchCustomers(query: query)
                    }

                    if !customerSuggestions.isEmpty {
                        VStack(spacing: 0) {
                            ForEach(customerSuggestions) { customer in
                                Button {
                                    selectCustomer(customer)
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(customer.name)
                                                .font(SpentyFonts.body)
                                                .foregroundStyle(SpentyColors.textPrimary)
                                            if let gstin = customer.gstin, !gstin.isEmpty {
                                                Text(gstin)
                                                    .font(SpentyFonts.caption)
                                                    .foregroundStyle(SpentyColors.textMuted)
                                            }
                                        }
                                        Spacer()
                                    }
                                    .padding(.horizontal, SpentySpacing.md)
                                    .padding(.vertical, SpentySpacing.sm)
                                }
                                .buttonStyle(.plain)

                                if customer.id != customerSuggestions.last?.id {
                                    Divider()
                                }
                            }
                        }
                        .background(SpentyColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: SpentyRadius.md)
                                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                        )
                    }

                    Button {
                        showCustomerSearch = false
                        customerQuery = ""
                        customerSuggestions = []
                    } label: {
                        Label("Add new customer", systemImage: "plus.circle")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.brandAccent)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                // Manual entry
                if selectedCustomer != nil {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(customerName)
                                .font(SpentyFonts.body)
                                .foregroundStyle(SpentyColors.textPrimary)
                            if !customerGstin.isEmpty {
                                Text(customerGstin)
                                    .font(SpentyFonts.caption)
                                    .foregroundStyle(SpentyColors.textMuted)
                            }
                        }
                        Spacer()
                        Button {
                            clearCustomer()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(SpentySpacing.md)
                    .background(SpentyColors.bgSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                }

                FormField("Customer Name", text: $customerName, placeholder: "Business name", isRequired: true)
                FormField("GSTIN", text: $customerGstin, placeholder: "e.g., 22AAAAA0000A1Z5")
                FormField("Address", text: $customerAddress, placeholder: "Billing address")

                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    HStack(spacing: 2) {
                        Text("State")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }
                    Picker("State", selection: $customerState) {
                        Text("Select State").tag("")
                        ForEach(Self.indianStates, id: \.self) { state in
                            Text(state).tag(state)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, SpentySpacing.md)
                    .padding(.vertical, SpentySpacing.sm)
                    .background(SpentyColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                    )
                }

                Button {
                    showCustomerSearch = true
                } label: {
                    Label("Search existing customers", systemImage: "magnifyingglass")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.brandAccent)
                }
                .buttonStyle(.plain)
            }

            // Place of Supply (for GST)
            if invoiceType == "gst" {
                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    HStack(spacing: 2) {
                        Text("Place of Supply")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }
                    Picker("Place of Supply", selection: $placeOfSupply) {
                        Text("Same as customer state").tag("")
                        ForEach(Self.indianStates, id: \.self) { state in
                            Text(state).tag(state)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, SpentySpacing.md)
                    .padding(.vertical, SpentySpacing.sm)
                    .background(SpentyColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                    )

                    if !isSameState {
                        Text("Inter-state supply: IGST will apply")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.info)
                    }
                }
            }
        }
    }

    // MARK: - Dates

    private var datesSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Dates")

            HStack(spacing: SpentySpacing.md) {
                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("Invoice Date")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    DatePicker("", selection: $invoiceDate, displayedComponents: .date)
                        .labelsHidden()
                }

                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("Due Date")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    DatePicker("", selection: $dueDate, displayedComponents: .date)
                        .labelsHidden()
                }
            }
        }
    }

    // MARK: - Line Items

    private var lineItemsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Line Items")

            ForEach(lineItems.indices, id: \.self) { index in
                lineItemRow(index: index)
            }

            Button {
                lineItems.append(EditableLineItem())
            } label: {
                Label("Add Item", systemImage: "plus.circle.fill")
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.brandAccent)
            }
            .buttonStyle(.plain)
        }
    }

    private func lineItemRow(index: Int) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack {
                    Text("Item \(index + 1)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textMuted)
                    Spacer()
                    if lineItems.count > 1 {
                        Button {
                            lineItems.remove(at: index)
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 14))
                                .foregroundStyle(SpentyColors.danger)
                        }
                        .buttonStyle(.plain)
                    }
                }

                FormField(
                    "Description",
                    text: $lineItems[index].description,
                    placeholder: "Item description",
                    isRequired: true
                )

                if invoiceType == "gst" {
                    FormField(
                        "HSN/SAC Code",
                        text: $lineItems[index].hsnSac,
                        placeholder: "e.g., 9983"
                    )
                }

                HStack(spacing: SpentySpacing.sm) {
                    FormField(
                        "Qty",
                        text: $lineItems[index].quantityStr,
                        placeholder: "1",
                        keyboardType: .decimalPad,
                        isRequired: true
                    )

                    FormField(
                        "Rate",
                        text: $lineItems[index].rateStr,
                        placeholder: "0.00",
                        keyboardType: .decimalPad,
                        isRequired: true
                    )
                }

                HStack(spacing: SpentySpacing.sm) {
                    FormField(
                        "Discount %",
                        text: $lineItems[index].discountStr,
                        placeholder: "0",
                        keyboardType: .decimalPad
                    )

                    if invoiceType == "gst" {
                        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                            Text("GST Rate")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)
                            Picker("GST", selection: $lineItems[index].gstRate) {
                                ForEach(Self.gstRates, id: \.self) { rate in
                                    Text("\(Int(rate))%").tag(rate)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, SpentySpacing.md)
                            .padding(.vertical, SpentySpacing.sm)
                            .background(SpentyColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: SpentyRadius.md)
                                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                            )
                        }
                    }
                }

                // Computed line totals
                HStack {
                    Text("Amount:")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textMuted)
                    Spacer()
                    MoneyText(lineItems[index].amount, currency: "INR", size: SpentyFonts.body)
                }

                if invoiceType == "gst" && lineItems[index].gstRate > 0 {
                    HStack {
                        Text("Tax (\(Int(lineItems[index].gstRate))%):")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                        Spacer()
                        MoneyText(lineItems[index].taxAmount, currency: "INR", size: SpentyFonts.caption)
                    }
                }
            }
        }
    }

    // MARK: - Totals

    private var totalsSection: some View {
        SpentyCard {
            VStack(spacing: SpentySpacing.sm) {
                HStack {
                    Text("Subtotal")
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Spacer()
                    MoneyText(subtotal, currency: "INR")
                }

                if invoiceType == "gst" && taxTotal > 0 {
                    Divider()

                    if isSameState {
                        HStack {
                            Text("CGST")
                                .font(SpentyFonts.body)
                                .foregroundStyle(SpentyColors.textSecondary)
                            Spacer()
                            MoneyText(cgstTotal, currency: "INR")
                        }
                        HStack {
                            Text("SGST")
                                .font(SpentyFonts.body)
                                .foregroundStyle(SpentyColors.textSecondary)
                            Spacer()
                            MoneyText(sgstTotal, currency: "INR")
                        }
                    } else {
                        HStack {
                            Text("IGST")
                                .font(SpentyFonts.body)
                                .foregroundStyle(SpentyColors.textSecondary)
                            Spacer()
                            MoneyText(igstTotal, currency: "INR")
                        }
                    }
                }

                Divider()

                HStack {
                    Text("Grand Total")
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)
                    Spacer()
                    MoneyText(grandTotal, currency: "INR", size: SpentyFonts.subheading)
                }
            }
        }
    }

    // MARK: - Payment

    private var paymentSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Payment")

            Picker("Status", selection: $paymentStatus) {
                Text("Unpaid").tag("unpaid")
                Text("Partial").tag("partial")
                Text("Paid").tag("paid")
            }
            .pickerStyle(.segmented)

            if paymentStatus == "paid" || paymentStatus == "partial" {
                FormField(
                    "Amount Paid",
                    text: $amountPaid,
                    placeholder: paymentStatus == "paid"
                        ? String(format: "%.2f", grandTotal)
                        : "0.00",
                    keyboardType: .decimalPad
                )

                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("Payment Method")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Picker("Method", selection: $paymentMethod) {
                        ForEach(Self.paymentMethods, id: \.0) { method in
                            Text(method.1).tag(method.0)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, SpentySpacing.md)
                    .padding(.vertical, SpentySpacing.sm)
                    .background(SpentyColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                    )
                }

                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("Payment Date")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    DatePicker("", selection: $paymentDate, displayedComponents: .date)
                        .labelsHidden()
                }
            }
        }
    }

    // MARK: - Notes

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Notes & Terms")

            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text("Notes")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
                TextEditor(text: $notes)
                    .font(SpentyFonts.body)
                    .frame(minHeight: 60)
                    .padding(SpentySpacing.xs)
                    .background(SpentyColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                    )
            }

            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text("Terms & Conditions")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
                TextEditor(text: $termsConditions)
                    .font(SpentyFonts.body)
                    .frame(minHeight: 60)
                    .padding(SpentySpacing.xs)
                    .background(SpentyColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                    )
            }
        }
    }

    // MARK: - Save

    private var saveSection: some View {
        VStack(spacing: SpentySpacing.sm) {
            if let error = errorMessage {
                Text(error)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            PrimaryButton(
                isEditing ? "Update Invoice" : "Save Invoice",
                icon: "checkmark",
                isLoading: isSaving,
                isDisabled: !canSave,
                isFullWidth: true,
                action: { Task { await saveInvoice() } }
            )
        }
        .padding(.bottom, SpentySpacing.xl)
    }

    // MARK: - Actions

    private func searchCustomers(query: String) {
        guard query.count >= 2 else {
            customerSuggestions = []
            return
        }
        Task {
            isSearchingCustomers = true
            do {
                let result = try await customerRepo.getCustomers(query: query, limit: 5)
                await MainActor.run {
                    customerSuggestions = result.items
                }
            } catch {
                // Silently fail search
            }
            isSearchingCustomers = false
        }
    }

    private func selectCustomer(_ customer: Customer) {
        selectedCustomer = customer
        customerName = customer.name
        customerGstin = customer.gstin ?? ""
        customerAddress = [customer.billingAddress, customer.city, customer.pincode]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        customerState = customer.state ?? ""
        customerSuggestions = []
        customerQuery = ""
        showCustomerSearch = false
    }

    private func clearCustomer() {
        selectedCustomer = nil
        customerName = ""
        customerGstin = ""
        customerAddress = ""
        customerState = ""
        showCustomerSearch = true
    }

    @MainActor
    private func saveInvoice() async {
        isSaving = true
        errorMessage = nil

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let items = lineItems.map { item in
            LineItemCreate(
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                discountPercent: item.discount > 0 ? item.discount : nil,
                gstRate: invoiceType == "gst" ? item.gstRate / 100 : nil,
                hsnSac: item.hsnSac.isEmpty ? nil : item.hsnSac
            )
        }

        let paidAmount: Double? = {
            if paymentStatus == "paid" {
                return Double(amountPaid) ?? grandTotal
            } else if paymentStatus == "partial" {
                return Double(amountPaid) ?? 0
            }
            return nil
        }()

        let supply = placeOfSupply.isEmpty ? (customerState.isEmpty ? nil : customerState) : placeOfSupply

        let create = InvoiceCreate(
            invoiceType: invoiceType,
            invoiceDate: dateFormatter.string(from: invoiceDate),
            dueDate: dateFormatter.string(from: dueDate),
            customerId: selectedCustomer?.customerId ?? "",
            customerName: customerName.trimmingCharacters(in: .whitespaces),
            customerGstin: customerGstin.isEmpty ? nil : customerGstin,
            customerAddress: customerAddress.isEmpty ? nil : customerAddress,
            customerState: customerState.isEmpty ? nil : customerState,
            placeOfSupply: supply,
            lineItems: items,
            paymentStatus: paymentStatus,
            amountPaid: paidAmount,
            paymentAccountId: paymentAccountId.isEmpty ? nil : paymentAccountId,
            paymentMethod: (paymentStatus != "unpaid") ? paymentMethod : nil,
            paymentDate: (paymentStatus != "unpaid") ? dateFormatter.string(from: paymentDate) : nil,
            notes: notes.isEmpty ? nil : notes,
            termsConditions: termsConditions.isEmpty ? nil : termsConditions
        )

        do {
            let saved: Invoice
            if let existing = editingInvoice {
                saved = try await invoiceRepo.updateInvoice(existing.invoiceId, create)
            } else {
                saved = try await invoiceRepo.createInvoice(create)
            }
            Haptics.success()
            onSaved(saved)
        } catch {
            errorMessage = "Failed to save invoice. Please try again."
            Haptics.error()
        }

        isSaving = false
    }

    // MARK: - Populate from Edit

    private func populateFromEdit() {
        guard let invoice = editingInvoice else {
            termsConditions = settings?.invoiceTerms ?? ""
            return
        }

        invoiceType = invoice.invoiceType ?? "simple"
        customerName = invoice.customerName ?? ""
        customerGstin = invoice.customerGstin ?? ""
        customerAddress = invoice.customerAddress ?? ""
        customerState = invoice.customerState ?? ""
        placeOfSupply = invoice.placeOfSupply ?? ""
        paymentStatus = invoice.paymentStatus ?? "unpaid"
        amountPaid = invoice.amountPaid.map { String(format: "%.2f", $0) } ?? ""
        paymentMethod = invoice.paymentMethod ?? "bank_transfer"
        notes = invoice.notes ?? ""
        termsConditions = invoice.termsConditions ?? settings?.invoiceTerms ?? ""

        if let dateStr = invoice.invoiceDate {
            invoiceDate = parseDate(dateStr) ?? Date()
        }
        if let dateStr = invoice.dueDate {
            dueDate = parseDate(dateStr) ?? Date().addingTimeInterval(30 * 24 * 3600)
        }
        if let dateStr = invoice.paymentDate {
            paymentDate = parseDate(dateStr) ?? Date()
        }

        if let items = invoice.lineItems, !items.isEmpty {
            lineItems = items.map { item in
                EditableLineItem(
                    description: item.description ?? "",
                    hsnSac: item.hsnSac ?? "",
                    quantityStr: item.quantity > 0 ? String(format: "%g", item.quantity) : "",
                    rateStr: item.rate > 0 ? String(format: "%.2f", item.rate) : "",
                    discountStr: item.discountPercent.map { String(format: "%g", $0) } ?? "",
                    gstRate: (item.gstRate ?? 0) * 100
                )
            }
        }

        if let customerId = invoice.customerId, !customerId.isEmpty {
            showCustomerSearch = false
        } else {
            showCustomerSearch = false
        }
    }

    private func parseDate(_ string: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: string) { return d }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: string) { return d }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: string)
    }
}

// MARK: - Editable Line Item

struct EditableLineItem: Identifiable {
    let id = UUID()
    var description: String = ""
    var hsnSac: String = ""
    var quantityStr: String = ""
    var rateStr: String = ""
    var discountStr: String = ""
    var gstRate: Double = 18

    var quantity: Double { Double(quantityStr) ?? 0 }
    var rate: Double { Double(rateStr) ?? 0 }
    var discount: Double { Double(discountStr) ?? 0 }

    var amount: Double {
        let base = quantity * rate
        let discountAmount = base * (discount / 100)
        return base - discountAmount
    }

    var taxAmount: Double {
        amount * (gstRate / 100)
    }
}
