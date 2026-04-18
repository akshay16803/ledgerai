import Foundation

struct SettingsRepository {

    func getSettings() async throws -> AppSettings {
        try await APIClient.shared.get(APIEndpoints.Settings.get)
    }

    func updateSettings(_ update: SettingsUpdate) async throws -> AppSettings {
        try await APIClient.shared.put(APIEndpoints.Settings.update, body: update)
    }
}
