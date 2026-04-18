import SwiftUI

struct ErrorBanner: View {
    let message: String
    var onDismiss: (() -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.white)

            Text(message)
                .font(SpentyFonts.footnote)
                .foregroundColor(.white)
                .lineLimit(3)

            Spacer()

            if let onDismiss {
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white.opacity(0.8))
                }
            }
        }
        .padding(12)
        .background(Color.spentyError)
        .cornerRadius(10)
        .padding(.horizontal, 16)
    }
}

#Preview {
    ErrorBanner(message: "Something went wrong. Please try again.") {}
}
