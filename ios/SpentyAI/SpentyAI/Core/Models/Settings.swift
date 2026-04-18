import Foundation

struct AppSettings: Codable {
    var firmName: String?
    var gstin: String?
    var pan: String?
    var state: String?
    var address: String?
    var businessCountry: String?
    var defaultCurrency: String?
    var dateFormat: String?
    var logoUrl: String?
    var signatureUrl: String?
}
