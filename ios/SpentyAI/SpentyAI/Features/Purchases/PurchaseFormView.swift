import SwiftUI

struct PurchaseFormView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @Bindable var viewModel: PurchasesViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var billNumber = ""
    @State private var selectedVendorId: String?
    @State private var vendorName = ""
    @State private var date = Date()
    @State private var dueDate = Date().addingTimeInterval(30 * 24 * 3600)
    @State private var lineItems: [PurchaseFormLineItem] = [PurchaseFormLineItem()]
    @State private var notes = ""
    @State private var showValidation = false
    @State private var isSaving = false

    private var isEditing: Bool { viewModel.editingBill != nil }

    // MARK: - Computed

    private var subtotal: Double {
        lineItems.reduce(0) { $0 + $1.computedAmount }
    }

    private var taxAmount: Double {
        lineItems.reduce(0) { total, item in
            total + (item.computedAmount * (item.taxRate / 100))
        }
    }

    private var grandTotal: Double {
        subtotal + taxAmount
    }

    private var hasValidLineItems: Bool {
        lineItems.contains { !$0.description.isEmpty }
    }

    private var isValid: Bool {
        !vendorName.trimmingCharacters(in: .whitespaces).isEmpty && hasValidLineItems
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    billDetailsSection
                    vendorSection
                    datesSection
                    lineItemsSection
                    totalsSection
                    notesSection
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(isEditing ? lang.s("edit_bill") : lang.s("new_bill"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(lang.s("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(lang.s("save")) {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.spentyPrimary)
                    .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .onAppear {
                populateFields()
            }
            .task {
                await viewModel.getNextNumber()
                if !isEditing && billNumber.isEmpty {
                    billNumber = viewModel.nextNumber
                }
            }
        }
    }

    // MARK: - Bill Details Section

    private var billDetailsSection: some View {
        Section {
            HStack {
                Text(lang.s("bill_number"))
                    .foregroundStyle(Color.spentyTextSecondary)
                Spacer()
                TextField("Auto", text: $billNumber)
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(Color.spentyTextPrimary)
            }
        } header: {
            Text(lang.s("bill_details"))
        }
    }

    // MARK: - Vendor Section

    private var vendorSection: some View {
        Section {
            if viewModel.vendors.isEmpty {
                TextField(lang.s("vendor_name") + " *", text: $vendorName)
                    .foregroundStyle(Color.spentyTextPrimary)
            } else {
                Picker(lang.s("vendor"), selection: $selectedVendorId) {
                    Text(lang.s("select_vendor")).tag(nil as String?)
                    ForEach(viewModel.vendors) { vendor in
                        Text(vendor.name ?? "Unnamed").tag(vendor.id as String?)
                    }
                }
                .onChange(of: selectedVendorId) { _, newValue in
                    if let vendor = viewModel.vendors.first(where: { $0.id == newValue }) {
                        vendorName = vendor.name ?? ""
                    }
                }

                TextField("Or enter name manually", text: $vendorName)
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyTextSecondary)
            }

            if showValidation && vendorName.trimmingCharacters(in: .whitespaces).isEmpty {
                Text(lang.s("vendor_required"))
                    .font(SpentyFonts.caption1)
                    .foregroundStyle(Color.spentyError)
            }
        } header: {
            Text(lang.s("vendor"))
        }
    }

    // MARK: - Dates Section

    private var datesSection: some View {
        Section {
            DatePicker(lang.s("date"), selection: $date, displayedComponents: .date)
                .foregroundStyle(Color.spentyTextPrimary)

            DatePicker(lang.s("date"), selection: $dueDate, displayedComponents: .date)
                .foregroundStyle(Color.spentyTextPrimary)
        } header: {
            Text(lang.s("dates"))
        }
    }

    // MARK: - Line Items Section

    private var lineItemsSection: some View {
        Section {
            ForEach($lineItems) { $item in
                lineItemRow(item: $item)
            }
            .onDelete { offsets in
                lineItems.remove(atOffsets: offsets)
                if lineItems.isEmpty {
                    lineItems.append(PurchaseFormLineItem())
                }
            }

            Button {
                lineItems.append(PurchaseFormLineItem())
            } label: {
                Label("Add Line Item", systemImage: "plus.circle.fill")
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyPrimary)
            }

            if showValidation && !hasValidLineItems {
                Text(lang.s("at_least_one_item"))
                    .font(SpentyFonts.caption1)
                    .foregroundStyle(Color.spentyError)
            }
        } header: {
            Text(lang.s("line_items"))
        }
    }

    private func lineItemRow(item: Binding<PurchaseFormLineItem>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField(lang.s("description"), text: item.description)
                .font(SpentyFonts.subheadline)

            TextField("HSN/SAC Code", text: item.hsnSac)
                .font(SpentyFonts.caption1)
                .foregroundStyle(Color.spentyTextSecondary)

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(lang.s("qty"))
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(Color.spentyTextSecondary)
                    TextField("1", value: item.quantity, format: .number)
                        .keyboardType(.decimalPad)
                        .font(SpentyFonts.subheadline)
                        .frame(width: 50)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Rate")
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(Color.spentyTextSecondary)
                    TextField("0", value: item.rate, format: .number)
                        .keyboardType(.decimalPad)
                        .font(SpentyFonts.subheadline)
                        .frame(width: 80)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(lang.s("tax_percent"))
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(Color.spentyTextSecondary)
                    TextField("0", value: item.taxRate, format: .number)
                        .keyboardType(.decimalPad)
                        .font(SpentyFonts.subheadline)
                        .frame(width: 50)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(lang.s("amount"))
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(Color.spentyTextSecondary)
                    Text(formatCurrency(item.wrappedValue.computedAmount))
                        .font(SpentyFonts.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.spentyTextPrimary)
                }
            }

            Divider()
        }
        .padding(.vertical, 4)
    }

    // MARK: - Totals Section

    private var totalsSection: some View {
        Section {
            HStack {
                Text(lang.s("subtotal"))
                    .foregroundStyle(Color.spentyTextSecondary)
                Spacer()
                Text(formatCurrency(subtotal))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyTextPrimary)
            }

            HStack {
                Text(lang.s("tax"))
                    .foregroundStyle(Color.spentyTextSecondary)
                Spacer()
                Text(formatCurrency(taxAmount))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyTextPrimary)
            }

            HStack {
                Text(lang.s("grand_total"))
                    .font(SpentyFonts.headline)
                    .foregroundStyle(Color.spentyTextPrimary)
                Spacer()
                Text(formatCurrency(grandTotal))
                    .font(SpentyFonts.amountSmall)
                    .foregroundStyle(Color.spentyPrimary)
            }
        } header: {
            Text(lang.s("totals"))
        }
    }

    // MARK: - Notes Section

    private var notesSection: some View {
        Section {
            TextField("Notes (optional)", text: $notes, axis: .vertical)
                .lineLimit(2...5)
                .foregroundStyle(Color.spentyTextPrimary)
        } header: {
            Text(lang.s("notes"))
        }
    }

    // MARK: - Actions

    private func save() async {
        showValidation = true
        guard isValid else { return }

        isSaving = true

        let items = lineItems.filter { !$0.description.isEmpty }.map { item in
            BillLineItemPayload(
                description: item.description,
                hsnSac: item.hsnSac.isEmpty ? nil : item.hsnSac,
                quantity: item.quantity,
                rate: item.rate,
                taxRate: item.taxRate,
                amount: item.computedAmount
            )
        }

        let payload = BillPayload(
            billNumber: billNumber.isEmpty ? nil : billNumber,
            vendorId: selectedVendorId,
            vendorName: vendorName.trimmingCharacters(in: .whitespaces),
            date: date,
            dueDate: dueDate,
            lineItems: items.isEmpty ? nil : items,
            subtotal: subtotal,
            taxAmount: taxAmount,
            grandTotal: grandTotal,
            notes: notes.isEmpty ? nil : notes
        )

        var success = false
        if let existing = viewModel.editingBill {
            success = await viewModel.updateBill(id: existing.id, payload)
        } else {
            success = await viewModel.createBill(payload)
        }

        isSaving = false
        if success { dismiss() }
    }

    private func populateFields() {
        guard let bill = viewModel.editingBill else { return }
        billNumber = bill.billNumber ?? ""
        vendorName = bill.vendorName ?? ""
        selectedVendorId = bill.vendorId
        date = bill.date ?? Date()
        dueDate = bill.dueDate ?? Date().addingTimeInterval(30 * 24 * 3600)
        notes = bill.notes ?? ""

        if let items = bill.lineItems, !items.isEmpty {
            lineItems = items.map { item in
                PurchaseFormLineItem(
                    description: item.description ?? "",
                    hsnSac: item.hsnSac ?? "",
                    quantity: item.quantity ?? 1,
                    rate: item.rate ?? 0,
                    taxRate: item.taxPercent ?? 0
                )
            }
        }
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\u{20B9}0"
    }
}

// MARK: - Form Line Item Model

struct PurchaseFormLineItem: Identifiable {
    let id = UUID()
    var description: String = ""
    var hsnSac: String = ""
    var quantity: Double = 1
    var rate: Double = 0
    var taxRate: Double = 0

    var computedAmount: Double {
        quantity * rate
    }
}

// MARK: - Preview

#Preview {
    PurchaseFormView(viewModel: PurchasesViewModel())
}
