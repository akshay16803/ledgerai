import SwiftUI

struct InternationalInvoiceSheet: View {
    let editingInvoice: Invoice?
    let settings: AppSettings?
    let onSaved: (Invoice) -> Void

    @Environment(\.dismiss) private var dismiss

    // MARK: - Form State

    @State private var invoiceDate = Date()
    @State private var dueDate = Date().addingTimeInterval(30 * 24 * 3600)

    // Customer
    @State private var customerQuery = ""
    @State private var customerSuggestions: [Customer] = []
    @State private var selectedCustomer: Customer?
    @State private var customerName = ""
    @State private var customerTaxId = ""
    @State private var customerAddress = ""
    @State private var showCustomerSearch = true

    // Line items
    @State private var lineItems: [EditableLineItem] = [EditableLineItem()]

    // Payment
    @State private var paymentStatus = "unpaid"
    @State private var amountPaid = ""
    @State private var paymentMethod = "bank_transfer"
    @State private var paymentDate = Date()

    // Notes
    @State private var notes = ""
    @State private var termsConditions = ""

    // UI State
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let invoiceRepo = InvoiceRepository()
    private let customerRepo = CustomerRepository()

    private var isEditing: Bool { editingInvoice != nil }

    // MARK: - Country Config

    private var countryConfig: CountryConfig {
        if let code = settings?.businessCountry,
           let config = CountryConfig.config(for: code) {
            return config
        }
        return CountryConfig(
            code: "US", name: "United States", currency: "USD",
            taxName: "Tax", taxIdLabel: "Tax ID",
            taxRateOptions: [0, 5, 10, 15, 20],
            dateFormat: "MM/dd/yyyy",
            invoiceTitle: "Invoice", billTitle: "Bill"
        )
    }

    private var taxRates: [Double] { countryConfig.taxRateOptions }
    private var currency: String { countryConfig.currency }

    static let paymentMethods = [
        ("bank_transfer", "Bank Transfer"),
        ("cash", "Cash"),
        ("cheque", "Cheque"),
        ("card", "Card"),
        ("paypal", "PayPal"),
        ("other", "Other")
    ]

    // MARK: - Computed

    private var subtotal: Double {
        lineItems.reduce(0) { $0 + $1.amount }
    }

    private var taxTotal: Double {
        lineItems.reduce(0) { $0 + $1.taxAmount }
    }

    private var grandTotal: Double {
        subtotal + taxTotal
    }

    private var canSave: Bool {
        !customerName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lineItems.isEmpty
            && lineItems.allSatisfy { !$0.description.isEmpty && $0.quantity > 0 && $0.rate > 0 }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: SpentySpacing.xl) {
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
                    isEditing ? "Edit \(countryConfig.invoiceTitle)" : "New \(countryConfig.invoiceTitle)",
                    subtitle: countryConfig.name,
                    onClose: { dismiss() }
                )
                .background(SpentyColors.surface)
            }
            .onAppear { populateFromEdit() }
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
                                        Text(customer.name)
                                            .font(SpentyFonts.body)
                                            .foregroundStyle(SpentyColors.textPrimary)
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
                if selectedCustomer != nil {
                    HStack {
                        Text(customerName)
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textPrimary)
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
                FormField(countryConfig.taxIdLabel, text: $customerTaxId, placeholder: "e.g., \(countryConfig.taxIdLabel)")
                FormField("Address", text: $customerAddress, placeholder: "Full address")

                Button {
                    showCustomerSearch = true
                } label: {
                    Label("Search existing customers", systemImage: "magnifyingglass")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.brandAccent)
                }
                .buttonStyle(.plain)
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

                HStack(spacing: SpentySpacing.sm) {
                    FormField(
                        "Qty",
                        text: $lineItems[index].quantityStr,
                        placeholder: "1",
                        keyboardType: .decimalPad,
                        isRequired: true
                    )

                    FormField(
                        "Rate (\(currency))",
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

                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("\(countryConfig.taxName) Rate")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                        Picker(countryConfig.taxName, selection: $lineItems[index].gstRate) {
                            ForEach(taxRates, id: \.self) { rate in
                                Text("\(rate, specifier: "%g")%").tag(rate)
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

                HStack {
                    Text("Amount:")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textMuted)
                    Spacer()
                    MoneyText(lineItems[index].amount, currency: currency, size: SpentyFonts.body)
                }

                if lineItems[index].gstRate > 0 {
                    HStack {
                        Text("\(countryConfig.taxName) (\(lineItems[index].gstRate, specifier: "%g")%):")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                        Spacer()
                        MoneyText(lineItems[index].taxAmount, currency: currency, size: SpentyFonts.caption)
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
                    MoneyText(subtotal, currency: currency)
                }

                if taxTotal > 0 {
                    Divider()
                    HStack {
                        Text(countryConfig.taxName)
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textSecondary)
                        Spacer()
                        MoneyText(taxTotal, currency: currency)
                    }
                }

                Divider()

                HStack {
                    Text("Grand Total")
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)
                    Spacer()
                    MoneyText(grandTotal, currency: currency, size: SpentyFonts.subheading)
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
                    "Amount Paid (\(currency))",
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
                isEditing ? "Update \(countryConfig.invoiceTitle)" : "Save \(countryConfig.invoiceTitle)",
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
            do {
                let result = try await customerRepo.getCustomers(query: query, limit: 5)
                await MainActor.run {
                    customerSuggestions = result.items
                }
            } catch {
                // Silently fail
            }
        }
    }

    private func selectCustomer(_ customer: Customer) {
        selectedCustomer = customer
        customerName = customer.name
        customerTaxId = customer.gstin ?? ""
        customerAddress = [customer.billingAddress, customer.city, customer.state, customer.pincode]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        customerSuggestions = []
        customerQuery = ""
        showCustomerSearch = false
    }

    private func clearCustomer() {
        selectedCustomer = nil
        customerName = ""
        customerTaxId = ""
        customerAddress = ""
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
                gstRate: item.gstRate > 0 ? item.gstRate / 100 : nil,
                hsnSac: nil
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

        let create = InvoiceCreate(
            invoiceType: "simple",
            invoiceDate: dateFormatter.string(from: invoiceDate),
            dueDate: dateFormatter.string(from: dueDate),
            customerId: selectedCustomer?.customerId ?? "",
            customerName: customerName.trimmingCharacters(in: .whitespaces),
            customerGstin: customerTaxId.isEmpty ? nil : customerTaxId,
            customerAddress: customerAddress.isEmpty ? nil : customerAddress,
            customerState: nil,
            placeOfSupply: nil,
            lineItems: items,
            paymentStatus: paymentStatus,
            amountPaid: paidAmount,
            paymentAccountId: nil,
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
            // Default tax rate for new items
            if let firstRate = taxRates.last(where: { $0 > 0 }) ?? taxRates.first {
                for i in lineItems.indices {
                    lineItems[i].gstRate = firstRate
                }
            }
            return
        }

        customerName = invoice.customerName ?? ""
        customerTaxId = invoice.customerGstin ?? ""
        customerAddress = invoice.customerAddress ?? ""
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
                    hsnSac: "",
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
