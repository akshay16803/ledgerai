import SwiftUI

/// A brand-colored call-to-action button with optional icon, loading state,
/// and full-width layout support.
struct PrimaryButton: View {
    let title: String
    let icon: String?
    let isLoading: Bool
    let isDisabled: Bool
    let isFullWidth: Bool
    let action: () -> Void

    /// Creates a PrimaryButton.
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
                        .tint(.white)
                        .controlSize(.small)
                } else if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                }

                Text(title)
                    .font(SpentyFonts.subheading)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .padding(.horizontal, SpentySpacing.xl)
            .padding(.vertical, SpentySpacing.md)
            .background(SpentyColors.brandPrimary)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .opacity(effectivelyDisabled ? 0.5 : 1.0)
        }
        .disabled(effectivelyDisabled)
    }
}

#Preview {
    VStack(spacing: SpentySpacing.lg) {
        PrimaryButton("Create Invoice", icon: "plus", action: {})
        PrimaryButton("Loading...", isLoading: true, action: {})
        PrimaryButton("Disabled", isDisabled: true, action: {})
        PrimaryButton("Full Width", icon: "paperplane.fill", isFullWidth: true, action: {})
    }
    .padding()
}
