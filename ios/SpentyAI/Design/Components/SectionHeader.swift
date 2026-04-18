import SwiftUI

/// A consistent section title bar with an optional trailing action button.
struct SectionHeader: View {
    let title: String
    let actionTitle: String?
    let action: (() -> Void)?

    /// Creates a SectionHeader.
    /// - Parameters:
    ///   - title: The section heading text.
    ///   - actionTitle: Optional label for a trailing action button.
    ///   - action: Optional closure invoked when the action button is tapped.
    init(
        _ title: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.actionTitle = actionTitle
        self.action = action
    }

    var body: some View {
        HStack {
            Text(title)
                .font(SpentyFonts.subheading)
                .foregroundStyle(SpentyColors.textPrimary)

            Spacer()

            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.brandAccent)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

#Preview {
    VStack(spacing: SpentySpacing.lg) {
        SectionHeader("Recent Transactions", actionTitle: "View All", action: {})
        SectionHeader("Summary")
    }
    .padding()
}
