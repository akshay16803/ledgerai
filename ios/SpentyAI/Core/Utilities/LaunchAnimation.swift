import SwiftUI

/// Branded launch animation that replaces the default ProgressView splash.
struct LaunchAnimationView: View {
    var onComplete: () -> Void

    @State private var showTitle = false
    @State private var showSubtitle = false
    @State private var activeDot = 0
    @State private var animationFinished = false

    private let dotCount = 3
    private let dotSize: CGFloat = 8
    private let totalDuration: Double = 1.5

    var body: some View {
        ZStack {
            SpentyColors.brandPrimary
                .ignoresSafeArea()

            VStack(spacing: SpentySpacing.medium) {
                // App title
                Text("SpentyAI")
                    .font(SpentyFonts.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
                    .opacity(showTitle ? 1 : 0)
                    .scaleEffect(showTitle ? 1.0 : 0.8)

                // Subtitle
                Text("Smart Finance Manager")
                    .font(SpentyFonts.body)
                    .foregroundStyle(.white.opacity(0.8))
                    .opacity(showSubtitle ? 1 : 0)

                Spacer()
                    .frame(height: SpentySpacing.large)

                // Pulsing dots loader
                HStack(spacing: SpentySpacing.small) {
                    ForEach(0..<dotCount, id: \.self) { index in
                        Circle()
                            .fill(.white)
                            .frame(width: dotSize, height: dotSize)
                            .scaleEffect(activeDot == index ? 1.4 : 0.8)
                            .opacity(activeDot == index ? 1.0 : 0.4)
                            .animation(
                                .easeInOut(duration: 0.4),
                                value: activeDot
                            )
                    }
                }
                .opacity(showSubtitle ? 1 : 0)
            }
            .padding()
        }
        .onAppear {
            startAnimation()
        }
    }

    private func startAnimation() {
        // Title animates in with spring
        withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
            showTitle = true
        }

        // Subtitle fades in after 0.3s
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(.easeIn(duration: 0.3)) {
                showSubtitle = true
            }
            startDotAnimation()
        }

        // Call onComplete after total duration
        DispatchQueue.main.asyncAfter(deadline: .now() + totalDuration) {
            guard !animationFinished else { return }
            animationFinished = true
            onComplete()
        }
    }

    private func startDotAnimation() {
        // Cycle through dots every 0.3s
        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { timer in
            if animationFinished {
                timer.invalidate()
                return
            }
            activeDot = (activeDot + 1) % dotCount
        }
    }
}

#Preview {
    LaunchAnimationView {
        print("Launch animation complete")
    }
}
