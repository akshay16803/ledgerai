import Foundation
import SwiftUI

@Observable
final class AccountsViewModel {

    // MARK: - State

    var accounts: [Account] = []
    var subTypes: [AccountSubType] = []
    var selectedAccount: Account?
    var accountTransactions: [Transaction] = []
    var amortizationSchedule: [AmortizationEntry] = []
    var amortizationTotalInterest: Double = 0
    var amortizationTotalPayment: Double = 0

    var isLoading = false
    var isDetailLoading = false
    var isSaving = false
    var errorMessage: String?
    var searchText = ""

    // Form state
    var showingForm = false
    var editingAccount: Account?

    // OD Interest
    var odFromDate = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
    var odToDate = Date()
    var odInterestResult: ODInterestResponse?
    var isCalculatingOD = false

    // Sub-type management
    var isLoadingSubTypes = false
    var newSubTypeName = ""
    var newSubTypeAccountType = "asset"
    var editingSubType: AccountSubType?
    var editingSubTypeName = ""

    // Demat
    var dematStatements: [DematStatement] = []
    var isUploadingDemat = false
    var isDematLoading = false

    // Transaction Filters (for AccountDetailView)
    var filterTransactionType = ""
    var filterCategoryId = ""
    var filterStartDate: Date? = nil
    var filterEndDate: Date? = nil
    var filterMinAmount = ""
    var filterMaxAmount = ""
    var filterSearch = ""
    var filterCategories: [(id: String, name: String)] = []
    var isLoadingFilteredTransactions = false
    var filteredTransactionTotal = 0

    private let repository = AccountRepository()

    // MARK: - Computed Properties

    var filteredAccounts: [Account] {
        guard !searchText.isEmpty else { return accounts }
        let query = searchText.lowercased()
        return accounts.filter { account in
            (account.name?.lowercased().contains(query) ?? false) ||
            (account.accountType?.lowercased().contains(query) ?? false) ||
            (account.subType?.lowercased().contains(query) ?? false) ||
            (account.accountNumber?.lowercased().contains(query) ?? false)
        }
    }

    var groupedAccounts: [(type: String, accounts: [Account])] {
        let typeOrder = ["asset", "liability", "equity", "investment"]
        let grouped = Dictionary(grouping: filteredAccounts) { $0.accountType?.lowercased() ?? "other" }
        return typeOrder.compactMap { type in
            guard let items = grouped[type], !items.isEmpty else { return nil }
            return (type: type, accounts: items)
        } + (grouped.keys.contains(where: { !typeOrder.contains($0) })
              ? grouped.filter { !typeOrder.contains($0.key) }.map { (type: $0.key, accounts: $0.value) }
              : [])
    }

    var totalBalance: Double {
        accounts.reduce(0) { total, account in
            let balance = account.balance ?? 0
            if account.accountType?.lowercased() == "liability" {
                return total - balance
            }
            return total + balance
        }
    }

    func subTypesForType(_ accountType: String) -> [AccountSubType] {
        subTypes.filter { ($0.accountType?.lowercased() ?? "") == accountType.lowercased() }
    }

    // MARK: - Account CRUD

