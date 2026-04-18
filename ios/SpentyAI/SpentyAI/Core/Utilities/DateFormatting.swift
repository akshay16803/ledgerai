import Foundation

enum DateFormatPreset: String, CaseIterable {
    case ddMMyyyySlash = "dd/MM/yyyy"
    case MMddyyyySlash = "MM/dd/yyyy"
    case yyyyMMddDash = "yyyy-MM-dd"
    case ddMMMyyyyDash = "dd-MMM-yyyy"
    case MMMddyyyyComma = "MMM dd, yyyy"
}

struct DateFormatting {
    private static var formatterCache: [String: DateFormatter] = [:]

    /// Format a Date using one of the preset formats
    static func format(_ date: Date, preset: DateFormatPreset) -> String {
        let formatter = getFormatter(for: preset.rawValue)
        return formatter.string(from: date)
    }

    /// Format a Date using a custom format string
    static func format(_ date: Date, format: String) -> String {
        let formatter = getFormatter(for: format)
        return formatter.string(from: date)
    }

    /// Parse a date string using the given format
    static func parse(_ string: String, format: String) -> Date? {
        let formatter = getFormatter(for: format)
        return formatter.date(from: string)
    }

    /// Parse an ISO 8601 date string
    static func parseISO(_ string: String) -> Date? {
        let formats = [
            "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZ",
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd"
        ]
        for fmt in formats {
            if let date = parse(string, format: fmt) {
                return date
            }
        }
        return ISO8601DateFormatter().date(from: string)
    }

    /// Relative time description (e.g. "2 hours ago")
    static func relativeString(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    /// Format an ISO date string (e.g. "2026-04-15" or full ISO 8601) into a short display date.
    static func shortDate(from isoString: String) -> String {
        guard let date = parseISO(isoString) else { return isoString }
        return format(date, preset: .MMMddyyyyComma)
    }

    private static func getFormatter(for format: String) -> DateFormatter {
        if let cached = formatterCache[format] {
            return cached
        }
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatterCache[format] = formatter
        return formatter
    }
}
