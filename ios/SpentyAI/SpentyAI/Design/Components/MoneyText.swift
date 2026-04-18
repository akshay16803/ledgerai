import SwiftUI

/// Formatted currency display with locale-aware formatting.
/// Positive amounts render in green, negative in red (when `showSign` is true).
struct MoneyText: View {
    let amount: Double
    let currency: String
    let showSign: Bool
    let size: Font

    /// Creates a MoneyText view.
    /// - Parameters:
    ///   - amount: The numeric amount to display.
    ///   - currency: ISO 4217 currency code (default "INR").
    ///   - showSign: Whether to color-code and show +/- signs.
    ///   - size: Font to apply (default: SpentyFonts.body).
    init(
        _ amount: Double,
        currency: String = "INR",
        showSign: Bool = false,
        size: Font = SpentyFonts.body
    ) {
        self.amount = amount
        self.currency = currency
        self.showSign = showSign
        self.size = size
    }

    private var formattedAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency

        // Use Indian locale for INR to get the lakh/crore grouping
        if currency == "INR" {
            formatter.locale = Locale(identifier: "en_IN")
        }

        if showSign && amount > 0 {
            formatter.positivePrefix = "+"
            formatter.positivePrefix += formatter.currencySymbol + " "
        }

        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }

    private var textColor: Color {
        guard showSign else { return SpentyColors.textPrimary }
        if amount > 0 { return SpentyColors.success }
        if amount < 0 { return SpentyColors.danger }
        return SpentyColors.textPrimary
    }

    var body: some View {
        Text(formattedAmount)
            .font(size)
            .foregroundStyle(textColor)
            .monospacedDigit()
    }
}

#Preview {
    VStack(alignment: .trailing, spacing: SpentySpacing.sm) {
        MoneyText(124500, currency: "INR", size: SpentyFonts.stat)
        MoneyText(1250.50, currency: "USD")
        MoneyText(3200, showSign: true)
        MoneyText(-1500, showSign: true)
        MoneyText(0, showSign: true)
    }
    .padding()
}
