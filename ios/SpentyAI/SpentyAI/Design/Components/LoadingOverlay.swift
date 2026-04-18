import SwiftUI

/// A full-screen semi-transparent overlay with a centered loading spinner.
/// Toggle visibility via the `isPresented` binding.
struct LoadingOverlay: View {
    @Binding var isPresented: Bool

    var body: some View {
        if isPresented {
            ZStack {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()

                ProgressView()
                    .controlSize(.large)
                    .tint(SpentyColors.brandAccent)
                    .padding(SpentySpacing.xl)
                    .background(SpentyColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.lg))
                    .shadow(color: .black.opacity(0.1), radius: 10, y: 4)
            }
            .transition(.opacity)
            .animation(.easeInOut(duration: 0.2), value: isPresented)
        }
    }
}

#Preview {
    ZStack {
        Color(SpentyColors.bgPrimary)
            .ignoresSafeArea()
        Text("Background content")
        LoadingOverlay(isPresented: .constant(true))
    }
}
