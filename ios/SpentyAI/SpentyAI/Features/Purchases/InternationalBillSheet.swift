import SwiftUI

struct InternationalBillSheet: View {
    @Environment(\.dismiss) private var dismiss

    let settings: AppSettings?
    var editBill: Bill? = nil
    var onSaved: (() async -> Void)?

    // MARK: - Form State

    @State private var billDate = Date()
    @State private var dueDate = Date()
    @State private var hasDueDate = false
    @State private var billReference = ""

    // Vendor
    @State private var vendorId = ""
    @State private var vendorName = ""
    @State private var vendorTaxId = ""
    @State private var vendorAddress = ""
    @State private var vendorSearchQuery = ""
    @State private var vendorResults: [Vendor] = []
    @State private var showVendorSearch = false
    @State private var isSearchingVendors = false
    @State private var showQuickAddVendor = false

    // Line items
    @State private var lineItems: [IntlBillLineItemForm] = [.empty()]

    // Payment
    @State private var paymentStatus = "unpaid"
    @State private var amountPaid = ""
    @State private var paymentMethod = "bank_transfer"
    @State private var paymentDate = Date()
    @State private var paymentAccountId = ""

    // Notes
    @State private var notes = ""
    @State private var termsConditions = ""

    // Accounts
    @State private var accounts: [Account] = []

    // Save state
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let billRepo = BillRepository()
    private let vendorRepo = VendorRepository()

    private var isEditing: Bool { editBill != nil }
    private var currency: String { settings?.baseCurrency ?? "USD" }

    private var countryConfig: CountryConfig? {
        CountryConfig.config(for: settings?.businessCountry ?? "US")
    }

    private var taxName: String { countryConfig?.taxName ?? "Tax" }
    private var taxIdLabel: String { countryConfig?.taxIdLabel ?? "Tax ID" }
    private var taxRateOptions: [Double] { countryConfig?.taxRateOptions ?? [0, 5, 10, 15, 20] }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SheetHeader(
                    isEditing ? "Edit Bill" : "New Bill",
                    subtitle: countryConfig?.name,
                    onClose: { dismiss() }
                )

                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        // AI Upload (new bills only)
                        if !isEditing {
                            uploadSection
                        }

                        vendorSection
                        billReferenceSection
                        datesSection
                        lineItemsSection
                        totalsSection
                        paymentSection
                        notesSection

