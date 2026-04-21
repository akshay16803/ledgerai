import Foundation

// MARK: - API Models

struct CurrencyOption: Codable, Identifiable, Hashable {
    let code: String
    let name: String
    let symbol: String?

    var id: String { code }
}

struct DateFormatOption: Codable, Identifiable, Hashable {
    let value: String?
    let label: String?
    let example: String?

    /// Use `value` if present, fall back to `label`
    var format: String { value ?? label ?? "" }
    var id: String { format }
}

struct CurrenciesResponse: Codable {
    let currencies: [CurrencyOption]
}

struct DateFormatsResponse: Codable {
    let formats: [DateFormatOption]
}

struct UploadResponse: Codable {
    let url: String?
    let logoUrl: String?
    let signatureUrl: String?
    let message: String?

    /// Returns the first non-nil URL from the response
    var resolvedUrl: String? {
        url ?? logoUrl ?? signatureUrl
    }
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
        let response: CurrenciesResponse = try await APIClient.shared.get(APIEndpoints.settingsCurrencies)
        return response.currencies
    }

    func getDateFormats() async throws -> [DateFormatOption] {
        let response: DateFormatsResponse = try await APIClient.shared.get(APIEndpoints.settingsDateFormats)
        return response.formats
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

    // MARK: - Reset Data

    func resetData() async throws -> EmptyResponse {
        struct ResetBody: Encodable { let confirmation: String }
        return try await APIClient.shared.post(APIEndpoints.settingsResetData, body: ResetBody(confirmation: "RESET"))
    }
}
