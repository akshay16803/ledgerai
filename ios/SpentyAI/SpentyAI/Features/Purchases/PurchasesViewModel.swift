import Foundation
import os

@Observable
final class PurchasesViewModel {

    // MARK: - State

    var bills: [Bill] = []
    var isLoading = false
    var isRefreshing = false
    var errorMessage: String?
    var statusFilter: String? = nil
    var settings: AppSettings?
    var needsSetup = false

    // MARK: - Sheet States

    var showNewBill = false
    var showEditBill = false
    var showPreview = false
    var showRecordPayment = false
    var showDeleteConfirm = false

    // MARK: - Selection

    var selectedBill: Bill?

    // MARK: - Record Payment Fields

    var paymentAmount: String = ""
    var paymentMethod: String = "bank_transfer"
    var paymentDate: Date = .init()
    var paymentAccountId: String?
    var isRecordingPayment = false

    // MARK: - Delete

    var isDeleting = false

    // MARK: - Private

    private let billRepo = BillRepository()
    private let settingsRepo = SettingsRepository()
    private let logger = Logger(subsystem: "com.spentyai", category: "purchases")

    // MARK: - Computed

    var filteredBills: [Bill] {
        bills
    }

    var isIndia: Bool {
        CountryConfig.usesExistingForms(code: settings?.businessCountry ?? "")
    }

    var currency: String {
        settings?.baseCurrency ?? "INR"
    }

    // MARK: - Load

    @MainActor
    func loadInitialData() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            settings = try await settingsRepo.getSettings()

            if settings?.firmName == nil || settings?.firmName?.isEmpty == true {
                needsSetup = true
                isLoading = false
                return
            }
            needsSetup = false

            let result = try await billRepo.getBills(status: statusFilter)
            bills = result.items
        } catch {
            errorMessage = "Failed to load bills: \(error.localizedDescription)"
            logger.error("Load bills failed: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func refresh() async {
        isRefreshing = true
        errorMessage = nil

        do {
            let result = try await billRepo.getBills(status: statusFilter)
            bills = result.items
        } catch {
            errorMessage = "Failed to refresh bills: \(error.localizedDescription)"
            logger.error("Refresh bills failed: \(error.localizedDescription)")
        }

        isRefreshing = false
    }

    @MainActor
    func applyFilter(_ status: String?) async {
        statusFilter = status
        isLoading = true

        do {
            let result = try await billRepo.getBills(status: statusFilter)
            bills = result.items
        } catch {
            errorMessage = "Failed to filter bills."
            logger.error("Filter bills failed: \(error.localizedDescription)")
        }

        isLoading = false
    }

    // MARK: - Delete

    @MainActor
    func deleteBill() async {
        guard let bill = selectedBill else { return }
        isDeleting = true

        do {
            try await billRepo.deleteBill(bill.billId)
            bills.removeAll { $0.billId == bill.billId }
            showDeleteConfirm = false
            selectedBill = nil
            logger.info("Deleted bill \(bill.billId)")
        } catch {
            errorMessage = "Failed to delete bill."
            logger.error("Delete bill failed: \(error.localizedDescription)")
        }

        isDeleting = false
    }

    // MARK: - Record Payment

    @MainActor
    func recordPayment() async {
        guard let bill = selectedBill else { return }
        guard let amount = Double(paymentAmount), amount > 0 else {
            errorMessage = "Enter a valid payment amount."
            return
        }

        isRecordingPayment = true
        let dateStr = DateFormatting.format(paymentDate, format: "yyyy-MM-dd")

        do {
            let updated = try await billRepo.recordPayment(
                bill.billId,
                amount: amount,
                accountId: paymentAccountId,
                paymentMethod: paymentMethod,
                date: dateStr
            )
            if let idx = bills.firstIndex(where: { $0.billId == bill.billId }) {
                bills[idx] = updated
            }
            showRecordPayment = false
            resetPaymentFields()
            logger.info("Recorded payment for bill \(bill.billId)")
        } catch {
            errorMessage = "Failed to record payment."
            logger.error("Record payment failed: \(error.localizedDescription)")
        }

        isRecordingPayment = false
    }

    // MARK: - Helpers

    func openPreview(_ bill: Bill) {
        selectedBill = bill
        showPreview = true
    }

    func openEdit(_ bill: Bill) {
        selectedBill = bill
        showEditBill = true
    }

    func openRecordPayment(_ bill: Bill) {
        selectedBill = bill
        paymentAmount = ""
        let remaining = (bill.grandTotal ?? 0) - (bill.amountPaid ?? 0)
        if remaining > 0 {
            paymentAmount = String(format: "%.2f", remaining)
        }
        showRecordPayment = true
    }

    func openDeleteConfirm(_ bill: Bill) {
        selectedBill = bill
        showDeleteConfirm = true
    }

    func statusType(for bill: Bill) -> StatusType {
        switch bill.paymentStatus?.lowercased() {
        case "paid": return .paid
        case "partial": return .partial
        default: return .unpaid
        }
    }

    private func resetPaymentFields() {
        paymentAmount = ""
        paymentMethod = "bank_transfer"
        paymentDate = Date()
        paymentAccountId = nil
    }
}
