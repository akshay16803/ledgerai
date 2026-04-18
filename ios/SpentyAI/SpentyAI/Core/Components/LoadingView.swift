import SwiftUI

struct LoadingView: View {
    var message: String?

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .controlSize(.large)
                .tint(.spentyPrimary)
            if let message {
                Text(message)
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.spentyBgPrimary)
    }
}

#Preview {
    LoadingView(message: "Loading your data...")
}
