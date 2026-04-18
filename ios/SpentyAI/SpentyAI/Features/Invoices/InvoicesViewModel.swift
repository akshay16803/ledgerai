import Foundation
import SwiftUI

@Observable
final class InvoicesViewModel {

    // MARK: - State

    var invoices: [Invoice] = []
    var stats: InvoiceStats?
    var debtors: [InvoiceDebtor] = []
    var aging: [InvoiceAgingBucket] = []
    var salesByCustomer: [InvoiceSalesByCustomer] = []
    var isLoading = false
    var showForm = false
    var editingInvoice: Invoice?
    var selectedInvoice: Invoice?
    var nextNumber: String = ""
    var customers: [Customer] = []
    var accounts: [Account] = []
    var errorMessage: String?

    // MARK: - Filters

    var searchText: String = ""
    var statusFilter: StatusFilter = .all

    enum StatusFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case paid = "paid"
        case partial = "partial"
        case unpaid = "unpaid"
        case overdue = "overdue"
        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .all: return "All"
            case .paid: return "Paid"
            case .partial: return "Partial"
            case .unpaid: return "Unpaid"
            case .overdue: return "Overdue"
            }
        }
    }

    // MARK: - Computed

    var filteredInvoices: [Invoice] {
        var result = invoices

        if statusFilter != .all {
            result = result.filter { ($0.paymentStatus ?? "").lowercased() == statusFilter.rawValue }
        }

        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter { invoice in
                (invoice.invoiceNumber ?? "").lowercased().contains(query)
                    || (invoice.customerName ?? "").lowercased().contains(query)
            }
        }

        return result
    }

    // MARK: - Dependencies

    private let repository = InvoiceRepository()

    // MARK: - Load Data

    @MainActor
    func loadInvoices() async {
        isLoading = true
        errorMessage = nil
        do {
            invoices = try await repository.fetchAll()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    func loadStats() async {
        do {
            stats = try await repository.fetchStats()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func loadDebtors() async {
        do {
            debtors = try await repository.fetchDebtors()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func loadAging() async {
        do {
            aging = try await repository.fetchAging()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func loadSalesByCustomer() async {
        do {
            salesByCustomer = try await repository.fetchSalesByCustomer()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func loadAll() async {
        isLoading = true
        errorMessage = nil
        async let inv: () = loadInvoicesOnly()
        async let st: () = loadStats()
        async let dbt: () = loadDebtors()
        async let ag: () = loadAging()
        _ = await (inv, st, dbt, ag)
        isLoading = false
    }

    @MainActor
    private func loadInvoicesOnly() async {
        do {
            invoices = try await repository.fetchAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - CRUD

    @MainActor
    func createInvoice(_ payload: InvoicePayload) async -> Bool {
        isLoading = true
        errorMessage = nil
        do {
            let invoice = try await repository.create(payload)
            invoices.insert(invoice, at: 0)
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    @MainActor
    func updateInvoice(id: String, _ payload: InvoicePayload) async -> Bool {
        isLoading = true
        errorMessage = nil
        do {
            let updated = try await repository.update(id: id, payload)
            if let index = invoices.firstIndex(where: { $0.id == id }) {
                invoices[index] = updated
            }
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    @MainActor
    func deleteInvoice(id: String) async {
        errorMessage = nil
        do {
            try await repository.delete(id: id)
            invoices.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Actions

    @MainActor
    func recordPayment(id: String, _ payload: RecordPaymentPayload) async -> Bool {
        errorMessage = nil
        do {
            let updated = try await repository.recordPayment(id: id, payload)
            if let index = invoices.firstIndex(where: { $0.id == id }) {
                invoices[index] = updated
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    @MainActor
    func markPaid(id: String) async {
        errorMessage = nil
        do {
            let updated = try await repository.markPaid(id: id)
            if let index = invoices.firstIndex(where: { $0.id == id }) {
                invoices[index] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func duplicateInvoice(id: String) async {
        errorMessage = nil
        do {
            let duplicate = try await repository.duplicate(id: id)
            invoices.insert(duplicate, at: 0)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func getNextNumber() async {
        do {
            let response = try await repository.fetchNextNumber()
            nextNumber = response.nextNumber ?? ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - PDF

    func loadInvoicePDF(id: String) async throws -> Data {
        try await repository.fetchPDF(id: id)
    }

    // MARK: - Supporting Data

    @MainActor
    func loadCustomers() async {
        do {
            customers = try await repository.fetchCustomers()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func loadAccounts() async {
        do {
            accounts = try await repository.fetchAccounts()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    func startCreate() {
        editingInvoice = nil
        showForm = true
    }

    func startEdit(_ invoice: Invoice) {
        editingInvoice = invoice
        showForm = true
    }
}
