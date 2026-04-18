import SwiftUI

/// A generic card container with the standard SpentyAI card appearance:
/// white background, subtle border, rounded corners, and consistent padding.
struct SpentyCard<Content: View>: View {
    private let content: Content

    /// Creates a SpentyCard wrapping the provided content.
    /// - Parameter content: The views to display inside the card.
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(SpentySpacing.lg)
            .background(SpentyColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.card)
                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
            )
    }
}

#Preview {
    SpentyCard {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            Text("Card Title")
                .font(SpentyFonts.subheading)
                .foregroundStyle(SpentyColors.textPrimary)
            Text("Some content inside a generic card.")
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
        }
    }
    .padding()
    .background(SpentyColors.bgPrimary)
}
