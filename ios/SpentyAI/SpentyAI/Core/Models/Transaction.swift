import Foundation

struct Transaction: Codable, Identifiable {
    let id: String
    var transactionType: String?
    var amount: Double?
    var date: Date?
    var accountId: String?
    var toAccountId: String?
    var categoryId: String?
    var subcategoryId: String?
    var description: String?
    var paymentMethod: String?
    var status: String?
    var isRecurring: Bool?
    var recurringFrequency: String?
    var recurrenceDate: Int?
    var source: String?
    var receiptId: String?
    var originalCurrency: String?
    var originalAmount: Double?
    var exchangeRate: Double?
    var isEstimatedRate: Bool?

    // Resolved names (populated by backend enrichment)
    var categoryName: String?
    var subcategoryName: String?
    var accountName: String?
    var toAccountName: String?

    enum CodingKeys: String, CodingKey {
        case id = "transactionId"
        case transactionType
        case amount
        case date
        case accountId
        case toAccountId
        case categoryId
        case subcategoryId
        case description
        case paymentMethod
        case status
        case isRecurring
        case recurringFrequency
        case recurrenceDate
        case source
        case receiptId
        case originalCurrency
        case originalAmount
        case exchangeRate
        case isEstimatedRate
        case categoryName
        case subcategoryName
        case accountName
        case toAccountName
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        // Use try? so a single malformed field doesn't discard the entire transaction
        self.transactionType = try? container.decodeIfPresent(String.self, forKey: .transactionType)
        self.amount = try? container.decodeIfPresent(Double.self, forKey: .amount)
        self.date = try? container.decodeIfPresent(Date.self, forKey: .date)
        self.accountId = try? container.decodeIfPresent(String.self, forKey: .accountId)
        self.toAccountId = try? container.decodeIfPresent(String.self, forKey: .toAccountId)
        self.categoryId = try? container.decodeIfPresent(String.self, forKey: .categoryId)
        self.subcategoryId = try? container.decodeIfPresent(String.self, forKey: .subcategoryId)
        self.description = try? container.decodeIfPresent(String.self, forKey: .description)
        self.paymentMethod = try? container.decodeIfPresent(String.self, forKey: .paymentMethod)
        self.status = try? container.decodeIfPresent(String.self, forKey: .status)
        self.isRecurring = try? container.decodeIfPresent(Bool.self, forKey: .isRecurring)
        self.recurringFrequency = try? container.decodeIfPresent(String.self, forKey: .recurringFrequency)
        self.recurrenceDate = try? container.decodeIfPresent(Int.self, forKey: .recurrenceDate)
        self.source = try? container.decodeIfPresent(String.self, forKey: .source)
        self.receiptId = try? container.decodeIfPresent(String.self, forKey: .receiptId)
        self.originalCurrency = try? container.decodeIfPresent(String.self, forKey: .originalCurrency)
        self.originalAmount = try? container.decodeIfPresent(Double.self, forKey: .originalAmount)
        self.exchangeRate = try? container.decodeIfPresent(Double.self, forKey: .exchangeRate)
        self.isEstimatedRate = try? container.decodeIfPresent(Bool.self, forKey: .isEstimatedRate)
        self.categoryName = try? container.decodeIfPresent(String.self, forKey: .categoryName)
        self.subcategoryName = try? container.decodeIfPresent(String.self, forKey: .subcategoryName)
        self.accountName = try? container.decodeIfPresent(String.self, forKey: .accountName)
        self.toAccountName = try? container.decodeIfPresent(String.self, forKey: .toAccountName)
    }

    // Memberwise init for creating transactions in code
    init(
        id: String = "",
        transactionType: String? = nil,
        amount: Double? = nil,
        date: Date? = nil,
        accountId: String? = nil,
        toAccountId: String? = nil,
        categoryId: String? = nil,
        subcategoryId: String? = nil,
        description: String? = nil,
        paymentMethod: String? = nil,
        status: String? = nil,
        isRecurring: Bool? = nil,
        recurringFrequency: String? = nil,
        recurrenceDate: Int? = nil,
        source: String? = nil,
        receiptId: String? = nil,
        originalCurrency: String? = nil,
        originalAmount: Double? = nil,
        exchangeRate: Double? = nil,
        isEstimatedRate: Bool? = nil,
        categoryName: String? = nil,
        subcategoryName: String? = nil,
        accountName: String? = nil,
        toAccountName: String? = nil
    ) {
        self.id = id
        self.transactionType = transactionType
        self.amount = amount
        self.date = date
        self.accountId = accountId
        self.toAccountId = toAccountId
        self.categoryId = categoryId
        self.subcategoryId = subcategoryId
        self.description = description
        self.paymentMethod = paymentMethod
        self.status = status
        self.isRecurring = isRecurring
        self.recurringFrequency = recurringFrequency
        self.recurrenceDate = recurrenceDate
        self.source = source
        self.receiptId = receiptId
        self.originalCurrency = originalCurrency
        self.originalAmount = originalAmount
        self.exchangeRate = exchangeRate
        self.isEstimatedRate = isEstimatedRate
        self.categoryName = categoryName
        self.subcategoryName = subcategoryName
        self.accountName = accountName
        self.toAccountName = toAccountName
    }
}
