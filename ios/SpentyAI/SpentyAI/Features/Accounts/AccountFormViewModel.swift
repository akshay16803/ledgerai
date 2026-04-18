import Foundation
import os

@Observable
final class AccountFormViewModel {

    // MARK: - Form State

    var name = ""
    var accountType = "Asset"
    var subType = ""
    var customSubType = ""
    var isCustomSubType = false
    var accountNumber = ""
    var openingBalance = ""
    var balanceAsOfDate = Date()
    var currency = "INR"
    var descriptionText = ""

    // Loan fields
    var loanSanctionedAmount = ""
    var loanInterestRate = ""
    var loanTenureMonths = ""
    var loanEmiAmount = ""
    var loanEmiDay = 1
    var loanStartDate = Date()
    var loanOutstandingBalance = ""

    // Investment fields
    var brokerName = ""

    // Sub-types
    var availableSubTypes: [AccountSubType] = []

    // State
    var isSaving = false
    var isLoadingSubTypes = false
    var errorMessage: String?
    var nameError: String?
    var balanceError: String?

    // MARK: - Edit Mode

    var isEditing: Bool { editingAccountId != nil }
    private var editingAccountId: String?

    // MARK: - Computed

    var showLoanFields: Bool {
        accountType == "Liability"
            || subType.localizedCaseInsensitiveContains("loan")
            || subType.localizedCaseInsensitiveContains("mortgage")
            || subType.localizedCaseInsensitiveContains("overdraft")
    }

    var showInvestmentFields: Bool {
        accountType == "Investment"
    }

    var effectiveSubType: String {
        isCustomSubType ? customSubType : subType
    }

    var filteredSubTypes: [AccountSubType] {
        availableSubTypes.filter { $0.accountType == accountType }
    }

    static let accountTypes = ["Asset", "Liability", "Equity", "Investment"]

    static let currencies = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED", "CHF"]

    // MARK: - Private

    private let repository = AccountRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "account-form")

    // MARK: - Methods

    @MainActor
    func loadSubTypes() async {
        isLoadingSubTypes = true
        do {
            let response = try await repository.getSubTypes()
            availableSubTypes = response.subTypes ?? []
        } catch {
            logger.error("Failed to load sub-types: \(error.localizedDescription)")
        }
        isLoadingSubTypes = false
    }

    func populateFromExisting(_ account: Account) {
        editingAccountId = account.accountId
        name = account.name
        accountType = account.accountType
        subType = account.subType ?? ""
        accountNumber = account.accountNumber ?? ""
        openingBalance = account.openingBalance.map { String($0) } ?? ""
        currency = account.currency ?? "INR"
        descriptionText = account.description ?? ""

        if let dateString = account.balanceAsOfDate {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            balanceAsOfDate = formatter.date(from: dateString) ?? Date()
        }

        // Loan fields
        loanSanctionedAmount = account.loanSanctionedAmount.map { String($0) } ?? ""
        loanInterestRate = account.loanInterestRate.map { String($0) } ?? ""
        loanTenureMonths = account.loanTenureMonths.map { String($0) } ?? ""
        loanEmiAmount = account.loanEmiAmount.map { String($0) } ?? ""
        loanEmiDay = account.loanEmiDay ?? 1
        loanOutstandingBalance = account.loanOutstandingBalance.map { String($0) } ?? ""

        if let dateString = account.loanStartDate {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            loanStartDate = formatter.date(from: dateString) ?? Date()
        }

        // Investment
        brokerName = account.brokerName ?? ""
    }

    @MainActor
    func save() async -> Bool {
        guard validate() else { return false }

        isSaving = true
        errorMessage = nil

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        do {
            if let accountId = editingAccountId {
                // Update
                var update = AccountUpdate()
                update.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
                update.accountType = accountType
                update.subType = effectiveSubType.isEmpty ? nil : effectiveSubType
                update.accountNumber = accountNumber.isEmpty ? nil : accountNumber
                update.openingBalance = Double(openingBalance)
                update.currency = currency
                update.description = descriptionText.isEmpty ? nil : descriptionText

                if showLoanFields {
                    update.loanSanctionedAmount = Double(loanSanctionedAmount)
                    update.loanInterestRate = Double(loanInterestRate)
                    update.loanTenureMonths = Int(loanTenureMonths)
                    update.loanEmiAmount = Double(loanEmiAmount)
                    update.loanEmiDay = loanEmiDay
                    update.loanStartDate = dateFormatter.string(from: loanStartDate)
                    update.loanOutstandingBalance = Double(loanOutstandingBalance)
                }

                if showInvestmentFields {
                    update.brokerName = brokerName.isEmpty ? nil : brokerName
                }

                _ = try await repository.updateAccount(accountId, update)
                logger.info("Updated account: \(self.name)")
            } else {
                // Create
                var create = AccountCreate(name: name.trimmingCharacters(in: .whitespacesAndNewlines), accountType: accountType)
                create.subType = effectiveSubType.isEmpty ? nil : effectiveSubType
                create.accountNumber = accountNumber.isEmpty ? nil : accountNumber
                create.openingBalance = Double(openingBalance)
                create.currency = currency
                create.description = descriptionText.isEmpty ? nil : descriptionText

                if showLoanFields {
                    create.loanSanctionedAmount = Double(loanSanctionedAmount)
                    create.loanInterestRate = Double(loanInterestRate)
                    create.loanTenureMonths = Int(loanTenureMonths)
                    create.loanEmiAmount = Double(loanEmiAmount)
                    create.loanEmiDay = loanEmiDay
                    create.loanStartDate = dateFormatter.string(from: loanStartDate)
                }

                if showInvestmentFields {
                    create.brokerName = brokerName.isEmpty ? nil : brokerName
                }

                _ = try await repository.createAccount(create)
                logger.info("Created account: \(self.name)")
            }

            isSaving = false
            return true
        } catch {
            errorMessage = "Failed to save account. Please try again."
            logger.error("Save account error: \(error.localizedDescription)")
            isSaving = false
            return false
        }
    }

    // MARK: - Validation

    private func validate() -> Bool {
        var isValid = true
        nameError = nil
        balanceError = nil

        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedName.isEmpty {
            nameError = "Account name is required."
            isValid = false
        }

        if openingBalance.isEmpty {
            balanceError = "Opening balance is required."
            isValid = false
        } else if Double(openingBalance) == nil {
            balanceError = "Enter a valid number."
            isValid = false
        }

        return isValid
    }
}