                        if let error = errorMessage {
                            Text(error)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.danger)
                        }

                        PrimaryButton(
                            isEditing ? "Update Bill" : "Save Bill",
                            icon: "checkmark",
                            isLoading: isSaving,
                            isDisabled: !isFormValid,
                            isFullWidth: true
                        ) {
                            Task { await saveBill() }
                        }
                        .padding(.bottom, SpentySpacing.xxl)
                    }
                    .padding(SpentySpacing.lg)
                }
            }
            .background(SpentyColors.bgPrimary)
        }
        .task { await loadAccounts() }
        .onAppear { prefillFromEdit() }
    }

    // MARK: - Upload Section

    private var uploadSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("AI Auto-Fill")

            BillUploadParser { result in
                applyParseResult(result)
            }
        }
    }

    // MARK: - Vendor Section

    private var vendorSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Vendor Details", actionTitle: "Quick Add", action: {
                showQuickAddVendor.toggle()
            })

            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text("Vendor")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                HStack {
                    TextField("Search vendors...", text: $vendorSearchQuery)
                        .font(SpentyFonts.body)
                        .onChange(of: vendorSearchQuery) { _, query in
                            Task { await searchVendors(query) }
                        }
                        .onTapGesture { showVendorSearch = true }

                    if !vendorName.isEmpty {
                        Button {
                            clearVendor()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, SpentySpacing.md)
                .padding(.vertical, SpentySpacing.sm + 2)
                .background(SpentyColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: SpentyRadius.md)
                        .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                )

                if showVendorSearch && !vendorResults.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(vendorResults) { vendor in
                            Button {
                                selectVendor(vendor)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(vendor.name)
                                        .font(SpentyFonts.body)
                                        .foregroundStyle(SpentyColors.textPrimary)
                                    if let gstin = vendor.gstin, !gstin.isEmpty {
                                        Text(gstin)
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textMuted)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, SpentySpacing.md)
                                .padding(.vertical, SpentySpacing.sm)
                            }
                            .buttonStyle(.plain)

                            if vendor.id != vendorResults.last?.id {
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
                    .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
                }
            }

            if !vendorName.isEmpty && !showQuickAddVendor {
                SpentyCard {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text(vendorName)
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(SpentyColors.textPrimary)
                        if !vendorTaxId.isEmpty {
                            Text("\(taxIdLabel): \(vendorTaxId)")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)
                        }
                    }
                }
            }

            if showQuickAddVendor {
                VStack(spacing: SpentySpacing.sm) {
                    FormField("Vendor Name", text: $vendorName, placeholder: "Enter vendor name", isRequired: true)
                    FormField(taxIdLabel, text: $vendorTaxId, placeholder: "Tax identification number")
                    FormField("Address", text: $vendorAddress, placeholder: "Vendor address")
                }
            }
        }
    }

    // MARK: - Bill Reference

    private var billReferenceSection: some View {
        FormField(
            "Bill Reference",
            text: $billReference,
            placeholder: "Vendor's invoice/bill number"
        )
    }

    // MARK: - Dates Section

    private var datesSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Dates")

            DatePicker("Bill Date", selection: $billDate, displayedComponents: .date)
                .font(SpentyFonts.body)
                .tint(SpentyColors.brandAccent)

            Toggle("Set Due Date", isOn: $hasDueDate)
                .font(SpentyFonts.body)
                .tint(SpentyColors.brandAccent)

            if hasDueDate {
                DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)
                    .font(SpentyFonts.body)
                    .tint(SpentyColors.brandAccent)
            }
        }
    }

    // MARK: - Line Items Section

    private var lineItemsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Line Items", actionTitle: "Add Item", action: {
                lineItems.append(.empty())
            })

            ForEach(lineItems.indices, id: \.self) { index in
                lineItemRow(index: index)
            }
        }
    }

    private func lineItemRow(index: Int) -> some View {
        SpentyCard {
            VStack(spacing: SpentySpacing.sm) {
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

                FormField("Description", text: $lineItems[index].description, placeholder: "Item description")

                HStack(spacing: SpentySpacing.sm) {
                    FormField("Qty", text: $lineItems[index].quantity, placeholder: "1", keyboardType: .decimalPad)
                    FormField("Rate", text: $lineItems[index].rate, placeholder: "0.00", keyboardType: .decimalPad)
                }

                HStack(spacing: SpentySpacing.sm) {
                    FormField("Discount %", text: $lineItems[index].discountPercent, placeholder: "0", keyboardType: .decimalPad)

                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("\(taxName) Rate")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker(taxName, selection: $lineItems[index].taxRate) {
                            ForEach(taxRateOptions, id: \.self) { rate in
                                Text("\(rate, specifier: rate.truncatingRemainder(dividingBy: 1) == 0 ? "%.0f" : "%.1f")%")
                                    .tag(String(rate))
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(SpentyColors.textPrimary)
                    }
                }

                HStack {
                    Text("Amount:")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Spacer()
                    MoneyText(lineItems[index].computedAmount, currency: currency, size: SpentyFonts.body)
                }

                HStack {
                    Text("\(taxName):")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Spacer()
                    MoneyText(lineItems[index].computedTax, currency: currency, size: SpentyFonts.body)
                }
            }
        }
    }

    // MARK: - Totals Section

    private var totalsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Totals")

            SpentyCard {
                VStack(spacing: SpentySpacing.sm) {
                    totalRow("Subtotal", value: computedSubtotal)
                    totalRow(taxName, value: computedTaxTotal)

                    Divider()

                    HStack {
                        Text("Grand Total")
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(SpentyColors.textPrimary)
                        Spacer()
                        MoneyText(computedGrandTotal, currency: currency, size: SpentyFonts.subheading)
                    }
                }
            }
        }
    }

    private func totalRow(_ label: String, value: Double) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
            Spacer()
            MoneyText(value, currency: currency)
        }
    }

    // MARK: - Payment Section

    private var paymentSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Payment")

            Picker("Status", selection: $paymentStatus) {
                Text("Unpaid").tag("unpaid")
                Text("Partial").tag("partial")
                Text("Paid").tag("paid")
            }
            .pickerStyle(.segmented)

            if paymentStatus != "unpaid" {
                FormField(
                    "Amount Paid",
                    text: $amountPaid,
                    placeholder: "0.00",
                    keyboardType: .decimalPad
                )

                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("Payment Method")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)

                    Picker("Method", selection: $paymentMethod) {
                        Text("Bank Transfer").tag("bank_transfer")
                        Text("Cash").tag("cash")
                        Text("Card").tag("card")
                        Text("Check").tag("check")
                        Text("Other").tag("other")
                    }
                    .pickerStyle(.menu)
                    .tint(SpentyColors.textPrimary)
                }

                DatePicker("Payment Date", selection: $paymentDate, displayedComponents: .date)
                    .font(SpentyFonts.body)
                    .tint(SpentyColors.brandAccent)

                if !accounts.isEmpty {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("Payment Account")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker("Account", selection: $paymentAccountId) {
                            Text("Select Account").tag("")
                            ForEach(accounts) { account in
                                Text(account.name).tag(account.accountId)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(SpentyColors.textPrimary)
                    }
                }
            }
        }
    }

    // MARK: - Notes Section

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Additional Info")

            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text("Notes")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                TextEditor(text: $notes)
                    .font(SpentyFonts.body)
                    .frame(minHeight: 60)
                    .padding(SpentySpacing.sm)
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
                    .padding(SpentySpacing.sm)
                    .background(SpentyColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                    )
            }
        }
    }

    // MARK: - Computed Properties

    private var computedSubtotal: Double {
        lineItems.reduce(0) { $0 + $1.computedAmount }
    }

    private var computedTaxTotal: Double {
        lineItems.reduce(0) { $0 + $1.computedTax }
    }

    private var computedGrandTotal: Double {
        computedSubtotal + computedTaxTotal
    }

    private var isFormValid: Bool {
        !vendorName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lineItems.isEmpty
            && lineItems.allSatisfy { !$0.description.isEmpty && !$0.rate.isEmpty }
    }

    // MARK: - Actions

    private func searchVendors(_ query: String) async {
        guard query.count >= 2 else {
            vendorResults = []
            return
        }

        isSearchingVendors = true
        do {
            let result = try await vendorRepo.getVendors(query: query, limit: 10)
            vendorResults = result.items
            showVendorSearch = true
        } catch {
            vendorResults = []
        }
        isSearchingVendors = false
    }

    private func selectVendor(_ vendor: Vendor) {
        vendorId = vendor.vendorId
        vendorName = vendor.name
        vendorTaxId = vendor.gstin ?? ""
        vendorAddress = vendor.billingAddress ?? ""
        vendorSearchQuery = vendor.name
        showVendorSearch = false
        vendorResults = []
    }

    private func clearVendor() {
        vendorId = ""
        vendorName = ""
        vendorTaxId = ""
        vendorAddress = ""
        vendorSearchQuery = ""
        showVendorSearch = false
    }

    private func applyParseResult(_ result: BillParseResult) {
        let data = result.parsedData

        if let name = data.vendorName { vendorName = name; vendorSearchQuery = name }
        if let gstin = data.vendorGstin { vendorTaxId = gstin }
        if let ref = data.billReference { billReference = ref }
        if let n = data.notes { notes = n }

        if let matchedId = data.matchedVendorId { vendorId = matchedId }
        if let matchedName = data.matchedVendorName {
            vendorName = matchedName
            vendorSearchQuery = matchedName
        }

        if let dateStr = data.billDate, let date = DateFormatting.parseISO(dateStr) {
            billDate = date
        }
        if let dueDateStr = data.dueDate, let date = DateFormatting.parseISO(dueDateStr) {
            dueDate = date
            hasDueDate = true
        }

        if let items = data.lineItems, !items.isEmpty {
            lineItems = items.map { item in
                IntlBillLineItemForm(
                    description: item.description ?? "",
                    quantity: item.quantity.map { String($0) } ?? "1",
                    rate: item.rate.map { String($0) } ?? "",
                    discountPercent: item.discountPercent.map { String($0) } ?? "0",
                    taxRate: item.gstRate.map { String($0) } ?? "0"
                )
            }
        }
    }

    private func loadAccounts() async {
        do {
            accounts = try await AccountRepository().getAccounts()
        } catch {}
    }

    private func prefillFromEdit() {
        guard let bill = editBill else {
            termsConditions = settings?.billTerms ?? ""
            return
        }

        vendorId = bill.vendorId ?? ""
        vendorName = bill.vendorName ?? ""
        vendorSearchQuery = bill.vendorName ?? ""
        vendorTaxId = bill.vendorGstin ?? ""
        vendorAddress = bill.vendorAddress ?? ""
        billReference = bill.poNumber ?? ""
        notes = bill.notes ?? ""
        termsConditions = bill.termsConditions ?? settings?.billTerms ?? ""
        paymentStatus = bill.paymentStatus ?? "unpaid"
        paymentMethod = bill.paymentMethod ?? "bank_transfer"
        paymentAccountId = bill.paymentAccountId ?? ""

        if let paid = bill.amountPaid, paid > 0 {
            amountPaid = String(paid)
        }

        if let dateStr = bill.billDate, let date = DateFormatting.parseISO(dateStr) {
            billDate = date
        }
        if let dueDateStr = bill.dueDate, let date = DateFormatting.parseISO(dueDateStr) {
            dueDate = date
            hasDueDate = true
        }
        if let pDateStr = bill.paymentDate, let date = DateFormatting.parseISO(pDateStr) {
            paymentDate = date
        }

        if let items = bill.lineItems, !items.isEmpty {
            lineItems = items.map { item in
                IntlBillLineItemForm(
                    description: item.description ?? "",
                    quantity: String(item.quantity),
                    rate: String(item.rate),
                    discountPercent: item.discountPercent.map { String($0) } ?? "0",
                    taxRate: item.gstRate.map { String($0) } ?? "0"
                )
            }
        }
    }

    @MainActor
    private func saveBill() async {
        guard isFormValid else {
            errorMessage = "Please fill in all required fields."
            return
        }

        isSaving = true
        errorMessage = nil

        let billDateStr = DateFormatting.format(billDate, format: "yyyy-MM-dd")
        let dueDateStr = hasDueDate ? DateFormatting.format(dueDate, format: "yyyy-MM-dd") : nil
        let payDateStr = paymentStatus != "unpaid"
            ? DateFormatting.format(paymentDate, format: "yyyy-MM-dd")
            : nil

        let createLineItems: [LineItemCreate] = lineItems.map { item in
            LineItemCreate(
                description: item.description,
                quantity: Double(item.quantity) ?? 1,
                rate: Double(item.rate) ?? 0,
                discountPercent: Double(item.discountPercent),
                gstRate: Double(item.taxRate),
                hsnSac: nil
            )
        }

        let create = BillCreate(
            billType: "international",
            billDate: billDateStr,
            dueDate: dueDateStr,
            vendorId: vendorId.isEmpty ? vendorName : vendorId,
            vendorName: vendorName,
            vendorGstin: vendorTaxId.isEmpty ? nil : vendorTaxId,
            vendorAddress: vendorAddress.isEmpty ? nil : vendorAddress,
            vendorState: nil,
            placeOfSupply: nil,
            lineItems: createLineItems,
            paymentStatus: paymentStatus,
            amountPaid: paymentStatus != "unpaid" ? Double(amountPaid) : nil,
            paymentAccountId: paymentStatus != "unpaid" && !paymentAccountId.isEmpty ? paymentAccountId : nil,
            paymentMethod: paymentStatus != "unpaid" ? paymentMethod : nil,
            paymentDate: payDateStr,
            poNumber: billReference.isEmpty ? nil : billReference,
            notes: notes.isEmpty ? nil : notes,
            termsConditions: termsConditions.isEmpty ? nil : termsConditions
        )

        do {
            if let existingBill = editBill {
                _ = try await billRepo.updateBill(existingBill.billId, create)
            } else {
                _ = try await billRepo.createBill(create)
            }

            if let onSaved {
                await onSaved()
            }
            dismiss()
        } catch {
            errorMessage = "Failed to save bill: \(error.localizedDescription)"
        }

        isSaving = false
    }
}

// MARK: - International Line Item Form Model

struct IntlBillLineItemForm: Identifiable {
    let id = UUID()
    var description: String
    var quantity: String
    var rate: String
    var discountPercent: String
    var taxRate: String

    static func empty() -> IntlBillLineItemForm {
        IntlBillLineItemForm(
            description: "",
            quantity: "1",
            rate: "",
            discountPercent: "0",
            taxRate: "0"
        )
    }

    var computedAmount: Double {
        let qty = Double(quantity) ?? 0
        let r = Double(rate) ?? 0
        let discount = Double(discountPercent) ?? 0
        let base = qty * r
        return base - (base * discount / 100)
    }

    var computedTax: Double {
        let tax = Double(taxRate) ?? 0
        return computedAmount * tax / 100
    }
}
