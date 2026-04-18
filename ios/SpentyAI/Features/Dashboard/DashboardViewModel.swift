import Foundation
import os

@Observable
final class DashboardViewModel {

    // MARK: - State

    var summary: DashboardSummary?
    var isLoading = false
    var isRefreshing = false
    var errorMessage: String?

    // Sheet presentations
    var showNewTransaction = false
    var showAIChat = false
    var showSalesInvoice = false
    var showPurchaseBill = false

    // MARK: - Private

    private let logger = Logger(subsystem: "com.spentyai", category: "dashboard")

    // MARK: - Methods

    @MainActor
    func loadDashboard() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            summary = try await DashboardRepository.getSummary()
            logger.info("Dashboard summary loaded successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to load dashboard: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to load dashboard. Please try again."
            logger.error("Unexpected error loading dashboard: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        errorMessage = nil

        do {
            summary = try await DashboardRepository.getSummary()
            logger.info("Dashboard refreshed successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to refresh dashboard: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to refresh. Please try again."
            logger.error("Unexpected error refreshing dashboard: \(error.localizedDescription)")
        }

        isRefreshing = false
    }
}

// MARK: - Dashboard Repository

enum DashboardRepository {
    static func getSummary() async throws -> DashboardSummary {
        try await APIClient.shared.get(APIEndpoints.Dashboard.summary)
    }
}
