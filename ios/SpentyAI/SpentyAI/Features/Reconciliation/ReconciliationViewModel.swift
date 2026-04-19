import Foundation
import Observation

@Observable
final class ReconciliationViewModel {

    // MARK: - Data

    var statements: [Statement] = []
    var accounts: [Account] = []
    var accountSubTypes: [AccountSubType] = []
    var categories: [Category] = []
    var activeStatement: Statement?
    var parsedEntries: [ParsedEntry] = []
    var reconciliationResult: ReconciliationResult?

    // MARK: - Upload State

    var selectedSubType: String = ""
    var selectedAccountId: String = ""
    var periodFrom: Date = Date()
    var periodTo: Date = Date()
    var isUploading: Bool = false
    var uploadProgress: Double = 0

    // MARK: - UI State

    var isLoading: Bool = false
    var isReconciling: Bool = false
    var isProcessing: Bool = false
    var showUploadSheet: Bool = false
    var showUnlockSheet: Bool = false
    var unlockPassword: String = ""
    var errorMessage: String?
    var successMessage: String?

    // MARK: - Polling

    private var parsePollingTimer: Timer?

    func startParsePollingIfNeeded(statementId: String) {
        guard activeStatement?.status?.lowercased() == "parsing" else { return }
        stopParsePolling()
        parsePollingTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                await self.pollStatement(id: statementId)
            }
        }
    }

    func stopParsePolling() {
        parsePollingTimer?.invalidate()
        parsePollingTimer = nil
    }

    @MainActor
    private func pollStatement(id: String) async {
        do {
            let updated = try await repository.fetchStatement(id: id)
            activeStatement = updated
            reconciliationResult = updated.reconciliation
            if updated.status?.lowercased() != "parsing" {
                stopParsePolling()
                // Refresh entries now that parsing is done
                parsedEntries = try await repository.fetchEntries(statementId: id)
                updateStatementInList(updated)
            }
        } catch {
            // Polling errors are non-fatal; stop polling on repeated failures
        }
    }

    // MARK: - Private

    private let repository = ReconciliationRepository.shared

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    // MARK: - Filtered Accounts

    var filteredAccounts: [Account] {
        guard !selectedSubType.isEmpty else { return accounts }
        return accounts.filter { $0.subType?.lowercased() == selectedSubType.lowercased() }
    }

    // MARK: - Load

    @MainActor
    func loadInitial() async {
        isLoading = true
        errorMessage = nil

        // Load each resource independently so one failure doesn't block the rest
        async let stmts = repository.fetchStatements()
        async let accts = repository.fetchAccounts()
        async let subTypes = repository.fetchAccountSubTypes()
        async let cats = repository.fetchCategories()

        do { statements = try await stmts } catch {
            errorMessage = error.localizedDescription
        }
        do { accounts = try await accts } catch { /* non-fatal */ }
        do { accountSubTypes = try await subTypes } catch { /* non-fatal */ }
        do { categories = try await cats } catch { /* non-fatal */ }

        isLoading = false
    }

    @MainActor
    func refreshStatements() async {
        errorMessage = nil
        do {
            statements = try await repository.fetchStatements()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Upload

    @MainActor
    func uploadStatement(fileData: Data, filename: String) async {
        guard !selectedAccountId.isEmpty else {
            errorMessage = "Please select an account."
            return
        }
        isUploading = true
        errorMessage = nil
        let mimeType = filename.lowercased().hasSuffix(".pdf") ? "application/pdf" : "text/csv"
        do {
            let response = try await repository.uploadStatement(
                fileData: fileData,
                filename: filename,
                mimeType: mimeType,
                accountId: selectedAccountId,
                periodFrom: Self.dateFormatter.string(from: periodFrom),
                periodTo: Self.dateFormatter.string(from: periodTo)
            )
            // Backend returns a lightweight response; try to refetch the full statement
            // but don't fail the whole upload if the refetch/decode fails
            if let stmtId = response.statementId {
                if let fullStatement = try? await repository.fetchStatement(id: stmtId) {
                    statements.insert(fullStatement, at: 0)
                } else {
                    // Refetch failed (likely decode issue) — refresh the whole list instead
                    await refreshStatements()
                }
            } else {
                // No statement ID returned — refresh the whole list
                await refreshStatements()
            }
            showUploadSheet = false
            successMessage = "Statement uploaded successfully."
            resetUploadForm()
        } catch {
            errorMessage = error.localizedDescription
        }
        isUploading = false
    }

    private func resetUploadForm() {
        selectedSubType = ""
        selectedAccountId = ""
        periodFrom = Date()
        periodTo = Date()
    }

    // MARK: - Statement Detail

    @MainActor
    func loadStatement(id: String) async {
        isLoading = true
        errorMessage = nil

        // Load statement and entries separately so one failure doesn't block the other
        do {
            activeStatement = try await repository.fetchStatement(id: id)
            reconciliationResult = activeStatement?.reconciliation
        } catch {
            errorMessage = error.localizedDescription
        }

        do {
            parsedEntries = try await repository.fetchEntries(statementId: id)
        } catch {
            // Non-fatal: statement header may still display
            if errorMessage == nil {
                errorMessage = "Failed to load entries: \(error.localizedDescription)"
            }
        }

        isLoading = false

        // Start polling if the statement is currently being parsed
        startParsePollingIfNeeded(statementId: id)
    }

    // MARK: - Reconcile

    @MainActor
    func reconcile(statementId: String) async {
        isReconciling = true
        errorMessage = nil
        do {
            _ = try await repository.reconcile(statementId: statementId)
            // Backend returns raw reconcile results; refetch the full statement
            let updated = try await repository.fetchStatement(id: statementId)
            activeStatement = updated
            reconciliationResult = updated.reconciliation
            updateStatementInList(updated)
            successMessage = "Reconciliation complete."
        } catch {
            errorMessage = error.localizedDescription
        }
        isReconciling = false
    }

    // MARK: - Add Missing to Ledger

    @MainActor
    func addMissingToLedger(statementId: String, entryIndices: [Int]? = nil) async {
        isProcessing = true
        errorMessage = nil
        do {
            // If no indices specified, send all missing entry indices
            let indices = entryIndices ?? {
                guard let missing = reconciliationResult?.missing, missing > 0 else { return [Int]() }
                return Array(0..<missing)
            }()
            let response = try await repository.addMissingToLedger(statementId: statementId, entryIndices: indices)
            // Refetch the full statement to update UI
            let updated = try await repository.fetchStatement(id: statementId)
            activeStatement = updated
            updateStatementInList(updated)
            successMessage = response.message ?? "Missing entries added to ledger."
        } catch {
            errorMessage = error.localizedDescription
        }
        isProcessing = false
    }

    // MARK: - Re-audit

    @MainActor
    func reaudit(statementId: String) async {
        isProcessing = true
        errorMessage = nil
        do {
            _ = try await repository.reaudit(statementId: statementId)
            // Backend returns lightweight response; refetch full statement
            let updated = try await repository.fetchStatement(id: statementId)
            activeStatement = updated
            reconciliationResult = updated.reconciliation
            updateStatementInList(updated)
            successMessage = "Re-audit started."
        } catch {
            errorMessage = error.localizedDescription
        }
        isProcessing = false
    }

    // MARK: - Unlock

    @MainActor
    func unlock(statementId: String) async {
        guard !unlockPassword.isEmpty else {
            errorMessage = "Please enter the PDF password."
            return
        }
        isProcessing = true
        errorMessage = nil
        do {
            _ = try await repository.unlock(statementId: statementId, password: unlockPassword)
            // Backend returns lightweight response; refetch full statement
            let updated = try await repository.fetchStatement(id: statementId)
            activeStatement = updated
            parsedEntries = updated.parsedEntries ?? []
            updateStatementInList(updated)
            showUnlockSheet = false
            unlockPassword = ""
            successMessage = "Statement unlocked and parsing."
        } catch {
            errorMessage = error.localizedDescription
        }
        isProcessing = false
    }

    // MARK: - Entry Category Update

    @MainActor
    func updateEntryCategory(statementId: String, index: Int, categoryId: String?, categoryName: String?) async {
        errorMessage = nil
        do {
            let response = try await repository.updateEntry(
                statementId: statementId,
                index: index,
                categoryId: categoryId,
                categoryName: categoryName
            )
            // Update the entry in-place if we got one back
            if let updatedEntry = response.entry, let entryIndex = response.entryIndex, entryIndex < parsedEntries.count {
                parsedEntries[entryIndex] = updatedEntry
            }
            // Also refetch the full statement to stay in sync
            let updated = try await repository.fetchStatement(id: statementId)
            activeStatement = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Bulk Categorize

    @MainActor
    func bulkCategorize(statementId: String, categoryId: String) async {
        isProcessing = true
        errorMessage = nil
        do {
            // Build updates array for all current entries
            let updates = parsedEntries.enumerated().map { index, _ in
                BulkCategorizeEntry(entryIndex: index, categoryId: categoryId, subcategoryId: nil)
            }
            _ = try await repository.bulkCategorize(statementId: statementId, updates: updates)
            // Refetch the full statement to get updated entries
            let updated = try await repository.fetchStatement(id: statementId)
            activeStatement = updated
            parsedEntries = updated.parsedEntries ?? parsedEntries
            successMessage = "All entries categorized."
        } catch {
            errorMessage = error.localizedDescription
        }
        isProcessing = false
    }

    // MARK: - Approve / Reject

    @MainActor
    func approveStatement(id: String) async {
        isProcessing = true
        errorMessage = nil
        do {
            _ = try await repository.approveStatement(id: id)
            // Backend returns message response; refetch the full statement
            let updated = try await repository.fetchStatement(id: id)
            activeStatement = updated
            updateStatementInList(updated)
            successMessage = "Statement approved."
        } catch {
            errorMessage = error.localizedDescription
        }
        isProcessing = false
    }

    @MainActor
    func rejectStatement(id: String) async {
        isProcessing = true
        errorMessage = nil
        do {
            _ = try await repository.rejectStatement(id: id)
            // Backend returns message response; refetch the full statement
            let updated = try await repository.fetchStatement(id: id)
            activeStatement = updated
            updateStatementInList(updated)
            successMessage = "Statement rejected."
        } catch {
            errorMessage = error.localizedDescription
        }
        isProcessing = false
    }

    // MARK: - Delete

    @MainActor
    func deleteStatement(id: String) async {
        errorMessage = nil
        do {
            _ = try await repository.deleteStatement(id: id)
            statements.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    func accountName(for id: String?) -> String {
        guard let id else { return "Unknown" }
        return accounts.first(where: { $0.id == id })?.name ?? "Unknown"
    }

    func categoryName(for id: String?) -> String {
        guard let id else { return "Uncategorized" }
        return categories.first(where: { $0.id == id })?.name ?? "Uncategorized"
    }

    func subcategories(for categoryId: String?) -> [Category] {
        guard let categoryId else { return [] }
        return categories.first(where: { $0.id == categoryId })?.children ?? []
    }

    private func updateStatementInList(_ statement: Statement) {
        if let idx = statements.firstIndex(where: { $0.id == statement.id }) {
            statements[idx] = statement
        }
    }
}
