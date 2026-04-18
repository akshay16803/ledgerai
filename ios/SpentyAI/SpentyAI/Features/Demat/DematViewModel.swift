import Foundation
import os

@Observable
final class DematViewModel {

    // MARK: - Data

    var statements: [DematStatement] = []
    var overallSummary: DematOverallSummary?

    // MARK: - Loading State

    var isLoading = false
    var isUploading = false
    var isRefreshing = false
    var errorMessage: String?

    // MARK: - Sheet State

    var showUploadSheet = false
    var showDeleteConfirm: DematStatement?
    var selectedAccountId: String = ""

    // MARK: - Private

    private let repo = DematRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "demat")

    // MARK: - Load Methods

    @MainActor
    func loadAll() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        async let statementsTask = repo.getStatements()
        async let summaryTask = repo.getSummary()

        do {
            let (stmts, sum) = try await (statementsTask, summaryTask)
            statements = stmts
            overallSummary = sum
            logger.info("Demat data loaded successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to load demat data: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to load demat data. Please try again."
            logger.error("Unexpected error loading demat data: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func loadStatements() async {
        do {
            statements = try await repo.getStatements()
            logger.info("Statements loaded successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to load statements: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to load statements."
            logger.error("Unexpected error loading statements: \(error.localizedDescription)")
        }
    }

    @MainActor
    func loadSummary() async {
        do {
            overallSummary = try await repo.getSummary()
            logger.info("Summary loaded successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to load summary: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to load summary."
            logger.error("Unexpected error loading summary: \(error.localizedDescription)")
        }
    }

    @MainActor
    func uploadStatement(
        fileData: Data,
        fileName: String,
        mimeType: String
    ) async {
        guard !selectedAccountId.isEmpty else {
            errorMessage = "Please select an account."
            return
        }

        isUploading = true
        errorMessage = nil

        do {
            let statement = try await repo.uploadStatement(
                fileData: fileData,
                fileName: fileName,
                mimeType: mimeType,
                accountId: selectedAccountId
            )
            statements.insert(statement, at: 0)
            showUploadSheet = false
            logger.info("Statement uploaded successfully")
            await loadSummary()
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to upload statement: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to upload statement. Please try again."
            logger.error("Unexpected error uploading statement: \(error.localizedDescription)")
        }

        isUploading = false
    }

    @MainActor
    func deleteStatement(_ id: String) async {
        isLoading = true
        errorMessage = nil

        do {
            try await repo.deleteStatement(id)
            statements.removeAll { $0.statementId == id }
            showDeleteConfirm = nil
            logger.info("Statement deleted successfully")
            await loadSummary()
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to delete statement: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to delete statement. Please try again."
            logger.error("Unexpected error deleting statement: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        errorMessage = nil

        async let statementsTask = repo.getStatements()
        async let summaryTask = repo.getSummary()

        do {
            let (stmts, sum) = try await (statementsTask, summaryTask)
            statements = stmts
            overallSummary = sum
            logger.info("Demat data refreshed successfully")
        } catch let error as APIError {
            errorMessage = error.errorDescription
            logger.error("Failed to refresh demat data: \(error.localizedDescription)")
        } catch {
            errorMessage = "Failed to refresh. Please try again."
            logger.error("Unexpected error refreshing demat data: \(error.localizedDescription)")
        }

        isRefreshing = false
    }
}
