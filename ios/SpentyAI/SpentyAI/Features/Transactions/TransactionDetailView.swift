import SwiftUI

struct TransactionDetailView: View {

    @Environment(\.dismiss) private var dismiss

    let transactionId: String
    var onTransactionUpdated: (() -> Void)?

    @State private var transaction: Transaction
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showEditSheet = false
    @State private var showDeleteConfirm = false
    @State private var showReceiptSheet = false
    @State private var isPerformingAction = false

    private let repository = TransactionRepository.shared

    // MARK: - Init

    init(transaction: Transaction, onTransactionUpdated: (() -> Void)? = nil) {
        self.transactionId = transaction.id
        self._transaction = State(initialValue: transaction)
        self.onTransactionUpdated = onTransactionUpdated
    }

    // MARK: - Computed

    private var amountColor: Color {
        switch transaction.transactionType?.lowercased() {
        case "income":
            return .spentySuccess
        case "expense":
            return .spentyError
        case "transfer":
            return .spentyAccent3
        default:
            return .spentyTextPrimary
        }
    }

    private var amountPrefix: String {
        switch transaction.transactionType?.lowercased() {
        case "income":
            return "+"
        case "expense":
            return "-"
        default:
            return ""
        }
    }

    private var formattedAmount: String {
        guard let amount = transaction.amount else { return "--" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }

    private var formattedDate: String {
        guard let date = transaction.date else { return "--" }
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private var typeDisplayName: String {
        guard let type = transaction.transactionType else { return "--" }
        return type.capitalized
    }

    private var isTransfer: Bool {
        transaction.transactionType?.lowercased() == "transfer"
    }

    private var isPending: Bool {
        transaction.status?.lowercased() == "pending"
    }

    private var hasForeignCurrency: Bool {
        transaction.originalCurrency != nil && transaction.originalAmount != nil
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                if isLoading && transaction.amount == nil {
                    LoadingView(message: "Loading transaction...")
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            amountSection
                            statusSection
                            detailCard
                            supportingDocumentCard
                            actionButtons
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 20)
                    }
                }
            }
            .navigationTitle("Transaction Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyTextPrimary)
                    }
                }
            }
            .task {
                await loadTransaction()
            }
            .sheet(isPresented: $showEditSheet) {
                TransactionFormView(
                    viewModel: TransactionsViewModel(),
                    transaction: transaction
                )
                .onDisappear {
                    Task { await loadTransaction() }
                    onTransactionUpdated?()
                }
            }
            .sheet(isPresented: $showReceiptSheet) {
                receiptPreviewSheet
            }
            .alert("Delete Transaction", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task { await deleteTransaction() }
                }
            } message: {
                Text("Are you sure you want to delete this transaction? This action cannot be undone.")
            }
        }
    }

    // MARK: - Amount Section

    private var amountSection: some View {
        VStack(spacing: 8) {
            Text("\(amountPrefix)\(formattedAmount)")
                .font(SpentyFonts.amountLarge)
                .foregroundColor(amountColor)

            Text(typeDisplayName)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    // MARK: - Status Section

    @ViewBuilder
    private var statusSection: some View {
        if let status = transaction.status, !status.isEmpty {
            HStack {
                Spacer()
                StatusBadge(status: status)
                Spacer()
            }
        }
    }

    // MARK: - Detail Card

    private var detailCard: some View {
        VStack(spacing: 0) {
            detailRow(label: "Type", value: typeDisplayName)
            divider
            detailRow(label: "Date", value: formattedDate)
            divider
            if let desc = transaction.description, !desc.isEmpty {
                detailRow(label: "Description", value: desc)
                divider
            }
            if let name = transaction.categoryName, !name.isEmpty {
                detailRow(label: "Category", value: name)
                divider
            }
            if let name = transaction.subcategoryName, !name.isEmpty {
                detailRow(label: "Subcategory", value: name)
                divider
            }
            if let name = transaction.accountName, !name.isEmpty {
                detailRow(label: "Account", value: name)
                divider
            }
            if isTransfer, let name = transaction.toAccountName, !name.isEmpty {
                detailRow(label: "To Account", value: name)
                divider
            }
            if let paymentMethod = transaction.paymentMethod, !paymentMethod.isEmpty {
                detailRow(label: "Payment Method", value: paymentMethod)
                divider
            }
            if let source = transaction.source, !source.isEmpty {
                detailRow(label: "Source", value: source)
                divider
            }
            recurringRow
            if hasForeignCurrency {
                foreignCurrencyRows
            }
        }
        .cardStyle()
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextSecondary)
            Spacer()
            Text(value)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextPrimary)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 10)
    }

    private var divider: some View {
        Divider()
            .background(Color.spentyBorder)
    }

    @ViewBuilder
    private var recurringRow: some View {
        let isRecurring = transaction.isRecurring ?? false
        detailRow(
            label: "Recurring",
            value: isRecurring
                ? "Yes\(transaction.recurringFrequency.map { " (\($0.capitalized))" } ?? "")"
                : "No"
        )
    }

    @ViewBuilder
    private var foreignCurrencyRows: some View {
        divider
        if let currency = transaction.originalCurrency {
            detailRow(label: "Original Currency", value: currency.uppercased())
        }
        if let originalAmount = transaction.originalAmount {
            divider
            let formatter = NumberFormatter()
            let _ = formatter.numberStyle = .decimal
            let _ = formatter.maximumFractionDigits = 2
            detailRow(
                label: "Original Amount",
                value: formatter.string(from: NSNumber(value: originalAmount)) ?? "\(originalAmount)"
            )
        }
        if let exchangeRate = transaction.exchangeRate {
            divider
            let rateLabel = transaction.isEstimatedRate == true ? "Exchange Rate (Est.)" : "Exchange Rate"
            detailRow(label: rateLabel, value: String(format: "%.4f", exchangeRate))
        }
    }

    // MARK: - Supporting Document

    private var supportingDocumentCard: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Supporting Document")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)
                Spacer()
            }

            if let receiptId = transaction.receiptId, !receiptId.isEmpty {
                Button {
                    showReceiptSheet = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "doc.text.image")
                            .font(SpentyFonts.body)
                        Text("View Supporting Document")
                            .font(SpentyFonts.subheadline)
                    }
                    .foregroundColor(.spentyPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentyPrimary.opacity(0.08))
                    .cornerRadius(10)
                }
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "doc.text.image")
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                    Text("No supporting document attached")
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
        }
        .cardStyle()
    }

    private var receiptPreviewSheet: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    Image(systemName: "doc.text.image")
                        .font(.system(size: 48))
                        .foregroundColor(.spentyPrimary)

                    Text("Supporting Document")
                        .font(SpentyFonts.title3)
                        .foregroundColor(.spentyTextPrimary)

                    if let receiptId = transaction.receiptId {
                        Text("Receipt ID: \(receiptId)")
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextSecondary)
                            .textSelection(.enabled)
                    }

                    Text("Full document preview will be available in a future update.")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
            }
            .navigationTitle("Document")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showReceiptSheet = false
                    }
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyPrimary)
                }
            }
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button {
                showEditSheet = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "pencil")
                    Text("Edit Transaction")
                }
                .primaryButtonStyle()
            }
            .disabled(isPerformingAction)

            if isPending {
                HStack(spacing: 12) {
                    Button {
                        Task { await approveTransaction() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle")
                            Text("Approve")
                        }
                        .primaryButtonStyle()
                    }
                    .disabled(isPerformingAction)

                    Button {
                        Task { await rejectTransaction() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "xmark.circle")
                            Text("Reject")
                        }
                        .destructiveButtonStyle()
                    }
                    .disabled(isPerformingAction)
                }
            }

            Button {
                showDeleteConfirm = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "trash")
                    Text("Delete Transaction")
                }
                .destructiveButtonStyle()
            }
            .disabled(isPerformingAction)
        }
        .padding(.top, 8)
    }

    // MARK: - Actions

    @MainActor
    private func loadTransaction() async {
        isLoading = true
        defer { isLoading = false }
        do {
            transaction = try await repository.fetchTransaction(id: transactionId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func deleteTransaction() async {
        isPerformingAction = true
        defer { isPerformingAction = false }
        do {
            _ = try await repository.deleteTransaction(id: transactionId)
            onTransactionUpdated?()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func approveTransaction() async {
        isPerformingAction = true
        defer { isPerformingAction = false }
        do {
            transaction = try await repository.approveTransaction(id: transactionId)
            onTransactionUpdated?()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func rejectTransaction() async {
        isPerformingAction = true
        defer { isPerformingAction = false }
        do {
            _ = try await repository.rejectTransaction(id: transactionId)
            transaction.status = "rejected"
            onTransactionUpdated?()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Preview

#Preview {
    TransactionDetailView(
        transaction: Transaction(
            id: "preview-1",
            transactionType: "expense",
            amount: 12500.50,
            date: Date(),
            accountId: "acc-001",
            categoryId: "cat-food",
            subcategoryId: "sub-restaurant",
            description: "Dinner with client at The Grand",
            paymentMethod: "Credit Card",
            status: "pending",
            isRecurring: false,
            source: "manual",
            receiptId: "rec-abc123"
        )
    )
}
