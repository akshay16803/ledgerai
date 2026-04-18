import SwiftUI

struct RecordPaymentSheet: View {
    let invoice: Invoice
    let settings: AppSettings?
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var amount = ""
    @State private var paymentMethod = "bank_transfer"
    @State private var paymentDate = Date()
    @State private var selectedAccountId = ""
    @State private var accounts: [Account] = []
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let invoiceRepo = InvoiceRepository()
    private let accountRepo = AccountRepository()

    // MARK: - Computed

    private var grandTotal: Double { invoice.grandTotal ?? 0 }
    private var alreadyPaid: Double { invoice.amountPaid ?? 0 }
    private var remaining: Double { max(0, grandTotal - alreadyPaid) }

    private var currency: String {
        if let code = settings?.businessCountry,
           let config = CountryConfig.config(for: code) {
            return config.currency
        }
        return settings?.baseCurrency ?? "INR"
    }

    private var enteredAmount: Double { Double(amount) ?? 0 }

    private var canSave: Bool {
        enteredAmount > 0 && enteredAmount <= remaining + 0.01
    }

    private var statusType: StatusType {
        switch invoice.paymentStatus?.lowercased() {
        case "paid": return .paid
        case "partial": return .partial
        default: return .unpaid
        }
    }

    static let paymentMethods = [
        ("bank_transfer", "Bank Transfer"),
        ("cash", "Cash"),
        ("upi", "UPI"),
        ("cheque", "Cheque"),
        ("card", "Card"),
        ("paypal", "PayPal"),
        ("other", "Other")
    ]

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SheetHeader("Record Payment", onClose: { dismiss() })

                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        invoiceSummary
                        paymentForm
                        saveSection
                    }
                    .padding(SpentySpacing.lg)
                }
            }
            .background(SpentyColors.bgPrimary)
            .task {
                await loadAccounts()
                amount = String(format: "%.2f", remaining)
            }
        }
    }

    // MARK: - Invoice Summary

    private var invoiceSummary: some View {
        SpentyCard {
            VStack(spacing: SpentySpacing.sm) {
                HStack {
                    Text(invoice.invoiceNumber ?? "Invoice")
                        .font(SpentyFonts.mono)
                        .foregroundStyle(SpentyColors.textPrimary)
                    Spacer()
                    StatusBadge(statusType)
                }

                Text(invoice.customerName ?? "")
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Divider()

                HStack {
                    Text("Grand Total")
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Spacer()
                    MoneyText(grandTotal, currency: currency, size: SpentyFonts.subheading)
                }

                HStack {
                    Text("Already Paid")
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Spacer()
                    MoneyText(alreadyPaid, currency: currency)
                }

                HStack {
                    Text("Remaining")
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)
                    Spacer()
                    MoneyText(remaining, currency: currency, size: SpentyFonts.subheading)
                }
            }
        }
    }

    // MARK: - Payment Form

    private var paymentForm: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Payment Details")

            FormField(
                "Amount (\(currency))",
                text: $amount,
                placeholder: String(format: "%.2f", remaining),
                keyboardType: .decimalPad,
                isRequired: true,
                errorMessage: enteredAmount > remaining + 0.01
                    ? "Amount exceeds remaining balance"
                    : nil
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

            if !accounts.isEmpty {
                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("Account")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Picker("Account", selection: $selectedAccountId) {
                        Text("None").tag("")
                        ForEach(accounts) { account in
                            Text(account.name).tag(account.accountId)
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
                "Record Payment",
                icon: "checkmark.circle.fill",
                isLoading: isSaving,
                isDisabled: !canSave,
                isFullWidth: true,
                action: { Task { await recordPayment() } }
            )
        }
    }

    // MARK: - Actions

    private func loadAccounts() async {
        do {
            accounts = try await accountRepo.getAccounts()
        } catch {
            // Non-critical, accounts picker just won't show
        }
    }

    @MainActor
    private func recordPayment() async {
        guard canSave else { return }
        isSaving = true
        errorMessage = nil

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        do {
            _ = try await invoiceRepo.recordPayment(
                invoice.invoiceId,
                amount: enteredAmount,
                accountId: selectedAccountId.isEmpty ? nil : selectedAccountId,
                paymentMethod: paymentMethod,
                date: dateFormatter.string(from: paymentDate)
            )
            Haptics.success()
            onSaved()
        } catch {
            errorMessage = "Failed to record payment. Please try again."
            Haptics.error()
        }

        isSaving = false
    }
}
