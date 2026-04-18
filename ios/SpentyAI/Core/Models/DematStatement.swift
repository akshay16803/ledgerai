import Foundation

struct DematParsedSummary: Codable, Hashable {
    var totalBuyValue: Double?
    var totalSellValue: Double?
    var charges: [String: Double]?
    var netRealizedPnl: Double?
    var numTrades: Int?

    enum CodingKeys: String, CodingKey {
        case totalBuyValue = "total_buy_value"
        case totalSellValue = "total_sell_value"
        case charges
        case netRealizedPnl = "net_realized_pnl"
        case numTrades = "num_trades"
    }
}

struct DematStatement: Codable, Identifiable, Hashable {
    var id: String { statementId }

    let statementId: String
    var accountId: String?
    var periodFrom: String?
    var periodTo: String?
    var parsedSummary: DematParsedSummary?
    var status: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case statementId = "statement_id"
        case accountId = "account_id"
        case periodFrom = "period_from"
        case periodTo = "period_to"
        case parsedSummary = "parsed_summary"
        case status
        case createdAt = "created_at"
    }
}
