import Foundation

// MARK: - Request Types

struct CustomerCreate: Codable {
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

struct CustomerRepository {

    func getCustomers(
        query: String? = nil,
        limit: Int = 100,
        skip: Int = 0
    ) async throws -> PaginatedList<Customer> {
        var params: [String: String] = [
            "limit": String(limit),
            "skip": String(skip)
        ]
        if let query { params["query"] = query }

        return try await APIClient.shared.get(APIEndpoints.Customers.list, query: params)
    }

    func getCustomer(_ id: String) async throws -> Customer {
        try await APIClient.shared.get(APIEndpoints.Customers.customer(id))
    }

    func createCustomer(_ customer: CustomerCreate) async throws -> Customer {
        try await APIClient.shared.post(APIEndpoints.Customers.create, body: customer)
    }

    func updateCustomer(_ id: String, _ update: CustomerCreate) async throws -> Customer {
        try await APIClient.shared.put(APIEndpoints.Customers.update(id), body: update)
    }

    func deleteCustomer(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Customers.delete(id))
    }
}
