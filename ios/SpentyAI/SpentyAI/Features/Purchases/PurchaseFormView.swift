import SwiftUI

struct PurchaseFormView: View {

    // MARK: - State

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

    private var isValid: Bool {
        !vendorName.trimmingCharacters(in: .whitespaces).isEmpty
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
            .navigationTitle(isEditing ? "Edit Bill" : "New Bill")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(.spentyPrimary)
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
                Text("Bill Number")
                    .foregroundStyle(.spentyTextSecondary)
                Spacer()
                TextField("Auto", text: $billNumber)
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(.spentyTextPrimary)
            }
        } header: {
            Text("Bill Details")
        }
    }

    // MARK: - Vendor Section

    private var vendorSection: some View {
        Section {
            if viewModel.vendors.isEmpty {
                TextField("Vendor Name *", text: $vendorName)
                    .foregroundStyle(.spentyTextPrimary)
            } else {
                Picker("Vendor", selection: $selectedVendorId) {
                    Text("Select Vendor").tag(nil as String?)
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
                    .foregroundStyle(.spentyTextSecondary)
            }

            if showValidation && vendorName.trimmingCharacters(in: .whitespaces).isEmpty {
                Text("Vendor name is required.")
                    .font(SpentyFonts.caption1)
                    .foregroundStyle(.spentyError)
            }
        } header: {
            Text("Vendor")
        }
    }

    // MARK: - Dates Section

    private var datesSection: some View {
        Section {
            DatePicker("Bill Date", selection: $date, displayedComponents: .date)
                .foregroundStyle(.spentyTextPrimary)

            DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)
                .foregroundStyle(.spentyTextPrimary)
        } header: {
            Text("Dates")
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
                    .foregroundStyle(.spentyPrimary)
            }
        } header: {
            Text("Line Items")
        }
    }

    private func lineItemRow(item: Binding<PurchaseFormLineItem>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Description", text: item.description)
                .font(SpentyFonts.subheadline)

            TextField("HSN/SAC Code", text: item.hsnSac)
                .font(SpentyFonts.caption1)
                .foregroundStyle(.spentyTextSecondary)

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Qty")
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(.spentyTextSecondary)
                    TextField("1", value: item.quantity, format: .number)
                        .keyboardType(.decimalPad)
                        .font(SpentyFonts.subheadline)
                        .frame(width: 50)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Rate")
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(.spentyTextSecondary)
                    TextField("0", value: item.rate, format: .number)
                        .keyboardType(.decimalPad)
                        .font(SpentyFonts.subheadline)
                        .frame(width: 80)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Tax %")
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(.spentyTextSecondary)
                    TextField("0", value: item.taxRate, format: .number)
                        .keyboardType(.decimalPad)
                        .font(SpentyFonts.subheadline)
                        .frame(width: 50)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("Amount")
                        .font(SpentyFonts.caption2)
                        .foregroundStyle(.spentyTextSecondary)
                    Text(formatCurrency(item.wrappedValue.computedAmount))
                        .font(SpentyFonts.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(.spentyTextPrimary)
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
                Text("Subtotal")
                    .foregroundStyle(.spentyTextSecondary)
                Spacer()
                Text(formatCurrency(subtotal))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(.spentyTextPrimary)
            }

            HStack {
                Text("Tax")
                    .foregroundStyle(.spentyTextSecondary)
                Spacer()
                Text(formatCurrency(taxAmount))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(.spentyTextPrimary)
            }

            HStack {
                Text("Grand Total")
                    .font(SpentyFonts.headline)
                    .foregroundStyle(.spentyTextPrimary)
                Spacer()
                Text(formatCurrency(grandTotal))
                    .font(SpentyFonts.amountSmall)
                    .foregroundStyle(.spentyPrimary)
            }
        } header: {
            Text("Totals")
        }
    }

    // MARK: - Notes Section

    private var notesSection: some View {
        Section {
            TextField("Notes (optional)", text: $notes, axis: .vertical)
                .lineLimit(2...5)
                .foregroundStyle(.spentyTextPrimary)
        } header: {
            Text("Notes")
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
                    hsnSac: "",
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
