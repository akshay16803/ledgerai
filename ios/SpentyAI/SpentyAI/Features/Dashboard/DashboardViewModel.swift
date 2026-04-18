import Foundation

@Observable
final class DashboardViewModel {

    // MARK: - State

    var summary: DashboardSummary?
    var isLoading = false
    var errorMessage = ""
    var showError = false

    // MARK: - Sheet State

    var showNewTransaction = false
    var showAIChat = false

    // MARK: - Dependencies

    private let repository: DashboardRepository

    // MARK: - Init

    init(repository: DashboardRepository = .shared) {
        self.repository = repository
    }

    // MARK: - Load

    @MainActor
    func loadSummary() async {
        isLoading = true
        showError = false

        do {
            summary = try await repository.getSummary()
        } catch {
            handleError(error)
        }

        isLoading = false
    }

    // MARK: - Refresh (pull-to-refresh)

    @MainActor
    func refresh() async {
        do {
            summary = try await repository.getSummary()
        } catch {
            handleError(error)
        }
    }

    // MARK: - Helpers

    @MainActor
    private func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            errorMessage = apiError.localizedDescription
        } else {
            errorMessage = error.localizedDescription
        }
        showError = true
    }

    // MARK: - Computed

    var netWorth: Double {
        summary?.netWorth ?? 0
    }

    var incomeThisMonth: Double {
        summary?.incomeThisMonth ?? 0
    }

    var expenseThisMonth: Double {
        summary?.expenseThisMonth ?? 0
    }

    var pendingReview: Int {
        summary?.pendingReview ?? 0
    }

    var accounts: [Account] {
        summary?.accounts ?? []
    }

    var recentTransactions: [Transaction] {
        let txns = summary?.recentTransactions ?? []
        return Array(txns.prefix(10))
    }

    var hasData: Bool {
        summary != nil
    }
}
