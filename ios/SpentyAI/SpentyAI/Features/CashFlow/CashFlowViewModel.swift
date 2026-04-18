import Foundation

@Observable
final class CashFlowViewModel {

    // MARK: - State

    var projection: CashFlowProjection?
    var mandates: [Mandate] = []
    var recurringItems: [RecurringItem] = []
    var upcomingMandates: [Mandate] = []
    var isLoading = false
    var errorMessage = ""
    var showError = false
    var isDetecting = false

    // MARK: - Dependencies

    private let repository: CashFlowRepository

    // MARK: - Init

    init(repository: CashFlowRepository = .shared) {
        self.repository = repository
    }

    // MARK: - Load All

    @MainActor
    func loadAll() async {
        isLoading = true
        showError = false

        async let p = repository.getProjection()
        async let m = repository.getMandates()
        async let r = repository.getRecurringList()
        async let u = repository.getUpcoming()

        do {
            projection = try await p
        } catch {
            handleError(error)
        }

        do {
            mandates = try await m
        } catch {
            // Non-fatal — projection may still load
        }

        do {
            recurringItems = try await r
        } catch {
            // Non-fatal
        }

        do {
            upcomingMandates = try await u
        } catch {
            // Non-fatal
        }

        isLoading = false
    }

    // MARK: - Individual Loaders

    @MainActor
    func loadProjection() async {
        do {
            projection = try await repository.getProjection()
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func loadMandates() async {
        do {
            mandates = try await repository.getMandates()
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func loadUpcoming() async {
        do {
            upcomingMandates = try await repository.getUpcoming()
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func loadRecurring() async {
        do {
            recurringItems = try await repository.getRecurringList()
        } catch {
            handleError(error)
        }
    }

    // MARK: - Actions

    @MainActor
    func toggleRecurring(transactionId: String) async {
        do {
            _ = try await repository.toggleRecurring(transactionId: transactionId)
            await loadRecurring()
            await loadProjection()
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func createMandate(merchant: String, amount: Double, frequency: String, mandateType: String? = nil) async {
        do {
            let mandate = try await repository.createMandate(merchant: merchant, amount: amount, frequency: frequency, mandateType: mandateType)
            mandates.append(mandate)
            await loadProjection()
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func updateMandate(id: String, amount: Double? = nil, status: String? = nil, frequency: String? = nil) async {
        do {
            let updated = try await repository.updateMandate(id: id, amount: amount, status: status, frequency: frequency)
            if let index = mandates.firstIndex(where: { $0.id == id }) {
                mandates[index] = updated
            }
            await loadProjection()
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func deleteMandate(id: String) async {
        do {
            _ = try await repository.deleteMandate(id: id)
            mandates.removeAll { $0.id == id }
            await loadProjection()
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func detectMandates() async {
        isDetecting = true
        do {
            _ = try await repository.detectMandates()
            await loadMandates()
            await loadUpcoming()
            await loadProjection()
        } catch {
            handleError(error)
        }
        isDetecting = false
    }

    @MainActor
    func refresh() async {
        await loadAll()
    }

    // MARK: - Computed

    var monthlyIncome: Double {
        projection?.monthlyRecurringIncome ?? 0
    }

    var monthlyExpense: Double {
        projection?.monthlyRecurringExpense ?? 0
    }

    var monthlyMandates: Double {
        projection?.monthlyMandateExpense ?? 0
    }

    var monthlyODInterest: Double {
        projection?.monthlyOdInterest ?? 0
    }

    var monthlyNet: Double {
        projection?.monthlyNet ?? 0
    }

    var projectionMonths: [ProjectionMonth] {
        projection?.projection ?? []
    }

    var hasData: Bool {
        projection != nil
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
}
