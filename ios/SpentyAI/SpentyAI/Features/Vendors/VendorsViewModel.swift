import Foundation
import SwiftUI

@Observable
final class VendorsViewModel {

    // MARK: - State

    var vendors: [Vendor] = []
    var searchText = ""
    var isLoading = false
    var showForm = false
    var editingVendor: Vendor?
    var selectedVendor: Vendor?
    var vendorBills: [VendorBill] = []
    var errorMessage = ""
    var showError = false
    var isLoadingBills = false

    // MARK: - Dependencies

    private let repository = VendorRepository.shared

    // MARK: - Computed

    var filteredVendors: [Vendor] {
        guard !searchText.isEmpty else { return vendors }
        let query = searchText.lowercased()
        return vendors.filter { vendor in
            (vendor.name?.lowercased().contains(query) ?? false) ||
            (vendor.email?.lowercased().contains(query) ?? false) ||
            (vendor.phone?.contains(query) ?? false) ||
            (vendor.gstin?.lowercased().contains(query) ?? false)
        }
    }

    // MARK: - CRUD

    @MainActor
    func loadVendors() async {
        isLoading = true
        do {
            vendors = try await repository.getVendors()
        } catch {
            setError(error)
        }
        isLoading = false
    }

    @MainActor
    func createVendor(name: String, email: String?, phone: String?, gstin: String?, address: String?) async {
        let request = CreateVendorRequest(
            name: name,
            email: email?.nilIfEmpty,
            phone: phone?.nilIfEmpty,
            gstin: gstin?.nilIfEmpty,
            address: address?.nilIfEmpty
        )
        do {
            let vendor = try await repository.createVendor(request)
            vendors.insert(vendor, at: 0)
            showForm = false
        } catch {
            setError(error)
        }
    }

    @MainActor
    func updateVendor(id: String, name: String, email: String?, phone: String?, gstin: String?, address: String?) async {
        let request = CreateVendorRequest(
            name: name,
            email: email?.nilIfEmpty,
            phone: phone?.nilIfEmpty,
            gstin: gstin?.nilIfEmpty,
            address: address?.nilIfEmpty
        )
        do {
            let updated = try await repository.updateVendor(id: id, request)
            if let index = vendors.firstIndex(where: { $0.id == id }) {
                vendors[index] = updated
            }
            if selectedVendor?.id == id {
                selectedVendor = updated
            }
            editingVendor = nil
            showForm = false
        } catch {
            setError(error)
        }
    }

    @MainActor
    func deleteVendor(at offsets: IndexSet) async {
        let toDelete = offsets.map { filteredVendors[$0] }
        for vendor in toDelete {
            do {
                try await repository.deleteVendor(id: vendor.id)
                vendors.removeAll { $0.id == vendor.id }
            } catch {
                setError(error)
            }
        }
    }

    // MARK: - Bills

    @MainActor
    func loadVendorBills(vendorId: String) async {
        isLoadingBills = true
        do {
            vendorBills = try await repository.getVendorBills(vendorId: vendorId)
        } catch {
            setError(error)
        }
        isLoadingBills = false
    }

    // MARK: - Form Helpers

    func startCreate() {
        editingVendor = nil
        showForm = true
    }

    func startEdit(_ vendor: Vendor) {
        editingVendor = vendor
        showForm = true
    }

    func dismissError() {
        showError = false
        errorMessage = ""
    }

    // MARK: - Private

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

// MARK: - Helpers

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
