import SwiftUI

struct RecordPaymentView: View {

    // MARK: - Payment methods


    @Environment(LocalizationManager.self) var lang
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
            .navigationTitle(lang.s("record_payment"))
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
                Text(lang.s("invoice_total"))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatCurrency(invoiceTotal))
                    .fontWeight(.semibold)
            }

            HStack {
                Text(lang.s("amount_paid"))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatCurrency(amountPaid))
                    .foregroundColor(.spentySuccess)
            }

            HStack {
                Text(lang.s("balance_due"))
                    .fontWeight(.semibold)
                Spacer()
                Text(formatCurrency(balanceDue))
                    .font(.title3.weight(.bold))
                    .foregroundColor(balanceDue > 0 ? .spentyError : .spentySuccess)
            }
        } header: {
            Text(lang.s("invoice_summary"))
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
                    Text(lang.s("amount_greater_zero"))
                        .font(.caption)
                        .foregroundStyle(Color.spentyError)
                } else if amount > balanceDue {
                    Text("Amount cannot exceed balance due (\(formatCurrency(balanceDue))).")
                        .font(.caption)
                        .foregroundStyle(Color.spentyError)
                }
            }

            DatePicker(lang.s("date"), selection: $paymentDate, displayedComponents: .date)

            Picker(lang.s("payment"), selection: $selectedMethod) {
                ForEach(paymentMethods, id: \.self) { method in
                    Text(method).tag(method)
                }
            }
        } header: {
            Text(lang.s("payment_details"))
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        Section {
            Picker(lang.s("account_label"), selection: $selectedAccountId) {
                Text(lang.s("none_option")).tag(String?.none)
                ForEach(viewModel.accounts) { account in
                    Text(account.name ?? "Unnamed Account")
                        .tag(Optional(account.id))
                }
            }
        } header: {
            Text(lang.s("deposit_account"))
        } footer: {
            Text(lang.s("deposit_account_info"))
        }
    }

    // MARK: - Note

    private var noteSection: some View {
        Section {
            TextField(lang.s("payment_notes"), text: $note, axis: .vertical)
                .lineLimit(2...4)
        } header: {
            Text(lang.s("notes"))
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
