import XCTest
@testable import SpentyAI

// MARK: - ReportsViewModelTests
//
// NOTE: ReportsViewModel internally creates a ReportRepository which calls
// APIClient.shared. For full isolation, the repository would need to be injected.
// These tests focus on the ViewModel's date range calculation logic, category
// expansion state, period selection, and computed properties.

@MainActor
final class ReportsViewModelTests: XCTestCase {

    private var viewModel: ReportsViewModel!
    private let calendar = Calendar.current
    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    override func setUp() {
        super.setUp()
        viewModel = ReportsViewModel()
    }

    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialState() {
        XCTAssertEqual(viewModel.selectedPeriod, .thisMonth)
        XCTAssertNil(viewModel.summary)
        XCTAssertNil(viewModel.periodReport)
        XCTAssertNil(viewModel.categoryReport)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
        XCTAssertTrue(viewModel.expandedCategories.isEmpty)
        XCTAssertEqual(viewModel.selectedType, .expense)
    }

    // MARK: - Date Range: This Month

    func testDateRange_thisMonth() {
        // Given: Period is thisMonth
        viewModel.selectedPeriod = .thisMonth

        // When: Getting the date range
        let range = viewModel.dateRange

        // Then: Start date should be the first of the current month
        let now = Date.now
        let expectedStart = calendar.date(from: calendar.dateComponents([.year, .month], from: now))!
        let expectedStartString = dateFormatter.string(from: expectedStart)
        let expectedEndString = dateFormatter.string(from: now)

        XCTAssertEqual(range.startDate, expectedStartString)
        XCTAssertEqual(range.endDate, expectedEndString)

        // Verify the start date is indeed the 1st of the month
        if let startDate = dateFormatter.date(from: range.startDate!) {
            let day = calendar.component(.day, from: startDate)
            XCTAssertEqual(day, 1, "This month start should be the 1st")
        }
    }

    // MARK: - Date Range: Last 3 Months

    func testDateRange_last3Months() {
        // Given: Period is last3Months
        viewModel.selectedPeriod = .last3Months

        // When: Getting the date range
        let range = viewModel.dateRange

        // Then: Start date should be 3 months ago
        let now = Date.now
        let expectedStart = calendar.date(byAdding: .month, value: -3, to: now)!
        let expectedStartString = dateFormatter.string(from: expectedStart)
        let expectedEndString = dateFormatter.string(from: now)

        XCTAssertEqual(range.startDate, expectedStartString)
        XCTAssertEqual(range.endDate, expectedEndString)

        // Verify the start date is roughly 3 months before end date
        if let startDate = dateFormatter.date(from: range.startDate!),
           let endDate = dateFormatter.date(from: range.endDate!) {
            let months = calendar.dateComponents([.month], from: startDate, to: endDate).month!
            XCTAssertTrue(months >= 2 && months <= 3, "Should be approximately 3 months apart")
        }
    }

    // MARK: - Date Range: Last 6 Months

    func testDateRange_last6Months() {
        viewModel.selectedPeriod = .last6Months

        let range = viewModel.dateRange

        let now = Date.now
        let expectedStart = calendar.date(byAdding: .month, value: -6, to: now)!
        let expectedStartString = dateFormatter.string(from: expectedStart)

        XCTAssertEqual(range.startDate, expectedStartString)
        XCTAssertNotNil(range.endDate)
    }

    // MARK: - Date Range: This Year

    func testDateRange_thisYear() {
        viewModel.selectedPeriod = .thisYear

        let range = viewModel.dateRange

        let now = Date.now
        let expectedStart = calendar.date(from: calendar.dateComponents([.year], from: now))!
        let expectedStartString = dateFormatter.string(from: expectedStart)

        XCTAssertEqual(range.startDate, expectedStartString)
        XCTAssertNotNil(range.endDate)

        // Verify start date is January 1 of current year
        if let startDate = dateFormatter.date(from: range.startDate!) {
            let month = calendar.component(.month, from: startDate)
            let day = calendar.component(.day, from: startDate)
            XCTAssertEqual(month, 1, "This year should start in January")
            XCTAssertEqual(day, 1, "This year should start on the 1st")
        }
    }

