import XCTest
@testable import SpentyAI

// MARK: - AccountsViewModelTests
//
// NOTE: AccountsViewModel internally creates an AccountRepository which calls
// APIClient.shared. For full isolation, the repository would need to be injected
// via a protocol. These tests verify the ViewModel's state management, grouping
// logic, and computed properties without making network calls.

@MainActor
final class AccountsViewModelTests: XCTestCase {

    private var viewModel: AccountsViewModel!

    override func setUp() {
        super.setUp()
        viewModel = AccountsViewModel()
    }

    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialState() {
        XCTAssertTrue(viewModel.accounts.isEmpty)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertFalse(viewModel.isRefreshing)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.showAddAccount)
        XCTAssertFalse(viewModel.showEditAccount)
        XCTAssertNil(viewModel.editingAccount)
        XCTAssertFalse(viewModel.showDeleteConfirm)
        XCTAssertNil(viewModel.deletingAccount)
        XCTAssertFalse(viewModel.showSubTypeManager)
        XCTAssertNil(viewModel.selectedAccountForDetail)
    }

    // MARK: - Grouping by Type

    func testLoadAccounts_groupsByType() {
        // Given: Accounts of different types
        let accounts = [
            MockData.mockAccount(id: "acc-001", name: "Savings", type: "Asset", balance: 100000),
            MockData.mockAccount(id: "acc-002", name: "Current", type: "Asset", balance: 50000),
            MockData.mockAccount(id: "acc-003", name: "Credit Card", type: "Liability", balance: -30000),
            MockData.mockAccount(id: "acc-004", name: "Home Loan", type: "Liability", balance: -500000),
            MockData.mockAccount(id: "acc-005", name: "Capital", type: "Equity", balance: 200000),
            MockData.mockAccount(id: "acc-006", name: "Mutual Funds", type: "Investment", balance: 150000)
        ]

        // When: Accounts are loaded
        viewModel.accounts = accounts

        // Then: grouped dictionary has correct grouping
        let grouped = viewModel.grouped
        XCTAssertEqual(grouped.keys.count, 4, "Should have 4 account type groups")
        XCTAssertEqual(grouped["Asset"]?.count, 2)
        XCTAssertEqual(grouped["Liability"]?.count, 2)
        XCTAssertEqual(grouped["Equity"]?.count, 1)
        XCTAssertEqual(grouped["Investment"]?.count, 1)
    }

    func testGrouped_withSingleType_returnsOneGroup() {
        let accounts = [
            MockData.mockAccount(id: "acc-001", name: "Savings", type: "Asset"),
            MockData.mockAccount(id: "acc-002", name: "Current", type: "Asset")
        ]

        viewModel.accounts = accounts

        XCTAssertEqual(viewModel.grouped.keys.count, 1)
        XCTAssertEqual(viewModel.grouped["Asset"]?.count, 2)
    }

    func testGrouped_empty_returnsEmptyDictionary() {
        viewModel.accounts = []

        XCTAssertTrue(viewModel.grouped.isEmpty)
    }

    func testGroupOrder_containsExpectedTypes() {
        let order = AccountsViewModel.groupOrder
        XCTAssertEqual(order, ["Asset", "Liability", "Equity", "Investment"])
    }

    // MARK: - Create Account

    func testCreateAccount_addsToList() {
        // Given: One existing account
        viewModel.accounts = [
            MockData.mockAccount(id: "acc-001", name: "Savings", type: "Asset", balance: 50000)
        ]
        XCTAssertEqual(viewModel.accounts.count, 1)

        // When: A new account is created and added
        let newAccount = MockData.mockAccount(
            id: "acc-002",
            name: "New Current Account",
            type: "Asset",
            balance: 0
        )
        viewModel.accounts.append(newAccount)

        // Then: Account is in the list
        XCTAssertEqual(viewModel.accounts.count, 2)
        XCTAssertTrue(viewModel.accounts.contains(where: { $0.accountId == "acc-002" }))
        XCTAssertEqual(viewModel.accounts.last?.name, "New Current Account")
    }

    func testCreateAccount_updatesGrouping() {
        // Given: Only Asset accounts
        viewModel.accounts = [
            MockData.mockAccount(id: "acc-001", type: "Asset")
        ]
        XCTAssertEqual(viewModel.grouped.keys.count, 1)

        // When: A Liability account is added
        viewModel.accounts.append(
            MockData.mockAccount(id: "acc-002", name: "Loan", type: "Liability", balance: -100000)
        )

        // Then: Grouped now has two types
        XCTAssertEqual(viewModel.grouped.keys.count, 2)
        XCTAssertNotNil(viewModel.grouped["Liability"])
    }

    // MARK: - Delete Account

    func testDeleteAccount_removesFromList() {
        // Given: Multiple accounts
        viewModel.accounts = [
            MockData.mockAccount(id: "acc-001", name: "Savings", type: "Asset"),
            MockData.mockAccount(id: "acc-002", name: "Credit Card", type: "Liability"),
            MockData.mockAccount(id: "acc-003", name: "Current", type: "Asset")
        ]
        XCTAssertEqual(viewModel.accounts.count, 3)

        // When: Simulating deletion of acc-002
        let accountToDelete = viewModel.accounts[1]
        viewModel.accounts.removeAll { $0.accountId == accountToDelete.accountId }

        // Then: Account is removed
        XCTAssertEqual(viewModel.accounts.count, 2)
        XCTAssertFalse(viewModel.accounts.contains(where: { $0.accountId == "acc-002" }))
        XCTAssertTrue(viewModel.accounts.contains(where: { $0.accountId == "acc-001" }))
        XCTAssertTrue(viewModel.accounts.contains(where: { $0.accountId == "acc-003" }))
    }

    func testDeleteAccount_updatesGrouping() {
        // Given: One Liability account among Assets
        viewModel.accounts = [
            MockData.mockAccount(id: "acc-001", type: "Asset"),
            MockData.mockAccount(id: "acc-002", type: "Liability")
        ]
        XCTAssertEqual(viewModel.grouped.keys.count, 2)

        // When: The only Liability account is removed
        viewModel.accounts.removeAll { $0.accountId == "acc-002" }

        // Then: Liability group is gone
        XCTAssertEqual(viewModel.grouped.keys.count, 1)
        XCTAssertNil(viewModel.grouped["Liability"])
    }

    // MARK: - Loading & Error State

    func testLoadingState_transitions() {
        XCTAssertFalse(viewModel.isLoading)

        viewModel.isLoading = true
        XCTAssertTrue(viewModel.isLoading)

        viewModel.isLoading = false
        XCTAssertFalse(viewModel.isLoading)
    }

    func testRefreshingState_transitions() {
        XCTAssertFalse(viewModel.isRefreshing)

        viewModel.isRefreshing = true
        XCTAssertTrue(viewModel.isRefreshing)

        viewModel.isRefreshing = false
        XCTAssertFalse(viewModel.isRefreshing)
    }

    func testErrorMessage_setsAndClears() {
        viewModel.errorMessage = "Failed to load accounts."
        XCTAssertEqual(viewModel.errorMessage, "Failed to load accounts.")

        viewModel.errorMessage = nil
        XCTAssertNil(viewModel.errorMessage)
    }

    // MARK: - Sheet State

    func testAddAccountSheet_state() {
        viewModel.showAddAccount = true
        XCTAssertTrue(viewModel.showAddAccount)

        viewModel.showAddAccount = false
        XCTAssertFalse(viewModel.showAddAccount)
    }

    func testEditAccountSheet_state() {
        let account = MockData.mockAccount(id: "acc-001")

        viewModel.editingAccount = account
        viewModel.showEditAccount = true

        XCTAssertNotNil(viewModel.editingAccount)
        XCTAssertTrue(viewModel.showEditAccount)
        XCTAssertEqual(viewModel.editingAccount?.accountId, "acc-001")
    }

    func testDeleteConfirmation_state() {
        let account = MockData.mockAccount(id: "acc-001")

        viewModel.deletingAccount = account
        viewModel.showDeleteConfirm = true

        XCTAssertNotNil(viewModel.deletingAccount)
        XCTAssertTrue(viewModel.showDeleteConfirm)
    }

    // MARK: - Account Model

    func testAccount_identifiable_usesAccountId() {
        let account = MockData.mockAccount(id: "test-id-123")
        XCTAssertEqual(account.id, "test-id-123")
        XCTAssertEqual(account.id, account.accountId)
    }
}
