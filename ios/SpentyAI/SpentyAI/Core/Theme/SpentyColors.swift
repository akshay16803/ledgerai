import SwiftUI

extension Color {
    static let spentyPrimary = Color(hex: 0x3A5C4A)
    static let spentyBgPrimary = Color(hex: 0xF8F6F3)
    static let spentySuccess = Color(hex: 0x3A5C4A)
    static let spentyError = Color(hex: 0x96453A)
    static let spentyWarning = Color(hex: 0xC28C3C)
    static let spentyInfo = Color(hex: 0x4A6E7D)
    static let spentyAccent1 = Color(hex: 0xC26D5C)
    static let spentyAccent3 = Color(hex: 0x4A6E7D)
    static let spentyTextPrimary = Color(hex: 0x2D2D2D)
    static let spentyTextSecondary = Color(hex: 0x6B7280)
    static let spentyCardBg = Color(hex: 0xFFFFFF)
    static let spentyBorder = Color(hex: 0xE5E7EB)

    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: alpha
        )
    }
}
