import SwiftUI

/// A centered empty-state placeholder for lists with no data.
/// Shows an icon, title, message, and an optional call-to-action button.
struct EmptyState: View {
    let icon: String
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?

    /// Creates an EmptyState view.
    /// - Parameters:
    ///   - icon: SF Symbol name for the illustration.
    ///   - title: Bold heading text.
    ///   - message: Descriptive body text.
    ///   - actionTitle: Optional label for a CTA button.
    ///   - action: Optional closure invoked when the CTA is tapped.
    init(
        icon: String,
        title: String,
        message: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.message = message
        self.actionTitle = actionTitle
        self.action = action
    }

    var body: some View {
        VStack(spacing: SpentySpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(SpentyColors.textMuted)

            VStack(spacing: SpentySpacing.sm) {
                Text(title)
                    .font(SpentyFonts.subheading)
                    .foregroundStyle(SpentyColors.textPrimary)

                Text(message)
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)
            }

            if let actionTitle, let action {
                PrimaryButton(actionTitle, action: action)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(SpentySpacing.xxl)
    }
}

#Preview {
    EmptyState(
        icon: "doc.text.magnifyingglass",
        title: "No Invoices Yet",
        message: "Create your first invoice to start tracking payments.",
        actionTitle: "Create Invoice",
        action: {}
    )
    .background(SpentyColors.bgPrimary)
}
