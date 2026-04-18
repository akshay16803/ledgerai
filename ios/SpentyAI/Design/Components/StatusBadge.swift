import SwiftUI

/// Represents the possible statuses for a StatusBadge.
enum StatusType: String, CaseIterable {
    case approved, pending, rejected
    case paid, unpaid, partial
    case processing, failed
    case active, expired

    /// Human-readable display label.
    var label: String {
        rawValue.capitalized
    }

    /// Background color for the pill.
    var backgroundColor: Color {
        switch self {
        case .approved, .paid, .active:
            return SpentyColors.success.opacity(0.15)
        case .pending, .processing:
            return SpentyColors.warning.opacity(0.15)
        case .rejected, .failed, .expired:
            return SpentyColors.danger.opacity(0.15)
        case .unpaid:
            return SpentyColors.textMuted.opacity(0.15)
        case .partial:
            return SpentyColors.info.opacity(0.15)
        }
    }

    /// Text color for the pill.
    var textColor: Color {
        switch self {
        case .approved, .paid, .active:
            return SpentyColors.success
        case .pending, .processing:
            return SpentyColors.warning
        case .rejected, .failed, .expired:
            return SpentyColors.danger
        case .unpaid:
            return SpentyColors.textSecondary
        case .partial:
            return SpentyColors.info
        }
    }
}

/// A small color-coded status pill badge.
struct StatusBadge: View {
    let status: StatusType

    /// Creates a StatusBadge for the given status.
    /// - Parameter status: The status to display.
    init(_ status: StatusType) {
        self.status = status
    }

    var body: some View {
        Text(status.label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(status.textColor)
            .padding(.horizontal, SpentySpacing.sm)
            .padding(.vertical, SpentySpacing.xs)
            .background(status.backgroundColor)
            .clipShape(Capsule())
    }
}

#Preview {
    HStack(spacing: SpentySpacing.sm) {
        ForEach(StatusType.allCases, id: \.self) { status in
            StatusBadge(status)
        }
    }
    .padding()
}
