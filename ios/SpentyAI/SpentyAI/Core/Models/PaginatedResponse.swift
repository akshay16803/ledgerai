import Foundation

struct PaginatedList<T: Decodable>: Decodable {
    let items: [T]
    let total: Int

    enum CodingKeys: String, CodingKey {
        case items
        case transactions
        case total
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        total = try container.decodeIfPresent(Int.self, forKey: .total) ?? 0

        // Try "items" first, fall back to "transactions"
        if let items = try? container.decode([T].self, forKey: .items) {
            self.items = items
        } else if let transactions = try? container.decode([T].self, forKey: .transactions) {
            self.items = transactions
        } else {
            self.items = []
        }
    }

    init(items: [T], total: Int) {
        self.items = items
        self.total = total
    }
}
