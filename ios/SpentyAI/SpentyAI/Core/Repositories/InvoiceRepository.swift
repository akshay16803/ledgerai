import Foundation

// MARK: - Request / Response Types

struct LineItemCreate: Codable, Hashable {
    var description: String?
    var quantity: Double
    var rate: Double
    var discountPercent: Double?
    var gstRate: Double?
    var hsnSac: String?

    enum CodingKeys: String, CodingKey {
        case description
        case quantity
        case rate
        case discountPercent = "discount_percent"
        case gstRate = "gst_rate"
        case hsnSac = "hsn_sac"
    }
}

struct InvoiceCreate: Codable {
    var invoiceType: String
    var invoiceDate: String
    var dueDate: String?
    var customerId: String
    var customerName: String
    var customerGstin: String?
    var customerAddress: String?
    var customerState: String?
    var placeOfSupply: String?
    var lineItems: [LineItemCreate]
    var paymentStatus: String
    var amountPaid: Double?
    var paymentAccountId: String?
    var paymentMethod: String?
    var paymentDate: String?
    var poNumber: String?
    var notes: String?
    var termsConditions: String?

    enum CodingKeys: String, CodingKey {
        case invoiceType = "invoice_type"
        case invoiceDate = "invoice_date"
        case dueDate = "due_date"
        case customerId = "customer_id"
        case customerName = "customer_name"
        case customerGstin = "customer_gstin"
        case customerAddress = "customer_address"
        case customerState = "customer_state"
        case placeOfSupply = "place_of_supply"
        case lineItems = "line_items"
        case paymentStatus = "payment_status"
        case amountPaid = "amount_paid"
        case paymentAccountId = "payment_account_id"
        case paymentMethod = "payment_method"
        case paymentDate = "payment_date"
        case poNumber = "po_number"
        case notes
        case termsConditions = "terms_conditions"
    }
}

struct InvoiceCountResponse: Decodable {
    let count: Int
}

// MARK: - Debtor Types

struct DebtorItem: Codable, Identifiable, Hashable {
    var id: String { customerId }

    let customerId: String
    let customerName: String
    let totalOutstanding: Double
    let invoiceCount: Int
    let oldestDate: String?

    enum CodingKeys: String, CodingKey {
        case customerId = "customer_id"
        case customerName = "customer_name"
        case totalOutstanding = "total_outstanding"
        case invoiceCount = "invoice_count"
        case oldestDate = "oldest_date"
    }
}

struct DebtorList: Codable {
    let items: [DebtorItem]
}

// MARK: - Aging Types

struct AgingBucket: Codable, Hashable {
    let amount: Double
    let count: Int
    let invoices: [Invoice]
}

struct AgingReport: Codable {
    let current: AgingBucket
    let period1_30: AgingBucket
    let period31_60: AgingBucket
    let period61_90: AgingBucket
    let period90Plus: AgingBucket

    enum CodingKeys: String, CodingKey {
        case current
        case period1_30 = "period_1_30"
        case period31_60 = "period_31_60"
        case period61_90 = "period_61_90"
        case period90Plus = "period_90_plus"
    }
}

// MARK: - Sales by Customer Types

struct SalesByCustomerItem: Codable, Identifiable, Hashable {
    var id: String { customerId }

    let customerId: String
    let customerName: String
    let totalSales: Double
    let invoiceCount: Int
    let lastInvoiceDate: String?

    enum CodingKeys: String, CodingKey {
        case customerId = "customer_id"
        case customerName = "customer_name"
        case totalSales = "total_sales"
        case invoiceCount = "invoice_count"
        case lastInvoiceDate = "last_invoice_date"
    }
}

struct SalesByCustomerList: Codable {
    let items: [SalesByCustomerItem]
}

// MARK: - Payment Recording

private struct RecordPaymentBody: Encodable {
    let amount: Double
    let accountId: String?
    let paymentMethod: String?
    let date: String?

    enum CodingKeys: String, CodingKey {
        case amount
        case accountId = "account_id"
        case paymentMethod = "payment_method"
        case date
    }
}

// MARK: - Repository

struct InvoiceRepository {

    func getInvoices(
        status: String? = nil,
        customerId: String? = nil,
        fromDate: String? = nil,
        toDate: String? = nil,
        limit: Int = 50,
        skip: Int = 0
    ) async throws -> PaginatedList<Invoice> {
        var query: [String: String] = [
            "limit": String(limit),
            "skip": String(skip)
        ]
        if let status { query["status"] = status }
        if let customerId { query["customer_id"] = customerId }
        if let fromDate { query["from_date"] = fromDate }
        if let toDate { query["to_date"] = toDate }

        return try await APIClient.shared.get(APIEndpoints.Invoices.list, query: query)
    }

    func getInvoice(_ id: String) async throws -> Invoice {
        try await APIClient.shared.get(APIEndpoints.Invoices.invoice(id))
    }

    func createInvoice(_ invoice: InvoiceCreate) async throws -> Invoice {
        try await APIClient.shared.post(APIEndpoints.Invoices.create, body: invoice)
    }

    func updateInvoice(_ id: String, _ update: InvoiceCreate) async throws -> Invoice {
        try await APIClient.shared.put(APIEndpoints.Invoices.update(id), body: update)
    }

    func deleteInvoice(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Invoices.delete(id))
    }

    func recordPayment(
        _ id: String,
        amount: Double,
        accountId: String? = nil,
        paymentMethod: String? = nil,
        date: String? = nil
    ) async throws -> Invoice {
        let body = RecordPaymentBody(
            amount: amount,
            accountId: accountId,
            paymentMethod: paymentMethod,
            date: date
        )
        return try await APIClient.shared.post(APIEndpoints.Invoices.recordPayment(id), body: body)
    }

    func getInvoiceCount() async throws -> Int {
        let response: InvoiceCountResponse = try await APIClient.shared.get(APIEndpoints.Invoices.count)
        return response.count
    }

    func getDebtors() async throws -> DebtorList {
        try await APIClient.shared.get(APIEndpoints.Invoices.debtors)
    }

    func getAging() async throws -> AgingReport {
        try await APIClient.shared.get(APIEndpoints.Invoices.aging)
    }

    func getSalesByCustomer() async throws -> SalesByCustomerList {
        try await APIClient.shared.get(APIEndpoints.Invoices.salesByCustomer)
    }
}
