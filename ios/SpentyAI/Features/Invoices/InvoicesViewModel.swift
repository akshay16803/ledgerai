import Foundation
import os

@Observable
final class InvoicesViewModel {

    // MARK: - Data

    var invoices: [Invoice] = []
    var totalCount: Int = 0
    var settings: AppSettings?

    // MARK: - Loading State

    var isLoading = false
    var isRefreshing = false
    var isLoadingMore = false
    var errorMessage: String?
    var isSaving = false

    // MARK: - Filter

    var statusFilter: String? = nil

    // MARK: - Sheet State

    var showNewInvoice = false
    var showEditInvoice: Invoice?
    var showPreview: Invoice?
    var showRecordPayment: Invoice?
    var showDeleteConfirm: Invoice?

    // MARK: - Computed

    var needsSetup: Bool {
        guard let settings else { return true }
        return (settings.firmName ?? "").trimmingCharacters(in: .whitespaces).isEmpty
    }

    var isIndia: Bool {
        CountryConfig.usesExistingForms(code: settings?.businessCountry ?? "")
    }

    var currencyCode: String {
        if let country = settings?.businessCountry,
           let config = CountryConfig.config(for: country) {
            return config.currency
        }
        return settings?.baseCurrency ?? "INR"
    }

    var hasMore: Bool {
        invoices.count < totalCount
    }

    // MARK: - Private

    private let invoiceRepo = InvoiceRepository()
    private let settingsRepo = SettingsRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "invoices")
    private let pageSize = 20

    // MARK: - Methods

    @MainActor
    func loadSettings() async {
        do {
            settings = try await settingsRepo.getSettings()
        } catch {
            logger.error("Failed to load settings: \(error.localizedDescription)")
        }
    }

    @MainActor
    func loadInvoices() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            let result = try await invoiceRepo.getInvoices(
                status: statusFilter,
                limit: pageSize,
                skip: 0
            )
            invoices = result.items
            totalCount = result.total
        } catch {
            errorMessage = "Failed to load invoices."
            logger.error("Load invoices error: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func loadMore() async {
        guard !isLoadingMore, hasMore else { return }
        isLoadingMore = true

        do {
            let result = try await invoiceRepo.getInvoices(
                status: statusFilter,
                limit: pageSize,
                skip: invoices.count
            )
            invoices.append(contentsOf: result.items)
            totalCount = result.total
        } catch {
            logger.error("Load more error: \(error.localizedDescription)")
        }

        isLoadingMore = false
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        do {
            let result = try await invoiceRepo.getInvoices(
                status: statusFilter,
                limit: pageSize,
                skip: 0
            )
            invoices = result.items
            totalCount = result.total
        } catch {
            logger.error("Refresh error: \(error.localizedDescription)")
        }
        isRefreshing = false
    }

    @MainActor
    func filterByStatus(_ status: String?) {
        statusFilter = status
        Task { await loadInvoices() }
    }

    @MainActor
    func deleteInvoice(_ invoice: Invoice) async -> Bool {
        do {
            try await invoiceRepo.deleteInvoice(invoice.invoiceId)
            invoices.removeAll { $0.invoiceId == invoice.invoiceId }
            totalCount = max(0, totalCount - 1)
            return true
        } catch {
            errorMessage = "Failed to delete invoice."
            logger.error("Delete error: \(error.localizedDescription)")
            return false
        }
    }

    func statusType(for invoice: Invoice) -> StatusType {
        switch invoice.paymentStatus?.lowercased() {
        case "paid": return .paid
        case "partial": return .partial
        default: return .unpaid
        }
    }
}
