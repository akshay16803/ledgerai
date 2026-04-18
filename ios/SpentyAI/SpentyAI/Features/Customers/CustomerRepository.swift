import Foundation

// MARK: - Models

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
private struct CustomerDeleteResponse: Codable {
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
        let _: CustomerDeleteResponse = try await api.delete(APIEndpoints.customer(id))
    }

    // MARK: - Invoices

    func fetchInvoices(customerId: String) async throws -> [CustomerInvoice] {
        try await api.get(APIEndpoints.customerInvoices(customerId))
    }
}
