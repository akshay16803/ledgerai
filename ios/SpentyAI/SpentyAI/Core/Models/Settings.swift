import Foundation

struct AppSettings: Codable, Hashable {
    var baseCurrency: String?
    var dateFormat: String?
    var businessCountry: String?
    var firmName: String?
    var firmAddress: String?
    var firmCity: String?
    var firmState: String?
    var firmPincode: String?
    var firmPhone: String?
    var firmEmail: String?
    var firmGstin: String?
    var firmPan: String?
    var firmWebsite: String?
    var firmLogoUrl: String?
    var firmSignatureUrl: String?
    var invoiceBankName: String?
    var invoiceBankAccountNumber: String?
    var invoiceBankIfsc: String?
    var invoiceBankBranch: String?
    var invoiceBankUpi: String?
    var invoicePrefix: String?
    var invoiceTerms: String?
    var billPrefix: String?
    var billTerms: String?

    enum CodingKeys: String, CodingKey {
        case baseCurrency = "base_currency"
        case dateFormat = "date_format"
        case businessCountry = "business_country"
        case firmName = "firm_name"
        case firmAddress = "firm_address"
        case firmCity = "firm_city"
        case firmState = "firm_state"
        case firmPincode = "firm_pincode"
        case firmPhone = "firm_phone"
        case firmEmail = "firm_email"
        case firmGstin = "firm_gstin"
        case firmPan = "firm_pan"
        case firmWebsite = "firm_website"
        case firmLogoUrl = "firm_logo_url"
        case firmSignatureUrl = "firm_signature_url"
        case invoiceBankName = "invoice_bank_name"
        case invoiceBankAccountNumber = "invoice_bank_account_number"
        case invoiceBankIfsc = "invoice_bank_ifsc"
        case invoiceBankBranch = "invoice_bank_branch"
        case invoiceBankUpi = "invoice_bank_upi"
        case invoicePrefix = "invoice_prefix"
        case invoiceTerms = "invoice_terms"
        case billPrefix = "bill_prefix"
        case billTerms = "bill_terms"
    }
}

struct SettingsUpdate: Codable {
    var baseCurrency: String?
    var dateFormat: String?
    var businessCountry: String?
    var firmName: String?
    var firmAddress: String?
    var firmCity: String?
    var firmState: String?
    var firmPincode: String?
    var firmPhone: String?
    var firmEmail: String?
    var firmGstin: String?
    var firmPan: String?
    var firmWebsite: String?
    var invoiceBankName: String?
    var invoiceBankAccountNumber: String?
    var invoiceBankIfsc: String?
    var invoiceBankBranch: String?
    var invoiceBankUpi: String?
    var invoicePrefix: String?
    var invoiceTerms: String?
    var billPrefix: String?
    var billTerms: String?

    enum CodingKeys: String, CodingKey {
        case baseCurrency = "base_currency"
        case dateFormat = "date_format"
        case businessCountry = "business_country"
        case firmName = "firm_name"
        case firmAddress = "firm_address"
        case firmCity = "firm_city"
        case firmState = "firm_state"
        case firmPincode = "firm_pincode"
        case firmPhone = "firm_phone"
        case firmEmail = "firm_email"
        case firmGstin = "firm_gstin"
        case firmPan = "firm_pan"
        case firmWebsite = "firm_website"
        case invoiceBankName = "invoice_bank_name"
        case invoiceBankAccountNumber = "invoice_bank_account_number"
        case invoiceBankIfsc = "invoice_bank_ifsc"
        case invoiceBankBranch = "invoice_bank_branch"
        case invoiceBankUpi = "invoice_bank_upi"
        case invoicePrefix = "invoice_prefix"
        case invoiceTerms = "invoice_terms"
        case billPrefix = "bill_prefix"
        case billTerms = "bill_terms"
    }
}
