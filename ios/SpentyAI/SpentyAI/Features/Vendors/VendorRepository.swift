import Foundation

// MARK: - Models

struct Vendor: Codable, Identifiable {
    let id: String
    var name: String
    var email: String?
    var phone: String?
    var gstin: String?
    var address: String?
    var totalBilled: Double?
    var totalPaid: Double?
    var outstanding: Double?

    enum CodingKeys: String, CodingKey {
        case id, name, email, phone, gstin, address
        case totalBilled  = "total_billed"
        case totalPaid    = "total_paid"
        case outstanding
    }
}

struct VendorBill: Codable, Identifiable {
    let id: String
    let billNumber: String?
    let date: String?
    let dueDate: String?
    let total: Double?
    let amountPaid: Double?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id, date, total, status
        case billNumber = "bill_number"
        case dueDate    = "due_date"
        case amountPaid = "amount_paid"
    }
}

struct CreateVendorRequest: Codable {
    let name: String
    let email: String?
    let phone: String?
    let gstin: String?
    let address: String?
}

// MARK: - Repository

final class VendorRepository {

    static let shared = VendorRepository()
    private init() {}

    // MARK: - CRUD

    func getVendors() async throws -> [Vendor] {
        try await APIClient.shared.get(APIEndpoints.vendors)
    }

    func getVendor(id: String) async throws -> Vendor {
        try await APIClient.shared.get(APIEndpoints.vendor(id))
    }

    func createVendor(_ request: CreateVendorRequest) async throws -> Vendor {
        try await APIClient.shared.post(APIEndpoints.vendors, body: request)
    }

    func updateVendor(id: String, _ request: CreateVendorRequest) async throws -> Vendor {
        try await APIClient.shared.put(APIEndpoints.vendor(id), body: request)
    }

    func deleteVendor(id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.vendor(id))
    }

    // MARK: - Bills

    func getVendorBills(vendorId: String) async throws -> [VendorBill] {
        try await APIClient.shared.get(APIEndpoints.vendorBills(vendorId))
    }
}
