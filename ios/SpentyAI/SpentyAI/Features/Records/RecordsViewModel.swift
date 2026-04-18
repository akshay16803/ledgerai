import Foundation
import os

@Observable
final class RecordsViewModel {

    // MARK: - Tab

    enum Tab: String, CaseIterable {
        case emailRecords = "Email Records"
        case receipts = "Receipts"
    }

    // MARK: - Data

    var records: [Record] = []
    var receipts: [Receipt] = []

    // MARK: - State

    var isLoading = false
    var isRefreshing = false
    var errorMessage: String?
    var searchText = ""
    var selectedTab: Tab = .emailRecords
    var showDeleteConfirm = false
    var deletingRecordId: String?
    var deletingReceiptId: String?

    // MARK: - Computed

    var filteredRecords: [Record] {
        guard !searchText.isEmpty else { return records }
        let query = searchText.lowercased()
        return records.filter { record in
            (record.subject?.lowercased().contains(query) ?? false) ||
            (record.sender?.lowercased().contains(query) ?? false)
        }
    }

    // MARK: - Private

    private let repo = RecordsRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "records")

    // MARK: - Methods

    @MainActor
    func loadAll() async {
        isLoading = true
        errorMessage = nil

        async let recordsTask: () = loadRecords()
        async let receiptsTask: () = loadReceipts()
        _ = await (recordsTask, receiptsTask)

        isLoading = false
    }

    @MainActor
    func loadRecords() async {
        do {
            let result = try await repo.getRecords()
            records = result.items
        } catch {
            errorMessage = "Failed to load email records."
            logger.error("Load records error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func loadReceipts() async {
        do {
            let result = try await repo.getReceipts()
            receipts = result.items
        } catch {
            errorMessage = "Failed to load receipts."
            logger.error("Load receipts error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func searchRecords() async {
        guard !searchText.isEmpty else {
            await loadRecords()
            return
        }

        do {
            records = try await repo.searchRecords(query: searchText)
        } catch {
            logger.error("Search records error: \(error.localizedDescription)")
        }
    }

    @MainActor
    func deleteRecord(_ id: String) async {
        do {
            try await repo.deleteRecord(id)
            records.removeAll { $0.archiveId == id }
            logger.info("Deleted record: \(id)")
        } catch {
            errorMessage = "Failed to delete record."
            logger.error("Delete record error: \(error.localizedDescription)")
        }

        showDeleteConfirm = false
        deletingRecordId = nil
    }

    @MainActor
    func deleteReceipt(_ id: String) async {
        do {
            try await repo.deleteReceipt(id)
            receipts.removeAll { $0.receiptId == id }
            logger.info("Deleted receipt: \(id)")
        } catch {
            errorMessage = "Failed to delete receipt."
            logger.error("Delete receipt error: \(error.localizedDescription)")
        }

        showDeleteConfirm = false
        deletingReceiptId = nil
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        await loadAll()
        isRefreshing = false
    }
}
