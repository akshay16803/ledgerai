import SwiftUI

struct InvoiceFormView: View {

    // MARK: - State

    @Bindable var viewModel: InvoicesViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var invoiceNumber = ""
    @State private var selectedCustomerId: String?
    @State private var customerName = ""
    @State private var invoiceDate = Date()
    @State private var dueDate = Date().addingTimeInterval(30 * 24 * 3600)
    @State private var lineItems: [FormLineItem] = [FormLineItem()]
    @State private var notes = ""
    @State private var terms = ""
    @State private var showValidation = false
    @State private var isSaving = false
    @State private var showCustomerPicker = false

    private var isEditing: Bool { viewModel.editingInvoice != nil }

    // MARK: - Computed

    private var subtotal: Double {
        lineItems.reduce(0) { $0 + $1.taxableAmount }
    }

    private var totalTax: Double {
        lineItems.reduce(0) { $0 + $1.taxAmount }
    }

    /// When editing an inter-state invoice the backend will have set IGST.
    private var isInterState: Bool {
        if let inv = viewModel.editingInvoice {
            return (inv.totalIgst ?? 0) > 0
        }
        return false
    }

    private var cgst: Double {
        isInterState ? 0 : totalTax / 2.0
    }

    private var sgst: Double {
        isInterState ? 0 : totalTax / 2.0
    }

    private var igst: Double {
        isInterState ? totalTax : 0
    }

    private var grandTotal: Double {
        subtotal + totalTax
    }

