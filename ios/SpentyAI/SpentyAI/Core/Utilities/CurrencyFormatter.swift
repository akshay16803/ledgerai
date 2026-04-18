import Foundation

struct CurrencyFormatter {
    private static let localeMap: [String: String] = [
        "INR": "en_IN",
        "USD": "en_US",
        "EUR": "de_DE",
        "GBP": "en_GB",
        "CAD": "en_CA",
        "AUD": "en_AU",
        "AED": "ar_AE",
        "SGD": "en_SG",
        "MYR": "ms_MY",
        "JPY": "ja_JP",
        "KRW": "ko_KR",
        "CNY": "zh_CN",
        "HKD": "zh_HK",
        "TWD": "zh_TW",
        "THB": "th_TH",
        "IDR": "id_ID",
        "PHP": "en_PH",
        "VND": "vi_VN",
        "BDT": "bn_BD",
        "PKR": "ur_PK",
        "LKR": "si_LK",
        "NPR": "ne_NP",
        "ZAR": "en_ZA",
        "NGN": "en_NG",
        "KES": "en_KE",
        "EGP": "ar_EG",
        "BRL": "pt_BR",
        "MXN": "es_MX",
        "ARS": "es_AR",
        "CLP": "es_CL",
        "COP": "es_CO",
        "PEN": "es_PE",
        "NZD": "en_NZ",
        "CHF": "de_CH",
        "SEK": "sv_SE",
        "NOK": "nb_NO",
        "DKK": "da_DK",
        "PLN": "pl_PL",
        "CZK": "cs_CZ",
        "HUF": "hu_HU",
        "RON": "ro_RO",
        "TRY": "tr_TR",
        "RUB": "ru_RU",
        "ILS": "he_IL",
        "SAR": "ar_SA",
        "QAR": "ar_QA",
        "KWD": "ar_KW",
        "BHD": "ar_BH",
        "OMR": "ar_OM"
    ]

    private static var formatterCache: [String: NumberFormatter] = [:]

    static func format(amount: Double, currencyCode: String) -> String {
        let formatter = getFormatter(for: currencyCode)
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currencyCode) \(amount)"
    }

    static func symbol(for currencyCode: String) -> String {
        let formatter = getFormatter(for: currencyCode)
        return formatter.currencySymbol ?? currencyCode
    }

    private static func getFormatter(for currencyCode: String) -> NumberFormatter {
        if let cached = formatterCache[currencyCode] {
            return cached
        }

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode

        if let localeIdentifier = localeMap[currencyCode] {
            formatter.locale = Locale(identifier: localeIdentifier)
        }

        // Use 0 decimal places for currencies that don't use them
        let zeroDecimalCurrencies: Set<String> = ["JPY", "KRW", "VND", "IDR", "CLP", "HUF"]
        if zeroDecimalCurrencies.contains(currencyCode) {
            formatter.minimumFractionDigits = 0
            formatter.maximumFractionDigits = 0
        } else {
            formatter.minimumFractionDigits = 2
            formatter.maximumFractionDigits = 2
        }

        // 3 decimal places for specific currencies
        let threeDecimalCurrencies: Set<String> = ["KWD", "BHD", "OMR"]
        if threeDecimalCurrencies.contains(currencyCode) {
            formatter.minimumFractionDigits = 3
            formatter.maximumFractionDigits = 3
        }

        formatterCache[currencyCode] = formatter
        return formatter
    }
}
