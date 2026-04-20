import Foundation

@Observable
final class DashboardViewModel {

    // MARK: - State

    var summary: DashboardSummary?
    var isLoading = false
    var errorMessage = ""
    var showError = false

    // MARK: - Pending Approval State

    var pendingTransactions: [PendingTransaction] = []
    var isLoadingPending = false

    // MARK: - Sheet State

    var showNewTransaction = false
    var showAIChat = false

    // MARK: - Dependencies

    private let repository: DashboardRepository
    private let emailRepository: EmailSyncRepository

    // MARK: - Init

    init(repository: DashboardRepository = .shared, emailRepository: EmailSyncRepository = .shared) {
        self.repository = repository
        self.emailRepository = emailRepository
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

        // Load pending transactions in background
        await loadPendingTransactions()
    }

    // MARK: - Refresh (pull-to-refresh)

    @MainActor
    func refresh() async {
        do {
            summary = try await repository.getSummary()
        } catch {
            handleError(error)
        }
        await loadPendingTransactions()
    }

    // MARK: - Pending Transactions

    @MainActor
    func loadPendingTransactions() async {
        isLoadingPending = true
        do {
            pendingTransactions = try await emailRepository.pendingReview()
        } catch {
            // Silently fail — pending section will show empty
            pendingTransactions = []
        }
        isLoadingPending = false
    }

    @MainActor
    func approvePendingTransaction(_ id: String) async {
        do {
            _ = try await emailRepository.approveTransaction(id)
            pendingTransactions.removeAll { $0.id == id }
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func rejectPendingTransaction(_ id: String) async {
        do {
            _ = try await emailRepository.rejectTransaction(id)
            pendingTransactions.removeAll { $0.id == id }
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
        let approved = txns.filter { ($0.status ?? "approved").lowercased() == "approved" }
        return Array(approved.prefix(10))
    }

    var hasData: Bool {
        summary != nil
    }
}
