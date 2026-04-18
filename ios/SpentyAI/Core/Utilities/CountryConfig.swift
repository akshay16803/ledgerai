import Foundation

struct CountryConfig: Hashable {
    let code: String
    let name: String
    let currency: String
    let taxName: String
    let taxIdLabel: String
    let taxRateOptions: [Double]
    let dateFormat: String
    let invoiceTitle: String
    let billTitle: String

    /// Returns true only for countries with specialized invoice/bill forms
    static func usesExistingForms(code: String) -> Bool {
        code == "IN"
    }

    static let all: [String: CountryConfig] = [
        "IN": CountryConfig(
            code: "IN", name: "India", currency: "INR",
            taxName: "GST", taxIdLabel: "GSTIN",
            taxRateOptions: [0, 5, 12, 18, 28],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Tax Invoice", billTitle: "Purchase Bill"
        ),
        "US": CountryConfig(
            code: "US", name: "United States", currency: "USD",
            taxName: "Sales Tax", taxIdLabel: "EIN",
            taxRateOptions: [0, 4, 5, 6, 7, 8, 9, 10],
            dateFormat: "MM/dd/yyyy",
            invoiceTitle: "Invoice", billTitle: "Bill"
        ),
        "GB": CountryConfig(
            code: "GB", name: "United Kingdom", currency: "GBP",
            taxName: "VAT", taxIdLabel: "VAT Number",
            taxRateOptions: [0, 5, 20],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Invoice", billTitle: "Bill"
        ),
        "CA": CountryConfig(
            code: "CA", name: "Canada", currency: "CAD",
            taxName: "GST/HST", taxIdLabel: "BN",
            taxRateOptions: [0, 5, 12, 13, 15],
            dateFormat: "yyyy-MM-dd",
            invoiceTitle: "Invoice", billTitle: "Bill"
        ),
        "AU": CountryConfig(
            code: "AU", name: "Australia", currency: "AUD",
            taxName: "GST", taxIdLabel: "ABN",
            taxRateOptions: [0, 10],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Tax Invoice", billTitle: "Bill"
        ),
        "AE": CountryConfig(
            code: "AE", name: "United Arab Emirates", currency: "AED",
            taxName: "VAT", taxIdLabel: "TRN",
            taxRateOptions: [0, 5],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Tax Invoice", billTitle: "Purchase Bill"
        ),
        "SG": CountryConfig(
            code: "SG", name: "Singapore", currency: "SGD",
            taxName: "GST", taxIdLabel: "UEN",
            taxRateOptions: [0, 9],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Tax Invoice", billTitle: "Bill"
        ),
        "MY": CountryConfig(
            code: "MY", name: "Malaysia", currency: "MYR",
            taxName: "SST", taxIdLabel: "SST ID",
            taxRateOptions: [0, 6, 10],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Invoice", billTitle: "Bill"
        ),
        "DE": CountryConfig(
            code: "DE", name: "Germany", currency: "EUR",
            taxName: "USt", taxIdLabel: "USt-IdNr",
            taxRateOptions: [0, 7, 19],
            dateFormat: "dd.MM.yyyy",
            invoiceTitle: "Rechnung", billTitle: "Eingangsrechnung"
        ),
        "FR": CountryConfig(
            code: "FR", name: "France", currency: "EUR",
            taxName: "TVA", taxIdLabel: "SIREN",
            taxRateOptions: [0, 5.5, 10, 20],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Facture", billTitle: "Facture Fournisseur"
        ),
        "NL": CountryConfig(
            code: "NL", name: "Netherlands", currency: "EUR",
            taxName: "BTW", taxIdLabel: "BTW-nummer",
            taxRateOptions: [0, 9, 21],
            dateFormat: "dd-MM-yyyy",
            invoiceTitle: "Factuur", billTitle: "Inkoopfactuur"
        ),
        "JP": CountryConfig(
            code: "JP", name: "Japan", currency: "JPY",
            taxName: "Consumption Tax", taxIdLabel: "Corporate Number",
            taxRateOptions: [0, 8, 10],
            dateFormat: "yyyy/MM/dd",
            invoiceTitle: "Invoice", billTitle: "Bill"
        ),
        "KR": CountryConfig(
            code: "KR", name: "South Korea", currency: "KRW",
            taxName: "VAT", taxIdLabel: "BRN",
            taxRateOptions: [0, 10],
            dateFormat: "yyyy-MM-dd",
            invoiceTitle: "Invoice", billTitle: "Bill"
        ),
        "ZA": CountryConfig(
            code: "ZA", name: "South Africa", currency: "ZAR",
            taxName: "VAT", taxIdLabel: "VAT Number",
            taxRateOptions: [0, 15],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Tax Invoice", billTitle: "Bill"
        ),
        "BR": CountryConfig(
            code: "BR", name: "Brazil", currency: "BRL",
            taxName: "ICMS", taxIdLabel: "CNPJ",
            taxRateOptions: [0, 7, 12, 17, 18, 25],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Nota Fiscal", billTitle: "Nota de Entrada"
        ),
        "MX": CountryConfig(
            code: "MX", name: "Mexico", currency: "MXN",
            taxName: "IVA", taxIdLabel: "RFC",
            taxRateOptions: [0, 8, 16],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Factura", billTitle: "Factura de Proveedor"
        ),
        "NZ": CountryConfig(
            code: "NZ", name: "New Zealand", currency: "NZD",
            taxName: "GST", taxIdLabel: "IRD Number",
            taxRateOptions: [0, 15],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Tax Invoice", billTitle: "Bill"
        ),
        "HK": CountryConfig(
            code: "HK", name: "Hong Kong", currency: "HKD",
            taxName: "N/A", taxIdLabel: "BR Number",
            taxRateOptions: [0],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Invoice", billTitle: "Bill"
        ),
        "ID": CountryConfig(
            code: "ID", name: "Indonesia", currency: "IDR",
            taxName: "PPN", taxIdLabel: "NPWP",
            taxRateOptions: [0, 11],
            dateFormat: "dd/MM/yyyy",
            invoiceTitle: "Faktur Pajak", billTitle: "Bill"
        ),
        "PH": CountryConfig(
            code: "PH", name: "Philippines", currency: "PHP",
            taxName: "VAT", taxIdLabel: "TIN",
            taxRateOptions: [0, 12],
            dateFormat: "MM/dd/yyyy",
            invoiceTitle: "Invoice", billTitle: "Bill"
        )
    ]

    static func config(for code: String) -> CountryConfig? {
        all[code]
    }
}
