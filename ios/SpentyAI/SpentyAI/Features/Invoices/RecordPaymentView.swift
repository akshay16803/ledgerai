import SwiftUI

struct RecordPaymentView: View {

    // MARK: - Payment methods

    private let paymentMethods = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Other"]

    // MARK: - State

    @Bindable var viewModel: InvoicesViewModel
    let invoice: Invoice
    @Environment(\.dismiss) private var dismiss

    @State private var amount: Double = 0
    @State private var paymentDate = Date()
    @State private var selectedMethod: String = "Bank Transfer"
    @State private var selectedAccountId: String?
    @State private var note: String = ""
    @State private var showValidation = false
    @State private var isSaving = false

    // MARK: - Computed

    private var invoiceTotal: Double {
        invoice.grandTotal ?? 0
    }

    private var amountPaid: Double {
        invoice.amountPaid ?? 0
    }

    private var balanceDue: Double {
        max(invoiceTotal - amountPaid, 0)
    }

    private var isAmountValid: Bool {
        amount > 0 && amount <= balanceDue
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    invoiceSummarySection
                    paymentDetailsSection
                    accountSection
                    noteSection
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Record Payment")
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
            .onAppear {
                amount = balanceDue
            }
        }
    }

    // MARK: - Invoice Summary

    private var invoiceSummarySection: some View {
        Section {
            summaryRow("Invoice", value: invoice.invoiceNumber ?? "—")
            summaryRow("Customer", value: invoice.customerName ?? "—")

            HStack {
                Text("Invoice Total")
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatCurrency(invoiceTotal))
                    .fontWeight(.semibold)
            }

            HStack {
                Text("Amount Paid")
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatCurrency(amountPaid))
                    .foregroundStyle(.spentySuccess)
            }

            HStack {
                Text("Balance Due")
                    .fontWeight(.semibold)
                Spacer()
                Text(formatCurrency(balanceDue))
                    .font(.title3.weight(.bold))
                    .foregroundStyle(balanceDue > 0 ? Color.spentyError : .spentySuccess)
            }
        } header: {
            Text("Invoice Summary")
        }
    }

    private func summaryRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
        }
    }

    // MARK: - Payment Details

    private var paymentDetailsSection: some View {
        Section {
            HStack {
                Text("Amount (\u{20B9})")
                Spacer()
                TextField("0.00", value: $amount, format: .number)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 150)
            }

            if showValidation && !isAmountValid {
                if amount <= 0 {
                    Text("Amount must be greater than zero.")
                        .font(.caption)
                        .foregroundStyle(Color.spentyError)
                } else if amount > balanceDue {
                    Text("Amount cannot exceed balance due (\(formatCurrency(balanceDue))).")
                        .font(.caption)
                        .foregroundStyle(Color.spentyError)
                }
            }

            DatePicker("Payment Date", selection: $paymentDate, displayedComponents: .date)

            Picker("Method", selection: $selectedMethod) {
                ForEach(paymentMethods, id: \.self) { method in
                    Text(method).tag(method)
                }
            }
        } header: {
            Text("Payment Details")
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        Section {
            Picker("Account", selection: $selectedAccountId) {
                Text("None").tag(String?.none)
                ForEach(viewModel.accounts) { account in
                    Text(account.name ?? "Unnamed Account")
                        .tag(Optional(account.id))
                }
            }
        } header: {
            Text("Deposit Account")
        } footer: {
            Text("Select the bank/cash account where this payment was received.")
        }
    }

    // MARK: - Note

    private var noteSection: some View {
        Section {
            TextField("Payment notes (optional)", text: $note, axis: .vertical)
                .lineLimit(2...4)
        } header: {
            Text("Notes")
        }
    }

    // MARK: - Actions

    private func save() async {
        showValidation = true
        guard isAmountValid else { return }

        isSaving = true

        let payload = RecordPaymentPayload(
            amount: amount,
            date: paymentDate,
            paymentMethod: selectedMethod,
            accountId: selectedAccountId,
            note: note.isEmpty ? nil : note.trimmingCharacters(in: .whitespaces)
        )

        let success = await viewModel.recordPayment(id: invoice.id, payload)

        isSaving = false
        if success {
            await viewModel.loadStats()
            dismiss()
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

// MARK: - Preview

#Preview {
    RecordPaymentView(
        viewModel: InvoicesViewModel(),
        invoice: {
            let json = #"{"invoiceId":"1","invoiceNumber":"INV-001","customerName":"Test","grandTotal":10000,"amountPaid":3000}"#
            let decoder = JSONDecoder()
            return try! decoder.decode(Invoice.self, from: Data(json.utf8))
        }()
    )
}
