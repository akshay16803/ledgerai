import SwiftUI

// MARK: - Color Hex Extension

extension Color {
    /// Initializes a Color from a hex string (e.g. "#1B2A4A" or "1B2A4A").
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: // RGB
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - SpentyColors

/// Central color palette for the SpentyAI design system.
/// All values mirror the web app's CSS custom properties.
struct SpentyColors {
    // Brand
    static let brandPrimary = Color(hex: "#1B2A4A")
    static let brandAccent = Color(hex: "#3B82F6")

    // Backgrounds
    static let bgPrimary = Color(hex: "#FAFBFD")
    static let bgSecondary = Color(hex: "#F1F5F9")
    static let surface = Color.white

    // Text
    static let textPrimary = Color(hex: "#1E293B")
    static let textSecondary = Color(hex: "#64748B")
    static let textMuted = Color(hex: "#94A3B8")

    // Semantic
    static let success = Color(hex: "#22C55E")
    static let danger = Color(hex: "#EF4444")
    static let warning = Color(hex: "#F59E0B")
    static let info = Color(hex: "#3B82F6")

    // Borders
    static let borderSubtle = Color(hex: "#E2E8F0")
    static let borderStrong = Color(hex: "#CBD5E1")
}

// MARK: - SpentyFonts

/// Typography scale for the SpentyAI design system.
struct SpentyFonts {
    /// Large section titles — 20pt semibold.
    static let heading: Font = .system(size: 20, weight: .semibold)

    /// Subsection titles — 16pt medium.
    static let subheading: Font = .system(size: 16, weight: .medium)

    /// Default body text — 14pt regular.
    static let body: Font = .system(size: 14, weight: .regular)

    /// Small helper text — 12pt regular.
    static let caption: Font = .system(size: 12, weight: .regular)

    /// Monospaced text for numbers / codes — 14pt monospaced.
    static let mono: Font = .system(size: 14, weight: .regular, design: .monospaced)

    /// Large stat / metric display — 28pt bold.
    static let stat: Font = .system(size: 28, weight: .bold)
}

// MARK: - SpentySpacing

/// Spacing tokens used throughout the app for consistent layout.
struct SpentySpacing {
    /// 4pt — extra small spacing.
    static let xs: CGFloat = 4

    /// 8pt — small spacing.
    static let sm: CGFloat = 8

    /// 12pt — medium spacing.
    static let md: CGFloat = 12

    /// 16pt — large spacing.
    static let lg: CGFloat = 16

    /// 24pt — extra large spacing.
    static let xl: CGFloat = 24

    /// 32pt — double extra large spacing.
    static let xxl: CGFloat = 32
}

// MARK: - SpentyRadius

/// Corner radius tokens for consistent rounding.
struct SpentyRadius {
    /// 4pt — small radius for pills and chips.
    static let sm: CGFloat = 4

    /// 8pt — medium radius for inputs and buttons.
    static let md: CGFloat = 8

    /// 12pt — large radius for modals and sheets.
    static let lg: CGFloat = 12

    /// 2pt — subtle radius for cards.
    static let card: CGFloat = 2
}
