import SwiftUI

/// A ViewModifier that applies the standard SpentyCard styling:
/// white background, subtle border, card corner radius, and a light shadow.
struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(SpentySpacing.lg)
            .background(SpentyColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.card)
                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
    }
}

extension View {
    /// Applies SpentyCard styling: white background, subtle border,
    /// rounded corners, padding, and a light shadow.
    func cardStyle() -> some View {
        modifier(CardStyle())
    }
}

#Preview {
    VStack(spacing: SpentySpacing.lg) {
        Text("Card via modifier")
            .font(SpentyFonts.body)
            .foregroundStyle(SpentyColors.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardStyle()
    }
    .padding()
    .background(SpentyColors.bgPrimary)
}
