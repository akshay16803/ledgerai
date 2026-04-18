import Foundation
import os

@Observable
final class AccountsViewModel {

    // MARK: - State

    var accounts: [Account] = []
    var isLoading = false
    var isRefreshing = false
    var errorMessage: String?

    // Sheet state
    var showAddAccount = false
    var showEditAccount = false
    var editingAccount: Account?
    var showDeleteConfirm = false
    var deletingAccount: Account?
    var showSubTypeManager = false

    // Navigation
    var selectedAccountForDetail: Account?

    // MARK: - Computed

    /// Accounts grouped by account_type in display order.
    var grouped: [String: [Account]] {
        Dictionary(grouping: accounts, by: { $0.accountType })
    }

    /// Ordered group keys for consistent display.
    static let groupOrder = ["Asset", "Liability", "Equity", "Investment"]

    // MARK: - Private

    private let repository = AccountRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "accounts")

    // MARK: - Methods

    @MainActor
    func loadAccounts() async {
        isLoading = true
        errorMessage = nil

        do {
            accounts = try await repository.getAccounts()
            logger.info("Loaded \(self.accounts.count) accounts")
        } catch {
            errorMessage = "Failed to load accounts."
            logger.error("Load accounts error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        errorMessage = nil

        do {
            accounts = try await repository.getAccounts()
        } catch {
            errorMessage = "Failed to refresh accounts."
            logger.error("Refresh accounts error: \(error.localizedDescription)")
        }

        isRefreshing = false
    }

    @MainActor
    func deleteAccount(_ account: Account) async {
        do {
            try await repository.deleteAccount(account.accountId)
            accounts.removeAll { $0.accountId == account.accountId }
            logger.info("Deleted account: \(account.name)")
        } catch {
            errorMessage = "Failed to delete account."
            logger.error("Delete account error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func recalculateBalance(_ account: Account) async {
        do {
            let updated = try await repository.recalculateBalance(account.accountId)
            if let index = accounts.firstIndex(where: { $0.accountId == account.accountId }) {
                accounts[index] = updated
            }
            logger.info("Recalculated balance for: \(account.name)")
        } catch {
            errorMessage = "Failed to recalculate balance."
            logger.error("Recalculate error: \(error.localizedDescription)")
        }
    }
}
