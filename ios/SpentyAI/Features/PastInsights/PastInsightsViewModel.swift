import Foundation
import os

@Observable
final class PastInsightsViewModel {

    // MARK: - Data

    var summaries: [TaxSummary] = []

    // MARK: - State

    var isLoading = false
    var isRefreshing = false
    var isCreating = false
    var errorMessage: String?
    var showCreateForm = false
    var showDeleteConfirm: TaxSummary?

    // MARK: - Create Form State

    var formName = ""
    var formDateFrom = Date()
    var formDateTo = Date()
    var formSelectedEmail = ""
    var formSelectedProvider = ""

    var isFormValid: Bool {
        !formName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !formSelectedEmail.trimmingCharacters(in: .whitespaces).isEmpty &&
        !formSelectedProvider.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Private

    private let repo = PastInsightsRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "past-insights")
    private var pollingTask: Task<Void, Never>?

    private let dateFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f
    }()

    // MARK: - Methods

    @MainActor
    func loadSummaries() async {
        isLoading = true
        errorMessage = nil

        do {
            summaries = try await repo.getSummaries()
            startPollingIfNeeded()
        } catch {
            errorMessage = "Failed to load insights."
            logger.error("Load summaries error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func createSummary() async {
        isCreating = true

        let body = TaxSummaryCreate(
            name: formName.trimmingCharacters(in: .whitespaces),
            dateFrom: dateFormatter.string(from: formDateFrom),
            dateTo: dateFormatter.string(from: formDateTo),
            emailAddress: formSelectedEmail.trimmingCharacters(in: .whitespaces),
            provider: formSelectedProvider
        )

        do {
            let created = try await repo.createSummary(body)
            summaries.insert(created, at: 0)
            resetForm()
            showCreateForm = false
            startPollingIfNeeded()
            logger.info("Created summary: \(created.summaryId)")
        } catch {
            errorMessage = "Failed to create insight."
            logger.error("Create summary error: \(error.localizedDescription)")
        }

        isCreating = false
    }

    @MainActor
    func deleteSummary(_ id: String) async {
        do {
            try await repo.deleteSummary(id)
            summaries.removeAll { $0.summaryId == id }
            logger.info("Deleted summary: \(id)")
        } catch {
            errorMessage = "Failed to delete insight."
            logger.error("Delete summary error: \(error.localizedDescription)")
        }

        showDeleteConfirm = nil
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        await loadSummaries()
        isRefreshing = false
    }

    // MARK: - Polling

    private func startPollingIfNeeded() {
        let hasProcessing = summaries.contains { $0.status == "processing" }
        guard hasProcessing else {
            pollingTask?.cancel()
            pollingTask = nil
            return
        }

        guard pollingTask == nil else { return }

        pollingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                guard !Task.isCancelled else { break }
                await self?.pollProcessingSummaries()
            }
        }
    }

    @MainActor
    private func pollProcessingSummaries() async {
        do {
            summaries = try await repo.getSummaries()
            let hasProcessing = summaries.contains { $0.status == "processing" }
            if !hasProcessing {
                pollingTask?.cancel()
                pollingTask = nil
            }
        } catch {
            logger.error("Polling error: \(error.localizedDescription)")
        }
    }

    // MARK: - Helpers

    private func resetForm() {
        formName = ""
        formDateFrom = Date()
        formDateTo = Date()
        formSelectedEmail = ""
        formSelectedProvider = ""
    }

    deinit {
        pollingTask?.cancel()
    }
}
