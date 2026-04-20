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

    // MARK: - Cash Flow Projection State

    var cashFlowProjection: CashFlowProjection?

    // MARK: - Dependencies

    private let repository: DashboardRepository
    private let emailRepository: EmailSyncRepository
    private let cashFlowRepository: CashFlowRepository

    // MARK: - Init

    init(repository: DashboardRepository = .shared, emailRepository: EmailSyncRepository = .shared, cashFlowRepository: CashFlowRepository = .shared) {
        self.repository = repository
        self.emailRepository = emailRepository
        self.cashFlowRepository = cashFlowRepository
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

        // Load pending transactions and cash flow projection in background
        await loadPendingTransactions()
        await loadCashFlowProjection()
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
        await loadCashFlowProjection()
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

    // MARK: - Cash Flow Projection

    @MainActor
    func loadCashFlowProjection() async {
        do {
            cashFlowProjection = try await cashFlowRepository.getProjection()
        } catch {
            // Non-fatal — dashboard still works without projection
            cashFlowProjection = nil
        }
    }

    /// Total next month outflow: recurring expenses + mandates + EMIs + OD interest
    var nextMonthTotalOutflow: Double {
        let expense = cashFlowProjection?.monthlyRecurringExpense ?? 0
        let mandate = cashFlowProjection?.monthlyMandateExpense ?? 0
        let emi = cashFlowProjection?.monthlyEmiTotal ?? 0
        let od = cashFlowProjection?.monthlyOdInterest ?? 0
        return expense + mandate + emi + od
    }

    var nextMonthExpense: Double {
        cashFlowProjection?.monthlyRecurringExpense ?? 0
    }

    var nextMonthMandates: Double {
        cashFlowProjection?.monthlyMandateExpense ?? 0
    }

    var nextMonthEMI: Double {
        cashFlowProjection?.monthlyEmiTotal ?? 0
    }

    var hasProjectionData: Bool {
        cashFlowProjection != nil
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
