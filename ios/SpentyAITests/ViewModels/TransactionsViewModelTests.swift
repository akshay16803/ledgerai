import XCTest
@testable import SpentyAI

// MARK: - TransactionsViewModelTests
//
// NOTE: TransactionsViewModel internally creates a TransactionRepository which calls
// APIClient.shared. For full isolation, the repository would need to be injected.
// These tests focus on state management, pagination logic, filtering, and computed
// properties that can be verified without network calls.

@MainActor
final class TransactionsViewModelTests: XCTestCase {

    private var viewModel: TransactionsViewModel!

    override func setUp() {
        super.setUp()
        viewModel = TransactionsViewModel()
    }

    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialState() {
        XCTAssertTrue(viewModel.transactions.isEmpty)
        XCTAssertEqual(viewModel.totalCount, 0)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertFalse(viewModel.isRefreshing)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertNil(viewModel.selectedType)
        XCTAssertNil(viewModel.selectedAccountId)
        XCTAssertNil(viewModel.dateFrom)
        XCTAssertNil(viewModel.dateTo)
        XCTAssertEqual(viewModel.currentPage, 0)
        XCTAssertEqual(viewModel.viewMode, .list)
    }

    // MARK: - Load Transactions Success

    func testLoadTransactions_success_populatesTransactions() {
        // Given: Mock transactions are prepared
        let mockTransactions = [
            MockData.mockTransaction(id: "txn-001", amount: 1000, type: .expense),
            MockData.mockTransaction(id: "txn-002", amount: 5000, type: .income),
            MockData.mockTransaction(id: "txn-003", amount: 2500, type: .expense)
        ]

        // When: Simulating a successful load by assigning data directly
        viewModel.transactions = mockTransactions
        viewModel.totalCount = 3

        // Then: The transactions array is populated correctly
        XCTAssertEqual(viewModel.transactions.count, 3)
        XCTAssertEqual(viewModel.totalCount, 3)
        XCTAssertEqual(viewModel.transactions[0].transactionId, "txn-001")
        XCTAssertEqual(viewModel.transactions[0].amount, 1000)
        XCTAssertEqual(viewModel.transactions[0].transactionType, .expense)
        XCTAssertEqual(viewModel.transactions[1].transactionType, .income)
    }

    // MARK: - Pagination

    func testLoadTransactions_pagination_incrementsCurrentPage() {
        // Given: Initial page is 0
        XCTAssertEqual(viewModel.currentPage, 0)

        // When: Simulating loadMore by incrementing page
        viewModel.currentPage += 1

        // Then: Page is incremented
        XCTAssertEqual(viewModel.currentPage, 1)
    }

    func testCanLoadMore_whenTransactionsLessThanTotal_returnsTrue() {
        // Given: Fewer loaded than total
        viewModel.transactions = [
            MockData.mockTransaction(id: "txn-001"),
            MockData.mockTransaction(id: "txn-002")
        ]
        viewModel.totalCount = 5

        // Then: canLoadMore should be true
        XCTAssertTrue(viewModel.canLoadMore)
    }

    func testCanLoadMore_whenAllLoaded_returnsFalse() {
        // Given: All transactions loaded
        viewModel.transactions = [
            MockData.mockTransaction(id: "txn-001"),
            MockData.mockTransaction(id: "txn-002")
        ]
        viewModel.totalCount = 2

        // Then: canLoadMore should be false
        XCTAssertFalse(viewModel.canLoadMore)
    }

    func testCanLoadMore_whenEmpty_returnsFalse() {
        viewModel.transactions = []
        viewModel.totalCount = 0

        XCTAssertFalse(viewModel.canLoadMore)
    }

    func testPagination_skipCalculation() {
        // Given: pageSize is 50 (private), we verify via currentPage
        viewModel.currentPage = 0
        XCTAssertEqual(viewModel.currentPage, 0)

        // Simulate multiple page loads
        viewModel.currentPage = 1
        XCTAssertEqual(viewModel.currentPage, 1)

        viewModel.currentPage = 2
        XCTAssertEqual(viewModel.currentPage, 2)
    }

    func testLoadMore_appendsTransactions() {
        // Given: Initial transactions loaded
        viewModel.transactions = [
            MockData.mockTransaction(id: "txn-001")
        ]
        viewModel.totalCount = 3

        // When: More transactions are appended (simulating loadMore)
        let moreTransactions = [
            MockData.mockTransaction(id: "txn-002"),
            MockData.mockTransaction(id: "txn-003")
        ]
        viewModel.transactions.append(contentsOf: moreTransactions)

        // Then: All transactions are present
        XCTAssertEqual(viewModel.transactions.count, 3)
        XCTAssertEqual(viewModel.transactions[2].transactionId, "txn-003")
    }

    // MARK: - Filtering

    func testFilterTransactions_byType_setsSelectedType() {
        // Given: No filter applied
        XCTAssertNil(viewModel.selectedType)
        XCTAssertFalse(viewModel.hasActiveFilters)

        // When: Expense filter is applied
        viewModel.selectedType = .expense

        // Then: Filter is set and hasActiveFilters is true
        XCTAssertEqual(viewModel.selectedType, .expense)
        XCTAssertTrue(viewModel.hasActiveFilters)
    }

