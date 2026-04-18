import SwiftUI

struct AccountFormSheet: View {

    @State private var viewModel = AccountFormViewModel()
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let account: Account?
    let onSave: () -> Void

    init(account: Account? = nil, onSave: @escaping () -> Void) {
        self.account = account
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        basicFieldsSection
                        balanceSection
                        currencySection

                        if viewModel.showLoanFields {
                            loanFieldsSection
                        }

                        if viewModel.showInvestmentFields {
                            investmentFieldsSection
                        }

                        descriptionSection

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.danger)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        saveButton
                    }
                    .padding(SpentySpacing.lg)
                }
            }
            .safeAreaInset(edge: .top) {
                SheetHeader(
                    viewModel.isEditing ? "Edit Account" : "New Account",
                    onClose: { dismiss() }
                )
                .background(SpentyColors.surface)
            }
        }
        .interactiveDismissDisabled(viewModel.isSaving)
        .task {
            // Set default currency from user settings
            if let baseCurrency = appState.user?.settings?.baseCurrency {
                viewModel.currency = baseCurrency
            }

            if let account {
                viewModel.populateFromExisting(account)
            }

            await viewModel.loadSubTypes()
        }
    }

    // MARK: - Basic Fields

    private var basicFieldsSection: some View {
        VStack(spacing: SpentySpacing.md) {
            // Account Type
            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text("Account Type")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                Picker("Account Type", selection: $viewModel.accountType) {
                    ForEach(AccountFormViewModel.accountTypes, id: \.self) { type in
                        Text(type).tag(type)
                    }
                }
                .pickerStyle(.segmented)
            }

            // Sub-Type
            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text("Sub-Type")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                if viewModel.isLoadingSubTypes {
                    ProgressView()
                        .controlSize(.small)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, SpentySpacing.sm)
                } else {
                    Picker("Sub-Type", selection: $viewModel.subType) {
                        Text("Select...").tag("")
                        ForEach(viewModel.filteredSubTypes) { st in
                            Text(st.name ?? "").tag(st.name ?? "")
                        }
                        Text("Custom...").tag("__custom__")
                    }
                    .pickerStyle(.menu)
                    .tint(SpentyColors.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, SpentySpacing.md)
                    .padding(.vertical, SpentySpacing.sm)
                    .background(SpentyColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                    )
                    .onChange(of: viewModel.subType) { _, newValue in
                        viewModel.isCustomSubType = newValue == "__custom__"
                    }

                    if viewModel.isCustomSubType {
                        FormField(
                            "Custom Sub-Type",
                            text: $viewModel.customSubType,
                            placeholder: "e.g. Fixed Deposit"
                        )
                    }
                }
            }

            // Account Name
            FormField(
                "Account Name",
                text: $viewModel.name,
                placeholder: "e.g. HDFC Savings",
                isRequired: true,
                errorMessage: viewModel.nameError
            )

            // Account Number
            FormField(
                "Account Number",
                text: $viewModel.accountNumber,
                placeholder: "e.g. 1234567890",
                keyboardType: .numberPad
            )
        }
    }

    // MARK: - Balance Section

    private var balanceSection: some View {
        VStack(spacing: SpentySpacing.md) {
            FormField(
                "Opening Balance",
                text: $viewModel.openingBalance,
                placeholder: "0.00",
                keyboardType: .decimalPad,
                isRequired: true,
                errorMessage: viewModel.balanceError
            )

            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text("Balance As Of Date")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                DatePicker(
                    "",
                    selection: $viewModel.balanceAsOfDate,
                    displayedComponents: .date
                )
                .labelsHidden()
                .tint(SpentyColors.brandAccent)
            }
        }
    }

    // MARK: - Currency Section

    private var currencySection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            Text("Currency")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textSecondary)

            Picker("Currency", selection: $viewModel.currency) {
                ForEach(AccountFormViewModel.currencies, id: \.self) { code in
                    Text(code).tag(code)
                }
            }
            .pickerStyle(.menu)
            .tint(SpentyColors.textPrimary)
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

    // MARK: - Loan Fields

    private var loanFieldsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Loan Details")

            FormField(
                "Sanctioned Amount",
                text: $viewModel.loanSanctionedAmount,
                placeholder: "0.00",
                keyboardType: .decimalPad
            )

            HStack(spacing: SpentySpacing.md) {
                FormField(
                    "Interest Rate (%)",
                    text: $viewModel.loanInterestRate,
                    placeholder: "0.00",
                    keyboardType: .decimalPad
                )

                FormField(
                    "Tenure (months)",
                    text: $viewModel.loanTenureMonths,
                    placeholder: "0",
                    keyboardType: .numberPad
                )
            }

            HStack(spacing: SpentySpacing.md) {
                FormField(
                    "EMI Amount",
                    text: $viewModel.loanEmiAmount,
                    placeholder: "0.00",
                    keyboardType: .decimalPad
                )

                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("EMI Day")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)

                    Picker("EMI Day", selection: $viewModel.loanEmiDay) {
                        ForEach(1...31, id: \.self) { day in
                            Text("\(day)").tag(day)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(SpentyColors.textPrimary)
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

            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text("Loan Start Date")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                DatePicker(
                    "",
                    selection: $viewModel.loanStartDate,
                    displayedComponents: .date
                )
                .labelsHidden()
                .tint(SpentyColors.brandAccent)
            }

            FormField(
                "Outstanding Balance",
                text: $viewModel.loanOutstandingBalance,
                placeholder: "0.00",
                keyboardType: .decimalPad
            )
        }
    }

    // MARK: - Investment Fields

    private var investmentFieldsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Investment Details")

            FormField(
                "Broker Name",
                text: $viewModel.brokerName,
                placeholder: "e.g. Zerodha, Groww"
            )
        }
    }

    // MARK: - Description

    private var descriptionSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            Text("Description")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textSecondary)

            TextEditor(text: $viewModel.descriptionText)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textPrimary)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 80)
                .padding(SpentySpacing.md)
                .background(SpentyColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: SpentyRadius.md)
                        .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                )
        }
    }

    // MARK: - Save Button

    private var saveButton: some View {
        PrimaryButton(
            viewModel.isEditing ? "Update Account" : "Save Account",
            icon: viewModel.isEditing ? "checkmark" : "plus",
            isLoading: viewModel.isSaving,
            isFullWidth: true
        ) {
            Task {
                let success = await viewModel.save()
                if success {
                    onSave()
                    dismiss()
                }
            }
        }
        .padding(.top, SpentySpacing.sm)
    }
}

#Preview {
    AccountFormSheet(onSave: {})
        .environment(AppState())
}
