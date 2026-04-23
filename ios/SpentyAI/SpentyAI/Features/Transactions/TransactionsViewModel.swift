import Foundation
import Observation

enum TransactionViewMode: String, CaseIterable {
    case list = "List"
    case ledger = "Ledger"
}

@Observable
final class TransactionsViewModel {

    // MARK: - Data

    var transactions: [Transaction] = []
    var total: Int = 0
    var accounts: [Account] = []
    var categories: [Category] = []

    // MARK: - Filters

    var filterType: String = "All"
    var filterAccountId: String = ""
    var filterDateFrom: Date? = nil
    var filterDateTo: Date? = nil
    var searchQuery: String = ""

    // MARK: - UI State

    var viewMode: TransactionViewMode = .list
    var isLoading: Bool = false
    var isLoadingMore: Bool = false
    var page: Int = 1
    var hasMore: Bool = true
    var showForm: Bool = false
    var editingTransaction: Transaction? = nil
    var errorMessage: String? = nil

    // MARK: - Pending Count (for empty state messaging)

    var pendingCount: Int = 0

    // MARK: - Bulk Selection

    var isSelecting: Bool = false
    var selectedIds: Set<String> = []

    // MARK: - Private

    private let repository = TransactionRepository.shared
    private let emailRepository = EmailSyncRepository.shared
    private let pageSize = 30

    private static let queryDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    // MARK: - Load

    @MainActor
    func loadInitial() async {
        isLoading = true
        errorMessage = nil
        page = 1
        do {
            async let txnResult = fetchTransactionsPage(page: 1)
            async let accts = repository.fetchAccounts()
            async let cats = repository.fetchCategories()

            let response = try await txnResult
            transactions = response.transactions
            total = response.total ?? transactions.count
            hasMore = transactions.count < total
            accounts = try await accts
            categories = try await cats
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false

        // Load pending count for empty state messaging
        await loadPendingCount()
    }

    @MainActor
    private func loadPendingCount() async {
        do {
            let stats = try await emailRepository.syncStats()
            pendingCount = stats.pendingReview ?? 0
        } catch {
            pendingCount = 0
        }
    }

    @MainActor
    func loadMore() async {
        guard !isLoadingMore, hasMore else { return }
        isLoadingMore = true
        page += 1
        do {
            let response = try await fetchTransactionsPage(page: page)
            transactions.append(contentsOf: response.transactions)
            hasMore = transactions.count < total
        } catch {
            page -= 1
            errorMessage = error.localizedDescription
        }
        isLoadingMore = false
    }

    @MainActor
    func refresh() async {
        page = 1
        errorMessage = nil
        do {
            let response = try await fetchTransactionsPage(page: 1)
            transactions = response.transactions
            total = response.total ?? transactions.count
            hasMore = transactions.count < total
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Search

    @MainActor
    func performSearch() async {
        guard !searchQuery.isEmpty else {
            await refresh()
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            let response = try await repository.search(query: searchQuery)
            transactions = response.transactions
            total = response.total ?? transactions.count
            hasMore = false
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - CRUD

    @MainActor
    func createTransaction(_ transaction: Transaction) async {
        do {
            let created = try await repository.createTransaction(transaction)
            transactions.insert(created, at: 0)
            total += 1
            showForm = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func updateTransaction(_ transaction: Transaction) async {
        do {
            let updated = try await repository.updateTransaction(id: transaction.id, transaction)
            if let idx = transactions.firstIndex(where: { $0.id == transaction.id }) {
                transactions[idx] = updated
            }
            editingTransaction = nil
            showForm = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func deleteTransaction(id: String) async {
        do {
            _ = try await repository.deleteTransaction(id: id)
            transactions.removeAll { $0.id == id }
            total -= 1
            selectedIds.remove(id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Approve / Reject

    @MainActor
    func approveTransaction(id: String) async {
        do {
            let updated = try await repository.approveTransaction(id: id)
            if let idx = transactions.firstIndex(where: { $0.id == id }) {
                transactions[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func rejectTransaction(id: String) async {
        do {
            _ = try await repository.rejectTransaction(id: id)
            if let idx = transactions.firstIndex(where: { $0.id == id }) {
                transactions[idx].status = "rejected"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Recurring

    @MainActor
    func toggleRecurring(id: String, isRecurring: Bool, frequency: String? = nil) async {
        do {
            let updated = try await repository.toggleRecurring(id: id, isRecurring: isRecurring, frequency: frequency)
            if let idx = transactions.firstIndex(where: { $0.id == id }) {
                transactions[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Bulk Operations

    func toggleSelection(_ id: String) {
        if selectedIds.contains(id) {
            selectedIds.remove(id)
        } else {
            selectedIds.insert(id)
        }
    }

    func selectAll() {
        selectedIds = Set(transactions.map(\.id))
    }

    func clearSelection() {
        selectedIds.removeAll()
        isSelecting = false
    }

    @MainActor
    func bulkApprove() async {
        guard !selectedIds.isEmpty else { return }
        do {
            _ = try await repository.bulkApprove(ids: Array(selectedIds))
            await refresh()
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func bulkReject() async {
        guard !selectedIds.isEmpty else { return }
        do {
            _ = try await repository.bulkReject(ids: Array(selectedIds))
            await refresh()
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func bulkDelete() async {
        guard !selectedIds.isEmpty else { return }
        do {
            _ = try await repository.bulkDelete(ids: Array(selectedIds))
            transactions.removeAll { selectedIds.contains($0.id) }
            total -= selectedIds.count
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    func accountName(for id: String?) -> String {
        guard let id else { return "Unknown" }
        return accounts.first(where: { $0.id == id })?.name ?? "Unknown"
    }

    func categoryName(for id: String?) -> String {
        guard let id else { return "Uncategorized" }
        return categories.first(where: { $0.id == id })?.name ?? "Uncategorized"
    }

    func subcategoryName(for categoryId: String?, subcategoryId: String?) -> String? {
        guard let categoryId, let subcategoryId else { return nil }
        guard let parent = categories.first(where: { $0.id == categoryId }) else { return nil }
        return parent.children?.first(where: { $0.id == subcategoryId })?.name
    }

    func subcategories(for categoryId: String?) -> [Category] {
        guard let categoryId else { return [] }
        return categories.first(where: { $0.id == categoryId })?.children ?? []
    }

    func beginCreate() {
        editingTransaction = nil
        showForm = true
    }

    func beginEdit(_ transaction: Transaction) {
        editingTransaction = transaction
        showForm = true
    }

    // MARK: - Private

    private func fetchTransactionsPage(page: Int) async throws -> TransactionListResponse {
        let typeParam: String? = filterType == "All" ? nil : filterType.lowercased()
        let dateFrom = filterDateFrom.map { Self.queryDateFormatter.string(from: $0) }
        let dateTo = filterDateTo.map { Self.queryDateFormatter.string(from: $0) }
        let acctId = filterAccountId.isEmpty ? nil : filterAccountId

        return try await repository.fetchTransactions(
            page: page,
            limit: pageSize,
            type: typeParam,
            accountId: acctId,
            dateFrom: dateFrom,
            dateTo: dateTo,
            status: "approved"
        )
    }
}