    private var isValid: Bool {
        !invoiceNumber.trimmingCharacters(in: .whitespaces).isEmpty
            && selectedCustomerId != nil
            && !lineItems.isEmpty
            && lineItems.allSatisfy { !($0.description.trimmingCharacters(in: .whitespaces).isEmpty) && $0.quantity > 0 && $0.rate > 0 }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    invoiceInfoSection
                    customerSection
                    datesSection
                    lineItemsSection
                    totalsSection
                    notesSection
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(isEditing ? "Edit Invoice" : "New Invoice")
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
                    .foregroundStyle(Color.spentyPrimary)
                    .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .onAppear(perform: populateFields)
            .task {
                if !isEditing {
                    await viewModel.getNextNumber()
                    if invoiceNumber.isEmpty {
                        invoiceNumber = viewModel.nextNumber
                    }
                }
            }
        }
    }

    // MARK: - Invoice Info

    private var invoiceInfoSection: some View {
        Section {
            HStack {
                Text("Invoice #")
                    .foregroundStyle(.secondary)
                TextField("INV-001", text: $invoiceNumber)
                    .multilineTextAlignment(.trailing)
            }
            if showValidation && invoiceNumber.trimmingCharacters(in: .whitespaces).isEmpty {
                Text("Invoice number is required.")
                    .font(.caption)
                    .foregroundStyle(Color.spentyError)
            }
        } header: {
            Text("Invoice")
        }
    }

    // MARK: - Customer

    private var customerSection: some View {
        Section {
            Button {
                showCustomerPicker = true
            } label: {
                HStack {
                    Text("Customer")
                        .foregroundStyle(.primary)
                    Spacer()
                    Text(customerName.isEmpty ? "Select Customer" : customerName)
                        .foregroundStyle(customerName.isEmpty ? .secondary : Color.spentyPrimary)
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .sheet(isPresented: $showCustomerPicker) {
                customerPickerSheet
            }

            if showValidation && selectedCustomerId == nil {
                Text("Customer is required.")
                    .font(.caption)
                    .foregroundStyle(Color.spentyError)
            }
        } header: {
            Text("Customer")
        }
    }

    private var customerPickerSheet: some View {
        NavigationStack {
            List(viewModel.customers) { customer in
                Button {
                    selectedCustomerId = customer.id
                    customerName = customer.name ?? ""
                    showCustomerPicker = false
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(customer.name ?? "Unnamed")
                                .font(.body)
                                .foregroundStyle(.primary)
                            if let email = customer.email, !email.isEmpty {
                                Text(email)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if customer.id == selectedCustomerId {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Color.spentyPrimary)
                        }
                    }
                }
            }
            .navigationTitle("Select Customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showCustomerPicker = false }
                }
            }
        }
    }

    // MARK: - Dates

    private var datesSection: some View {
        Section {
            DatePicker("Invoice Date", selection: $invoiceDate, displayedComponents: .date)
            DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)
        } header: {
            Text("Dates")
        }
    }

    // MARK: - Line Items

    private var lineItemsSection: some View {
        Section {
            ForEach($lineItems) { $item in
                lineItemRow(item: $item)
            }
            .onDelete(perform: deleteLineItem)

            Button {
                withAnimation {
                    lineItems.append(FormLineItem())
                }
            } label: {
                Label("Add Line Item", systemImage: "plus.circle.fill")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.spentyPrimary)
            }

            if showValidation && lineItems.isEmpty {
                Text("At least one line item is required.")
                    .font(.caption)
                    .foregroundStyle(Color.spentyError)
            }
        } header: {
            Text("Line Items")
        }
    }

    private func lineItemRow(item: Binding<FormLineItem>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Description *", text: item.description)
                .font(.body)

            TextField("HSN/SAC Code", text: item.hsnSac)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Qty")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    TextField("1", value: item.quantity, format: .number)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 60)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Rate (\u{20B9})")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    TextField("0.00", value: item.rate, format: .number)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 90)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("GST %")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    TextField("18", value: item.taxPercent, format: .number)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 60)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("Amount")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(formatCurrency(item.wrappedValue.lineTotal))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.spentyPrimary)
                }
            }

            if showValidation && item.wrappedValue.description.trimmingCharacters(in: .whitespaces).isEmpty {
                Text("Description is required.")
                    .font(.caption)
                    .foregroundStyle(Color.spentyError)
            }
        }
        .padding(.vertical, 4)
    }

    private func deleteLineItem(at offsets: IndexSet) {
        lineItems.remove(atOffsets: offsets)
    }

    // MARK: - Totals

    private var totalsSection: some View {
        Section {
            HStack {
                Text("Subtotal")
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatCurrency(subtotal))
                    .font(.body)
            }

            if isInterState {
                HStack {
                    Text("IGST")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(formatCurrency(igst))
                        .font(.body)
                }
            } else {
                HStack {
                    Text("CGST")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(formatCurrency(cgst))
                        .font(.body)
                }

                HStack {
                    Text("SGST")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(formatCurrency(sgst))
                        .font(.body)
                }
            }

            HStack {
                Text("Total Tax")
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatCurrency(totalTax))
                    .font(.body)
            }

            HStack {
                Text("Grand Total")
                    .font(.body.weight(.bold))
                Spacer()
                Text(formatCurrency(grandTotal))
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Color.spentyPrimary)
            }
        } header: {
            Text("GST Summary")
        }
    }

    // MARK: - Notes

    private var notesSection: some View {
        Section {
            TextField("Payment Terms", text: $terms, axis: .vertical)
                .lineLimit(2...4)
            TextField("Notes", text: $notes, axis: .vertical)
                .lineLimit(2...4)
        } header: {
            Text("Terms & Notes")
        }
    }

    // MARK: - Actions

    private func save() async {
        showValidation = true
        guard isValid else { return }

        isSaving = true

        let itemPayloads = lineItems.map { item in
            InvoiceLineItemPayload(
                description: item.description.trimmingCharacters(in: .whitespaces),
                hsnSac: item.hsnSac.isEmpty ? nil : item.hsnSac.trimmingCharacters(in: .whitespaces),
                quantity: item.quantity,
                rate: item.rate,
                taxPercent: item.taxPercent,
                amount: item.taxableAmount   // Backend expects taxable amount (qty * rate), not lineTotal
            )
        }

        let payload = InvoicePayload(
            invoiceNumber: invoiceNumber.trimmingCharacters(in: .whitespaces),
            customerId: selectedCustomerId,
            customerName: customerName.trimmingCharacters(in: .whitespaces),
            invoiceDate: invoiceDate,
            dueDate: dueDate,
            lineItems: itemPayloads,
            subtotal: subtotal,
            taxAmount: totalTax,
            totalCgst: cgst,
            totalSgst: sgst,
            totalIgst: igst,
            grandTotal: grandTotal,
            notes: notes.isEmpty ? nil : notes.trimmingCharacters(in: .whitespaces),
            termsConditions: terms.isEmpty ? nil : terms.trimmingCharacters(in: .whitespaces)
        )

        var success = false
        if let existing = viewModel.editingInvoice {
            success = await viewModel.updateInvoice(id: existing.id, payload)
        } else {
            success = await viewModel.createInvoice(payload)
        }

        isSaving = false
        if success {
            await viewModel.loadStats()
            dismiss()
        }
    }

    private func populateFields() {
        guard let invoice = viewModel.editingInvoice else { return }
        invoiceNumber = invoice.invoiceNumber ?? ""
        selectedCustomerId = invoice.customerId
        customerName = invoice.customerName ?? ""
        invoiceDate = invoice.date ?? Date()
        dueDate = invoice.dueDate ?? Date().addingTimeInterval(30 * 24 * 3600)
        notes = invoice.notes ?? ""
        terms = invoice.terms ?? ""

        if let items = invoice.lineItems, !items.isEmpty {
            lineItems = items.map { item in
                FormLineItem(
                    description: item.description ?? "",
                    hsnSac: item.hsnSac ?? "",
                    quantity: item.quantity ?? 1,
                    rate: item.rate ?? 0,
                    taxPercent: item.taxPercent ?? 0
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
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "\u{20B9}0.00"
    }
}

// MARK: - Form Line Item Model

struct FormLineItem: Identifiable {
    let id = UUID()
    var description: String = ""
    var hsnSac: String = ""
    var quantity: Double = 1
    var rate: Double = 0
    var taxPercent: Double = 18

    var taxableAmount: Double {
        quantity * rate
    }

    var taxAmount: Double {
        taxableAmount * taxPercent / 100.0
    }

    var lineTotal: Double {
        taxableAmount + taxAmount
    }
}

// MARK: - Preview

#Preview {
    InvoiceFormView(viewModel: InvoicesViewModel())
}
