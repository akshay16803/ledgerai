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
    @State private var recurrenceDate: String = ""

    @State private var selectedPhoto: PhotosPickerItem?
    @State private var isSaving: Bool = false
    @State private var errorMessage: String?

    // Quick-add inline creation state
    @State private var showNewCategorySheet: Bool = false
    @State private var showNewSubcategorySheet: Bool = false
    @State private var newCategoryName: String = ""
    @State private var newSubcategoryName: String = ""
    @State private var isCreatingCategory: Bool = false
    @State private var showNewAccountAlert: Bool = false
    @State private var newAccountName: String = ""
    @State private var newAccountType: String = "savings"

    private var isEditing: Bool { transaction != nil }

    private var isTransfer: Bool { transactionType == "transfer" }
    private var isIncome: Bool { transactionType == "income" }

    private let transactionTypes = ["income", "expense", "transfer"]
    private let paymentMethods = ["Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Net Banking", "Wallet", "Other"]
    private let frequencies = ["daily", "weekly", "monthly", "quarterly", "yearly"]
    private let frequencyLabels = ["daily": "Daily", "weekly": "Weekly", "monthly": "Monthly", "quarterly": "Quarterly", "yearly": "Yearly"]

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
                        amountHero
                        detailsSection
                        categorySection
                        noteSection
                        recurringSection
                        attachmentSection
                        switchToInvoiceButton

                        if let errorMessage {
                            Text(errorMessage)
                                .font(SpentyFonts.footnote)
                                .foregroundColor(.spentyError)
                                .padding(.horizontal, 4)
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

    // MARK: - Section Label

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(.spentyTextSecondary)
            .tracking(0.8)
            .padding(.leading, 4)
            .padding(.bottom, -12)
    }

    // MARK: - Amount Hero

    private var amountHero: some View {
        VStack(spacing: 20) {
            // Type picker
            HStack(spacing: 0) {
                ForEach(transactionTypes, id: \.self) { type in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            transactionType = type
                            categoryId = ""
                            subcategoryId = ""
                        }
                    } label: {
                        Text(type.capitalized)
                            .font(.system(size: 14, weight: transactionType == type ? .semibold : .regular))
                            .foregroundColor(transactionType == type ? .white : .spentyTextSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                transactionType == type
                                    ? typeAccentColor
                                    : Color.clear
                            )
                            .cornerRadius(10)
                    }
                }
            }
            .padding(3)
            .background(Color.spentyBgSecondary)
            .cornerRadius(12)

            // Amount input
            VStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\u{20B9}")
                        .font(.system(size: 30, weight: .semibold, design: .rounded))
                        .foregroundColor(typeAccentColor)

                    TextField("0.00", text: $amount)
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(.spentyTextPrimary)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.5)
                }
                .frame(maxWidth: .infinity)

                Text(transactionType == "transfer" ? "Transfer amount" : transactionType == "income" ? "Money received" : "Money spent")
                    .font(.system(size: 13))
                    .foregroundColor(.spentyTextSecondary)
            }
            .padding(.vertical, 4)
        }
        .padding(20)
        .background(Color.spentyCardBg)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    // MARK: - Details Section

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Details")

            VStack(spacing: 0) {
                // Date row
                formRow(icon: "calendar", label: "Date") {
                    DatePicker("", selection: $date, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .labelsHidden()
                }

                formDivider

                // Account row
                HStack(spacing: 8) {
                    Image(systemName: "building.columns")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 22)

                    Text(isTransfer ? "From" : "Account")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)

                    Spacer(minLength: 4)

                    Picker("", selection: $accountId) {
                        Text("Select").tag("")
                        ForEach(viewModel.accounts) { account in
                            Text(account.name ?? "Unnamed").tag(account.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)

                    Button {
                        newAccountName = ""
                        newAccountType = "savings"
                        showNewAccountAlert = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.spentyPrimary.opacity(0.7))
                    }
                }
                .padding(.vertical, 12)

                if isTransfer {
                    formDivider

                    formRow(icon: "arrow.right.circle", label: "To") {
                        Picker("", selection: $toAccountId) {
                            Text("Select").tag("")
                            ForEach(viewModel.accounts.filter { $0.id != accountId }) { account in
                                Text(account.name ?? "Unnamed").tag(account.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(.spentyTextPrimary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }

                formDivider

                // Payment method row (moved here from optional card)
                formRow(icon: "creditcard", label: "Payment") {
                    Picker("", selection: $paymentMethod) {
                        Text("Select").tag("")
                        ForEach(paymentMethods, id: \.self) { method in
                            Text(method).tag(method)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
            .cardStyle()
        }
    }

    // MARK: - Category Section

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Category")

            VStack(spacing: 0) {
                // Category row
                HStack(spacing: 8) {
                    Image(systemName: "tag")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 22)

                    Text("Category")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)

                    Spacer(minLength: 4)

                    Picker("", selection: $categoryId) {
                        Text("Select").tag("")
                        ForEach(filteredCategories) { cat in
                            Text(cat.name ?? "Unnamed").tag(cat.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
                    .onChange(of: categoryId) { _, _ in
                        subcategoryId = ""
                    }

                    Button {
                        newCategoryName = ""
                        showNewCategorySheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.spentyPrimary.opacity(0.7))
                    }
                }
                .padding(.vertical, 12)

                if !subcategories.isEmpty || !categoryId.isEmpty {
                    formDivider

                    // Subcategory row
                    HStack(spacing: 8) {
                        Image(systemName: "tag.circle")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyPrimary.opacity(0.6))
                            .frame(width: 22)

                        Text("Subcategory")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .lineLimit(1)

                        Spacer(minLength: 4)

                        Picker("", selection: $subcategoryId) {
                            Text("None").tag("")
                            ForEach(subcategories) { sub in
                                Text(sub.name ?? "Unnamed").tag(sub.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(.spentyTextPrimary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .fixedSize(horizontal: false, vertical: true)

                        if !categoryId.isEmpty {
                            Button {
                                newSubcategoryName = ""
                                showNewSubcategorySheet = true
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(.spentyPrimary.opacity(0.7))
                            }
                        }
                    }
                    .padding(.vertical, 12)
                }
            }
            .cardStyle()
            .alert("New Account", isPresented: $showNewAccountAlert) {
                TextField("Account name", text: $newAccountName)
                Picker("Type", selection: $newAccountType) {
                    Text("Savings").tag("savings")
                    Text("Current").tag("current")
                    Text("Credit Card").tag("credit_card")
                    Text("Cash").tag("cash")
                    Text("Wallet").tag("wallet")
                    Text("Loan").tag("loan")
                    Text("Investment").tag("investment")
                }
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineAccount() }
                }
                .disabled(newAccountName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name and type for the new account.")
            }
            .alert("New Category", isPresented: $showNewCategorySheet) {
                TextField("Category name", text: $newCategoryName)
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineCategory() }
                }
                .disabled(newCategoryName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name for the new \(transactionType) category.")
            }
            .alert("New Subcategory", isPresented: $showNewSubcategorySheet) {
                TextField("Subcategory name", text: $newSubcategoryName)
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineSubcategory() }
                }
                .disabled(newSubcategoryName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name for the new subcategory.")
            }
        }
    }

    // MARK: - Note Section

    private var noteSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Note")

            HStack(spacing: 10) {
                Image(systemName: "text.alignleft")
                    .font(.system(size: 15))
                    .foregroundColor(.spentyPrimary)

                TextField("Add a note...", text: $descriptionText)
                    .font(.system(size: 15))
                    .foregroundColor(.spentyTextPrimary)
            }
            .padding(14)
            .background(Color.spentyCardBg)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.spentyBorder, lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
        }
    }

    // MARK: - Recurring Section

    private var recurringSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Recurring")

            VStack(spacing: 0) {
                // Toggle row
                HStack(spacing: 10) {
                    Image(systemName: "repeat")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 24)

                    Toggle(isOn: $isRecurring) {
                        Text("Repeat")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .lineLimit(1)
                    }
                    .tint(Color.spentyPrimary)
                }
                .padding(.vertical, 12)

                if isRecurring {
                    formDivider

                    // Frequency
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            Image(systemName: "clock.arrow.2.circlepath")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyPrimary.opacity(0.6))
                                .frame(width: 24)

                            Text("Frequency")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyTextPrimary)
                                .lineLimit(1)
                        }
                        .padding(.top, 12)

                        HStack(spacing: 2) {
                            ForEach(frequencies, id: \.self) { freq in
                                Button {
                                    recurringFrequency = freq
                                } label: {
                                    Text(frequencyLabels[freq] ?? freq.capitalized)
                                        .font(.system(size: 12, weight: recurringFrequency == freq ? .semibold : .regular))
                                        .foregroundColor(recurringFrequency == freq ? .white : .spentyTextSecondary)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 9)
                                        .background(
                                            recurringFrequency == freq
                                                ? Color.spentyPrimary
                                                : Color.clear
                                        )
                                        .cornerRadius(10)
                                }
                            }
                        }
                        .padding(3)
                        .background(Color.spentyBgSecondary)
                        .cornerRadius(12)
                    }

                    formDivider

                    // Recurrence day
                    formRow(icon: "number", label: "Day") {
                        TextField("1-31", text: $recurrenceDate)
                            .keyboardType(.numberPad)
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }
            .cardStyle()
        }
    }

    // MARK: - Attachment Section

    private var attachmentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Attachment")

            PhotosPicker(
                selection: $selectedPhoto,
                matching: .images
            ) {
                HStack(spacing: 12) {
                    // Icon with badge background
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.spentyPrimary.opacity(0.12))
                            .frame(width: 36, height: 36)

                        Image(systemName: "doc.viewfinder")
                            .font(.system(size: 16))
                            .foregroundColor(.spentyPrimary)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedPhoto == nil ? "Attach Receipt" : "Receipt Selected")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(selectedPhoto == nil ? .spentyTextPrimary : .spentySuccess)
                            .lineLimit(1)

                        Text("Photo or document")
                            .font(.system(size: 12))
                            .foregroundColor(.spentyTextSecondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    if selectedPhoto != nil {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundColor(.spentySuccess)
                    } else {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.spentyTextSecondary.opacity(0.5))
                    }
                }
                .padding(.vertical, 10)
            }
            .cardStyle()
        }
    }

    // MARK: - Switch to Invoice

    @ViewBuilder
    private var switchToInvoiceButton: some View {
        if isIncome {
            Button {
                dismiss()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 15))
                    Text("Switch to Invoice")
                        .font(.system(size: 14, weight: .medium))
                }
                .foregroundColor(.spentyInfo)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.spentyInfo.opacity(0.08))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.spentyInfo.opacity(0.15), lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Shared Form Components

    private func formRow<Content: View>(
        icon: String,
        label: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 15))
                .foregroundColor(.spentyPrimary)
                .frame(width: 22)

            Text(label)
                .font(.system(size: 15))
                .foregroundColor(.spentyTextPrimary)
                .lineLimit(1)

            Spacer(minLength: 4)

            content()
        }
        .padding(.vertical, 12)
    }

    private var formDivider: some View {
        Divider()
            .padding(.leading, 40)
    }

    // MARK: - Helpers

    private var typeAccentColor: Color {
        switch transactionType {
        case "income": return .spentySuccess
        case "expense": return .spentyError
        case "transfer": return .spentyInfo
        default: return .spentyPrimary
        }
    }

    // MARK: - Inline Account Creation

    private func createInlineAccount() async {
        let trimmed = newAccountName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        do {
            let payload: [String: Any] = ["name": trimmed, "accountType": newAccountType]
            let created = try await AccountRepository().createAccount(payload)
            viewModel.accounts = try await AccountRepository().fetchAccounts()
            accountId = created.id
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Inline Category Creation

    private func createInlineCategory() async {
        let trimmed = newCategoryName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        let catType: CategoryType = transactionType == "income" ? .income : .expense
        do {
            let created = try await CategoryRepository.shared.createCategory(name: trimmed, type: catType, parentId: nil)
            viewModel.categories = try await CategoryRepository.shared.getCategories()
            categoryId = created.id
            subcategoryId = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func createInlineSubcategory() async {
        let trimmed = newSubcategoryName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !categoryId.isEmpty else { return }

        let catType: CategoryType = transactionType == "income" ? .income : .expense
        do {
            let created = try await CategoryRepository.shared.createCategory(name: trimmed, type: catType, parentId: categoryId)
            viewModel.categories = try await CategoryRepository.shared.getCategories()
            subcategoryId = created.id
        } catch {
            errorMessage = error.localizedDescription
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
        recurrenceDate = txn.recurrenceDate.map { String($0) } ?? ""
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
            recurrenceDate: isRecurring ? Int(recurrenceDate) : nil,
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

        if let vmError = viewModel.errorMessage {
            errorMessage = vmError
        }

        isSaving = false
    }
}

#Preview {
    TransactionFormView(viewModel: TransactionsViewModel())
}
