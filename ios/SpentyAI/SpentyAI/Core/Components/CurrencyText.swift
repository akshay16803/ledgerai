import SwiftUI

struct CurrencyText: View {
    let amount: Double
    var currencyCode: String = "INR"
    var font: Font = SpentyFonts.body
    var color: Color?

    private var formattedAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }

    private var displayColor: Color {
        if let color { return color }
        return amount >= 0 ? .spentySuccess : .spentyError
    }

    var body: some View {
        Text(formattedAmount)
            .font(font)
            .foregroundColor(displayColor)
    }
}

#Preview {
    VStack {
        CurrencyText(amount: 1234.56)
        CurrencyText(amount: -789.00, currencyCode: "USD")
    }
}
