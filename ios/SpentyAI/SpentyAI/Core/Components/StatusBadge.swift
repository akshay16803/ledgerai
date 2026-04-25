import SwiftUI

struct StatusBadge: View {
    let status: String

    /// Convert snake_case backend values to human-readable title, e.g.
    /// "corrected_with_warnings" → "Corrected With Warnings"
    private var displayText: String {
        status.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private var backgroundColor: Color {
        switch status.lowercased() {
        case "approved", "active", "paid", "completed", "connected",
             "verified", "corrected":
            return .spentySuccess.opacity(0.15)
        case "pending", "processing", "trialing", "partial",
             "corrected_with_warnings", "skipped":
            return .spentyWarning.opacity(0.15)
        case "rejected", "failed", "overdue", "cancelled", "expired",
             "issues_found":
            return .spentyError.opacity(0.15)
        case "draft":
            return .spentyTextSecondary.opacity(0.15)
        default:
            return .spentyInfo.opacity(0.15)
        }
    }

    private var textColor: Color {
        switch status.lowercased() {
        case "approved", "active", "paid", "completed", "connected",
             "verified", "corrected":
            return .spentySuccess
        case "pending", "processing", "trialing", "partial",
             "corrected_with_warnings", "skipped":
            return .spentyWarning
        case "rejected", "failed", "overdue", "cancelled", "expired",
             "issues_found":
            return .spentyError
        case "draft":
            return .spentyTextSecondary
        default:
            return .spentyInfo
        }
    }

    var body: some View {
        Text(displayText)
            .font(SpentyFonts.caption1)
            .fontWeight(.medium)
            .foregroundColor(textColor)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .clipShape(Capsule())
    }
}

#Preview {
    VStack(spacing: 8) {
        StatusBadge(status: "approved")
        StatusBadge(status: "pending")
        StatusBadge(status: "rejected")
        StatusBadge(status: "draft")
    }
}
