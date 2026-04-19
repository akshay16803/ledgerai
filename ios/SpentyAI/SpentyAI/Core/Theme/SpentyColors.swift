import SwiftUI
import UIKit

extension Color {
    static let spentyPrimary = Color(hex: 0x3A5C4A)
    static let spentyBgPrimary = Color(uiColor: UIColor { traitCollection in
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0x1C/255.0, green: 0x1C/255.0, blue: 0x1E/255.0, alpha: 1)
            : UIColor(red: 0xF8/255.0, green: 0xF6/255.0, blue: 0xF3/255.0, alpha: 1)
    })
    static let spentySuccess = Color(hex: 0x3A5C4A)
    static let spentyError = Color(hex: 0x96453A)
    static let spentyWarning = Color(hex: 0xC28C3C)
    static let spentyInfo = Color(hex: 0x4A6E7D)
    static let spentyAccent1 = Color(hex: 0xC26D5C)
    static let spentyAccent3 = Color(hex: 0x4A6E7D)
    static let spentyTextPrimary = Color(uiColor: UIColor { traitCollection in
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0xF2/255.0, green: 0xF2/255.0, blue: 0xF7/255.0, alpha: 1)
            : UIColor(red: 0x2D/255.0, green: 0x2D/255.0, blue: 0x2D/255.0, alpha: 1)
    })
    static let spentyTextSecondary = Color(uiColor: UIColor { traitCollection in
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0x8E/255.0, green: 0x8E/255.0, blue: 0x93/255.0, alpha: 1)
            : UIColor(red: 0x6B/255.0, green: 0x72/255.0, blue: 0x80/255.0, alpha: 1)
    })
    static let spentyCardBg = Color(uiColor: UIColor { traitCollection in
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0x2C/255.0, green: 0x2C/255.0, blue: 0x2E/255.0, alpha: 1)
            : UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1)
    })
    static let spentyBorder = Color(uiColor: UIColor { traitCollection in
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0x38/255.0, green: 0x38/255.0, blue: 0x3A/255.0, alpha: 1)
            : UIColor(red: 0xE5/255.0, green: 0xE7/255.0, blue: 0xEB/255.0, alpha: 1)
    })

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
