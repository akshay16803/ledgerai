import Foundation
import Observation
import SwiftUI

enum RecordsTab: String, CaseIterable {
    case emails = "Emails"
    case receipts = "Receipts"
}

@Observable
final class RecordsViewModel {

    // MARK: - Data

    var records: [Record] = []
    var receipts: [Receipt] = []
    var recordsTotal: Int = 0
    var receiptsTotal: Int = 0

    // MARK: - Tab

    var activeTab: RecordsTab = .emails

    // MARK: - Filters (Emails)

    var searchQuery: String = ""
    var dateFrom: Date? = nil
    var dateTo: Date? = nil
    var amountMin: String = ""
    var amountMax: String = ""

    // MARK: - UI State

    var isLoading: Bool = false
    var isLoadingMore: Bool = false
    var page: Int = 1
    var hasMore: Bool = true

    var receiptsPage: Int = 1
    var receiptsHasMore: Bool = true
    var isLoadingReceipts: Bool = false
    var isLoadingMoreReceipts: Bool = false

    var selectedRecord: Record? = nil
    var errorMessage: String? = nil

    var isDownloadingZip: Bool = false
    var isDownloadingEml: Bool = false

    var shareItem: ShareItem? = nil

    // MARK: - Private

    private let repository = RecordsRepository.shared
    private let pageSize = 30

    private static let queryDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    // MARK: - Record Operations

    @MainActor
    func loadRecords() async {
        isLoading = true
        errorMessage = nil
        page = 1
        do {
            let response = try await fetchRecordsPage(page: 1)
            records = response.records
            recordsTotal = response.total
            hasMore = records.count < recordsTotal
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    func loadMoreRecords() async {
        guard !isLoadingMore, hasMore else { return }
        isLoadingMore = true
        page += 1
        do {
            let response = try await fetchRecordsPage(page: page)
            records.append(contentsOf: response.records)
            hasMore = records.count < recordsTotal
        } catch {
            page -= 1
            errorMessage = error.localizedDescription
        }
        isLoadingMore = false
    }

    @MainActor
    func refreshRecords() async {
        page = 1
        errorMessage = nil
        do {
            let response = try await fetchRecordsPage(page: 1)
            records = response.records
            recordsTotal = response.total
            hasMore = records.count < recordsTotal
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func searchRecords() async {
        guard !searchQuery.isEmpty else {
            await refreshRecords()
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            let response = try await repository.searchRecords(query: searchQuery)
            records = response.records
            recordsTotal = response.total
            hasMore = false
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    func deleteRecord(id: String) async {
        do {
            _ = try await repository.deleteRecord(id: id)
            records.removeAll { $0.id == id }
            recordsTotal -= 1
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func downloadEml(id: String, subject: String?) async {
        isDownloadingEml = true
        do {
            let data = try await repository.downloadEml(id: id)
            let filename = (subject ?? "email").replacingOccurrences(of: "/", with: "-") + ".eml"
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            try data.write(to: tempURL)
            shareItem = ShareItem(url: tempURL)
        } catch {
            errorMessage = error.localizedDescription
        }
        isDownloadingEml = false
    }

    @MainActor
    func downloadAttachment(recordId: String, index: Int, filename: String?) async {
        do {
            let data = try await repository.downloadAttachment(id: recordId, index: index)
            let name = filename ?? "attachment_\(index)"
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            try data.write(to: tempURL)
            shareItem = ShareItem(url: tempURL)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func downloadZip() async {
        isDownloadingZip = true
        do {
            let data = try await repository.downloadZip()
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("records_export.zip")
            try data.write(to: tempURL)
            shareItem = ShareItem(url: tempURL)
        } catch {
            errorMessage = error.localizedDescription
        }
        isDownloadingZip = false
    }

    // MARK: - Receipt Operations

    @MainActor
    func loadReceipts() async {
        isLoadingReceipts = true
        errorMessage = nil
        receiptsPage = 1
        do {
            let response = try await repository.fetchReceipts(page: 1, limit: pageSize)
            receipts = response.receipts
            receiptsTotal = response.total
            receiptsHasMore = receipts.count < receiptsTotal
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoadingReceipts = false
    }

    @MainActor
    func loadMoreReceipts() async {
        guard !isLoadingMoreReceipts, receiptsHasMore else { return }
        isLoadingMoreReceipts = true
        receiptsPage += 1
        do {
            let response = try await repository.fetchReceipts(page: receiptsPage, limit: pageSize)
            receipts.append(contentsOf: response.receipts)
            receiptsHasMore = receipts.count < receiptsTotal
        } catch {
            receiptsPage -= 1
            errorMessage = error.localizedDescription
        }
        isLoadingMoreReceipts = false
    }

    @MainActor
    func refreshReceipts() async {
        receiptsPage = 1
        errorMessage = nil
        do {
            let response = try await repository.fetchReceipts(page: 1, limit: pageSize)
            receipts = response.receipts
            receiptsTotal = response.total
            receiptsHasMore = receipts.count < receiptsTotal
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func deleteReceipt(id: String) async {
        do {
            _ = try await repository.deleteReceipt(id: id)
            receipts.removeAll { $0.id == id }
            receiptsTotal -= 1
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func downloadReceipt(id: String, filename: String?) async {
        do {
            let data = try await repository.downloadReceipt(id: id)
            let name = filename ?? "receipt_\(id)"
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            try data.write(to: tempURL)
            shareItem = ShareItem(url: tempURL)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func uploadReceipt(imageData: Data, filename: String, mimeType: String) async -> String? {
        do {
            let response = try await repository.uploadReceipt(
                imageData: imageData,
                filename: filename,
                mimeType: mimeType
            )
            await loadReceipts()
            return response.id
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    @MainActor
    func parseReceipt(id: String) async -> Receipt? {
        do {
            let parsed = try await repository.parseReceipt(id: id)
            if let idx = receipts.firstIndex(where: { $0.id == id }) {
                receipts[idx] = parsed
            }
            return parsed
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    @MainActor
    func linkReceiptToTransaction(receiptId: String, transactionId: String) async {
        do {
            let updated = try await repository.linkReceipt(id: receiptId, transactionId: transactionId)
            if let idx = receipts.firstIndex(where: { $0.id == receiptId }) {
                receipts[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func fetchRecordsPage(page: Int) async throws -> RecordListResponse {
        let dateFromStr = dateFrom.map { Self.queryDateFormatter.string(from: $0) }
        let dateToStr = dateTo.map { Self.queryDateFormatter.string(from: $0) }
        let minAmt = Double(amountMin)
        let maxAmt = Double(amountMax)

        return try await repository.fetchRecords(
            page: page,
            limit: pageSize,
            dateFrom: dateFromStr,
            dateTo: dateToStr,
            amountMin: minAmt,
            amountMax: maxAmt
        )
    }
}

// MARK: - Share Item

struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
}
