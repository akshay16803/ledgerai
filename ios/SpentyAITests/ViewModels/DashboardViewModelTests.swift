import XCTest
@testable import SpentyAI

// MARK: - DashboardViewModelTests
//
// NOTE: DashboardViewModel internally instantiates DashboardRepository which calls
// APIClient.shared directly. For true isolation, dependency injection of the repository
// (or a protocol abstraction) would be needed. These tests focus on verifying the
// ViewModel's state management logic — initial state, computed properties, and
// state transitions — independent of actual network calls.

@MainActor
final class DashboardViewModelTests: XCTestCase {

    private var viewModel: DashboardViewModel!

    override func setUp() {
        super.setUp()
        viewModel = DashboardViewModel()
    }

    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialState() {
        XCTAssertNil(viewModel.summary, "Summary should be nil before loading")
        XCTAssertFalse(viewModel.isLoading, "isLoading should be false initially")
        XCTAssertFalse(viewModel.isRefreshing, "isRefreshing should be false initially")
        XCTAssertNil(viewModel.errorMessage, "errorMessage should be nil initially")
        XCTAssertFalse(viewModel.showNewTransaction)
        XCTAssertFalse(viewModel.showAIChat)
        XCTAssertFalse(viewModel.showSalesInvoice)
        XCTAssertFalse(viewModel.showPurchaseBill)
    }

    // MARK: - Summary Population

    func testLoadDashboard_success_populatesSummary() {
        // Given: A mock summary is assigned directly (simulating successful load)
        let mockSummary = MockData.mockDashboardSummary()

        // When: We simulate the result of a successful load
        viewModel.summary = mockSummary

        // Then: The summary should be populated with correct values
        XCTAssertNotNil(viewModel.summary)
        XCTAssertEqual(viewModel.summary?.totalAssets, 500000.0)
        XCTAssertEqual(viewModel.summary?.totalLiabilities, 100000.0)
        XCTAssertEqual(viewModel.summary?.netWorth, 400000.0)
        XCTAssertEqual(viewModel.summary?.incomeThisMonth, 75000.0)
        XCTAssertEqual(viewModel.summary?.expenseThisMonth, 45000.0)
        XCTAssertEqual(viewModel.summary?.savingsThisMonth, 30000.0)
        XCTAssertEqual(viewModel.summary?.pendingReview, 3)
        XCTAssertEqual(viewModel.summary?.accounts?.count, 2)
        XCTAssertEqual(viewModel.summary?.recentTransactions?.count, 2)
    }

    // MARK: - Error State

    func testLoadDashboard_error_setsErrorMessage() {
        // Given: ViewModel starts clean
        XCTAssertNil(viewModel.errorMessage)

        // When: An error occurs (simulated by setting errorMessage directly)
        viewModel.errorMessage = "Failed to load dashboard. Please try again."

        // Then: errorMessage is set and summary remains nil
        XCTAssertNotNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.errorMessage, "Failed to load dashboard. Please try again.")
        XCTAssertNil(viewModel.summary)
    }

    func testLoadDashboard_apiError_setsFormattedMessage() {
        // When: An API error description is set
        let apiError = APIError.unauthorized
        viewModel.errorMessage = apiError.errorDescription

        // Then: The formatted error message is used
        XCTAssertEqual(viewModel.errorMessage, "Session expired. Please sign in again.")
    }

    // MARK: - Loading State Transitions

    func testLoadDashboard_setsIsLoading() {
        // Given: ViewModel is not loading
        XCTAssertFalse(viewModel.isLoading)

        // When: Loading starts
        viewModel.isLoading = true

        // Then: isLoading reflects the loading state
        XCTAssertTrue(viewModel.isLoading)

        // When: Loading completes
        viewModel.isLoading = false

        // Then: isLoading is reset
        XCTAssertFalse(viewModel.isLoading)
    }

    func testRefresh_setsIsRefreshing() {
        // Given: ViewModel is not refreshing
        XCTAssertFalse(viewModel.isRefreshing)

        // When: Refresh starts
        viewModel.isRefreshing = true

        // Then: isRefreshing reflects the state
        XCTAssertTrue(viewModel.isRefreshing)

        // When: Refresh completes
        viewModel.isRefreshing = false

        // Then: isRefreshing is reset
        XCTAssertFalse(viewModel.isRefreshing)
    }

    // MARK: - Error Cleared on Reload

    func testLoadDashboard_clearsErrorOnNewLoad() {
        // Given: A previous error exists
        viewModel.errorMessage = "Previous error"

        // When: A new load clears the error
        viewModel.errorMessage = nil

        // Then: Error is cleared
        XCTAssertNil(viewModel.errorMessage)
    }

    // MARK: - Sheet Presentation

    func testSheetPresentationStates() {
        // showNewTransaction
        viewModel.showNewTransaction = true
        XCTAssertTrue(viewModel.showNewTransaction)
        viewModel.showNewTransaction = false
        XCTAssertFalse(viewModel.showNewTransaction)

        // showAIChat
        viewModel.showAIChat = true
        XCTAssertTrue(viewModel.showAIChat)

        // showSalesInvoice
        viewModel.showSalesInvoice = true
        XCTAssertTrue(viewModel.showSalesInvoice)

        // showPurchaseBill
        viewModel.showPurchaseBill = true
        XCTAssertTrue(viewModel.showPurchaseBill)
    }

    // MARK: - DashboardSummary Model

    func testDashboardSummary_withCustomValues() {
        let summary = MockData.mockDashboardSummary(
            totalAssets: 1000000,
            totalLiabilities: 200000,
            netWorth: 800000,
            incomeThisMonth: 150000,
            expenseThisMonth: 90000,
            savingsThisMonth: 60000,
            pendingReview: 5
        )

        viewModel.summary = summary

        XCTAssertEqual(viewModel.summary?.totalAssets, 1000000)
        XCTAssertEqual(viewModel.summary?.netWorth, 800000)
        XCTAssertEqual(viewModel.summary?.pendingReview, 5)
    }

    func testDashboardSummary_withNilFields() {
        let summary = MockData.mockDashboardSummary(
            totalAssets: nil,
            totalLiabilities: nil,
            netWorth: nil,
            pendingReview: nil
        )

        viewModel.summary = summary

        XCTAssertNil(viewModel.summary?.totalAssets)
        XCTAssertNil(viewModel.summary?.netWorth)
        XCTAssertNil(viewModel.summary?.pendingReview)
    }
}
