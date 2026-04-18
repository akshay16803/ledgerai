import Foundation
import os

@Observable
final class EditTransactionViewModel {

    // MARK: - Form Fields

    var transactionType: TransactionType = .expense
    var amount: String = ""
    var date: Date = .now
    var accountId: String?
    var toAccountId: String?
    var categoryId: String?
    var subcategoryId: String?
    var description: String = ""
    var paymentMethod: String = "Cash"
    var isRecurring: Bool = false
    var recurringFrequency: String = "Monthly"

    // MARK: - Picker Data

    var accounts: [Account] = []
    var categories: [Category] = []

    var subcategories: [Category] {
        guard let categoryId else { return [] }
        return categories.filter { $0.parentId == categoryId }
    }

    var filteredCategories: [Category] {
        let type: CategoryType = transactionType == .income ? .income : .expense
        return categories.filter { $0.parentId == nil && $0.categoryType == type }
    }

    // MARK: - Receipt

    var receiptFile: Data?
    var receiptFileName: String?
    var receiptId: String?

    // MARK: - Loading State

    var isUploading = false
    var isParsing = false
    var isSaving = false
    var errorMessage: String?

    // MARK: - Edit Mode

    var isEdit: Bool = false
    var existingTransaction: Transaction?

    // MARK: - Validation

    var isValid: Bool {
        guard let amountValue = Double(amount), amountValue > 0 else { return false }
        guard accountId != nil else { return false }
        if transactionType == .transfer && toAccountId == nil { return false }
        return true
    }

    // MARK: - Payment Methods

    static let paymentMethods = [
        "Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Other"
    ]

    static let recurringFrequencies = ["Daily", "Weekly", "Monthly", "Yearly"]

    // MARK: - Private

    private let transactionRepo = TransactionRepository()
    private let accountRepo = AccountRepository()
    private let categoryRepo = CategoryRepository()
    private let receiptRepo = ReceiptRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "edit-transaction")

    private let dateFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f
    }()

    // MARK: - Methods

    @MainActor
    func loadPickerData() async {
        do {
            async let fetchedAccounts = accountRepo.getAccounts()
            async let fetchedCategories = categoryRepo.getCategories()
            accounts = try await fetchedAccounts
            categories = try await fetchedCategories
        } catch {
            errorMessage = "Failed to load form data."
            logger.error("Load picker data error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func uploadReceipt(data: Data, fileName: String, mimeType: String) async {
        isUploading = true
        errorMessage = nil

        do {
            let receipt = try await receiptRepo.uploadReceipt(
                fileData: data,
                fileName: fileName,
                mimeType: mimeType
            )
            receiptId = receipt.receiptId
            receiptFile = data
            receiptFileName = fileName
            isUploading = false

            // Parse receipt with AI
            isParsing = true
            let parseResponse = try await receiptRepo.parseReceipt(receipt.receiptId)

            if let parsed = parseResponse.parsedData {
                if let parsedAmount = parsed.amount {
                    amount = String(format: "%.2f", parsedAmount)
                }
                if let parsedDate = parsed.date {
                    let isoFormatter = ISO8601DateFormatter()
                    isoFormatter.formatOptions = [.withFullDate]
                    if let d = isoFormatter.date(from: parsedDate) {
                        date = d
                    }
                }
                if let parsedDesc = parsed.description, !parsedDesc.isEmpty {
                    description = parsedDesc
                } else if let vendor = parsed.vendor, !vendor.isEmpty {
                    description = vendor
                }
                if let parsedMethod = parsed.paymentMethod {
                    let normalized = parsedMethod.capitalized
                    if Self.paymentMethods.contains(normalized) {
                        paymentMethod = normalized
                    }
                }
                // Try to match category by name
                if let catName = parsed.categoryName {
                    let match = filteredCategories.first {
                        $0.name.lowercased() == catName.lowercased()
                    }
                    if let match {
                        categoryId = match.categoryId
                    }
                }
            }

            isParsing = false
            logger.info("Receipt uploaded and parsed: \(receipt.receiptId)")
        } catch {
            errorMessage = "Failed to process receipt."
            isUploading = false
            isParsing = false
            logger.error("Receipt upload error: \(error.localizedDescription)")
        }
    }

    func removeReceipt() {
        receiptFile = nil
        receiptFileName = nil
        receiptId = nil
    }

    @MainActor
    func save() async throws {
        guard isValid else {
            errorMessage = "Please fill in all required fields."
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            if isEdit, let txn = existingTransaction {
                let payload = buildUpdatePayload()
                _ = try await transactionRepo.updateTransaction(txn.transactionId, payload)
                logger.info("Updated transaction: \(txn.transactionId)")
            } else {
                let payload = buildCreatePayload()
                _ = try await transactionRepo.createTransaction(payload)
                logger.info("Created new transaction")
            }
        } catch {
            isSaving = false
            errorMessage = "Failed to save transaction."
            logger.error("Save error: \(error.localizedDescription)")
            throw error
        }

        isSaving = false
    }

    @MainActor
    func approve() async throws {
        guard let txn = existingTransaction else { return }

        isSaving = true
        errorMessage = nil

        do {
            _ = try await transactionRepo.approveTransaction(txn.transactionId)
            logger.info("Approved transaction: \(txn.transactionId)")
        } catch {
            isSaving = false
            errorMessage = "Failed to approve transaction."
            logger.error("Approve error: \(error.localizedDescription)")
            throw error
        }

        isSaving = false
    }

    func populateFromExisting(_ txn: Transaction) {
        isEdit = true
        existingTransaction = txn
        transactionType = txn.transactionType
        amount = String(format: "%.2f", txn.amount)

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withFullDate]
        if let d = isoFormatter.date(from: txn.date) {
            date = d
        }

        accountId = txn.accountId
        toAccountId = txn.toAccountId
        categoryId = txn.categoryId
        subcategoryId = txn.subcategoryId
        description = txn.description ?? ""
        paymentMethod = txn.paymentMethod ?? "Cash"
        isRecurring = txn.isRecurring ?? false
        recurringFrequency = txn.recurringFrequency ?? "Monthly"
        receiptId = txn.receiptId
    }

    func buildCreatePayload() -> TransactionCreate {
        TransactionCreate(
            transactionType: transactionType,
            amount: Double(amount) ?? 0,
            date: dateFormatter.string(from: date),
            accountId: accountId,
            toAccountId: transactionType == .transfer ? toAccountId : nil,
            categoryId: categoryId,
            subcategoryId: subcategoryId,
            description: description.isEmpty ? nil : description,
            paymentMethod: paymentMethod,
            isRecurring: isRecurring,
            recurringFrequency: isRecurring ? recurringFrequency : nil
        )
    }

    func buildUpdatePayload() -> TransactionUpdate {
        TransactionUpdate(
            transactionType: transactionType,
            amount: Double(amount) ?? 0,
            date: dateFormatter.string(from: date),
            accountId: accountId,
            toAccountId: transactionType == .transfer ? toAccountId : nil,
            categoryId: categoryId,
            subcategoryId: subcategoryId,
            description: description.isEmpty ? nil : description,
            paymentMethod: paymentMethod,
            isRecurring: isRecurring,
            recurringFrequency: isRecurring ? recurringFrequency : nil
        )
    }
}
