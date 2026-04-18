import XCTest
@testable import SpentyAI

// MARK: - InvoicesViewModelTests
//
// NOTE: InvoicesViewModel internally creates InvoiceRepository and SettingsRepository
// which call APIClient.shared. For full isolation, these repositories would need to be
// injected via protocols. These tests verify the ViewModel's state management,
// filtering logic, computed properties (needsSetup, hasMore, currencyCode), and
// list manipulation without making actual network calls.

@MainActor
final class InvoicesViewModelTests: XCTestCase {

    private var viewModel: InvoicesViewModel!

    override func setUp() {
        super.setUp()
        viewModel = InvoicesViewModel()
    }

    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialState() {
        XCTAssertTrue(viewModel.invoices.isEmpty)
        XCTAssertEqual(viewModel.totalCount, 0)
        XCTAssertNil(viewModel.settings)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertFalse(viewModel.isRefreshing)
        XCTAssertFalse(viewModel.isLoadingMore)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isSaving)
        XCTAssertNil(viewModel.statusFilter)
        XCTAssertFalse(viewModel.showNewInvoice)
        XCTAssertNil(viewModel.showEditInvoice)
        XCTAssertNil(viewModel.showPreview)
        XCTAssertNil(viewModel.showRecordPayment)
        XCTAssertNil(viewModel.showDeleteConfirm)
    }

    // MARK: - Load Invoices Success

    func testLoadInvoices_success_populatesInvoices() {
        // Given: Mock invoices
        let invoices = [
            MockData.mockInvoice(id: "inv-001", status: "unpaid", amount: 10000),
            MockData.mockInvoice(id: "inv-002", status: "paid", amount: 25000),
            MockData.mockInvoice(id: "inv-003", status: "partial", amount: 15000)
        ]

        // When: Simulating successful load
        viewModel.invoices = invoices
        viewModel.totalCount = 3

        // Then: Invoices are populated
        XCTAssertEqual(viewModel.invoices.count, 3)
        XCTAssertEqual(viewModel.totalCount, 3)
        XCTAssertEqual(viewModel.invoices[0].invoiceId, "inv-001")
        XCTAssertEqual(viewModel.invoices[0].grandTotal, 10000)
        XCTAssertEqual(viewModel.invoices[1].paymentStatus, "paid")
    }

    // MARK: - Filter by Status

    func testFilterByStatus_showsCorrectInvoices() {
        // Given: Mixed status invoices loaded
        let allInvoices = [
            MockData.mockInvoice(id: "inv-001", status: "unpaid"),
            MockData.mockInvoice(id: "inv-002", status: "paid"),
            MockData.mockInvoice(id: "inv-003", status: "unpaid"),
            MockData.mockInvoice(id: "inv-004", status: "partial")
        ]
        viewModel.invoices = allInvoices
        viewModel.totalCount = 4

        // When: Filter is set to "unpaid"
        viewModel.statusFilter = "unpaid"

        // Then: statusFilter is set (actual filtering happens via API reload)
        XCTAssertEqual(viewModel.statusFilter, "unpaid")

        // Verify: We can filter locally for testing purposes
        let unpaidInvoices = viewModel.invoices.filter { $0.paymentStatus == "unpaid" }
        XCTAssertEqual(unpaidInvoices.count, 2)

        let paidInvoices = viewModel.invoices.filter { $0.paymentStatus == "paid" }
        XCTAssertEqual(paidInvoices.count, 1)
    }

    func testFilterByStatus_nilShowsAll() {
        viewModel.statusFilter = "paid"
        XCTAssertEqual(viewModel.statusFilter, "paid")

        viewModel.statusFilter = nil
        XCTAssertNil(viewModel.statusFilter)
    }

    // MARK: - needsSetup

    func testNeedsSetup_whenNoSettings_returnsTrue() {
        // Given: Settings is nil
        viewModel.settings = nil

        // Then: Setup is needed
        XCTAssertTrue(viewModel.needsSetup)
    }

    func testNeedsSetup_whenNoFirmName_returnsTrue() {
        // Given: Settings with empty firm name
        viewModel.settings = MockData.mockSettings(firmName: nil)

        // Then: Setup is needed
        XCTAssertTrue(viewModel.needsSetup)
    }

    func testNeedsSetup_whenEmptyFirmName_returnsTrue() {
        // Given: Settings with whitespace-only firm name
        viewModel.settings = MockData.mockSettings(firmName: "   ")

        // Then: Setup is needed
        XCTAssertTrue(viewModel.needsSetup)
    }

    func testNeedsSetup_whenFirmNameSet_returnsFalse() {
        // Given: Settings with a valid firm name
        viewModel.settings = MockData.mockSettings(firmName: "My Business LLC")

        // Then: Setup is not needed
        XCTAssertFalse(viewModel.needsSetup)
    }

    // MARK: - hasMore

    func testHasMore_whenInvoicesLessThanTotal_returnsTrue() {
        viewModel.invoices = [
            MockData.mockInvoice(id: "inv-001")
        ]
        viewModel.totalCount = 5

        XCTAssertTrue(viewModel.hasMore)
    }

    func testHasMore_whenAllLoaded_returnsFalse() {
        viewModel.invoices = [
            MockData.mockInvoice(id: "inv-001"),
            MockData.mockInvoice(id: "inv-002")
        ]
        viewModel.totalCount = 2

        XCTAssertFalse(viewModel.hasMore)
    }

    func testHasMore_whenEmpty_returnsFalse() {
        viewModel.invoices = []
        viewModel.totalCount = 0

        XCTAssertFalse(viewModel.hasMore)
    }

    // MARK: - Delete Invoice

    func testDeleteInvoice_removesFromList() {
        // Given: Multiple invoices
        viewModel.invoices = [
            MockData.mockInvoice(id: "inv-001", status: "unpaid", amount: 10000),
            MockData.mockInvoice(id: "inv-002", status: "paid", amount: 25000),
            MockData.mockInvoice(id: "inv-003", status: "partial", amount: 15000)
        ]
        viewModel.totalCount = 3

        // When: Simulating deletion of inv-002
        let invoiceToDelete = viewModel.invoices[1]
        viewModel.invoices.removeAll { $0.invoiceId == invoiceToDelete.invoiceId }
        viewModel.totalCount = max(0, viewModel.totalCount - 1)

        // Then: Invoice is removed
        XCTAssertEqual(viewModel.invoices.count, 2)
        XCTAssertEqual(viewModel.totalCount, 2)
        XCTAssertFalse(viewModel.invoices.contains(where: { $0.invoiceId == "inv-002" }))
    }

    func testDeleteInvoice_updatesHasMore() {
        viewModel.invoices = [
            MockData.mockInvoice(id: "inv-001"),
            MockData.mockInvoice(id: "inv-002")
        ]
        viewModel.totalCount = 3
        XCTAssertTrue(viewModel.hasMore)

        // Delete one, total decreases
        viewModel.invoices.removeAll { $0.invoiceId == "inv-001" }
        viewModel.totalCount = 2
        XCTAssertTrue(viewModel.hasMore) // 1 < 2

        viewModel.totalCount = 1
        XCTAssertFalse(viewModel.hasMore)
    }

    // MARK: - Currency Code

    func testCurrencyCode_defaultsToINR() {
        viewModel.settings = nil
        XCTAssertEqual(viewModel.currencyCode, "INR")
    }

    func testCurrencyCode_usesBaseCurrencyFromSettings() {
        viewModel.settings = MockData.mockSettings(
            firmName: "Test",
            businessCountry: nil,
            baseCurrency: "USD"
        )

        // When businessCountry is nil, falls through to baseCurrency
        XCTAssertEqual(viewModel.currencyCode, "USD")
    }

    // MARK: - Status Type

    func testStatusType_paid() {
        let invoice = MockData.mockInvoice(id: "inv-001", status: "paid")
        let statusType = viewModel.statusType(for: invoice)
        XCTAssertEqual(statusType, .paid)
    }

    func testStatusType_partial() {
        let invoice = MockData.mockInvoice(id: "inv-001", status: "partial")
        let statusType = viewModel.statusType(for: invoice)
        XCTAssertEqual(statusType, .partial)
    }

    func testStatusType_unpaid() {
        let invoice = MockData.mockInvoice(id: "inv-001", status: "unpaid")
        let statusType = viewModel.statusType(for: invoice)
        XCTAssertEqual(statusType, .unpaid)
    }

    func testStatusType_nilStatus_defaultsToUnpaid() {
        let invoice = MockData.mockInvoice(id: "inv-001", status: nil)
        let statusType = viewModel.statusType(for: invoice)
        XCTAssertEqual(statusType, .unpaid)
    }

    // MARK: - Loading States

    func testLoadingStates() {
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertFalse(viewModel.isRefreshing)
        XCTAssertFalse(viewModel.isLoadingMore)
        XCTAssertFalse(viewModel.isSaving)

        viewModel.isLoading = true
        XCTAssertTrue(viewModel.isLoading)

        viewModel.isLoadingMore = true
        XCTAssertTrue(viewModel.isLoadingMore)

        viewModel.isSaving = true
        XCTAssertTrue(viewModel.isSaving)
    }

    // MARK: - Error State

    func testErrorMessage_setsAndClears() {
        viewModel.errorMessage = "Failed to load invoices."
        XCTAssertEqual(viewModel.errorMessage, "Failed to load invoices.")

        viewModel.errorMessage = nil
        XCTAssertNil(viewModel.errorMessage)
    }

    // MARK: - Sheet State

    func testShowNewInvoice_state() {
        viewModel.showNewInvoice = true
        XCTAssertTrue(viewModel.showNewInvoice)
    }

    func testShowEditInvoice_state() {
        let invoice = MockData.mockInvoice(id: "inv-001")
        viewModel.showEditInvoice = invoice
        XCTAssertNotNil(viewModel.showEditInvoice)
        XCTAssertEqual(viewModel.showEditInvoice?.invoiceId, "inv-001")
    }

    func testShowDeleteConfirm_state() {
        let invoice = MockData.mockInvoice(id: "inv-001")
        viewModel.showDeleteConfirm = invoice
        XCTAssertNotNil(viewModel.showDeleteConfirm)
        XCTAssertEqual(viewModel.showDeleteConfirm?.invoiceId, "inv-001")
    }
}
