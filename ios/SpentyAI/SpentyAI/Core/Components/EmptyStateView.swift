import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: String
    var subtitle: String?
    var buttonTitle: String?
    var onAction: (() -> Void)?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.spentyTextSecondary.opacity(0.5))

            Text(title)
                .font(SpentyFonts.title3)
                .foregroundColor(.spentyTextPrimary)
                .multilineTextAlignment(.center)

            if let subtitle {
                Text(subtitle)
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextSecondary)
                    .multilineTextAlignment(.center)
            }

            if let buttonTitle, let onAction {
                Button(action: onAction) {
                    Text(buttonTitle)
                        .primaryButtonStyle()
                }
                .padding(.top, 8)
                .frame(maxWidth: 240)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    EmptyStateView(
        icon: "tray",
        title: "No Transactions",
        subtitle: "Add your first transaction to get started.",
        buttonTitle: "Add Transaction"
    ) {}
}
