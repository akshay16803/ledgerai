import SwiftUI

struct PendingReviewView: View {

    @Bindable var viewModel: EmailSyncViewModel

    @State private var accounts: [Account] = []
    @State private var categories: [Category] = []
    @State private var showNewAccountAlert: Bool = false
    @State private var showNewCategoryAlert: Bool = false
    @State private var showNewSubcategoryAlert: Bool = false
    @State private var newAccountName: String = ""
    @State private var newAccountType: String = "savings"
    @State private var newCategoryName: String = ""
    @State private var newSubcategoryName: String = ""

    var body: some View {
        Group {
            if viewModel.isLoadingPending && viewModel.pendingTransactions.isEmpty {
                LoadingView(message: "Loading pending transactions...")
            } else if viewModel.pendingTransactions.isEmpty {
                EmptyStateView(
                    icon: "checkmark.circle",
                    title: "All Caught Up",
                    subtitle: "No transactions pending review. New AI-detected transactions will appear here."
                )
            } else {
                transactionList
            }
        }
        .background(Color.spentyBgPrimary)
        .navigationTitle("Pending Review")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        if viewModel.allSelected {
                            viewModel.deselectAll()
                        } else {
                            viewModel.selectAll()
                        }
                    } label: {
                        Label(
                            viewModel.allSelected ? "Deselect All" : "Select All",
                            systemImage: viewModel.allSelected ? "xmark.circle" : "checkmark.circle"
                        )
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundColor(.spentyPrimary)
                }
            }
        }
        .task {
            await viewModel.loadPendingReview()
        }
        .refreshable {
            await viewModel.loadPendingReview()
        }
        .sheet(isPresented: $viewModel.showEditSheet) {
            editTransactionSheet
        }
        .sheet(isPresented: $viewModel.showSourceSheet) {
            viewSourceSheet
        }
    }

    // MARK: - Transaction List

    private var transactionList: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Error
                if viewModel.showError {
                    ErrorBanner(message: viewModel.errorMessage) {
                        viewModel.showError = false
                    }
                }

                // Bulk actions
                if !viewModel.selectedTransactionIds.isEmpty {
                    bulkActionsBar
                }

                // Transactions
                ForEach(viewModel.pendingTransactions) { txn in
                    pendingTransactionRow(txn)
                }
            }
            .padding(16)
        }
    }

    // MARK: - Bulk Actions

    private var bulkActionsBar: some View {
        VStack(spacing: 10) {
            HStack {
                Text("\(viewModel.selectedTransactionIds.count) selected")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                Button("Deselect") {
                    viewModel.deselectAll()
                }
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyPrimary)
            }

            HStack(spacing: 12) {
                Button {
                    Task { await viewModel.bulkApprove() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Approve All")
                    }
                    .font(SpentyFonts.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentySuccess)
                    .cornerRadius(10)
                }

                Button {
                    Task { await viewModel.bulkReject() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "xmark.circle.fill")
                        Text("Reject All")
                    }
                    .font(SpentyFonts.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentyError)
                    .cornerRadius(10)
                }
            }
        }
        .cardStyle()
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: - Transaction Row

    private func pendingTransactionRow(_ txn: PendingTransaction) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Selection + header
            HStack(spacing: 12) {
                Button {
                    viewModel.toggleSelection(txn.id)
                } label: {
                    Image(systemName: viewModel.selectedTransactionIds.contains(txn.id)
                          ? "checkmark.circle.fill"
                          : "circle")
                        .font(.system(size: 22))
                        .foregroundColor(viewModel.selectedTransactionIds.contains(txn.id)
                                         ? .spentyPrimary
                                         : .spentyTextSecondary.opacity(0.4))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(txn.description ?? "Unknown Transaction")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(2)

                    if let date = txn.date {
                        Text(date, format: .dateTime.day().month(.abbreviated).year())
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }

                Spacer()

                if let amount = txn.amount {
                    Text(formatAmount(amount, type: txn.transactionType))
                        .font(SpentyFonts.amountSmall)
                        .foregroundColor(txn.transactionType == "income" ? .spentySuccess : .spentyTextPrimary)
                }
            }

            // Details
            HStack(spacing: 16) {
                if let account = txn.accountName {
                    Label(account, systemImage: "building.columns")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                        .lineLimit(1)
                }

                if let category = txn.categoryName {
                    Label(category, systemImage: "tag")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                        .lineLimit(1)
                }

                if let source = txn.source {
                    Label(source, systemImage: "envelope")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyInfo)
                        .lineLimit(1)
                }

                if txn.isRecurring == true {
                    Label {
                        Text(txn.recurringFrequency?.capitalized ?? "Recurring")
                    } icon: {
                        Image(systemName: "repeat")
                    }
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyPrimary)
                    .lineLimit(1)
                }
            }

            // Actions
            HStack(spacing: 10) {
                Button {
                    Task { await viewModel.approveTransaction(txn.id) }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                        Text("Approve")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.spentySuccess)
                    .cornerRadius(8)
                }

                Button {
                    Task { await viewModel.rejectTransaction(txn.id) }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                        Text("Reject")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyError)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.spentyError.opacity(0.1))
                    .cornerRadius(8)
                }

                Button {
                    viewModel.beginEditTransaction(txn)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "pencil")
                            .font(.system(size: 12, weight: .bold))
                        Text("Edit")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.spentyPrimary.opacity(0.1))
                    .cornerRadius(8)
                }

                if txn.sourceId != nil {
                    Button {
                        Task { await viewModel.loadSource(for: txn) }
                    } label: {
                        HStack(spacing: 4) {
                            if viewModel.isLoadingSource {
                                ProgressView()
                                    .controlSize(.mini)
                                    .tint(Color.purple)
                            } else {
                                Image(systemName: "doc.text.magnifyingglass")
                                    .font(.system(size: 12, weight: .bold))
                            }
                            Text("Source")
                                .font(SpentyFonts.caption1)
                        }
                        .foregroundColor(.purple)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.purple.opacity(0.1))
                        .cornerRadius(8)
                    }
                    .disabled(viewModel.isLoadingSource)
                }

                Spacer()
            }
        }
        .cardStyle()
    }

    // MARK: - Edit Sheet

    private var editTransactionSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Description
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)
                        TextField("Transaction description", text: $viewModel.editDescription)
                            .inputStyle()
                    }

                    // Amount
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Amount")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)
                        TextField("0.00", text: $viewModel.editAmount)
                            .keyboardType(.decimalPad)
                            .inputStyle()
                    }

                    // Transaction Type
                    VStack(spacing: 0) {
                        HStack(spacing: 8) {
                            Image(systemName: "arrow.left.arrow.right")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyPrimary)
                                .frame(width: 22)

                            Text("Type")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyTextPrimary)
                                .lineLimit(1)

                            Spacer(minLength: 4)

                            Picker("", selection: $viewModel.editTransactionType) {
                                Text("Expense").tag("expense")
                                Text("Income").tag("income")
                            }
                            .pickerStyle(.menu)
                            .tint(.spentyTextPrimary)
                            .fixedSize(horizontal: true, vertical: false)
                            .onChange(of: viewModel.editTransactionType) { _, _ in
                                viewModel.editCategoryId = ""
                                viewModel.editSubcategoryId = ""
                            }
                        }
                        .padding(.vertical, 12)
                    }
                    .cardStyle()

                    // Account
                    VStack(spacing: 0) {
                        HStack(spacing: 8) {
                            Image(systemName: "building.columns")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyPrimary)
                                .frame(width: 22)

                            Text("Account")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyTextPrimary)
                                .lineLimit(1)

                            Spacer(minLength: 4)

                            Picker("", selection: $viewModel.editAccountId) {
                                Text("Select").tag("")
                                ForEach(accounts) { account in
                                    Text(account.name ?? "Unnamed").tag(account.id)
                                }
                            }
                            .pickerStyle(.menu)
                            .tint(.spentyTextPrimary)
                            .fixedSize(horizontal: true, vertical: false)

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

                    // Category & Subcategory
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

                            Picker("", selection: $viewModel.editCategoryId) {
                                Text("Select").tag("")
                                ForEach(filteredCategories) { cat in
                                    Text(cat.name ?? "Unnamed").tag(cat.id)
                                }
                            }
                            .pickerStyle(.menu)
                            .tint(.spentyTextPrimary)
                            .fixedSize(horizontal: true, vertical: false)
                            .onChange(of: viewModel.editCategoryId) { _, _ in
                                viewModel.editSubcategoryId = ""
                            }

                            Button {
                                newCategoryName = ""
                                showNewCategoryAlert = true
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(.spentyPrimary.opacity(0.7))
                            }
                        }
                        .padding(.vertical, 12)

                        if !subcategories.isEmpty || !viewModel.editCategoryId.isEmpty {
                            Divider()
                                .padding(.leading, 40)

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

                                Picker("", selection: $viewModel.editSubcategoryId) {
                                    Text("None").tag("")
                                    ForEach(subcategories) { sub in
                                        Text(sub.name ?? "Unnamed").tag(sub.id)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(.spentyTextPrimary)
                                .fixedSize(horizontal: true, vertical: false)

                                if !viewModel.editCategoryId.isEmpty {
                                    Button {
                                        newSubcategoryName = ""
                                        showNewSubcategoryAlert = true
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
                    .alert("New Category", isPresented: $showNewCategoryAlert) {
                        TextField("Category name", text: $newCategoryName)
                        Button("Cancel", role: .cancel) { }
                        Button("Create") {
                            Task { await createInlineCategory() }
                        }
                        .disabled(newCategoryName.trimmingCharacters(in: .whitespaces).isEmpty)
                    } message: {
                        Text("Enter a name for the new \(viewModel.editTransactionType) category.")
                    }
                    .alert("New Subcategory", isPresented: $showNewSubcategoryAlert) {
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
                .padding(16)
            }
            .background(Color.spentyBgPrimary)
            .navigationTitle("Edit Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.showEditSheet = false
                    }
                    .foregroundColor(.spentyPrimary)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await viewModel.saveEditedTransaction() }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.spentyPrimary)
                }
            }
            .task { await loadPickerData() }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Picker Data

    private var filteredCategories: [Category] {
        categories.filter { cat in
            guard let catType = cat.categoryType?.lowercased() else { return true }
            return catType == viewModel.editTransactionType
        }
    }

    private var subcategories: [Category] {
        guard !viewModel.editCategoryId.isEmpty else { return [] }
        return categories.first(where: { $0.id == viewModel.editCategoryId })?.children ?? []
    }

    private func loadPickerData() async {
        do {
            accounts = try await TransactionRepository.shared.fetchAccounts()
            categories = try await CategoryRepository.shared.getCategories()
        } catch { }
    }

    private func createInlineAccount() async {
        let trimmed = newAccountName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        do {
            let payload: [String: Any] = ["name": trimmed, "accountType": newAccountType]
            let created = try await AccountRepository().createAccount(payload)
            accounts = try await TransactionRepository.shared.fetchAccounts()
            viewModel.editAccountId = created.id
        } catch { }
    }

    private func createInlineCategory() async {
        let trimmed = newCategoryName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        let catType: CategoryType = viewModel.editTransactionType == "income" ? .income : .expense
        do {
            let created = try await CategoryRepository.shared.createCategory(name: trimmed, type: catType, parentId: nil)
            categories = try await CategoryRepository.shared.getCategories()
            viewModel.editCategoryId = created.id
            viewModel.editSubcategoryId = ""
        } catch { }
    }

    private func createInlineSubcategory() async {
        let trimmed = newSubcategoryName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !viewModel.editCategoryId.isEmpty else { return }
        let catType: CategoryType = viewModel.editTransactionType == "income" ? .income : .expense
        do {
            let created = try await CategoryRepository.shared.createCategory(name: trimmed, type: catType, parentId: viewModel.editCategoryId)
            categories = try await CategoryRepository.shared.getCategories()
            viewModel.editSubcategoryId = created.id
        } catch { }
    }

    // MARK: - View Source Sheet

    private var viewSourceSheet: some View {
        NavigationStack {
            ScrollView {
                if let source = viewModel.sourceContent {
                    VStack(alignment: .leading, spacing: 16) {
                        if source.type == "email" {
                            // Email content
                            VStack(alignment: .leading, spacing: 8) {
                                Text("SUBJECT")
                                    .font(SpentyFonts.caption2)
                                    .foregroundColor(.spentyTextSecondary)
                                Text(source.subject ?? "(no subject)")
                                    .font(SpentyFonts.headline)
                                    .foregroundColor(.spentyTextPrimary)
                            }

                            HStack(spacing: 24) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("FROM")
                                        .font(SpentyFonts.caption2)
                                        .foregroundColor(.spentyTextSecondary)
                                    Text(source.from ?? "—")
                                        .font(SpentyFonts.subheadline)
                                        .foregroundColor(.spentyTextPrimary)
                                }

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("DATE")
                                        .font(SpentyFonts.caption2)
                                        .foregroundColor(.spentyTextSecondary)
                                    Text(source.date ?? "—")
                                        .font(SpentyFonts.subheadline)
                                        .foregroundColor(.spentyTextPrimary)
                                }
                            }

                            VStack(alignment: .leading, spacing: 8) {
                                Text("BODY")
                                    .font(SpentyFonts.caption2)
                                    .foregroundColor(.spentyTextSecondary)
                                Text(source.body ?? "(empty)")
                                    .font(SpentyFonts.subheadline)
                                    .foregroundColor(.spentyTextSecondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(12)
                                    .background(Color.spentyBorder.opacity(0.3))
                                    .cornerRadius(8)
                            }
                        } else {
                            // SMS content
                            HStack(spacing: 24) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("SENDER")
                                        .font(SpentyFonts.caption2)
                                        .foregroundColor(.spentyTextSecondary)
                                    Text(source.sender ?? "—")
                                        .font(SpentyFonts.headline)
                                        .foregroundColor(.spentyTextPrimary)
                                }

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("DATE")
                                        .font(SpentyFonts.caption2)
                                        .foregroundColor(.spentyTextSecondary)
                                    Text(source.date ?? "—")
                                        .font(SpentyFonts.subheadline)
                                        .foregroundColor(.spentyTextPrimary)
                                }
                            }

                            VStack(alignment: .leading, spacing: 8) {
                                Text("MESSAGE")
                                    .font(SpentyFonts.caption2)
                                    .foregroundColor(.spentyTextSecondary)
                                Text(source.body ?? "(empty)")
                                    .font(SpentyFonts.subheadline)
                                    .foregroundColor(.spentyTextSecondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(12)
                                    .background(Color.spentyBorder.opacity(0.3))
                                    .cornerRadius(8)
                            }
                        }
                    }
                    .padding(16)
                } else {
                    ProgressView("Loading source...")
                        .padding(40)
                }
            }
            .background(Color.spentyBgPrimary)
            .navigationTitle(viewModel.sourceContent?.type == "sms" ? "Original SMS" : "Original Email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        viewModel.showSourceSheet = false
                    }
                    .foregroundColor(.spentyPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Helpers

    private func formatAmount(_ amount: Double, type: String?) -> String {
        let formatted = String(format: "%.2f", abs(amount))
        if type == "income" {
            return "+\(formatted)"
        }
        return formatted
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        PendingReviewView(viewModel: EmailSyncViewModel())
    }
}
