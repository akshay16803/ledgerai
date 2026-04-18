import SwiftUI

struct StatusBadge: View {
    let status: String

    private var backgroundColor: Color {
        switch status.lowercased() {
        case "approved", "active", "paid", "completed", "connected":
            return .spentySuccess.opacity(0.15)
        case "pending", "processing", "trialing", "partial":
            return .spentyWarning.opacity(0.15)
        case "rejected", "failed", "overdue", "cancelled", "expired":
            return .spentyError.opacity(0.15)
        case "draft":
            return .spentyTextSecondary.opacity(0.15)
        default:
            return .spentyInfo.opacity(0.15)
        }
    }

    private var textColor: Color {
        switch status.lowercased() {
        case "approved", "active", "paid", "completed", "connected":
            return .spentySuccess
        case "pending", "processing", "trialing", "partial":
            return .spentyWarning
        case "rejected", "failed", "overdue", "cancelled", "expired":
            return .spentyError
        case "draft":
            return .spentyTextSecondary
        default:
            return .spentyInfo
        }
    }

    var body: some View {
        Text(status.capitalized)
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
