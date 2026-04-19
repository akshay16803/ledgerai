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

    enum CodingKeys: String, CodingKey {
        case id = "invoiceId"
        case invoiceNumber
        case date
        case dueDate
        case total
        case amountPaid
        case status
    }
}

struct CustomerInvoicesResponse: Codable {
    let items: [CustomerInvoice]
    let total: Int?
    let customerName: String?
}

struct CustomerPayload: Codable {
    let name: String
    let email: String?
    let phone: String?
    let gstin: String?
    let billingAddress: String?
    let shippingAddress: String?
}

struct CustomerListResponse: Codable {
    let items: [Customer]
    let total: Int?
}

// MARK: - Repository

struct CustomerRepository {

    private let api = APIClient.shared

    // MARK: - CRUD

    func fetchAll() async throws -> [Customer] {
        let response: CustomerListResponse = try await api.get(APIEndpoints.customers)
        return response.items
    }

    func create(_ payload: CustomerPayload) async throws -> Customer {
        try await api.post(APIEndpoints.customers, body: payload)
    }

    func update(id: String, _ payload: CustomerPayload) async throws -> Customer {
        try await api.put(APIEndpoints.customer(id), body: payload)
    }

    func delete(id: String) async throws {
        let _: MessageResponse = try await api.delete(APIEndpoints.customer(id))
    }

    // MARK: - Invoices

    func fetchInvoices(customerId: String) async throws -> [CustomerInvoice] {
        let response: CustomerInvoicesResponse = try await api.get(APIEndpoints.customerInvoices(customerId))
        return response.items
    }
}
