import SwiftUI

/// A selectable filter pill used in filter bars and toolbars.
/// Toggles between selected (accent) and unselected (secondary) appearance.
struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    /// Creates a FilterChip.
    /// - Parameters:
    ///   - label: The text displayed on the chip.
    ///   - isSelected: Whether the chip is currently active.
    ///   - action: Closure invoked on tap.
    init(_ label: String, isSelected: Bool, action: @escaping () -> Void) {
        self.label = label
        self.isSelected = isSelected
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(SpentyFonts.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundStyle(isSelected ? .white : SpentyColors.textSecondary)
                .padding(.horizontal, SpentySpacing.md)
                .padding(.vertical, SpentySpacing.sm)
                .background(isSelected ? SpentyColors.brandAccent : SpentyColors.bgSecondary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.15), value: isSelected)
    }
}

#Preview {
    HStack(spacing: SpentySpacing.sm) {
        FilterChip("All", isSelected: true, action: {})
        FilterChip("Pending", isSelected: false, action: {})
        FilterChip("Paid", isSelected: false, action: {})
    }
    .padding()
}
