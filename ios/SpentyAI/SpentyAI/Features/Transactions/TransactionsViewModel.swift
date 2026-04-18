import Foundation
import os

@Observable
final class TransactionsViewModel {

    // MARK: - Data

    var transactions: [Transaction] = []
    var totalCount: Int = 0

    // MARK: - Loading State

    var isLoading = false
    var isRefreshing = false
    var errorMessage: String?

    // MARK: - Filter State

    var selectedType: TransactionType?
    var selectedAccountId: String?
    var dateFrom: Date?
    var dateTo: Date?

    var hasActiveFilters: Bool {
        selectedType != nil || selectedAccountId != nil || dateFrom != nil || dateTo != nil
    }

    // MARK: - Sheet State

    var showEditTransaction = false
    var editingTransaction: Transaction?
    var showDeleteConfirm = false
    var deletingTransaction: Transaction?

    // MARK: - View Mode

    enum ViewMode: String, CaseIterable {
        case list = "List"
        case ledger = "Ledger"
    }

    var viewMode: ViewMode = .list

    // MARK: - Pagination

    private let pageSize = 50
    var currentPage = 0

    var canLoadMore: Bool {
        transactions.count < totalCount
    }

    // MARK: - Private

    private let repo = TransactionRepository()
    private let dateFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f
    }()
    private let logger = Logger(subsystem: "com.spentyai", category: "transactions")

    // MARK: - Methods

    @MainActor
    func loadTransactions() async {
        isLoading = true
        errorMessage = nil
        currentPage = 0

        do {
            let result = try await repo.getTransactions(
                type: selectedType?.rawValue,
                fromDate: dateFrom.map { dateFormatter.string(from: $0) },
                toDate: dateTo.map { dateFormatter.string(from: $0) },
                accountId: selectedAccountId,
                limit: pageSize,
                skip: 0
            )
            transactions = result.items
            totalCount = result.total
        } catch {
            errorMessage = "Failed to load transactions."
            logger.error("Load transactions error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func loadMore() async {
        guard canLoadMore, !isLoading else { return }

        currentPage += 1
        let skip = currentPage * pageSize

        do {
            let result = try await repo.getTransactions(
                type: selectedType?.rawValue,
                fromDate: dateFrom.map { dateFormatter.string(from: $0) },
                toDate: dateTo.map { dateFormatter.string(from: $0) },
                accountId: selectedAccountId,
                limit: pageSize,
                skip: skip
            )
            transactions.append(contentsOf: result.items)
            totalCount = result.total
        } catch {
            currentPage = max(0, currentPage - 1)
            logger.error("Load more error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        currentPage = 0

        do {
            let result = try await repo.getTransactions(
                type: selectedType?.rawValue,
                fromDate: dateFrom.map { dateFormatter.string(from: $0) },
                toDate: dateTo.map { dateFormatter.string(from: $0) },
                accountId: selectedAccountId,
                limit: pageSize,
                skip: 0
            )
            transactions = result.items
            totalCount = result.total
        } catch {
            logger.error("Refresh error: \(error.localizedDescription)")
        }

        isRefreshing = false
    }

    @MainActor
    func applyFilters() async {
        currentPage = 0
        await loadTransactions()
    }

    @MainActor
    func clearFilters() {
        selectedType = nil
        selectedAccountId = nil
        dateFrom = nil
        dateTo = nil
        Task {
            await loadTransactions()
        }
    }

    @MainActor
    func deleteTransaction(_ txn: Transaction) async {
        do {
            try await repo.deleteTransaction(txn.transactionId)
            transactions.removeAll { $0.transactionId == txn.transactionId }
            totalCount = max(0, totalCount - 1)
            logger.info("Deleted transaction: \(txn.transactionId)")
        } catch {
            errorMessage = "Failed to delete transaction."
            logger.error("Delete error: \(error.localizedDescription)")
        }

        showDeleteConfirm = false
        deletingTransaction = nil
    }

    @MainActor
    func approveTransaction(_ txn: Transaction) async {
        do {
            let updated = try await repo.approveTransaction(txn.transactionId)
            if let index = transactions.firstIndex(where: { $0.transactionId == txn.transactionId }) {
                transactions[index] = updated
            }
            logger.info("Approved transaction: \(txn.transactionId)")
        } catch {
            errorMessage = "Failed to approve transaction."
            logger.error("Approve error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func rejectTransaction(_ txn: Transaction) async {
        do {
            try await repo.rejectTransaction(txn.transactionId)
            if let index = transactions.firstIndex(where: { $0.transactionId == txn.transactionId }) {
                transactions[index].status = .rejected
            }
            logger.info("Rejected transaction: \(txn.transactionId)")
        } catch {
            errorMessage = "Failed to reject transaction."
            logger.error("Reject error: \(error.localizedDescription)")
        }
    }
}
