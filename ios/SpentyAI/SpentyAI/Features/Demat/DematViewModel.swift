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
    private let accountRepo = AccountRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "demat")

    // MARK: - Load Methods

    @MainActor
    func loadAll() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            // Get all accounts, filter investment/demat ones, fetch statements per account
            let accounts = try await accountRepo.getAccounts()
            let investmentAccounts = accounts.filter { account in
                let type = account.accountType.lowercased()
                let subType = (account.subType ?? "").lowercased()
                return type == "investment" || type == "demat" || subType == "demat" || subType == "trading"
            }

            var allStatements: [DematStatement] = []
            for account in investmentAccounts {
                let stmts = try await repo.getStatements(accountId: account.accountId)
                allStatements.append(contentsOf: stmts)
            }
            statements = allStatements
            overallSummary = computeSummary(from: allStatements)
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
            overallSummary = computeSummary(from: statements)
            logger.info("Statement uploaded successfully")
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
        // Deleting demat statements — the backend doesn't have a direct delete endpoint
        // for demat. We can reject the statement which effectively removes it.
        isLoading = true
        errorMessage = nil

        do {
            _ = try await repo.rejectStatement(id)
            statements.removeAll { $0.statementId == id }
            showDeleteConfirm = nil
            overallSummary = computeSummary(from: statements)
            logger.info("Statement deleted successfully")
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
        await loadAll()
        isRefreshing = false
    }

    // MARK: - Helpers

    private func computeSummary(from statements: [DematStatement]) -> DematOverallSummary {
        var totalBuy = 0.0
        var totalSell = 0.0
        var totalCharges = 0.0

        for stmt in statements {
            if let summary = stmt.parsedSummary {
                totalBuy += summary.totalBuyValue ?? 0
                totalSell += summary.totalSellValue ?? 0
                totalCharges += summary.totalCharges ?? 0
            }
        }

        return DematOverallSummary(
            totalBuyValue: totalBuy,
            totalSellValue: totalSell,
            totalCharges: totalCharges,
            netPnl: totalSell - totalBuy - totalCharges,
            statementCount: statements.count
        )
    }
}
