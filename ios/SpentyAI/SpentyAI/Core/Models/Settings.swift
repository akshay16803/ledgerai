import Foundation

struct AppSettings: Codable {
    var firmName: String?
    var firmGstin: String?
    var firmPan: String?
    var firmState: String?
    var firmAddress: String?
    var businessCountry: String?
    var baseCurrency: String?
    var dateFormat: String?
    var logoUrl: String?
    var signatureUrl: String?
}
