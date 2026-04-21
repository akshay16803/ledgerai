import Foundation
import SwiftUI

@Observable
final class SettingsViewModel {

    // MARK: - State

    var settings = AppSettings()
    var currencies: [CurrencyOption] = []
    var dateFormats: [DateFormatOption] = []
    var isLoading = false
    var isSaving = false
    var errorMessage = ""
    var showError = false
    var showDeleteConfirm = false
    var showResetWarning = false
    var showResetConfirmInput = false
    var resetConfirmText = ""
    var isResetting = false
    var showResetSuccess = false
    var showSaveSuccess = false

    // Image upload state
    var isUploadingLogo = false
    var isUploadingSignature = false
    var isDeletingLogo = false
    var isDeletingSignature = false

    // MARK: - Dependencies

    private let repository: SettingsRepository
    private let authManager: AuthManager

    // MARK: - Init

    init(repository: SettingsRepository = .shared, authManager: AuthManager) {
        self.repository = repository
        self.authManager = authManager
    }

    // MARK: - Load Settings

    @MainActor
    func loadSettings() async {
        isLoading = true
        showError = false

        do {
            settings = try await repository.getSettings()
        } catch {
            handleError(error)
        }

        isLoading = false
    }

    // MARK: - Save Settings

    @MainActor
    func saveSettings() async {
        isSaving = true
        showError = false

        do {
            settings = try await repository.updateSettings(settings)
            showSaveSuccess = true
        } catch {
            handleError(error)
        }

        isSaving = false
    }

    // MARK: - Currencies

    @MainActor
    func loadCurrencies() async {
        do {
            currencies = try await repository.getCurrencies()
        } catch {
            handleError(error)
        }
    }

    // MARK: - Date Formats

    @MainActor
    func loadDateFormats() async {
        do {
            dateFormats = try await repository.getDateFormats()
        } catch {
            handleError(error)
        }
    }

    // MARK: - Logo

    @MainActor
    func uploadLogo(imageData: Data) async {
        isUploadingLogo = true
        showError = false

        do {
            let response = try await repository.uploadLogo(imageData: imageData)
            settings.logoUrl = response.resolvedUrl
        } catch {
            handleError(error)
        }

        isUploadingLogo = false
    }

    @MainActor
    func deleteLogo() async {
        isDeletingLogo = true
        showError = false

        do {
            _ = try await repository.deleteLogo()
            settings.logoUrl = nil
        } catch {
            handleError(error)
        }

        isDeletingLogo = false
    }

    // MARK: - Signature

    @MainActor
    func uploadSignature(imageData: Data) async {
        isUploadingSignature = true
        showError = false

        do {
            let response = try await repository.uploadSignature(imageData: imageData)
            settings.signatureUrl = response.resolvedUrl
        } catch {
            handleError(error)
        }

        isUploadingSignature = false
    }

    @MainActor
    func deleteSignature() async {
        isDeletingSignature = true
        showError = false

        do {
            _ = try await repository.deleteSignature()
            settings.signatureUrl = nil
        } catch {
            handleError(error)
        }

        isDeletingSignature = false
    }

    // MARK: - Reset Data

    @MainActor
    func resetData() async {
        isResetting = true
        showError = false

        do {
            _ = try await repository.resetData()
            showResetSuccess = true
            resetConfirmText = ""
        } catch {
            handleError(error)
        }

        isResetting = false
    }

    // MARK: - Delete Account

    @MainActor
    func deleteAccount() async {
        isLoading = true
        showError = false

        do {
            try await authManager.deleteAccount()
        } catch {
            handleError(error)
            isLoading = false
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

    func dismissError() {
        showError = false
        errorMessage = ""
    }
}
