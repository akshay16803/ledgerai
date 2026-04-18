import Foundation

struct DashboardRepository {

    func getSummary() async throws -> DashboardSummary {
        try await APIClient.shared.get(APIEndpoints.Dashboard.summary)
    }
}
