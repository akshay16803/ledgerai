import SwiftUI

/// A standard header for sheets and modals.
/// Displays a title (and optional subtitle) on the left with a close button on the right,
/// separated from content by a bottom border.
struct SheetHeader: View {
    let title: String
    let subtitle: String?
    let onClose: () -> Void

    /// Creates a SheetHeader.
    /// - Parameters:
    ///   - title: The sheet title.
    ///   - subtitle: Optional descriptive subtitle below the title.
    ///   - onClose: Closure invoked when the close button is tapped.
    init(
        _ title: String,
        subtitle: String? = nil,
        onClose: @escaping () -> Void
    ) {
        self.title = title
        self.subtitle = subtitle
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text(title)
                        .font(SpentyFonts.heading)
                        .foregroundStyle(SpentyColors.textPrimary)

                    if let subtitle {
                        Text(subtitle)
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }
                }

                Spacer()

                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(SpentyColors.textSecondary)
                        .frame(width: 32, height: 32)
                        .background(SpentyColors.bgSecondary)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)

            Divider()
                .overlay(SpentyColors.borderSubtle)
        }
    }
}

#Preview {
    VStack {
        SheetHeader("New Invoice", subtitle: "Create a new sales invoice", onClose: {})
        SheetHeader("Settings", onClose: {})
        Spacer()
    }
    .background(SpentyColors.surface)
}
