import SwiftUI
import PhotosUI

struct TransactionFormView: View {

    @Environment(\.dismiss) private var dismiss

    var viewModel: TransactionsViewModel
    var transaction: Transaction?

    // MARK: - Form State

    @State private var transactionType: String = "expense"
    @State private var amount: String = ""
    @State private var date: Date = Date()
    @State private var accountId: String = ""
    @State private var toAccountId: String = ""
    @State private var categoryId: String = ""
    @State private var subcategoryId: String = ""
    @State private var descriptionText: String = ""
    @State private var paymentMethod: String = ""
    @State private var isRecurring: Bool = false
    @State private var recurringFrequency: String = "monthly"

    @State private var selectedPhoto: PhotosPickerItem?
    @State private var isSaving: Bool = false
    @State private var errorMessage: String?

    private var isEditing: Bool { transaction != nil }

    private var isTransfer: Bool { transactionType == "transfer" }
    private var isIncome: Bool { transactionType == "income" }

    private let transactionTypes = ["income", "expense", "transfer"]
    private let paymentMethods = ["Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Net Banking", "Wallet", "Other"]
    private let frequencies = ["daily", "weekly", "monthly", "quarterly", "yearly"]

    // MARK: - Filtered Categories

    private var filteredCategories: [Category] {
        viewModel.categories.filter { cat in
            guard let catType = cat.categoryType?.lowercased() else { return true }
            if transactionType == "transfer" { return true }
            return catType == transactionType
        }
    }

