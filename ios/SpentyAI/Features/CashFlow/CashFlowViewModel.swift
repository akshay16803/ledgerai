import Foundation
import os

@Observable
final class CashFlowViewModel {

    // MARK: - Data

    var projection: CashFlowProjection?
    var mandates: [Mandate] = []

    // MARK: - Loading State

    var isLoading = false
    var isRefreshing = false
    var isSaving = false
    var errorMessage: String?

    // MARK: - Sheet State

    var showAddMandate = false
    var showEditMandate: Mandate?
    var showDeleteConfirm: Mandate?

    // MARK: - Private

    private let repo = CashFlowRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "cashflow")

    // MARK: - Load Methods

    @MainActor
    func loadAll() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        async let projectionTask = repo.getProjection()
        async let mandatesTask = repo.getMandates()

        do {
            let (proj, mands) = try await (projectionTask, mandatesTask)
            projection = proj
            mandates = mands
            logger.info("Cash flow data loaded successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to load cash flow: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to load cash flow data. Please try again."
            logger.error("Unexpected error loading cash flow: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func loadProjection() async {
        do {
            projection = try await repo.getProjection()
            logger.info("Projection loaded successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to load projection: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to load projection."
            logger.error("Unexpected error loading projection: \(error.localizedDescription)")
        }
    }

    @MainActor
    func loadMandates() async {
        do {
            mandates = try await repo.getMandates()
            logger.info("Mandates loaded successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to load mandates: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to load mandates."
            logger.error("Unexpected error loading mandates: \(error.localizedDescription)")
        }
    }

    @MainActor
    func createMandate(_ body: MandateCreate) async {
        isSaving = true
        errorMessage = nil

        do {
            let mandate = try await repo.createMandate(body)
            mandates.append(mandate)
            showAddMandate = false
            logger.info("Mandate created successfully")
            await loadProjection()
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to create mandate: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to create mandate. Please try again."
            logger.error("Unexpected error creating mandate: \(error.localizedDescription)")
        }

        isSaving = false
    }

    @MainActor
    func updateMandate(_ id: String, _ body: MandateCreate) async {
        isSaving = true
        errorMessage = nil

        do {
            let updated = try await repo.updateMandate(id, body)
            if let index = mandates.firstIndex(where: { $0.mandateId == id }) {
                mandates[index] = updated
            }
            showEditMandate = nil
            logger.info("Mandate updated successfully")
            await loadProjection()
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to update mandate: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to update mandate. Please try again."
            logger.error("Unexpected error updating mandate: \(error.localizedDescription)")
        }

        isSaving = false
    }

    @MainActor
    func deleteMandate(_ id: String) async {
        isSaving = true
        errorMessage = nil

        do {
            try await repo.deleteMandate(id)
            mandates.removeAll { $0.mandateId == id }
            showDeleteConfirm = nil
            logger.info("Mandate deleted successfully")
            await loadProjection()
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to delete mandate: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to delete mandate. Please try again."
            logger.error("Unexpected error deleting mandate: \(error.localizedDescription)")
        }

        isSaving = false
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        errorMessage = nil

        async let projectionTask = repo.getProjection()
        async let mandatesTask = repo.getMandates()

        do {
            let (proj, mands) = try await (projectionTask, mandatesTask)
            projection = proj
            mandates = mands
            logger.info("Cash flow refreshed successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to refresh cash flow: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to refresh. Please try again."
            logger.error("Unexpected error refreshing cash flow: \(error.localizedDescription)")
        }

        isRefreshing = false
    }
}