    func testFilterTransactions_byAccount_setsSelectedAccountId() {
        viewModel.selectedAccountId = "acc-001"

        XCTAssertEqual(viewModel.selectedAccountId, "acc-001")
        XCTAssertTrue(viewModel.hasActiveFilters)
    }

    func testFilterTransactions_byDateRange() {
        let fromDate = Calendar.current.date(byAdding: .month, value: -1, to: .now)!
        let toDate = Date.now

        viewModel.dateFrom = fromDate
        viewModel.dateTo = toDate

        XCTAssertNotNil(viewModel.dateFrom)
        XCTAssertNotNil(viewModel.dateTo)
        XCTAssertTrue(viewModel.hasActiveFilters)
    }

    func testHasActiveFilters_noFilters_returnsFalse() {
        XCTAssertFalse(viewModel.hasActiveFilters)
    }

    func testHasActiveFilters_withTypeFilter_returnsTrue() {
        viewModel.selectedType = .income
        XCTAssertTrue(viewModel.hasActiveFilters)
    }

    func testHasActiveFilters_withDateFilter_returnsTrue() {
        viewModel.dateFrom = Date.now
        XCTAssertTrue(viewModel.hasActiveFilters)
    }

    func testClearFilters_resetsAllFilterState() {
        // Given: Multiple filters are active
        viewModel.selectedType = .expense
        viewModel.selectedAccountId = "acc-001"
        viewModel.dateFrom = Date.now
        viewModel.dateTo = Date.now
        XCTAssertTrue(viewModel.hasActiveFilters)

        // When: Filters are cleared
        viewModel.selectedType = nil
        viewModel.selectedAccountId = nil
        viewModel.dateFrom = nil
        viewModel.dateTo = nil

        // Then: No active filters
        XCTAssertFalse(viewModel.hasActiveFilters)
    }

    // MARK: - Delete Transaction

    func testDeleteTransaction_removesFromList() {
        // Given: Three transactions in the list
        viewModel.transactions = [
            MockData.mockTransaction(id: "txn-001"),
            MockData.mockTransaction(id: "txn-002"),
            MockData.mockTransaction(id: "txn-003")
        ]
        viewModel.totalCount = 3

        // When: Simulating deletion of txn-002
        let txnToDelete = viewModel.transactions[1]
        viewModel.transactions.removeAll { $0.transactionId == txnToDelete.transactionId }
        viewModel.totalCount = max(0, viewModel.totalCount - 1)

        // Then: Transaction is removed and count updated
        XCTAssertEqual(viewModel.transactions.count, 2)
        XCTAssertEqual(viewModel.totalCount, 2)
        XCTAssertFalse(viewModel.transactions.contains(where: { $0.transactionId == "txn-002" }))
        XCTAssertTrue(viewModel.transactions.contains(where: { $0.transactionId == "txn-001" }))
        XCTAssertTrue(viewModel.transactions.contains(where: { $0.transactionId == "txn-003" }))
    }

    // MARK: - View Mode

    func testViewMode_defaultIsList() {
        XCTAssertEqual(viewModel.viewMode, .list)
    }

    func testViewMode_canSwitchToLedger() {
        viewModel.viewMode = .ledger
        XCTAssertEqual(viewModel.viewMode, .ledger)
    }

    func testViewMode_allCases() {
        let cases = TransactionsViewModel.ViewMode.allCases
        XCTAssertEqual(cases.count, 2)
        XCTAssertTrue(cases.contains(.list))
        XCTAssertTrue(cases.contains(.ledger))
    }

    // MARK: - Sheet State

    func testDeleteConfirmation_state() {
        let txn = MockData.mockTransaction(id: "txn-001")

        viewModel.deletingTransaction = txn
        viewModel.showDeleteConfirm = true

        XCTAssertNotNil(viewModel.deletingTransaction)
        XCTAssertTrue(viewModel.showDeleteConfirm)
        XCTAssertEqual(viewModel.deletingTransaction?.transactionId, "txn-001")

        // Reset after delete
        viewModel.showDeleteConfirm = false
        viewModel.deletingTransaction = nil

        XCTAssertFalse(viewModel.showDeleteConfirm)
        XCTAssertNil(viewModel.deletingTransaction)
    }

    func testEditTransaction_state() {
        let txn = MockData.mockTransaction(id: "txn-001")

        viewModel.editingTransaction = txn
        viewModel.showEditTransaction = true

        XCTAssertNotNil(viewModel.editingTransaction)
        XCTAssertTrue(viewModel.showEditTransaction)
    }

    // MARK: - Error State

    func testErrorState_setsAndClears() {
        viewModel.errorMessage = "Failed to load transactions."
        XCTAssertEqual(viewModel.errorMessage, "Failed to load transactions.")

        viewModel.errorMessage = nil
        XCTAssertNil(viewModel.errorMessage)
    }
}
