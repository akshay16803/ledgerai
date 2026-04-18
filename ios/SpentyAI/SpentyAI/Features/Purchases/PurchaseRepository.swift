import Foundation

// MARK: - Request / Response Models

struct BillPayload: Codable {
    var billNumber: String?
    var vendorId: String?
    var vendorName: String?
    var date: Date?
    var dueDate: Date?
    var lineItems: [BillLineItemPayload]?
    var subtotal: Double?
    var taxAmount: Double?
    var grandTotal: Double?
    var notes: String?
}

struct BillLineItemPayload: Codable {
    var description: String?
    var hsnSac: String?
    var quantity: Double?
    var rate: Double?
    var taxRate: Double?
    var amount: Double?
}

struct RecordBillPaymentPayload: Codable {
    var amount: Double
    var date: Date?
    var method: String?
    var accountId: String?
    var notes: String?
}

struct BillNextNumberResponse: Codable {
    let nextNumber: String?
}

struct BillStatsResponse: Codable {
    let totalBilled: Double?
    let totalPaid: Double?
    let totalOutstanding: Double?
    let totalOverdue: Double?
    let count: Int?
}

struct BillCountResponse: Codable {
    let count: Int?
}

struct CreditorSummary: Codable, Identifiable {
    var id: String { vendorId ?? UUID().uuidString }
    let vendorId: String?
    let vendorName: String?
    let totalOwed: Double?
    let totalPaid: Double?
    let outstanding: Double?
}

struct AgingBucket: Codable, Identifiable {
    var id: String { bucket ?? UUID().uuidString }
    let bucket: String?
    let amount: Double?
    let count: Int?
}

struct VendorPurchaseSummary: Codable, Identifiable {
    var id: String { vendorId ?? UUID().uuidString }
    let vendorId: String?
    let vendorName: String?
    let totalPurchases: Double?
    let billCount: Int?
}

struct BillParseResponse: Codable {
    let vendorName: String?
    let billNumber: String?
    let date: String?
    let dueDate: String?
    let lineItems: [BillLineItemPayload]?
    let subtotal: Double?
    let taxAmount: Double?
    let grandTotal: Double?
    let notes: String?
}

struct BillDeleteResponse: Codable {
    let detail: String?
}

struct BillMarkPaidResponse: Codable {
    let detail: String?
    let bill: Bill?
}

// MARK: - Repository

final class PurchaseRepository {

    static let shared = PurchaseRepository()
    private init() {}

    private let api = APIClient.shared

    // MARK: - CRUD

    func fetchBills() async throws -> [Bill] {
        try await api.get(APIEndpoints.bills)
    }

    func fetchBill(id: String) async throws -> Bill {
        try await api.get(APIEndpoints.bill(id))
    }

    func createBill(_ payload: BillPayload) async throws -> Bill {
        try await api.post(APIEndpoints.bills, body: payload)
    }

    func updateBill(id: String, _ payload: BillPayload) async throws -> Bill {
        try await api.put(APIEndpoints.bill(id), body: payload)
    }

    func deleteBill(id: String) async throws {
        let _: BillDeleteResponse = try await api.delete(APIEndpoints.bill(id))
    }

    // MARK: - Actions

    func recordPayment(id: String, _ payload: RecordBillPaymentPayload) async throws -> Bill {
        try await api.post(APIEndpoints.billRecordPayment(id), body: payload)
    }

    func markPaid(id: String) async throws -> Bill {
        let response: BillMarkPaidResponse = try await api.post(APIEndpoints.billMarkPaid(id))
        if let bill = response.bill { return bill }
        return try await fetchBill(id: id)
    }

    func duplicateBill(id: String) async throws -> Bill {
        try await api.post(APIEndpoints.billDuplicate(id))
    }

    // MARK: - Next Number

    func getNextNumber() async throws -> String {
        let response: BillNextNumberResponse = try await api.get(APIEndpoints.billsNextNumber)
        return response.nextNumber ?? ""
    }

    // MARK: - Stats & Analytics

    func fetchStats() async throws -> BillStatsResponse {
        try await api.get(APIEndpoints.billsStats)
    }

    func fetchCreditors() async throws -> [CreditorSummary] {
        try await api.get(APIEndpoints.billsCreditors)
    }

    func fetchAging() async throws -> [AgingBucket] {
        try await api.get(APIEndpoints.billsAging)
    }

    func fetchPurchasesByVendor() async throws -> [VendorPurchaseSummary] {
        try await api.get(APIEndpoints.billsPurchasesByVendor)
    }

    // MARK: - PDF

    func fetchBillPDF(id: String) async throws -> Data {
        try await api.getRaw(APIEndpoints.billPDF(id))
    }

    // MARK: - Upload & Parse

    func uploadAndParseBill(data: Data, filename: String, mimeType: String) async throws -> BillParseResponse {
        try await api.upload(
            APIEndpoints.billsParseUpload,
            data: data,
            filename: filename,
            mimeType: mimeType
        )
    }

    // MARK: - Vendors & Accounts (for pickers)

    func fetchVendors() async throws -> [Vendor] {
        try await api.get(APIEndpoints.vendors)
    }

    func fetchAccounts() async throws -> [Account] {
        try await api.get(APIEndpoints.accounts)
    }
}