    private var subcategories: [Category] {
        viewModel.subcategories(for: categoryId.isEmpty ? nil : categoryId)
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        typePicker
                        amountSection
                        dateSection
                        accountSection
                        categorySection
                        descriptionSection
                        paymentMethodSection
                        recurringSection
                        receiptSection
                        switchToInvoiceButton

                        if let errorMessage {
                            Text(errorMessage)
                                .font(SpentyFonts.footnote)
                                .foregroundColor(.spentyError)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle(isEditing ? "Edit Transaction" : "New Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.spentyTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Create") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.spentyPrimary)
                    .disabled(isSaving || amount.isEmpty || accountId.isEmpty || (!isTransfer && categoryId.isEmpty))
                }
            }
            .onAppear { populateFields() }
        }
    }

    // MARK: - Type Picker

    private var typePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Type")

            Picker("Type", selection: $transactionType) {
                ForEach(transactionTypes, id: \.self) { type in
                    Text(type.capitalized).tag(type)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: transactionType) { _, _ in
                categoryId = ""
                subcategoryId = ""
            }
        }
    }

    // MARK: - Amount

    private var amountSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Amount")

            HStack(spacing: 8) {
                Text("\u{20B9}")
                    .font(SpentyFonts.amountMedium)
                    .foregroundColor(typeAccentColor)

                TextField("0.00", text: $amount)
                    .font(SpentyFonts.amountMedium)
                    .foregroundColor(.spentyTextPrimary)
                    .keyboardType(.decimalPad)
            }
            .padding(14)
            .background(Color.spentyCardBg)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(typeAccentColor.opacity(0.3), lineWidth: 1.5)
            )
        }
    }

    // MARK: - Date

    private var dateSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Date")

            DatePicker("", selection: $date, displayedComponents: .date)
                .datePickerStyle(.compact)
                .labelsHidden()
                .inputStyle()
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel(isTransfer ? "From Account" : "Account")

            Picker("Account", selection: $accountId) {
                Text("Select Account").tag("")
                ForEach(viewModel.accounts) { account in
                    Text(account.name ?? "Unnamed").tag(account.id)
                }
            }
            .pickerStyle(.menu)
            .inputStyle()

            if isTransfer {
                sectionLabel("To Account")

                Picker("To Account", selection: $toAccountId) {
                    Text("Select Account").tag("")
                    ForEach(viewModel.accounts.filter { $0.id != accountId }) { account in
                        Text(account.name ?? "Unnamed").tag(account.id)
                    }
                }
                .pickerStyle(.menu)
                .inputStyle()
            }
        }
    }

    // MARK: - Category

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Category")

            Picker("Category", selection: $categoryId) {
                Text("Select Category").tag("")
                ForEach(filteredCategories) { cat in
                    Text(cat.name ?? "Unnamed").tag(cat.id)
                }
            }
            .pickerStyle(.menu)
            .inputStyle()
            .onChange(of: categoryId) { _, _ in
                subcategoryId = ""
            }

            if !subcategories.isEmpty {
                sectionLabel("Subcategory")

                Picker("Subcategory", selection: $subcategoryId) {
                    Text("None").tag("")
                    ForEach(subcategories) { sub in
                        Text(sub.name ?? "Unnamed").tag(sub.id)
                    }
                }
                .pickerStyle(.menu)
                .inputStyle()
            }
        }
    }

    // MARK: - Description

    private var descriptionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Description")

            TextField("Enter description", text: $descriptionText)
                .font(SpentyFonts.body)
                .inputStyle()
        }
    }

    // MARK: - Payment Method

    private var paymentMethodSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Payment Method")

            Picker("Payment Method", selection: $paymentMethod) {
                Text("Select Method").tag("")
                ForEach(paymentMethods, id: \.self) { method in
                    Text(method).tag(method)
                }
            }
            .pickerStyle(.menu)
            .inputStyle()
        }
    }

    // MARK: - Recurring

    private var recurringSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle(isOn: $isRecurring) {
                HStack(spacing: 8) {
                    Image(systemName: "repeat")
                        .foregroundColor(.spentyPrimary)
                    Text("Recurring Transaction")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextPrimary)
                }
            }
            .tint(Color.spentyPrimary)

            if isRecurring {
                Picker("Frequency", selection: $recurringFrequency) {
                    ForEach(frequencies, id: \.self) { freq in
                        Text(freq.capitalized).tag(freq)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
        .padding(14)
        .background(Color.spentyCardBg)
        .cornerRadius(12)
    }

    // MARK: - Receipt

    private var receiptSection: some View {
        PhotosPicker(
            selection: $selectedPhoto,
            matching: .images
        ) {
            HStack(spacing: 8) {
                Image(systemName: "doc.viewfinder")
                    .foregroundColor(.spentyPrimary)
                Text(selectedPhoto == nil ? "Attach Receipt" : "Receipt Selected")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(.spentyTextSecondary)
            }
            .padding(14)
            .background(Color.spentyCardBg)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.spentyBorder, lineWidth: 1)
            )
        }
    }

    // MARK: - Switch to Invoice

    @ViewBuilder
    private var switchToInvoiceButton: some View {
        if isIncome {
            Button {
                dismiss()
                // Navigation to invoice creation would be handled by a coordinator
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "doc.text")
                    Text("Switch to Invoice")
                        .font(SpentyFonts.subheadline)
                }
                .foregroundColor(.spentyInfo)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.spentyInfo.opacity(0.08))
                .cornerRadius(10)
            }
        }
    }

    // MARK: - Helpers

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(SpentyFonts.caption1)
            .fontWeight(.medium)
            .foregroundColor(.spentyTextSecondary)
            .textCase(.uppercase)
    }

    private var typeAccentColor: Color {
        switch transactionType {
        case "income": return .spentySuccess
        case "expense": return .spentyError
        case "transfer": return .spentyInfo
        default: return .spentyPrimary
        }
    }

    // MARK: - Populate

    private func populateFields() {
        guard let txn = transaction else { return }
        transactionType = txn.transactionType ?? "expense"
        amount = txn.amount.map { String(format: "%.2f", $0) } ?? ""
        date = txn.date ?? Date()
        accountId = txn.accountId ?? ""
        toAccountId = txn.toAccountId ?? ""
        categoryId = txn.categoryId ?? ""
        subcategoryId = txn.subcategoryId ?? ""
        descriptionText = txn.description ?? ""
        paymentMethod = txn.paymentMethod ?? ""
        isRecurring = txn.isRecurring ?? false
        recurringFrequency = txn.recurringFrequency ?? "monthly"
    }

    // MARK: - Save

    private func save() async {
        guard let parsedAmount = Double(amount), parsedAmount > 0 else {
            errorMessage = "Please enter a valid amount."
            return
        }

        guard !accountId.isEmpty else {
            errorMessage = "Please select an account."
            return
        }

        if !isTransfer && categoryId.isEmpty {
            errorMessage = "Please select a category."
            return
        }

        if isTransfer && toAccountId.isEmpty {
            errorMessage = "Please select a destination account."
            return
        }

        isSaving = true
        errorMessage = nil

        let txn = Transaction(
            id: transaction?.id ?? "",
            transactionType: transactionType,
            amount: parsedAmount,
            date: date,
            accountId: accountId.isEmpty ? nil : accountId,
            toAccountId: isTransfer && !toAccountId.isEmpty ? toAccountId : nil,
            categoryId: categoryId.isEmpty ? nil : categoryId,
            subcategoryId: subcategoryId.isEmpty ? nil : subcategoryId,
            description: descriptionText.isEmpty ? nil : descriptionText,
            paymentMethod: paymentMethod.isEmpty ? nil : paymentMethod,
            status: transaction?.status ?? "approved",
            isRecurring: isRecurring,
            recurringFrequency: isRecurring ? recurringFrequency : nil,
            source: transaction?.source ?? "manual",
            receiptId: transaction?.receiptId,
            originalCurrency: transaction?.originalCurrency,
            originalAmount: transaction?.originalAmount,
            exchangeRate: transaction?.exchangeRate,
            isEstimatedRate: transaction?.isEstimatedRate
        )

        if isEditing {
            await viewModel.updateTransaction(txn)
        } else {
            await viewModel.createTransaction(txn)
        }

        // Surface any network error from the view model
        if let vmError = viewModel.errorMessage {
            errorMessage = vmError
        }

        isSaving = false
    }
}

#Preview {
    TransactionFormView(viewModel: TransactionsViewModel())
}
