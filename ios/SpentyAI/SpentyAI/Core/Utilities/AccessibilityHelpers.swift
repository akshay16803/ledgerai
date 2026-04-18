import SwiftUI

// MARK: - View Accessibility Extensions

extension View {
    /// Combines accessibilityLabel, accessibilityHint, and accessibilityAddTraits in one modifier.
    func spentyAccessible(
        label: String,
        hint: String? = nil,
        traits: AccessibilityTraits = []
    ) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityHint(hint ?? "")
            .accessibilityAddTraits(traits)
    }

    /// Marks a view as a button with label and optional hint for VoiceOver.
    func spentyButton(label: String, hint: String? = nil) -> some View {
        self.spentyAccessible(label: label, hint: hint, traits: .isButton)
    }

    /// Marks a view as a header for VoiceOver navigation.
    func spentyHeader(label: String) -> some View {
        self.spentyAccessible(label: label, traits: .isHeader)
    }

    /// Adds an accessibility value for sliders, steppers, and similar controls.
    func spentyValue(label: String, value: String) -> some View {
        self
            .accessibilityLabel(label)
            .accessibilityValue(value)
    }

    /// Sets the VoiceOver focus/sort priority. Lower numbers are read first.
    func spentyFocusOrder(_ priority: Int) -> some View {
        self.accessibilitySortPriority(Double(priority))
    }
}

// MARK: - MoneyAccessibility

/// Helpers for producing human-readable currency strings for VoiceOver.
struct MoneyAccessibility {
    /// Returns a VoiceOver-friendly string like "150 dollars and 50 cents".
    ///
    /// Supports common currency codes (USD, EUR, GBP, INR, JPY, etc.).
    /// Falls back to the raw ISO code for unknown currencies.
    static func readableAmount(_ amount: Double, currency: String) -> String {
        let isNegative = amount < 0
        let absolute = abs(amount)

        let whole = Int(absolute)
        let fractional = Int(round((absolute - Double(whole)) * 100))

        let (majorUnit, minorUnit) = currencyUnitNames(for: currency)

        var parts: [String] = []

        if isNegative {
            parts.append("negative")
        }

        parts.append("\(whole) \(majorUnit)")

        // Skip fractional part for zero-decimal currencies (e.g. JPY)
        if minorUnit != nil, fractional > 0 {
            parts.append("and \(fractional) \(minorUnit!)")
        }

        return parts.joined(separator: " ")
    }

    /// Returns (major unit name, minor unit name or nil for zero-decimal currencies).
    private static func currencyUnitNames(for code: String) -> (String, String?) {
        switch code.uppercased() {
        case "USD":
            return ("dollars", "cents")
        case "EUR":
            return ("euros", "cents")
        case "GBP":
            return ("pounds", "pence")
        case "INR":
            return ("rupees", "paise")
        case "JPY":
            return ("yen", nil)
        case "CAD":
            return ("Canadian dollars", "cents")
        case "AUD":
            return ("Australian dollars", "cents")
        case "CHF":
            return ("Swiss francs", "centimes")
        case "CNY":
            return ("yuan", "fen")
        case "KRW":
            return ("won", nil)
        default:
            return (code, "cents")
        }
    }
}

// MARK: - Dynamic Type / SpentyFonts Mapping
//
// SpentyFonts text style → recommended Dynamic Type style:
//
//   SpentyFonts.largeTitle   → .largeTitle
//   SpentyFonts.title        → .title
//   SpentyFonts.title2       → .title2
//   SpentyFonts.title3       → .title3
//   SpentyFonts.headline     → .headline
//   SpentyFonts.body         → .body
//   SpentyFonts.callout      → .callout
//   SpentyFonts.subheadline  → .subheadline
//   SpentyFonts.footnote     → .footnote
//   SpentyFonts.caption      → .caption
//   SpentyFonts.caption2     → .caption2
//
// When using custom SpentyFonts, always pair with `.dynamicTypeSize(...)` or
// use `.font(.custom(..., relativeTo: .body))` so the text scales with the
// user's preferred size. Prefer `@ScaledMetric` for spacing that should grow
// alongside text.