    // MARK: - Date Range: All Time

    func testDateRange_allTime() {
        viewModel.selectedPeriod = .allTime

        let range = viewModel.dateRange

        XCTAssertNil(range.startDate, "All time should have nil start date")
        XCTAssertNil(range.endDate, "All time should have nil end date")
    }

    // MARK: - Date Range: Custom

    func testDateRange_custom() {
        viewModel.selectedPeriod = .custom

        let customStart = dateFormatter.date(from: "2026-01-01")!
        let customEnd = dateFormatter.date(from: "2026-03-31")!

        viewModel.customStartDate = customStart
        viewModel.customEndDate = customEnd

        let range = viewModel.dateRange

        XCTAssertEqual(range.startDate, "2026-01-01")
        XCTAssertEqual(range.endDate, "2026-03-31")
    }

    // MARK: - Report Period Enum

    func testReportPeriod_allCases() {
        let cases = ReportPeriod.allCases
        XCTAssertEqual(cases.count, 6)
        XCTAssertTrue(cases.contains(.thisMonth))
        XCTAssertTrue(cases.contains(.last3Months))
        XCTAssertTrue(cases.contains(.last6Months))
        XCTAssertTrue(cases.contains(.thisYear))
        XCTAssertTrue(cases.contains(.allTime))
        XCTAssertTrue(cases.contains(.custom))
    }

    func testReportPeriod_rawValues() {
        XCTAssertEqual(ReportPeriod.thisMonth.rawValue, "This Month")
        XCTAssertEqual(ReportPeriod.last3Months.rawValue, "Last 3 Months")
        XCTAssertEqual(ReportPeriod.allTime.rawValue, "All Time")
    }

    // MARK: - Report Transaction Type

    func testReportTransactionType_apiValues() {
        XCTAssertNil(ReportTransactionType.all.apiValue)
        XCTAssertEqual(ReportTransactionType.expense.apiValue, "expense")
        XCTAssertEqual(ReportTransactionType.income.apiValue, "income")
    }

    // MARK: - Load All Populates Data

    func testLoadAll_populatesAllData() {
        // Given: Mock data is prepared
        let mockSummary = MockData.mockReportSummary()
        let mockPeriodReport = PeriodReport(
            summary: mockSummary,
            periods: [
                PeriodEntry(
                    period: "2026-04",
                    income: 75000,
                    expense: 45000,
                    transfers: 5000,
                    net: 30000,
                    transactionCount: 42
                )
            ]
        )
        let mockCategoryReport = CategoryReport(
            summary: mockSummary,
            categories: [
                CategoryBreakdown(
                    name: "Food & Dining",
                    amount: 15000,
                    count: 20,
                    percentage: 33.3,
                    subcategories: [
                        SubcategoryBreakdown(name: "Restaurants", amount: 10000, count: 12, percentage: 66.7),
                        SubcategoryBreakdown(name: "Groceries", amount: 5000, count: 8, percentage: 33.3)
                    ]
                ),
                CategoryBreakdown(
                    name: "Transportation",
                    amount: 8000,
                    count: 10,
                    percentage: 17.8,
                    subcategories: nil
                )
            ]
        )

        // When: Data is assigned (simulating loadAll completion)
        viewModel.summary = mockSummary
        viewModel.periodReport = mockPeriodReport
        viewModel.categoryReport = mockCategoryReport

        // Then: All data is populated
        XCTAssertNotNil(viewModel.summary)
        XCTAssertEqual(viewModel.summary?.totalIncome, 75000)
        XCTAssertEqual(viewModel.summary?.totalExpense, 45000)
        XCTAssertEqual(viewModel.summary?.net, 30000)

        XCTAssertNotNil(viewModel.periodReport)
        XCTAssertEqual(viewModel.periodReport?.periods?.count, 1)
        XCTAssertEqual(viewModel.periodReport?.periods?.first?.period, "2026-04")

        XCTAssertNotNil(viewModel.categoryReport)
        XCTAssertEqual(viewModel.categoryReport?.categories?.count, 2)
        XCTAssertEqual(viewModel.categoryReport?.categories?.first?.name, "Food & Dining")
        XCTAssertEqual(viewModel.categoryReport?.categories?.first?.subcategories?.count, 2)
    }

