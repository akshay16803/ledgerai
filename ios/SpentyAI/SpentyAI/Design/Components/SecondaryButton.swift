import SwiftUI

/// An outline/ghost variant of the CTA button with a transparent background,
/// brandPrimary border, and brandPrimary text.
struct SecondaryButton: View {
    let title: String
    let icon: String?
    let isLoading: Bool
    let isDisabled: Bool
    let isFullWidth: Bool
    let action: () -> Void

    /// Creates a SecondaryButton.
    /// - Parameters:
    ///   - title: The button label text.
    ///   - icon: Optional SF Symbol name displayed before the title.
    ///   - isLoading: When true, shows a spinner and disables interaction.
    ///   - isDisabled: When true, dims the button and disables interaction.
    ///   - isFullWidth: When true, the button stretches to fill available width.
    ///   - action: Closure executed on tap.
    init(
        _ title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        isFullWidth: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.isFullWidth = isFullWidth
        self.action = action
    }

    private var effectivelyDisabled: Bool {
        isDisabled || isLoading
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: SpentySpacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(SpentyColors.brandPrimary)
                        .controlSize(.small)
                } else if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                }

                Text(title)
                    .font(SpentyFonts.subheading)
            }
            .foregroundStyle(SpentyColors.brandPrimary)
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .padding(.horizontal, SpentySpacing.xl)
            .padding(.vertical, SpentySpacing.md)
            .background(Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.md)
                    .stroke(SpentyColors.brandPrimary, lineWidth: 1.5)
            )
            .opacity(effectivelyDisabled ? 0.5 : 1.0)
        }
        .disabled(effectivelyDisabled)
    }
}

#Preview {
    VStack(spacing: SpentySpacing.lg) {
        SecondaryButton("Cancel", action: {})
        SecondaryButton("Export", icon: "square.and.arrow.up", action: {})
        SecondaryButton("Full Width", isFullWidth: true, action: {})
    }
    .padding()
}
