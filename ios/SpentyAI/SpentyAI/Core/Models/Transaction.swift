import Foundation

enum TransactionType: String, Codable, Hashable, CaseIterable {
    case income
    case expense
    case transfer
}

enum TransactionStatus: String, Codable, Hashable, CaseIterable {
    case approved
    case pendingReview = "pending_review"
    case rejected
}

struct Transaction: Codable, Identifiable, Hashable {
    var id: String { transactionId }

    let transactionId: String
    let userId: String?
    var transactionType: TransactionType
    var amount: Double
    var date: String
    var accountId: String?
    var toAccountId: String?
    var categoryId: String?
    var subcategoryId: String?
    var description: String?
    var paymentMethod: String?
    var isRecurring: Bool?
    var recurringFrequency: String?
    var source: String?
    var status: TransactionStatus?
    var receiptId: String?
    var createdAt: String?
    var accountName: String?
    var categoryName: String?

    enum CodingKeys: String, CodingKey {
        case transactionId = "transaction_id"
        case userId = "user_id"
        case transactionType = "transaction_type"
        case amount
        case date
        case accountId = "account_id"
        case toAccountId = "to_account_id"
        case categoryId = "category_id"
        case subcategoryId = "subcategory_id"
        case description
        case paymentMethod = "payment_method"
        case isRecurring = "is_recurring"
        case recurringFrequency = "recurring_frequency"
        case source
        case status
        case receiptId = "receipt_id"
        case createdAt = "created_at"
        case accountName = "account_name"
        case categoryName = "category_name"
    }
}

struct TransactionCreate: Codable {
    var transactionType: TransactionType
    var amount: Double
    var date: String
    var accountId: String?
    var toAccountId: String?
    var categoryId: String?
    var subcategoryId: String?
    var description: String?
    var paymentMethod: String?
    var isRecurring: Bool?
    var recurringFrequency: String?

    enum CodingKeys: String, CodingKey {
        case transactionType = "transaction_type"
        case amount
        case date
        case accountId = "account_id"
        case toAccountId = "to_account_id"
        case categoryId = "category_id"
        case subcategoryId = "subcategory_id"
        case description
        case paymentMethod = "payment_method"
        case isRecurring = "is_recurring"
        case recurringFrequency = "recurring_frequency"
    }
}

struct TransactionUpdate: Codable {
    var transactionType: TransactionType?
    var amount: Double?
    var date: String?
    var accountId: String?
    var toAccountId: String?
    var categoryId: String?
    var subcategoryId: String?
    var description: String?
    var paymentMethod: String?
    var isRecurring: Bool?
    var recurringFrequency: String?
    var status: TransactionStatus?

    enum CodingKeys: String, CodingKey {
        case transactionType = "transaction_type"
        case amount
        case date
        case accountId = "account_id"
        case toAccountId = "to_account_id"
        case categoryId = "category_id"
        case subcategoryId = "subcategory_id"
        case description
        case paymentMethod = "payment_method"
        case isRecurring = "is_recurring"
        case recurringFrequency = "recurring_frequency"
        case status
    }
}
