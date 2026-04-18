import Foundation

// MARK: - Request Types

struct BillCreate: Codable {
    var billType: String
    var billDate: String
    var dueDate: String?
    var vendorId: String
    var vendorName: String
    var vendorGstin: String?
    var vendorAddress: String?
    var vendorState: String?
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
        case billType = "bill_type"
        case billDate = "bill_date"
        case dueDate = "due_date"
        case vendorId = "vendor_id"
        case vendorName = "vendor_name"
        case vendorGstin = "vendor_gstin"
        case vendorAddress = "vendor_address"
        case vendorState = "vendor_state"
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

// MARK: - Creditor Types

struct CreditorItem: Codable, Identifiable, Hashable {
    var id: String { vendorId }

    let vendorId: String
    let vendorName: String
    let totalOutstanding: Double
    let billCount: Int
    let oldestDate: String?

    enum CodingKeys: String, CodingKey {
        case vendorId = "vendor_id"
        case vendorName = "vendor_name"
        case totalOutstanding = "total_outstanding"
        case billCount = "bill_count"
        case oldestDate = "oldest_date"
    }
}

struct CreditorList: Codable {
    let items: [CreditorItem]
}

// MARK: - Bill Aging Types

struct BillAgingBucket: Codable, Hashable {
    let amount: Double
    let count: Int
    let bills: [Bill]
}

struct BillAgingReport: Codable {
    let current: BillAgingBucket
    let period1_30: BillAgingBucket
    let period31_60: BillAgingBucket
    let period61_90: BillAgingBucket
    let period90Plus: BillAgingBucket

    enum CodingKeys: String, CodingKey {
        case current
        case period1_30 = "period_1_30"
        case period31_60 = "period_31_60"
        case period61_90 = "period_61_90"
        case period90Plus = "period_90_plus"
    }
}

// MARK: - Purchases by Vendor Types

struct PurchasesByVendorItem: Codable, Identifiable, Hashable {
    var id: String { vendorId }

    let vendorId: String
    let vendorName: String
    let totalPurchases: Double
    let billCount: Int
    let lastBillDate: String?

    enum CodingKeys: String, CodingKey {
        case vendorId = "vendor_id"
        case vendorName = "vendor_name"
        case totalPurchases = "total_purchases"
        case billCount = "bill_count"
        case lastBillDate = "last_bill_date"
    }
}

struct PurchasesByVendorList: Codable {
    let items: [PurchasesByVendorItem]
}

// MARK: - Bill Parse Types

struct BillParsedLineItem: Codable, Hashable {
    var description: String?
    var quantity: Double?
    var rate: Double?
    var discountPercent: Double?
    var gstRate: Double?
    var hsnSac: String?
    var amount: Double?

    enum CodingKeys: String, CodingKey {
        case description
        case quantity
        case rate
        case discountPercent = "discount_percent"
        case gstRate = "gst_rate"
        case hsnSac = "hsn_sac"
        case amount
    }
}

struct BillParsedData: Codable, Hashable {
    var vendorName: String?
    var vendorGstin: String?
    var billDate: String?
    var dueDate: String?
    var billReference: String?
    var billType: String?
    var placeOfSupply: String?
    var lineItems: [BillParsedLineItem]?
    var subtotal: Double?
    var taxTotal: Double?
    var grandTotal: Double?
    var notes: String?
    var matchedVendorId: String?
    var matchedVendorName: String?

    enum CodingKeys: String, CodingKey {
        case vendorName = "vendor_name"
        case vendorGstin = "vendor_gstin"
        case billDate = "bill_date"
        case dueDate = "due_date"
        case billReference = "bill_reference"
        case billType = "bill_type"
        case placeOfSupply = "place_of_supply"
        case lineItems = "line_items"
        case subtotal
        case taxTotal = "tax_total"
        case grandTotal = "grand_total"
        case notes
        case matchedVendorId = "matched_vendor_id"
        case matchedVendorName = "matched_vendor_name"
    }
}

struct BillParseResult: Codable {
    let parsedData: BillParsedData

    enum CodingKeys: String, CodingKey {
        case parsedData = "parsed_data"
    }
}

// MARK: - Payment Recording

private struct BillRecordPaymentBody: Encodable {
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

private struct BillCountResponse: Decodable {
    let count: Int
}

// MARK: - Repository

struct BillRepository {

    func getBills(
        status: String? = nil,
        vendorId: String? = nil,
        fromDate: String? = nil,
        toDate: String? = nil,
        limit: Int = 50,
        skip: Int = 0
    ) async throws -> PaginatedList<Bill> {
        var query: [String: String] = [
            "limit": String(limit),
            "skip": String(skip)
        ]
        if let status { query["status"] = status }
        if let vendorId { query["vendor_id"] = vendorId }
        if let fromDate { query["from_date"] = fromDate }
        if let toDate { query["to_date"] = toDate }

        return try await APIClient.shared.get(APIEndpoints.Bills.list, query: query)
    }

    func getBill(_ id: String) async throws -> Bill {
        try await APIClient.shared.get(APIEndpoints.Bills.bill(id))
    }

    func createBill(_ bill: BillCreate) async throws -> Bill {
        try await APIClient.shared.post(APIEndpoints.Bills.create, body: bill)
    }

    func updateBill(_ id: String, _ update: BillCreate) async throws -> Bill {
        try await APIClient.shared.put(APIEndpoints.Bills.update(id), body: update)
    }

    func deleteBill(_ id: String) async throws {
        try await APIClient.shared.delete(APIEndpoints.Bills.delete(id))
    }

    func recordPayment(
        _ id: String,
        amount: Double,
        accountId: String? = nil,
        paymentMethod: String? = nil,
        date: String? = nil
    ) async throws -> Bill {
        let body = BillRecordPaymentBody(
            amount: amount,
            accountId: accountId,
            paymentMethod: paymentMethod,
            date: date
        )
        return try await APIClient.shared.post(APIEndpoints.Bills.recordPayment(id), body: body)
    }

    func getBillCount() async throws -> Int {
        let response: BillCountResponse = try await APIClient.shared.get(APIEndpoints.Bills.count)
        return response.count
    }

    func getCreditors() async throws -> CreditorList {
        try await APIClient.shared.get(APIEndpoints.Bills.creditors)
    }

    func getBillAging() async throws -> BillAgingReport {
        try await APIClient.shared.get(APIEndpoints.Bills.aging)
    }

    func getPurchasesByVendor() async throws -> PurchasesByVendorList {
        try await APIClient.shared.get(APIEndpoints.Bills.purchasesByVendor)
    }

    func parseBillUpload(
        fileData: Data,
        fileName: String,
        mimeType: String
    ) async throws -> BillParseResult {
        try await APIClient.shared.upload(
            APIEndpoints.Bills.parseUpload,
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType
        )
    }
}
