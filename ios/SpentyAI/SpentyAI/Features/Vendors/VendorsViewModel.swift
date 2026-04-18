import Foundation
import os

@Observable
final class VendorsViewModel {

    // MARK: - Tab

    enum Tab: String, CaseIterable {
        case vendors = "Vendors"
        case creditors = "Creditors"
        case aging = "Aging"
        case purchasesByVendor = "By Vendor"
    }

    // MARK: - Data

    var vendors: [Vendor] = []
    var creditors: [CreditorItem] = []
    var billAging: BillAgingReport?
    var purchasesByVendor: [PurchasesByVendorItem] = []

    // MARK: - State

    var isLoading = false
    var errorMessage: String?
    var searchText = ""
    var selectedTab: Tab = .vendors

    // MARK: - Sheet State

    var showAddVendor = false
    var showEditVendor: Vendor?
    var showDeleteConfirm: Vendor?

    // MARK: - Private

    private let vendorRepo = VendorRepository()
    private let billRepo = BillRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "vendors")

    // MARK: - Computed

    var filteredVendors: [Vendor] {
        guard !searchText.isEmpty else { return vendors }
        let query = searchText.lowercased()
        return vendors.filter { $0.name.lowercased().contains(query) }
    }

    var filteredCreditors: [CreditorItem] {
        guard !searchText.isEmpty else { return creditors }
        let query = searchText.lowercased()
        return creditors.filter { $0.vendorName.lowercased().contains(query) }
    }

    var filteredPurchasesByVendor: [PurchasesByVendorItem] {
        guard !searchText.isEmpty else { return purchasesByVendor }
        let query = searchText.lowercased()
        return purchasesByVendor.filter { $0.vendorName.lowercased().contains(query) }
    }

    // MARK: - Load All

    @MainActor
    func loadAll() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        async let v: () = loadVendorsInternal()
        async let c: () = loadCreditorsInternal()
        async let a: () = loadBillAgingInternal()
        async let p: () = loadPurchasesByVendorInternal()

        _ = await (v, c, a, p)

        isLoading = false
    }

    // MARK: - Individual Loaders

    @MainActor
    func loadVendors() async {
        isLoading = true
        errorMessage = nil
        await loadVendorsInternal()
        isLoading = false
    }

    @MainActor
    func loadCreditors() async {
        isLoading = true
        errorMessage = nil
        await loadCreditorsInternal()
        isLoading = false
    }

    @MainActor
    func loadBillAging() async {
        isLoading = true
        errorMessage = nil
        await loadBillAgingInternal()
        isLoading = false
    }

    @MainActor
    func loadPurchasesByVendor() async {
        isLoading = true
        errorMessage = nil
        await loadPurchasesByVendorInternal()
        isLoading = false
    }

    // MARK: - CRUD

    @MainActor
    func createVendor(_ vendor: VendorCreate) async -> Bool {
        do {
            let created = try await vendorRepo.createVendor(vendor)
            vendors.insert(created, at: 0)
            return true
        } catch {
            errorMessage = "Failed to create vendor."
            logger.error("Create vendor error: \(error.localizedDescription)")
            return false
        }
    }

    @MainActor
    func updateVendor(_ id: String, _ vendor: VendorCreate) async -> Bool {
        do {
            let updated = try await vendorRepo.updateVendor(id, vendor)
            if let idx = vendors.firstIndex(where: { $0.vendorId == id }) {
                vendors[idx] = updated
            }
            return true
        } catch {
            errorMessage = "Failed to update vendor."
            logger.error("Update vendor error: \(error.localizedDescription)")
            return false
        }
    }

    @MainActor
    func deleteVendor(_ id: String) async -> Bool {
        do {
            try await vendorRepo.deleteVendor(id)
            vendors.removeAll { $0.vendorId == id }
            return true
        } catch {
            errorMessage = "Failed to delete vendor."
            logger.error("Delete vendor error: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Refresh

    @MainActor
    func refresh() async {
        errorMessage = nil

        switch selectedTab {
        case .vendors:
            await loadVendorsInternal()
        case .creditors:
            await loadCreditorsInternal()
        case .aging:
            await loadBillAgingInternal()
        case .purchasesByVendor:
            await loadPurchasesByVendorInternal()
        }
    }

    // MARK: - Private Internals

    @MainActor
    private func loadVendorsInternal() async {
        do {
            let result = try await vendorRepo.getVendors()
            vendors = result.items
        } catch {
            errorMessage = "Failed to load vendors."
            logger.error("Load vendors error: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func loadCreditorsInternal() async {
        do {
            let result = try await billRepo.getCreditors()
            creditors = result.items
        } catch {
            errorMessage = "Failed to load creditors."
            logger.error("Load creditors error: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func loadBillAgingInternal() async {
        do {
            billAging = try await billRepo.getBillAging()
        } catch {
            errorMessage = "Failed to load bill aging."
            logger.error("Load bill aging error: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func loadPurchasesByVendorInternal() async {
        do {
            let result = try await billRepo.getPurchasesByVendor()
            purchasesByVendor = result.items
        } catch {
            errorMessage = "Failed to load purchases by vendor."
            logger.error("Load purchases by vendor error: \(error.localizedDescription)")
        }
    }
}
