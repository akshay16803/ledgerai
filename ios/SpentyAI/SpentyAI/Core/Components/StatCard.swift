import SwiftUI

struct StatCard: View {
    let label: String
    let value: String
    var icon: String = "chart.bar.fill"
    var color: Color = .spentyPrimary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(color)
                Spacer()
            }

            Text(value)
                .font(SpentyFonts.amountMedium)
                .foregroundColor(.spentyTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.5)

            Text(label)
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
        }
        .cardStyle()
    }
}

#Preview {
    StatCard(label: "Net Worth", value: "$12,450.00", icon: "banknote.fill", color: .spentySuccess)
        .frame(width: 160)
        .padding()
}
