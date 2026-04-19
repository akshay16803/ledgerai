import Foundation
import SwiftUI

@Observable
final class CustomersViewModel {

    // MARK: - State

    var customers: [Customer] = []
    var searchText: String = ""
    var isLoading = false
    var showForm = false
    var editingCustomer: Customer?
    var selectedCustomer: Customer?
    var customerInvoices: [CustomerInvoice] = []
    var errorMessage: String?

    // MARK: - Computed

    var filteredCustomers: [Customer] {
        guard !searchText.isEmpty else { return customers }
        let query = searchText.lowercased()
        return customers.filter { customer in
            (customer.name?.lowercased().contains(query) ?? false)
                || (customer.email?.lowercased().contains(query) ?? false)
        }
    }

    // MARK: - Dependencies

    private let repository = CustomerRepository()

    // MARK: - Actions

    @MainActor
    func loadCustomers() async {
        isLoading = true
        errorMessage = nil
        do {
            customers = try await repository.fetchAll()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    @MainActor
    func createCustomer(_ payload: CustomerPayload) async -> Bool {
        isLoading = true
        errorMessage = nil
        do {
            let customer = try await repository.create(payload)
            customers.append(customer)
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    @MainActor
    func updateCustomer(id: String, _ payload: CustomerPayload) async -> Bool {
        isLoading = true
        errorMessage = nil
        do {
            let updated = try await repository.update(id: id, payload)
            if let index = customers.firstIndex(where: { $0.id == id }) {
                customers[index] = updated
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
    func deleteCustomer(id: String) async {
        errorMessage = nil
        do {
            try await repository.delete(id: id)
            customers.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func loadCustomerInvoices(id: String) async {
        customerInvoices = []
        do {
            customerInvoices = try await repository.fetchInvoices(customerId: id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    func startCreate() {
        editingCustomer = nil
        showForm = true
    }

    func startEdit(_ customer: Customer) {
        editingCustomer = customer
        showForm = true
    }
}
