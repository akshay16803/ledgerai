import Foundation

// MARK: - API Models

struct AppSettings: Codable {
    var firmName: String?
    var gstin: String?
    var pan: String?
    var state: String?
    var address: String?
    var businessCountry: String?
    var defaultCurrency: String?
    var dateFormat: String?
    var logoUrl: String?
    var signatureUrl: String?
}

struct CurrencyOption: Codable, Identifiable, Hashable {
    let code: String
    let name: String
    let symbol: String?

    var id: String { code }
}

struct DateFormatOption: Codable, Identifiable, Hashable {
    let format: String
    let example: String?

    var id: String { format }
}

struct UploadResponse: Codable {
    let url: String?
    let message: String?
}

// MARK: - Repository

final class SettingsRepository {

    static let shared = SettingsRepository()
    private init() {}

    // MARK: - Settings CRUD

    func getSettings() async throws -> AppSettings {
        try await APIClient.shared.get(APIEndpoints.settings)
    }

    func updateSettings(_ settings: AppSettings) async throws -> AppSettings {
        try await APIClient.shared.put(APIEndpoints.settings, body: settings)
    }

    // MARK: - Currencies & Date Formats

    func getCurrencies() async throws -> [CurrencyOption] {
        try await APIClient.shared.get(APIEndpoints.settingsCurrencies)
    }

    func getDateFormats() async throws -> [DateFormatOption] {
        try await APIClient.shared.get(APIEndpoints.settingsDateFormats)
    }

    // MARK: - Logo

    func uploadLogo(imageData: Data) async throws -> UploadResponse {
        try await APIClient.shared.upload(
            APIEndpoints.settingsLogo,
            data: imageData,
            filename: "logo.jpg",
            mimeType: "image/jpeg"
        )
    }

    func deleteLogo() async throws -> EmptyResponse {
        try await APIClient.shared.delete(APIEndpoints.settingsLogo)
    }

    // MARK: - Signature

    func uploadSignature(imageData: Data) async throws -> UploadResponse {
        try await APIClient.shared.upload(
            APIEndpoints.settingsSignature,
            data: imageData,
            filename: "signature.jpg",
            mimeType: "image/jpeg"
        )
    }

    func deleteSignature() async throws -> EmptyResponse {
        try await APIClient.shared.delete(APIEndpoints.settingsSignature)
    }
}
