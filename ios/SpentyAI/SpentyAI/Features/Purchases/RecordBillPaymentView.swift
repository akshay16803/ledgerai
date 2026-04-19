import SwiftUI

struct RecordBillPaymentView: View {

    // MARK: - State

    @Bindable var viewModel: PurchasesViewModel
    @Environment(\.dismiss) private var dismiss
    let bill: Bill

    @State private var amount: Double = 0
    @State private var date = Date()
    @State private var method: String = "bank_transfer"
    @State private var selectedAccountId: String?
    @State private var notes = ""
    @State private var showValidation = false
    @State private var isSaving = false

    private static let paymentMethods = [
        "bank_transfer", "cash", "cheque", "upi", "card", "other"
    ]

    // MARK: - Computed

    private var balanceDue: Double {
        (bill.grandTotal ?? 0) - (bill.amountPaid ?? 0)
    }

    private var isAmountValid: Bool {
        amount > 0 && amount <= balanceDue + 0.01
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    billSummarySection
                    paymentDetailsSection
                    accountSection
                    notesSection
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

    // MARK: - Bill Summary

    private var billSummarySection: some View {
        Section {
            HStack {
                Text("Bill")
                    .foregroundStyle(Color.spentyTextSecondary)
                Spacer()
                Text(bill.billNumber ?? "Draft")
                    .font(SpentyFonts.headline)
                    .foregroundStyle(Color.spentyTextPrimary)
            }

            HStack {
                Text("Vendor")
                    .foregroundStyle(Color.spentyTextSecondary)
                Spacer()
                Text(bill.vendorName ?? "--")
                    .foregroundStyle(Color.spentyTextPrimary)
            }

            HStack {
                Text("Bill Total")
                    .foregroundStyle(Color.spentyTextSecondary)
                Spacer()
                Text(formatCurrency(bill.grandTotal ?? 0))
                    .font(SpentyFonts.amountSmall)
                    .foregroundStyle(Color.spentyTextPrimary)
            }

            HStack {
                Text("Amount Paid")
                    .foregroundStyle(Color.spentyTextSecondary)
                Spacer()
                Text(formatCurrency(bill.amountPaid ?? 0))
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentySuccess)
            }

            HStack {
                Text("Balance Due")
                    .font(SpentyFonts.headline)
                    .foregroundStyle(Color.spentyTextPrimary)
                Spacer()
                Text(formatCurrency(balanceDue))
                    .font(SpentyFonts.amountSmall)
                    .foregroundStyle(Color.spentyError)
            }
        } header: {
            Text("Bill Summary")
        }
    }

    // MARK: - Payment Details

    private var paymentDetailsSection: some View {
        Section {
            HStack {
                Text("Amount")
                    .foregroundStyle(Color.spentyTextSecondary)
                Spacer()
                TextField("0", value: $amount, format: .number)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .font(SpentyFonts.amountSmall)
                    .foregroundStyle(Color.spentyTextPrimary)
                    .frame(width: 120)
            }

            if showValidation && !isAmountValid {
                Text(amount <= 0
                     ? "Amount must be greater than zero."
                     : "Amount cannot exceed the balance due.")
                    .font(SpentyFonts.caption1)
                    .foregroundStyle(Color.spentyError)
            }

            DatePicker("Payment Date", selection: $date, displayedComponents: .date)
                .foregroundStyle(Color.spentyTextPrimary)

            Picker("Method", selection: $method) {
                ForEach(Self.paymentMethods, id: \.self) { m in
                    Text(m.replacingOccurrences(of: "_", with: " ").capitalized)
                        .tag(m)
                }
            }
        } header: {
            Text("Payment Details")
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        Section {
            if viewModel.accounts.isEmpty {
                Text("No accounts loaded")
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyTextSecondary)
            } else {
                Picker("Pay From Account", selection: $selectedAccountId) {
                    Text("Select Account").tag(nil as String?)
                    ForEach(viewModel.accounts) { account in
                        Text(account.name ?? "Unnamed")
                            .tag(account.id as String?)
                    }
                }
            }
        } header: {
            Text("Account")
        }
    }

    // MARK: - Notes

    private var notesSection: some View {
        Section {
            TextField("Payment notes (optional)", text: $notes, axis: .vertical)
                .lineLimit(2...4)
                .foregroundStyle(Color.spentyTextPrimary)
        } header: {
            Text("Notes")
        }
    }

    // MARK: - Actions

    private func save() async {
        showValidation = true
        guard isAmountValid else { return }

        isSaving = true

        let payload = RecordBillPaymentPayload(
            amount: amount,
            date: date,
            paymentMethod: method,
            accountId: selectedAccountId,
            notes: notes.isEmpty ? nil : notes
        )

        let success = await viewModel.recordPayment(id: bill.id, payload)
        isSaving = false
        if success { dismiss() }
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

// MARK: - Preview

#Preview {
    RecordBillPaymentView(
        viewModel: PurchasesViewModel(),
        bill: Bill(id: "test", billNumber: "BILL-001", vendorName: "Test Vendor", grandTotal: 5000, amountPaid: 2000)
    )
}
