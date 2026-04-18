import Foundation
import os

@Observable
final class CustomersViewModel {

    // MARK: - Tab

    enum Tab: String, CaseIterable, Identifiable {
        case customers
        case debtors
        case aging
        case salesByCustomer

        var id: String { rawValue }

        var label: String {
            switch self {
            case .customers: "Customers"
            case .debtors: "Debtors"
            case .aging: "Aging"
            case .salesByCustomer: "Sales"
            }
        }
    }

    // MARK: - Data

    var customers: [Customer] = []
    var debtors: [DebtorItem] = []
    var agingReport: AgingReport?
    var salesByCustomer: [SalesByCustomerItem] = []

    // MARK: - State

    var isLoading = false
    var errorMessage: String?
    var searchText = ""
    var selectedTab: Tab = .customers
    var isSaving = false

    // MARK: - Sheet State

    var showAddCustomer = false
    var showEditCustomer: Customer?
    var showDeleteConfirm: Customer?

    // MARK: - Computed

    var filteredCustomers: [Customer] {
        guard !searchText.isEmpty else { return customers }
        let query = searchText.lowercased()
        return customers.filter { $0.name.lowercased().contains(query) }
    }

    // MARK: - Private

    private let customerRepo = CustomerRepository()
    private let invoiceRepo = InvoiceRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "customers")

    // MARK: - Load All

    @MainActor
    func loadAll() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        async let c: () = loadCustomersQuietly()
        async let d: () = loadDebtorsQuietly()
        async let a: () = loadAgingQuietly()
        async let s: () = loadSalesByCustomerQuietly()

        _ = await (c, d, a, s)

        isLoading = false
    }

    // MARK: - Individual Loaders

    @MainActor
    func loadCustomers() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        await loadCustomersQuietly()
        isLoading = false
    }

    @MainActor
    func loadDebtors() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        await loadDebtorsQuietly()
        isLoading = false
    }

    @MainActor
    func loadAging() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        await loadAgingQuietly()
        isLoading = false
    }

    @MainActor
    func loadSalesByCustomer() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        await loadSalesByCustomerQuietly()
        isLoading = false
    }

    // MARK: - Quiet Loaders (no isLoading toggling)

    @MainActor
    private func loadCustomersQuietly() async {
        do {
            let result = try await customerRepo.getCustomers()
            customers = result.items
        } catch {
            errorMessage = "Failed to load customers."
            logger.error("Load customers error: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func loadDebtorsQuietly() async {
        do {
            let result = try await invoiceRepo.getDebtors()
            debtors = result.items
        } catch {
            logger.error("Load debtors error: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func loadAgingQuietly() async {
        do {
            agingReport = try await invoiceRepo.getAging()
        } catch {
            logger.error("Load aging error: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func loadSalesByCustomerQuietly() async {
        do {
            let result = try await invoiceRepo.getSalesByCustomer()
            salesByCustomer = result.items
        } catch {
            logger.error("Load sales by customer error: \(error.localizedDescription)")
        }
    }

    // MARK: - CRUD

    @MainActor
    func createCustomer(_ create: CustomerCreate) async -> Bool {
        isSaving = true
        defer { isSaving = false }

        do {
            let customer = try await customerRepo.createCustomer(create)
            customers.insert(customer, at: 0)
            return true
        } catch {
            errorMessage = "Failed to create customer."
            logger.error("Create customer error: \(error.localizedDescription)")
            return false
        }
    }

    @MainActor
    func updateCustomer(_ id: String, _ update: CustomerCreate) async -> Bool {
        isSaving = true
        defer { isSaving = false }

        do {
            let updated = try await customerRepo.updateCustomer(id, update)
            if let index = customers.firstIndex(where: { $0.customerId == id }) {
                customers[index] = updated
            }
            return true
        } catch {
            errorMessage = "Failed to update customer."
            logger.error("Update customer error: \(error.localizedDescription)")
            return false
        }
    }

    @MainActor
    func deleteCustomer(_ id: String) async -> Bool {
        do {
            try await customerRepo.deleteCustomer(id)
            customers.removeAll { $0.customerId == id }
            return true
        } catch {
            errorMessage = "Failed to delete customer."
            logger.error("Delete customer error: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Refresh

    @MainActor
    func refresh() async {
        async let c: () = loadCustomersQuietly()
        async let d: () = loadDebtorsQuietly()
        async let a: () = loadAgingQuietly()
        async let s: () = loadSalesByCustomerQuietly()

        _ = await (c, d, a, s)
    }
}