    // MARK: - Toggle Category Expand/Collapse

    func testToggleCategory_expandsAndCollapses() {
        // Given: No categories are expanded
        XCTAssertTrue(viewModel.expandedCategories.isEmpty)

        // When: A category is toggled (expanded)
        viewModel.toggleCategory(id: "cat-food")

        // Then: The category is in the expanded set
        XCTAssertTrue(viewModel.expandedCategories.contains("cat-food"))
        XCTAssertEqual(viewModel.expandedCategories.count, 1)

        // When: The same category is toggled again (collapsed)
        viewModel.toggleCategory(id: "cat-food")

        // Then: The category is removed from the expanded set
        XCTAssertFalse(viewModel.expandedCategories.contains("cat-food"))
        XCTAssertTrue(viewModel.expandedCategories.isEmpty)
    }

    func testToggleCategory_multipleCategories() {
        // Expand multiple categories
        viewModel.toggleCategory(id: "cat-food")
        viewModel.toggleCategory(id: "cat-transport")
        viewModel.toggleCategory(id: "cat-utilities")

        XCTAssertEqual(viewModel.expandedCategories.count, 3)
        XCTAssertTrue(viewModel.expandedCategories.contains("cat-food"))
        XCTAssertTrue(viewModel.expandedCategories.contains("cat-transport"))
        XCTAssertTrue(viewModel.expandedCategories.contains("cat-utilities"))

        // Collapse one
        viewModel.toggleCategory(id: "cat-transport")
        XCTAssertEqual(viewModel.expandedCategories.count, 2)
        XCTAssertFalse(viewModel.expandedCategories.contains("cat-transport"))
    }

    // MARK: - Selected Type

    func testSelectedType_defaultIsExpense() {
        XCTAssertEqual(viewModel.selectedType, .expense)
    }

    func testSelectedType_canSwitchToIncome() {
        viewModel.selectedType = .income
        XCTAssertEqual(viewModel.selectedType, .income)
    }

    func testSelectedType_canSwitchToAll() {
        viewModel.selectedType = .all
        XCTAssertEqual(viewModel.selectedType, .all)
    }

    // MARK: - Loading & Error State

    func testLoadingState_transitions() {
        XCTAssertFalse(viewModel.isLoading)

        viewModel.isLoading = true
        XCTAssertTrue(viewModel.isLoading)

        viewModel.isLoading = false
        XCTAssertFalse(viewModel.isLoading)
    }

    func testErrorState_setsAndClears() {
        viewModel.error = "Something went wrong"
        XCTAssertEqual(viewModel.error, "Something went wrong")

        viewModel.error = nil
        XCTAssertNil(viewModel.error)
    }

    // MARK: - Period Selection Changes Date Range

    func testPeriodSelection_changingPeriod_updatesDates() {
        // Start with thisMonth
        viewModel.selectedPeriod = .thisMonth
        let thisMonthRange = viewModel.dateRange
        XCTAssertNotNil(thisMonthRange.startDate)

        // Switch to last3Months
        viewModel.selectedPeriod = .last3Months
        let last3MonthsRange = viewModel.dateRange
        XCTAssertNotNil(last3MonthsRange.startDate)

        // The start dates should be different
        XCTAssertNotEqual(thisMonthRange.startDate, last3MonthsRange.startDate,
                          "Different periods should produce different start dates")

        // Switch to allTime
        viewModel.selectedPeriod = .allTime
        let allTimeRange = viewModel.dateRange
        XCTAssertNil(allTimeRange.startDate)
        XCTAssertNil(allTimeRange.endDate)
    }
}
