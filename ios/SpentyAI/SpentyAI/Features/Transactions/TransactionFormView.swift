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
                    VStack(spacing: 16) {
                        amountHero
                        detailsCard
                        categoryCard
                        optionalCard
                        recurringCard
                        receiptRow
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

    // MARK: - Amount Hero

    private var amountHero: some View {
        VStack(spacing: 16) {
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
                            .font(SpentyFonts.subheadline)
                            .fontWeight(transactionType == type ? .semibold : .regular)
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
            VStack(spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\u{20B9}")
                        .font(.system(size: 32, weight: .semibold, design: .rounded))
                        .foregroundColor(typeAccentColor)

                    TextField("0.00", text: $amount)
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundColor(.spentyTextPrimary)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.5)
                }
                .frame(maxWidth: .infinity)

                Text(transactionType == "transfer" ? "Transfer amount" : transactionType == "income" ? "Money received" : "Money spent")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }
            .padding(.vertical, 8)
        }
        .padding(20)
        .background(Color.spentyCardBg)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    // MARK: - Details Card

    private var detailsCard: some View {
        VStack(spacing: 0) {
            // Date row
            formRow(icon: "calendar", label: "Date") {
                DatePicker("", selection: $date, displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .labelsHidden()
            }

            formDivider

            // Account row
            formRow(icon: "building.columns", label: isTransfer ? "From Account" : "Account") {
                Picker("", selection: $accountId) {
                    Text("Select").tag("").foregroundColor(.spentyTextSecondary)
                    ForEach(viewModel.accounts) { account in
                        Text(account.name ?? "Unnamed").tag(account.id)
                    }
                }
                .pickerStyle(.menu)
                .tint(.spentyTextPrimary)
            }

            if isTransfer {
                formDivider

                formRow(icon: "arrow.right.circle", label: "To Account") {
                    Picker("", selection: $toAccountId) {
                        Text("Select").tag("").foregroundColor(.spentyTextSecondary)
                        ForEach(viewModel.accounts.filter { $0.id != accountId }) { account in
                            Text(account.name ?? "Unnamed").tag(account.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Category Card

    private var categoryCard: some View {
        VStack(spacing: 0) {
            // Category row
            HStack(spacing: 12) {
                Image(systemName: "tag")
                    .font(.system(size: 16))
                    .foregroundColor(.spentyPrimary)
                    .frame(width: 24)

                Text("Category")
                    .font(SpentyFonts.body)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                Picker("", selection: $categoryId) {
                    Text("Select").tag("")
                    ForEach(filteredCategories) { cat in
                        Text(cat.name ?? "Unnamed").tag(cat.id)
                    }
                }
                .pickerStyle(.menu)
                .tint(.spentyTextPrimary)
                .onChange(of: categoryId) { _, _ in
                    subcategoryId = ""
                }

                Button {
                    newCategoryName = ""
                    showNewCategorySheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.spentyPrimary.opacity(0.7))
                }
            }
            .padding(.vertical, 12)

            if !subcategories.isEmpty || !categoryId.isEmpty {
                formDivider

                // Subcategory row
                HStack(spacing: 12) {
                    Image(systemName: "tag.circle")
                        .font(.system(size: 16))
                        .foregroundColor(.spentyPrimary.opacity(0.6))
                        .frame(width: 24)

                    Text("Subcategory")
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyTextPrimary)

                    Spacer()

                    Picker("", selection: $subcategoryId) {
                        Text("None").tag("")
                        ForEach(subcategories) { sub in
                            Text(sub.name ?? "Unnamed").tag(sub.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)

                    if !categoryId.isEmpty {
                        Button {
                            newSubcategoryName = ""
                            showNewSubcategorySheet = true
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 22))
                                .foregroundColor(.spentyPrimary.opacity(0.7))
                        }
                    }
                }
                .padding(.vertical, 12)
            }
        }
        .cardStyle()
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

    // MARK: - Optional Details Card

    private var optionalCard: some View {
        VStack(spacing: 0) {
            // Description row
            formRow(icon: "text.alignleft", label: "Description") {
                TextField("Add note", text: $descriptionText)
                    .font(SpentyFonts.body)
                    .foregroundColor(.spentyTextPrimary)
                    .multilineTextAlignment(.trailing)
            }

            formDivider

            // Payment method row
            formRow(icon: "creditcard", label: "Payment") {
                Picker("", selection: $paymentMethod) {
                    Text("Select").tag("")
                    ForEach(paymentMethods, id: \.self) { method in
                        Text(method).tag(method)
                    }
                }
                .pickerStyle(.menu)
                .tint(.spentyTextPrimary)
            }
        }
        .cardStyle()
    }

    // MARK: - Recurring Card

    private var recurringCard: some View {
        VStack(spacing: 0) {
            // Toggle row
            HStack(spacing: 12) {
                Image(systemName: "repeat")
                    .font(.system(size: 16))
                    .foregroundColor(.spentyPrimary)
                    .frame(width: 24)

                Toggle(isOn: $isRecurring) {
                    Text("Recurring")
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyTextPrimary)
                }
                .tint(Color.spentyPrimary)
            }
            .padding(.vertical, 12)

            if isRecurring {
                formDivider

                // Frequency
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        Image(systemName: "clock.arrow.2.circlepath")
                            .font(.system(size: 16))
                            .foregroundColor(.spentyPrimary.opacity(0.6))
                            .frame(width: 24)

                        Text("Frequency")
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyTextPrimary)
                    }
                    .padding(.top, 12)

                    HStack(spacing: 0) {
                        ForEach(frequencies, id: \.self) { freq in
                            Button {
                                recurringFrequency = freq
                            } label: {
                                Text(freq.prefix(1).uppercased() + freq.dropFirst().prefix(2))
                                    .font(SpentyFonts.caption1)
                                    .fontWeight(recurringFrequency == freq ? .semibold : .regular)
                                    .foregroundColor(recurringFrequency == freq ? .white : .spentyTextSecondary)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(
                                        recurringFrequency == freq
                                            ? Color.spentyPrimary
                                            : Color.clear
                                    )
                                    .cornerRadius(8)
                            }
                        }
                    }
                    .padding(3)
                    .background(Color.spentyBgSecondary)
                    .cornerRadius(10)
                }

                formDivider

                // Recurrence day
                formRow(icon: "number", label: "Day of Month") {
                    TextField("1-31", text: $recurrenceDate)
                        .keyboardType(.numberPad)
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyTextPrimary)
                        .multilineTextAlignment(.trailing)
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Receipt Row

    private var receiptRow: some View {
        PhotosPicker(
            selection: $selectedPhoto,
            matching: .images
        ) {
            HStack(spacing: 12) {
                Image(systemName: "doc.viewfinder")
                    .font(.system(size: 16))
                    .foregroundColor(.spentyPrimary)
                    .frame(width: 24)

                Text(selectedPhoto == nil ? "Attach Receipt" : "Receipt Selected")
                    .font(SpentyFonts.body)
                    .foregroundColor(selectedPhoto == nil ? .spentyTextPrimary : .spentySuccess)

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
            .padding(.vertical, 12)
        }
        .cardStyle()
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
                        .font(.system(size: 16))
                    Text("Switch to Invoice")
                        .font(SpentyFonts.subheadline)
                        .fontWeight(.medium)
                }
                .foregroundColor(.spentyInfo)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.spentyInfo.opacity(0.08))
                .cornerRadius(12)
            }
        }
    }

    // MARK: - Shared Form Components

    private func formRow<Content: View>(
        icon: String,
        label: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(.spentyPrimary)
                .frame(width: 24)

            Text(label)
                .font(SpentyFonts.body)
                .foregroundColor(.spentyTextPrimary)

            Spacer()

            content()
        }
        .padding(.vertical, 12)
    }

    private var formDivider: some View {
        Divider()
            .padding(.leading, 48)
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
