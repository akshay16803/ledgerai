import SwiftUI

/// A ViewModifier that applies a continuous shimmer loading animation.
/// A translucent gradient slides from left to right across the view.
struct ShimmerEffect: ViewModifier {
    let isActive: Bool
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        if isActive {
            content
                .overlay(
                    GeometryReader { geometry in
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0),
                                .init(color: .white.opacity(0.4), location: 0.5),
                                .init(color: .clear, location: 1)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geometry.size.width * 0.6)
                        .offset(x: geometry.size.width * phase)
                        .onAppear {
                            withAnimation(
                                .linear(duration: 1.5)
                                .repeatForever(autoreverses: false)
                            ) {
                                phase = 1.5
                            }
                        }
                    }
                )
                .clipped()
                .redacted(reason: .placeholder)
        } else {
            content
        }
    }
}

extension View {
    /// Applies a shimmer loading animation over the view.
    /// - Parameter isActive: Whether the shimmer effect is visible.
    func shimmer(isActive: Bool = true) -> some View {
        modifier(ShimmerEffect(isActive: isActive))
    }
}

#Preview {
    VStack(spacing: SpentySpacing.lg) {
        RoundedRectangle(cornerRadius: SpentyRadius.md)
            .fill(SpentyColors.bgSecondary)
            .frame(height: 20)
            .frame(maxWidth: 200)
            .shimmer()

        RoundedRectangle(cornerRadius: SpentyRadius.md)
            .fill(SpentyColors.bgSecondary)
            .frame(height: 14)
            .frame(maxWidth: 280)
            .shimmer()

        RoundedRectangle(cornerRadius: SpentyRadius.md)
            .fill(SpentyColors.bgSecondary)
            .frame(height: 14)
            .frame(maxWidth: 160)
            .shimmer()
    }
    .padding()
}
