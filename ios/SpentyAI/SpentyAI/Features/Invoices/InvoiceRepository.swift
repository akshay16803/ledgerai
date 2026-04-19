import Foundation

struct InvoicePayload: Codable {
    let invoiceNumber: String?
    let customerId: String?
    let customerName: String?
    let invoiceDate: Date?
    let dueDate: Date?
    let lineItems: [InvoiceLineItemPayload]?
    let subtotal: Double?
    let taxAmount: Double?
    let grandTotal: Double?
    let notes: String?
    let termsConditions: String?
}

struct InvoiceLineItemPayload: Codable {
    let description: String?
    let hsnSac: String?
    let quantity: Double?
    let rate: Double?
    let taxPercent: Double?
    let amount: Double?
}

struct RecordPaymentPayload: Codable {
    let amount: Double
    let date: Date
    let paymentMethod: String?
    let accountId: String?
    let note: String?
}

private struct InvoiceListResponse: Codable {
    let invoices: [Invoice]
    let total: Int?

    enum CodingKeys: String, CodingKey {
        case invoices
        case items
        case total
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Backend may send "invoices" or "items" key
        if let invoices = try? container.decode([Invoice].self, forKey: .invoices) {
            self.invoices = invoices
        } else if let items = try? container.decode([Invoice].self, forKey: .items) {
            self.invoices = items
        } else {
            self.invoices = []
        }
        self.total = try? container.decodeIfPresent(Int.self, forKey: .total)
    }
}

struct InvoiceRepository {

    private let api = APIClient.shared

    // MARK: - CRUD

    func fetchAll() async throws -> [Invoice] {
        let response: InvoiceListResponse = try await api.get(APIEndpoints.invoices)
        return response.invoices
    }

    func fetch(id: String) async throws -> Invoice {
        try await api.get(APIEndpoints.invoice(id))
    }

    func create(_ payload: InvoicePayload) async throws -> Invoice {
        try await api.post(APIEndpoints.invoices, body: payload)
    }

    func update(id: String, _ payload: InvoicePayload) async throws -> Invoice {
        try await api.put(APIEndpoints.invoice(id), body: payload)
    }

    func delete(id: String) async throws {
        let _: MessageResponse = try await api.delete(APIEndpoints.invoice(id))
    }

    // MARK: - Actions

    func recordPayment(id: String, _ payload: RecordPaymentPayload) async throws -> Invoice {
        try await api.post(APIEndpoints.invoiceRecordPayment(id), body: payload)
    }

    func markPaid(id: String) async throws -> Invoice {
        try await api.post(APIEndpoints.invoiceMarkPaid(id))
    }

    func duplicate(id: String) async throws -> Invoice {
        try await api.post(APIEndpoints.invoiceDuplicate(id))
    }

    // MARK: - Stats & Aggregates

    func fetchNextNumber() async throws -> InvoiceNextNumber {
        try await api.get(APIEndpoints.invoicesNextNumber)
    }

    func fetchStats() async throws -> InvoiceStats {
        try await api.get(APIEndpoints.invoicesStats)
    }

    func fetchCount() async throws -> InvoiceCountResponse {
        try await api.get(APIEndpoints.invoicesCount)
    }

    func fetchDebtors() async throws -> [InvoiceDebtor] {
        try await api.get(APIEndpoints.invoicesDebtors)
    }

    func fetchAging() async throws -> [InvoiceAgingBucket] {
        try await api.get(APIEndpoints.invoicesAging)
    }

    func fetchSalesByCustomer() async throws -> [InvoiceSalesByCustomer] {
        try await api.get(APIEndpoints.invoicesSalesByCustomer)
    }

    // MARK: - PDF

    func fetchPDF(id: String) async throws -> Data {
        try await api.getRaw(APIEndpoints.invoicePDF(id))
    }

    // MARK: - Customers & Accounts (for pickers)

    func fetchCustomers() async throws -> [Customer] {
        let response: CustomerListResponse = try await api.get(APIEndpoints.customers)
        return response.items
    }

    func fetchAccounts() async throws -> [Account] {
        try await api.get(APIEndpoints.accounts)
    }
}
