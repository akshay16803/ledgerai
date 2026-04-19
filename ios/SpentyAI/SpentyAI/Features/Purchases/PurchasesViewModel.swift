import Foundation
import SwiftUI

@Observable
final class PurchasesViewModel {

    // MARK: - State

    var bills: [Bill] = []
    var stats: BillStatsResponse?
    var creditors: [CreditorSummary] = []
    var aging: [AgingBucket] = []
    var purchasesByVendor: [VendorPurchaseSummary] = []

    var isLoading = false
    var showForm = false
    var editingBill: Bill?
    var nextNumber: String = ""

    var vendors: [Vendor] = []
    var accounts: [Account] = []

    var errorMessage: String?

    var searchText: String = ""
    var statusFilter: String = "all"

    var showPaymentSheet = false
    var paymentBill: Bill?

    var showPreview = false
    var previewBillId: String?
    var pdfData: Data?

    var showUploadParser = false
    var parsedBill: BillParseResponse?
    var isUploading = false

    // MARK: - Computed

    var filteredBills: [Bill] {
        var result = bills

        if statusFilter != "all" {
            result = result.filter { ($0.paymentStatus?.lowercased() ?? "") == statusFilter.lowercased() }
        }

        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter { bill in
                (bill.billNumber?.lowercased().contains(query) ?? false)
                    || (bill.vendorName?.lowercased().contains(query) ?? false)
            }
        }

        return result
    }

    static let statusOptions = ["all", "unpaid", "partial", "paid", "overdue"]

    // MARK: - Dependencies

    private let repository = PurchaseRepository.shared

    // MARK: - Load

    @MainActor
    func loadBills() async {
        isLoading = true
        errorMessage = nil
        do {
            bills = try await repository.fetchBills()
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
    func loadCreditors() async {
        do {
            creditors = try await repository.fetchCreditors()
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
    func loadPurchasesByVendor() async {
        do {
            purchasesByVendor = try await repository.fetchPurchasesByVendor()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func loadAll() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadBills() }
            group.addTask { await self.loadStats() }
            group.addTask { await self.loadVendors() }
            group.addTask { await self.loadAccounts() }
            group.addTask { await self.loadCreditors() }
            group.addTask { await self.loadAging() }
        }
    }

    // MARK: - CRUD

    @MainActor
    func createBill(_ payload: BillPayload) async -> Bool {
        isLoading = true
        errorMessage = nil
        do {
            let bill = try await repository.createBill(payload)
            bills.insert(bill, at: 0)
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    @MainActor
    func updateBill(id: String, _ payload: BillPayload) async -> Bool {
        isLoading = true
        errorMessage = nil
        do {
            let updated = try await repository.updateBill(id: id, payload)
            if let index = bills.firstIndex(where: { $0.id == id }) {
                bills[index] = updated
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
    func deleteBill(id: String) async {
        errorMessage = nil
        do {
            try await repository.deleteBill(id: id)
            bills.removeAll { $0.id == id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Actions

    @MainActor
    func recordPayment(id: String, _ payload: RecordBillPaymentPayload) async -> Bool {
        errorMessage = nil
        do {
            let updated = try await repository.recordPayment(id: id, payload)
            if let index = bills.firstIndex(where: { $0.id == id }) {
                bills[index] = updated
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
            if let index = bills.firstIndex(where: { $0.id == id }) {
                bills[index] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func duplicateBill(id: String) async {
        errorMessage = nil
        do {
            let duplicate = try await repository.duplicateBill(id: id)
            bills.insert(duplicate, at: 0)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Next Number

    @MainActor
    func getNextNumber() async {
        do {
            nextNumber = try await repository.getNextNumber()
        } catch {
            nextNumber = ""
        }
    }

    // MARK: - PDF

    @MainActor
    func loadBillPDF(id: String) async {
        pdfData = nil
        do {
            pdfData = try await repository.fetchBillPDF(id: id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Upload & Parse

    @MainActor
    func uploadAndParseBill(data: Data, filename: String, mimeType: String) async {
        isUploading = true
        parsedBill = nil
        errorMessage = nil
        do {
            parsedBill = try await repository.uploadAndParseBill(data: data, filename: filename, mimeType: mimeType)
        } catch {
            errorMessage = error.localizedDescription
        }
        isUploading = false
    }

    // MARK: - Supporting Data

    @MainActor
    func loadVendors() async {
        do {
            vendors = try await repository.fetchVendors()
        } catch {
            // Non-critical; silently fail
        }
    }

    @MainActor
    func loadAccounts() async {
        do {
            accounts = try await repository.fetchAccounts()
        } catch {
            // Non-critical; silently fail
        }
    }

    // MARK: - Helpers

    func startCreate() {
        editingBill = nil
        showForm = true
    }

    func startEdit(_ bill: Bill) {
        editingBill = bill
        showForm = true
    }

    func startPayment(_ bill: Bill) {
        paymentBill = bill
        showPaymentSheet = true
    }

    func startPreview(_ bill: Bill) {
        previewBillId = bill.id
        showPreview = true
    }

    func startUpload() {
        parsedBill = nil
        showUploadParser = true
    }
}
