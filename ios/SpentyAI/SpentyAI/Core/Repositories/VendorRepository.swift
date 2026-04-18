import Foundation

// MARK: - Request Types

struct VendorCreate: Codable {
    var name: String
    var gstin: String?
    var pan: String?
    var phone: String?
    var email: String?
    var billingAddress: String?
    var city: String?
    var state: String?
    var pincode: String?
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case name
        case gstin
        case pan
        case phone
        case email
        case billingAddress = "billing_address"
        case city
        case state
        case pincode
        case notes
    }
}

// MARK: - Repository

struct VendorRepository {

    func getVendors(
        query: String? = nil,
        limit: Int = 100,
        skip: Int = 0
    ) async throws -> PaginatedList<Vendor> {
        var params: [String: String] = [
            "limit": String(limit),
            "skip": String(skip)
        ]
        if let query { params["query"] = query }

        return try await APIClient.shared.get(APIEndpoints.Vendors.list, query: params)
    }

    func getVendor(_ id: String) async throws -> Vendor {
        try await APIClient.shared.get(APIEndpoints.Vendors.vendor(id))
    }

    func createVendor(_ vendor: VendorCreate) async throws -> Vendor {
        try await APIClient.shared.post(APIEndpoints.Vendors.create, body: vendor)
    }

    func updateVendor(_ id: String, _ update: VendorCreate) async throws -> Vendor {
        try await APIClient.shared.put(APIEndpoints.Vendors.update(id), body: update)
    }

    func deleteVendor(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Vendors.delete(id))
    }
}
