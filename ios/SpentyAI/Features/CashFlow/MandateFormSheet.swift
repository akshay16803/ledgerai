import SwiftUI

struct MandateFormSheet: View {
    let editingMandate: Mandate?
    let onSaved: (MandateCreate) -> Void

    @Environment(\.dismiss) private var dismiss

    // MARK: - Form State

    @State private var merchant = ""
    @State private var amountText = ""
    @State private var frequency = "monthly"
    @State private var mandateType = "auto_debit"
    @State private var startDate = Date()
    @State private var endDate = Date().addingTimeInterval(365 * 24 * 3600)
    @State private var debitDay = 1
    @State private var accountId = ""

    // UI State
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var isEditing: Bool { editingMandate != nil }

    private var isFormValid: Bool {
        !merchant.trimmingCharacters(in: .whitespaces).isEmpty
            && (Double(amountText) ?? 0) > 0
    }

    private static let frequencies = [
        ("monthly", "Monthly"),
        ("quarterly", "Quarterly"),
        ("yearly", "Yearly")
    ]

    private static let mandateTypes = [
        ("auto_debit", "Auto Debit"),
        ("standing_instruction", "Standing Instruction"),
        ("emi", "EMI"),
        ("subscription", "Subscription"),
        ("other", "Other")
    ]

    private let dateFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f
    }()

    var body: some View {
        NavigationStack {
            Form {
                merchantSection
                amountSection
                frequencySection
                datesSection
                debitDaySection

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.danger)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Mandate" : "New Mandate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Update" : "Save") {
                        save()
                    }
                    .disabled(!isFormValid || isSaving)
                }
            }
            .onAppear {
                populateFromMandate()
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var merchantSection: some View {
        Section {
            FormField(
                "Merchant",
                text: $merchant,
                placeholder: "e.g. Netflix, SBI Insurance",
                isRequired: true
            )
        } header: {
            Text("Merchant")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textMuted)
        }
    }

    @ViewBuilder
    private var amountSection: some View {
        Section {
            FormField(
                "Amount",
                text: $amountText,
                placeholder: "0.00",
                keyboardType: .decimalPad,
                isRequired: true
            )
        } header: {
            Text("Amount")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textMuted)
        }
    }

    @ViewBuilder
    private var frequencySection: some View {
        Section {
            Picker("Frequency", selection: $frequency) {
                ForEach(Self.frequencies, id: \.0) { value, label in
                    Text(label).tag(value)
                }
            }
            .pickerStyle(.segmented)

            Picker("Type", selection: $mandateType) {
                ForEach(Self.mandateTypes, id: \.0) { value, label in
                    Text(label).tag(value)
                }
            }
        } header: {
            Text("Schedule")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textMuted)
        }
    }

    @ViewBuilder
    private var datesSection: some View {
        Section {
            DatePicker(
                "Start Date",
                selection: $startDate,
                displayedComponents: .date
            )

            DatePicker(
                "End Date",
                selection: $endDate,
                in: startDate...,
                displayedComponents: .date
            )
        } header: {
            Text("Duration")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textMuted)
        }
    }

    @ViewBuilder
    private var debitDaySection: some View {
        Section {
            Stepper("Debit Day: \(debitDay)", value: $debitDay, in: 1...31)
        } header: {
            Text("Debit Day")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textMuted)
        }
    }

    // MARK: - Actions

    private func save() {
        guard isFormValid else { return }
        isSaving = true

        let body = MandateCreate(
            merchant: merchant.trimmingCharacters(in: .whitespaces),
            amount: Double(amountText) ?? 0,
            frequency: frequency,
            mandateType: mandateType,
            startDate: dateFormatter.string(from: startDate),
            endDate: dateFormatter.string(from: endDate),
            debitDay: debitDay,
            accountId: accountId.isEmpty ? nil : accountId
        )

        onSaved(body)
    }

    private func populateFromMandate() {
        guard let mandate = editingMandate else { return }

        merchant = mandate.merchant ?? ""
        amountText = mandate.amount.map { String(format: "%.2f", $0) } ?? ""
        frequency = mandate.frequency ?? "monthly"
        mandateType = mandate.mandateType ?? "auto_debit"
        debitDay = mandate.debitDay ?? 1
        accountId = mandate.accountId ?? ""

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withFullDate]

        if let start = mandate.startDate, let date = isoFormatter.date(from: start) {
            startDate = date
        }
        if let end = mandate.endDate, let date = isoFormatter.date(from: end) {
            endDate = date
        }
    }
}
