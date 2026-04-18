import Foundation

// MARK: - Models

struct Customer: Codable, Identifiable, Equatable {
    let id: String
    var name: String
    var email: String?
    var phone: String?
    var gstin: String?
    var billingAddress: String?
    var shippingAddress: String?
    var totalInvoiced: Double?
    var totalPaid: Double?
    var outstanding: Double?
}

struct CustomerInvoice: Codable, Identifiable {
    let id: String
    let invoiceNumber: String?
    let date: Date?
    let dueDate: Date?
    let total: Double?
    let amountPaid: Double?
    let status: String?
}

struct CustomerPayload: Codable {
    let name: String
    let email: String?
    let phone: String?
    let gstin: String?
    let billingAddress: String?
    let shippingAddress: String?
}

/// Empty-body response for DELETE calls that return `{ "detail": "..." }`.
struct DeleteResponse: Codable {
    let detail: String?
}

// MARK: - Repository

struct CustomerRepository {

    private let api = APIClient.shared

    // MARK: - CRUD

    func fetchAll() async throws -> [Customer] {
        try await api.get(APIEndpoints.customers)
    }

    func create(_ payload: CustomerPayload) async throws -> Customer {
        try await api.post(APIEndpoints.customers, body: payload)
    }

    func update(id: String, _ payload: CustomerPayload) async throws -> Customer {
        try await api.put(APIEndpoints.customer(id), body: payload)
    }

    func delete(id: String) async throws {
        let _: DeleteResponse = try await api.delete(APIEndpoints.customer(id))
    }

    // MARK: - Invoices

    func fetchInvoices(customerId: String) async throws -> [CustomerInvoice] {
        try await api.get(APIEndpoints.customerInvoices(customerId))
    }
}
