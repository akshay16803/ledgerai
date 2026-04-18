import Foundation

final class DashboardRepository {

    static let shared = DashboardRepository()
    private init() {}

    // MARK: - Dashboard Summary

    func getSummary() async throws -> DashboardSummary {
        try await APIClient.shared.get(APIEndpoints.dashboardSummary)
    }
}