    @MainActor
    func loadAccounts() async {
        isLoading = true
        errorMessage = nil
        do {
            accounts = try await repository.fetchAccounts()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    func loadAccountDetail(_ id: String) async {
        isDetailLoading = true
        errorMessage = nil
        do {
            async let accountTask = repository.fetchAccount(id)
            async let transactionsTask = repository.fetchAccountTransactions(id)
            selectedAccount = try await accountTask
            accountTransactions = try await transactionsTask
        } catch {
            errorMessage = error.localizedDescription
        }
        isDetailLoading = false
    }

    @MainActor
    func saveAccount(_ payload: [String: Any], editId: String? = nil) async -> Bool {
        isSaving = true
        errorMessage = nil
        do {
            if let editId {
                let updated = try await repository.updateAccount(editId, payload)
                if let idx = accounts.firstIndex(where: { $0.id == editId }) {
                    accounts[idx] = updated
                }
                selectedAccount = updated
            } else {
                let created = try await repository.createAccount(payload)
                accounts.append(created)
            }
            isSaving = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isSaving = false
            return false
        }
    }

    @MainActor
    func updateOpeningBalance(_ accountId: String, amount: Double, asOfDate: Date) async -> Bool {
        isSaving = true
        errorMessage = nil
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        let payload: [String: Any] = [
            "openingBalance": amount,
            "balanceAsOfDate": dateFormatter.string(from: asOfDate)
        ]
        do {
            let updated = try await repository.updateAccount(accountId, payload)
            if let idx = accounts.firstIndex(where: { $0.id == accountId }) {
                accounts[idx] = updated
            }
            selectedAccount = updated
            isSaving = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isSaving = false
            return false
        }
    }

    @MainActor
    func deleteAccount(_ id: String) async {
        do {
            try await repository.deleteAccount(id)
            accounts.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Amortization

    @MainActor
    func loadAmortization(_ accountId: String) async {
        do {
            let response = try await repository.fetchAmortization(accountId)
            amortizationSchedule = response.schedule
            amortizationTotalInterest = response.totalInterest ?? 0
            amortizationTotalPayment = response.totalPayment ?? 0
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - OD Interest

    @MainActor
    func calculateODInterest(_ accountId: String) async {
        isCalculatingOD = true
        do {
            odInterestResult = try await repository.calculateODInterest(accountId, from: odFromDate, to: odToDate)
        } catch {
            errorMessage = error.localizedDescription
        }
        isCalculatingOD = false
    }

    // MARK: - Sub-Types

    @MainActor
    func loadSubTypes() async {
        isLoadingSubTypes = true
        do {
            subTypes = try await repository.fetchSubTypes()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoadingSubTypes = false
    }

    @MainActor
    func createSubType() async {
        guard !newSubTypeName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        do {
            let payload: [String: String] = [
                "name": newSubTypeName.trimmingCharacters(in: .whitespaces),
                "accountType": newSubTypeAccountType
            ]
            let created = try await repository.createSubType(payload)
            subTypes.append(created)
            newSubTypeName = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func updateSubType(_ id: String) async {
        guard !editingSubTypeName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        do {
            let payload: [String: String] = ["name": editingSubTypeName.trimmingCharacters(in: .whitespaces)]
            let updated = try await repository.updateSubType(id, payload)
            if let idx = subTypes.firstIndex(where: { $0.id == id }) {
                subTypes[idx] = updated
            }
            editingSubType = nil
            editingSubTypeName = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func deleteSubType(_ id: String) async {
        do {
            try await repository.deleteSubType(id)
            subTypes.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Demat

    @MainActor
    func loadDematStatements(_ accountId: String) async {
        isDematLoading = true
        do {
            dematStatements = try await repository.fetchDematStatements(accountId)
        } catch {
            errorMessage = error.localizedDescription
        }
        isDematLoading = false
    }

    @MainActor
    func uploadDematStatement(data: Data, filename: String, accountId: String) async -> Bool {
        isUploadingDemat = true
        do {
            _ = try await repository.uploadDematStatement(data: data, filename: filename, accountId: accountId)
            await loadDematStatements(accountId)
            isUploadingDemat = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isUploadingDemat = false
            return false
        }
    }

    @MainActor
    func approveDematStatement(_ id: String, accountId: String) async {
        do {
            try await repository.approveDematStatement(id)
            await loadDematStatements(accountId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func rejectDematStatement(_ id: String, accountId: String) async {
        do {
            try await repository.rejectDematStatement(id)
            await loadDematStatements(accountId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Filtered Transactions

    @MainActor
    func loadFilteredTransactions(_ accountId: String) async {
        isLoadingFilteredTransactions = true
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        do {
            let result = try await repository.fetchFilteredAccountTransactions(
                accountId,
                transactionType: filterTransactionType.isEmpty ? nil : filterTransactionType,
                categoryId: filterCategoryId.isEmpty ? nil : filterCategoryId,
                startDate: filterStartDate.map { dateFormatter.string(from: $0) },
                endDate: filterEndDate.map { dateFormatter.string(from: $0) },
                minAmount: Double(filterMinAmount),
                maxAmount: Double(filterMaxAmount),
                search: filterSearch.isEmpty ? nil : filterSearch
            )
            accountTransactions = result.transactions
            filteredTransactionTotal = result.total
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoadingFilteredTransactions = false
    }

    func resetFilters() {
        filterTransactionType = ""
        filterCategoryId = ""
        filterStartDate = nil
        filterEndDate = nil
        filterMinAmount = ""
        filterMaxAmount = ""
        filterSearch = ""
    }

    @MainActor
    func loadFilterCategories() async {
        do {
            let cats: [Category] = try await APIClient.shared.get(APIEndpoints.categories)
            filterCategories = cats.compactMap { cat in
                guard let name = cat.name else { return nil }
                return (id: cat.id, name: name)
            }
        } catch {
            // Silent — categories are optional for filtering
        }
    }

    // MARK: - Helpers

    func dismissError() {
        errorMessage = nil
    }

    static let accountTypes = ["asset", "liability", "equity", "investment"]

    static func iconForAccountType(_ type: String) -> String {
        switch type.lowercased() {
        case "asset": return "building.columns.fill"
        case "liability": return "creditcard.fill"
        case "equity": return "chart.pie.fill"
        case "investment": return "chart.line.uptrend.xyaxis"
        default: return "banknote.fill"
        }
    }

    static func colorForAccountType(_ type: String) -> Color {
        switch type.lowercased() {
        case "asset": return .spentyPrimary
        case "liability": return .spentyError
        case "equity": return .spentyInfo
        case "investment": return .spentyWarning
        default: return .spentyTextSecondary
        }
    }
}
