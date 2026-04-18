import Foundation
import SwiftUI

@Observable
final class PastInsightsViewModel {

    // MARK: - State

    var summaries: [TaxSummary] = []
    var availableEmails: [String] = []
    var selectedSummary: TaxSummary?
    var detailTransactions: [TaxSummaryTransaction] = []
    var isLoading = false
    var isCreating = false
    var isLoadingTransactions = false
    var errorMessage = ""
    var showError = false

    // MARK: - Create Form State

    var showCreateForm = false
    var createName = ""
    var createDateFrom = Calendar.current.date(byAdding: .year, value: -1, to: Date()) ?? Date()
    var createDateTo = Date()
    var createSelectedEmail = ""

    // MARK: - Transaction Form State

    var showAddTransaction = false
    var editingTransaction: TaxSummaryTransaction?
    var txnDate = Date()
    var txnDescription = ""
    var txnAmount = ""
    var txnType = "expense"
    var txnCategory = ""

    // MARK: - Share Sheet

    var shareItem: ShareableFile?
    var showShareSheet = false

    // MARK: - Dependencies

    private let repository = PastInsightsRepository.shared

    // MARK: - Date Formatter

    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f
    }()

    // MARK: - Summaries CRUD

    @MainActor
    func loadSummaries() async {
        isLoading = true
        do {
            summaries = try await repository.getSummaries()
        } catch {
            setError(error)
        }
        isLoading = false
    }

    @MainActor
    func refresh() async {
        do {
            summaries = try await repository.getSummaries()
        } catch {
            setError(error)
        }
    }

    @MainActor
    func loadAvailableEmails() async {
        do {
            availableEmails = try await repository.getAvailableEmails()
            if createSelectedEmail.isEmpty, let first = availableEmails.first {
                createSelectedEmail = first
            }
        } catch {
            setError(error)
        }
    }

    @MainActor
    func createSummary() async {
        guard !createName.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter a name for the summary."
            showError = true
            return
        }

        isCreating = true
        let request = CreateTaxSummaryRequest(
            name: createName.trimmingCharacters(in: .whitespaces),
            dateFrom: isoFormatter.string(from: createDateFrom),
            dateTo: isoFormatter.string(from: createDateTo),
            emailAddress: createSelectedEmail
        )

        do {
            let summary = try await repository.createSummary(request)
            summaries.insert(summary, at: 0)

            // Trigger generation
            _ = try? await repository.generateSummary()

            resetCreateForm()
            showCreateForm = false
        } catch {
            setError(error)
        }
        isCreating = false
    }

    @MainActor
    func deleteSummary(at offsets: IndexSet) async {
        let toDelete = offsets.map { summaries[$0] }
        for summary in toDelete {
            do {
                try await repository.deleteSummary(id: summary.id)
                summaries.removeAll { $0.id == summary.id }
            } catch {
                setError(error)
            }
        }
    }

    // MARK: - Detail / Transactions

    @MainActor
    func loadDetail(for summary: TaxSummary) async {
        selectedSummary = summary
        isLoadingTransactions = true
        do {
            let fresh = try await repository.getSummary(id: summary.id)
            selectedSummary = fresh
            if let idx = summaries.firstIndex(where: { $0.id == summary.id }) {
                summaries[idx] = fresh
            }
            detailTransactions = try await repository.getTransactions(summaryId: summary.id)
        } catch {
            setError(error)
        }
        isLoadingTransactions = false
    }

    @MainActor
    func refreshDetail() async {
        guard let summary = selectedSummary else { return }
        await loadDetail(for: summary)
    }

    @MainActor
    func addTransaction() async {
        guard let summaryId = selectedSummary?.id else { return }
        guard !txnDescription.trimmingCharacters(in: .whitespaces).isEmpty,
              let amount = Double(txnAmount) else {
            errorMessage = "Please fill in description and a valid amount."
            showError = true
            return
        }

        let request = AddTransactionRequest(
            date: isoFormatter.string(from: txnDate),
            description: txnDescription.trimmingCharacters(in: .whitespaces),
            amount: amount,
            transactionType: txnType,
            categoryName: txnCategory.isEmpty ? nil : txnCategory
        )

        do {
            let txn = try await repository.addTransaction(summaryId: summaryId, request)
            detailTransactions.insert(txn, at: 0)
            resetTransactionForm()
            showAddTransaction = false
        } catch {
            setError(error)
        }
    }

    @MainActor
    func updateTransaction() async {
        guard let summaryId = selectedSummary?.id,
              let txnId = editingTransaction?.id else { return }

        let request = UpdateTransactionRequest(
            date: isoFormatter.string(from: txnDate),
            description: txnDescription.trimmingCharacters(in: .whitespaces),
            amount: Double(txnAmount),
            transactionType: txnType,
            categoryName: txnCategory.isEmpty ? nil : txnCategory
        )

        do {
            let updated = try await repository.updateTransaction(summaryId: summaryId, txnId: txnId, request)
            if let idx = detailTransactions.firstIndex(where: { $0.id == txnId }) {
                detailTransactions[idx] = updated
            }
            resetTransactionForm()
            editingTransaction = nil
            showAddTransaction = false
        } catch {
            setError(error)
        }
    }

    @MainActor
    func deleteTransaction(_ txn: TaxSummaryTransaction) async {
        guard let summaryId = selectedSummary?.id else { return }
        do {
            try await repository.deleteTransaction(summaryId: summaryId, txnId: txn.id)
            detailTransactions.removeAll { $0.id == txn.id }
        } catch {
            setError(error)
        }
    }

    // MARK: - Export / Download

    @MainActor
    func exportCSV() async {
        guard let summaryId = selectedSummary?.id else { return }
        do {
            let data = try await repository.exportCSV(summaryId: summaryId)
            let name = selectedSummary?.name ?? "tax-summary"
            let sanitized = name.replacingOccurrences(of: " ", with: "-").lowercased()
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(sanitized).csv")
            try data.write(to: tempURL)
            shareItem = ShareableFile(url: tempURL)
            showShareSheet = true
        } catch {
            setError(error)
        }
    }

    @MainActor
    func downloadPDF() async {
        guard let summaryId = selectedSummary?.id else { return }
        do {
            let data = try await repository.downloadPDF(summaryId: summaryId)
            let name = selectedSummary?.name ?? "tax-summary"
            let sanitized = name.replacingOccurrences(of: " ", with: "-").lowercased()
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(sanitized).pdf")
            try data.write(to: tempURL)
            shareItem = ShareableFile(url: tempURL)
            showShareSheet = true
        } catch {
            setError(error)
        }
    }

    // MARK: - Form Helpers

    func startCreate() {
        resetCreateForm()
        showCreateForm = true
    }

    func startAddTransaction() {
        resetTransactionForm()
        editingTransaction = nil
        showAddTransaction = true
    }

    func startEditTransaction(_ txn: TaxSummaryTransaction) {
        editingTransaction = txn
        txnDate = txn.date ?? Date()
        txnDescription = txn.description ?? ""
        txnAmount = txn.amount.map { String(format: "%.2f", $0) } ?? ""
        txnType = txn.transactionType ?? "expense"
        txnCategory = txn.categoryName ?? ""
        showAddTransaction = true
    }

    func dismissError() {
        showError = false
        errorMessage = ""
    }

    // MARK: - Private

    private func resetCreateForm() {
        createName = ""
        createDateFrom = Calendar.current.date(byAdding: .year, value: -1, to: Date()) ?? Date()
        createDateTo = Date()
        createSelectedEmail = availableEmails.first ?? ""
    }

    private func resetTransactionForm() {
        txnDate = Date()
        txnDescription = ""
        txnAmount = ""
        txnType = "expense"
        txnCategory = ""
    }

    @MainActor
    private func setError(_ error: Error) {
        if let apiError = error as? APIError {
            errorMessage = apiError.localizedDescription
        } else {
            errorMessage = error.localizedDescription
        }
        showError = true
    }
}

// MARK: - Shareable File

struct ShareableFile: Identifiable {
    let id = UUID()
    let url: URL
}
