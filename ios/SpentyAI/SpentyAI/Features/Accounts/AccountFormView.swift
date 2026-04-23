import SwiftUI

struct AccountFormView: View {

    @Environment(LocalizationManager.self) var lang
    @Bindable var viewModel: AccountsViewModel
    let account: Account?

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var accountType = "asset"
    @State private var subType = ""
    @State private var accountNumber = ""
    @State private var openingBalance = ""
    @State private var balanceAsOfDate = Date()
    @State private var currency = "INR"
    @State private var descriptionText = ""

    // Loan fields
    @State private var loanInterestRate = ""
    @State private var loanTenureMonths = ""
    @State private var loanEmiAmount = ""
    @State private var loanEmiDay = ""
    @State private var loanSanctionedAmount = ""

    // Demat fields
    @State private var brokerName = ""

    private var isEditing: Bool { account != nil }
    private var isLiability: Bool { accountType.lowercased() == "liability" }
    private var isInvestment: Bool { accountType.lowercased() == "investment" }
    private var isDematSubType: Bool {
        subType.lowercased().contains("demat") || subType.lowercased().contains("dmat")
    }
    private var isFormValid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }

    private var filteredSubTypes: [AccountSubType] {
        viewModel.subTypesForType(accountType)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    basicInfoSection
                    balanceSection

                    if isLiability {
                        loanSection
                    }

                    if isInvestment && isDematSubType {
                        dematSection
                    }

                    notesSection
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(isEditing ? lang.s("edit_account") : lang.s("new_account"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(lang.s("cancel")) { dismiss() }
                        .foregroundColor(.spentyTextSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(isEditing ? lang.s("save") : lang.s("add")) {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(isFormValid ? .spentyPrimary : .spentyTextSecondary)
                    .disabled(!isFormValid || viewModel.isSaving)
                }
            }
            .onAppear(perform: populateForm)
            .overlay {
                if viewModel.isSaving {
                    Color.black.opacity(0.15).ignoresSafeArea()
                    ProgressView(lang.s("saving"))
                        .padding(24)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    // MARK: - Sections

    private var basicInfoSection: some View {
        Section {
            TextField(lang.s("account_name_placeholder"), text: $name)
                .font(SpentyFonts.body)

            Picker(lang.s("account_type"), selection: $accountType) {
                ForEach(AccountsViewModel.accountTypes, id: \.self) { type in
                    Text(type.capitalized).tag(type)
                }
            }

            if filteredSubTypes.isEmpty {
                TextField(lang.s("sub_type"), text: $subType)
                    .font(SpentyFonts.body)
            } else {
                Picker(lang.s("sub_type"), selection: $subType) {
                    Text(lang.s("none_option")).tag("")
                    ForEach(filteredSubTypes) { st in
                        Text(st.name ?? "").tag(st.name ?? "")
                    }
                }
            }

            TextField(lang.s("account_number"), text: $accountNumber)
                .font(SpentyFonts.body)
                .textContentType(.creditCardNumber)

            Picker(lang.s("currency"), selection: $currency) {
                ForEach(["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"], id: \.self) { code in
                    Text(code).tag(code)
                }
            }
        } header: {
            Text(lang.s("basic_info"))
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
        }
    }

    private var balanceSection: some View {
        Section {
            HStack {
                Text(lang.s("opening_balance"))
                    .font(SpentyFonts.body)
                Spacer()
                TextField("0.00", text: $openingBalance)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 160)
                    .font(SpentyFonts.amountSmall)
            }

            DatePicker(
                lang.s("as_of_date"),
                selection: $balanceAsOfDate,
                displayedComponents: .date
            )
            .font(SpentyFonts.body)
        } header: {
            Text(lang.s("balance"))
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
        }
    }

    private var loanSection: some View {
        Section {
            formNumberField(lang.s("interest_rate_pct"), text: $loanInterestRate)
            formNumberField(lang.s("tenure_months"), text: $loanTenureMonths, isDecimal: false)
            formNumberField(lang.s("emi_amount"), text: $loanEmiAmount)
            formNumberField(lang.s("emi_day"), text: $loanEmiDay, isDecimal: false)
            formNumberField(lang.s("sanctioned_amount"), text: $loanSanctionedAmount)
        } header: {
            HStack(spacing: 6) {
                Image(systemName: "percent")
                    .font(.system(size: 11))
                Text(lang.s("loan_details"))
            }
            .font(SpentyFonts.caption1)
            .foregroundColor(.spentyError)
        }
    }

    private var dematSection: some View {
        Section {
            TextField(lang.s("broker_name"), text: $brokerName)
                .font(SpentyFonts.body)
        } header: {
            HStack(spacing: 6) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 11))
                Text(lang.s("demat_details"))
            }
            .font(SpentyFonts.caption1)
            .foregroundColor(.spentyWarning)
        }
    }

    private var notesSection: some View {
        Section {
            TextField(lang.s("description_notes"), text: $descriptionText, axis: .vertical)
                .lineLimit(3...6)
                .font(SpentyFonts.body)
        } header: {
            Text(lang.s("notes"))
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
        }
    }

    // MARK: - Helpers

    private func formNumberField(_ title: String, text: Binding<String>, isDecimal: Bool = true) -> some View {
        HStack {
            Text(title)
                .font(SpentyFonts.body)
            Spacer()
            TextField("0", text: text)
                .keyboardType(isDecimal ? .decimalPad : .numberPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 120)
                .font(SpentyFonts.amountSmall)
        }
    }

    private func populateForm() {
        guard let account else { return }
        name = account.name ?? ""
        accountType = account.accountType?.lowercased() ?? "asset"
        subType = account.subType ?? ""
        accountNumber = account.accountNumber ?? ""
        openingBalance = account.openingBalance.map { String($0) } ?? ""
        balanceAsOfDate = account.balanceAsOfDate ?? Date()
        currency = account.currency ?? "INR"
        descriptionText = account.description ?? ""
        loanInterestRate = account.loanInterestRate.map { String($0) } ?? ""
        loanTenureMonths = account.loanTenureMonths.map { String($0) } ?? ""
        loanEmiAmount = account.loanEmiAmount.map { String($0) } ?? ""
        loanEmiDay = account.loanEmiDay.map { String($0) } ?? ""
        loanSanctionedAmount = account.loanSanctionedAmount.map { String($0) } ?? ""
        brokerName = account.brokerName ?? ""
    }

    private func save() async {
        var payload: [String: Any] = [
            "name": name.trimmingCharacters(in: .whitespaces),
            "accountType": accountType,
            "currency": currency
        ]

        if !subType.isEmpty { payload["subType"] = subType }
        if !accountNumber.isEmpty { payload["accountNumber"] = accountNumber }
        if let val = Double(openingBalance) { payload["openingBalance"] = val }
        payload["balanceAsOfDate"] = balanceAsOfDate
        if !descriptionText.isEmpty { payload["description"] = descriptionText }

        if isLiability {
            if let val = Double(loanInterestRate) { payload["loanInterestRate"] = val }
            if let val = Int(loanTenureMonths) { payload["loanTenureMonths"] = val }
            if let val = Double(loanEmiAmount) { payload["loanEmiAmount"] = val }
            if let val = Int(loanEmiDay) { payload["loanEmiDay"] = val }
            if let val = Double(loanSanctionedAmount) { payload["loanSanctionedAmount"] = val }
        }

        if isInvestment && isDematSubType && !brokerName.isEmpty {
            payload["brokerName"] = brokerName
        }

        let success = await viewModel.saveAccount(payload, editId: account?.id)
        if success { dismiss() }
    }
}

#Preview {
    AccountFormView(viewModel: AccountsViewModel(), account: nil)
}
