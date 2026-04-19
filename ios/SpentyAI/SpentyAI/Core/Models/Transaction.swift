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
    }
}
