import SwiftUI

/// A compact inline "AI" pill badge used to indicate AI-sourced items.
/// Features a purple-to-blue gradient background with white text.
struct AIBadge: View {
    var body: some View {
        Text("AI")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, SpentySpacing.sm - 2)
            .padding(.vertical, 2)
            .background(
                LinearGradient(
                    colors: [Color(hex: "#8B5CF6"), SpentyColors.brandAccent],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .clipShape(Capsule())
    }
}

#Preview {
    HStack(spacing: SpentySpacing.sm) {
        Text("Office Supplies")
            .font(SpentyFonts.body)
            .foregroundStyle(SpentyColors.textPrimary)
        AIBadge()
    }
    .padding()
}
