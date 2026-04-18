import Foundation
import os

@Observable
final class SettingsViewModel {

    // MARK: - Settings Fields

    var baseCurrency = ""
    var dateFormat = ""
    var businessCountry = ""
    var firmName = ""
    var firmAddress = ""
    var firmCity = ""
    var firmState = ""
    var firmPincode = ""
    var firmGstin = ""
    var firmPan = ""
    var firmPhone = ""
    var firmEmail = ""
    var invoiceBankName = ""
    var invoiceBankAccountNo = ""
    var invoiceBankIfsc = ""
    var invoiceBankBranch = ""
    var invoicePrefix = "INV-"
    var invoiceTerms = ""
    var billPrefix = "BILL-"
    var billTerms = ""

    // MARK: - UI State

    var isLoading = false
    var isSaving = false
    var errorMessage: String?
    var showSaved = false
    var setupMode: String?

    // MARK: - Computed

    var isIndianBusiness: Bool {
        businessCountry == "IN"
    }

    var requiredFieldsMissing: [String] {
        guard setupMode != nil else { return [] }
        var missing: [String] = []
        if firmName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            missing.append("Firm Name")
        }
        return missing
    }

    // MARK: - Private

    private let repository = SettingsRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "settings")

    // MARK: - Methods

    @MainActor
    func loadSettings() async {
        isLoading = true
        errorMessage = nil

        do {
            let settings = try await repository.getSettings()
            populateFrom(settings)
            logger.info("Loaded settings")
        } catch {
            errorMessage = "Failed to load settings."
            logger.error("Load settings error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func saveSettings() async {
        isSaving = true
        errorMessage = nil

        let update = SettingsUpdate(
            baseCurrency: baseCurrency.isEmpty ? nil : baseCurrency,
            dateFormat: dateFormat.isEmpty ? nil : dateFormat,
            businessCountry: businessCountry.isEmpty ? nil : businessCountry,
            firmName: firmName.isEmpty ? nil : firmName,
            firmAddress: firmAddress.isEmpty ? nil : firmAddress,
            firmCity: firmCity.isEmpty ? nil : firmCity,
            firmState: firmState.isEmpty ? nil : firmState,
            firmPincode: firmPincode.isEmpty ? nil : firmPincode,
            firmPhone: firmPhone.isEmpty ? nil : firmPhone,
            firmEmail: firmEmail.isEmpty ? nil : firmEmail,
            firmGstin: firmGstin.isEmpty ? nil : firmGstin,
            firmPan: firmPan.isEmpty ? nil : firmPan,
            invoiceBankName: invoiceBankName.isEmpty ? nil : invoiceBankName,
            invoiceBankAccountNumber: invoiceBankAccountNo.isEmpty ? nil : invoiceBankAccountNo,
            invoiceBankIfsc: invoiceBankIfsc.isEmpty ? nil : invoiceBankIfsc,
            invoiceBankBranch: invoiceBankBranch.isEmpty ? nil : invoiceBankBranch,
            invoicePrefix: invoicePrefix.isEmpty ? nil : invoicePrefix,
            invoiceTerms: invoiceTerms.isEmpty ? nil : invoiceTerms,
            billPrefix: billPrefix.isEmpty ? nil : billPrefix,
            billTerms: billTerms.isEmpty ? nil : billTerms
        )

        do {
            let saved = try await repository.updateSettings(update)
            populateFrom(saved)
            showSaved = true
            logger.info("Settings saved successfully")

            try? await Task.sleep(for: .seconds(2))
            showSaved = false
        } catch {
            errorMessage = "Failed to save settings."
            logger.error("Save settings error: \(error.localizedDescription)")
        }

        isSaving = false
    }

    func populateFrom(_ settings: AppSettings) {
        baseCurrency = settings.baseCurrency ?? ""
        dateFormat = settings.dateFormat ?? ""
        businessCountry = settings.businessCountry ?? ""
        firmName = settings.firmName ?? ""
        firmAddress = settings.firmAddress ?? ""
        firmCity = settings.firmCity ?? ""
        firmState = settings.firmState ?? ""
        firmPincode = settings.firmPincode ?? ""
        firmGstin = settings.firmGstin ?? ""
        firmPan = settings.firmPan ?? ""
        firmPhone = settings.firmPhone ?? ""
        firmEmail = settings.firmEmail ?? ""
        invoiceBankName = settings.invoiceBankName ?? ""
        invoiceBankAccountNo = settings.invoiceBankAccountNumber ?? ""
        invoiceBankIfsc = settings.invoiceBankIfsc ?? ""
        invoiceBankBranch = settings.invoiceBankBranch ?? ""
        invoicePrefix = settings.invoicePrefix ?? "INV-"
        invoiceTerms = settings.invoiceTerms ?? ""
        billPrefix = settings.billPrefix ?? "BILL-"
        billTerms = settings.billTerms ?? ""
    }
}
