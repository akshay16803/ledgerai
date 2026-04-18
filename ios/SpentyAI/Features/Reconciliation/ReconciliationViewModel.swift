import Foundation
import os

@Observable
final class ReconciliationViewModel {

    // MARK: - State

    var statements: [Statement] = []
    var selectedStatement: Statement?
    var isLoading = false
    var isUploading = false
    var isReconciling = false
    var errorMessage: String?

    // Sheet state
    var showUploadSheet = false
    var showPasswordSheet: Statement?
    var showDeleteConfirm: Statement?

    // Upload form state
    var selectedAccountId: String?
    var selectedSubType: String?
    var periodFrom: Date?
    var periodTo: Date?

    // Reconciliation result (cached after reconcile)
    var lastReconciliationResult: ReconciliationResult?

    // MARK: - Private

    private let repository = ReconciliationRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "reconciliation")

    // MARK: - Computed

    var canUpload: Bool {
        selectedAccountId != nil
    }

    // MARK: - Methods

    @MainActor
    func loadStatements() async {
        isLoading = true
        errorMessage = nil

        do {
            statements = try await repository.getStatements()
            logger.info("Loaded \(self.statements.count) statements")
        } catch {
            errorMessage = "Failed to load statements."
            logger.error("Load statements error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func refresh() async {
        errorMessage = nil

        do {
            statements = try await repository.getStatements()
        } catch {
            errorMessage = "Failed to refresh statements."
            logger.error("Refresh statements error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func uploadStatement(data: Data, name: String, mimeType: String) async {
        guard let accountId = selectedAccountId else { return }

        isUploading = true
        errorMessage = nil

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let fromStr = periodFrom.map { dateFormatter.string(from: $0) }
        let toStr = periodTo.map { dateFormatter.string(from: $0) }

        do {
            let statement = try await repository.uploadStatement(
                fileData: data,
                fileName: name,
                mimeType: mimeType,
                accountId: accountId,
                subType: selectedSubType,
                periodFrom: fromStr,
                periodTo: toStr
            )
            statements.insert(statement, at: 0)
            resetUploadForm()
            logger.info("Uploaded statement: \(statement.filename ?? name)")
        } catch {
            errorMessage = "Failed to upload statement."
            logger.error("Upload statement error: \(error.localizedDescription)")
        }

        isUploading = false
    }

    @MainActor
    func deleteStatement(_ id: String) async {
        do {
            try await repository.deleteStatement(id)
            statements.removeAll { $0.statementId == id }
            logger.info("Deleted statement: \(id)")
        } catch {
            errorMessage = "Failed to delete statement."
            logger.error("Delete statement error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func reconcile(_ id: String) async {
        isReconciling = true
        errorMessage = nil

        do {
            let result = try await repository.reconcile(id)
            lastReconciliationResult = result

            // Refresh the statement to get updated status
            if let updated = try? await repository.getStatement(id),
               let index = statements.firstIndex(where: { $0.statementId == id }) {
                statements[index] = updated
                selectedStatement = updated
            }

            logger.info("Reconciled statement \(id): matched=\(result.matchedCount ?? 0)")
        } catch {
            errorMessage = "Failed to reconcile statement."
            logger.error("Reconcile error: \(error.localizedDescription)")
        }

        isReconciling = false
    }

    @MainActor
    func unlockStatement(_ id: String, password: String) async {
        errorMessage = nil

        do {
            let updated = try await repository.unlockStatement(id, password: password)
            if let index = statements.firstIndex(where: { $0.statementId == id }) {
                statements[index] = updated
            }
            showPasswordSheet = nil
            logger.info("Unlocked statement: \(id)")
        } catch {
            errorMessage = "Incorrect password or unlock failed."
            logger.error("Unlock error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func updateEntry(
        statementId: String,
        entryIndex: Int,
        categoryId: String?,
        subcategoryId: String?,
        transactionType: String?
    ) async {
        let update = EntryUpdate(
            categoryId: categoryId,
            subcategoryId: subcategoryId,
            transactionType: transactionType
        )

        do {
            let updated = try await repository.updateEntry(statementId, entryIndex: entryIndex, update: update)
            if let index = statements.firstIndex(where: { $0.statementId == statementId }) {
                statements[index] = updated
            }
            selectedStatement = updated
            logger.info("Updated entry \(entryIndex) for statement \(statementId)")
        } catch {
            errorMessage = "Failed to update entry."
            logger.error("Update entry error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func bulkCategorize(_ id: String, entries: [BulkCategoryEntry]) async {
        errorMessage = nil

        do {
            let updated = try await repository.bulkCategorize(id, entries: entries)
            if let index = statements.firstIndex(where: { $0.statementId == id }) {
                statements[index] = updated
            }
            selectedStatement = updated
            logger.info("Bulk categorized \(entries.count) entries for statement \(id)")
        } catch {
            errorMessage = "Failed to bulk categorize entries."
            logger.error("Bulk categorize error: \(error.localizedDescription)")
        }
    }

    // MARK: - Helpers

    private func resetUploadForm() {
        selectedAccountId = nil
        selectedSubType = nil
        periodFrom = nil
        periodTo = nil
    }
}
