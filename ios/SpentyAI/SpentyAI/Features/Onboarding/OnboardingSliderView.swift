import SwiftUI

// MARK: - Onboarding Slider View
// Hosts the 8 paged slides plus the chrome around them: a Stories-style
// segmented progress bar at the top, the Skip button, dot indicators, and
// the bottom Next / Get Started CTA. Layout sits inside the safe area so
// nothing collides with the Dynamic Island.

struct OnboardingSliderView: View {

    @Environment(LocalizationManager.self) var lang
    @State private var currentSlide = 0
    var onComplete: () -> Void

    private let slides = OnboardingSlide.allSlides

    /// Apple App Review (May 2026) flagged iPhone-stretched iPad UI; cap the
    /// onboarding bottom CTA's width on iPad and centre it.
    private var isPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

    var body: some View {
        ZStack(alignment: .top) {

            // ── Full-screen paged slides (gradient renders under Dynamic Island) ──
            TabView(selection: $currentSlide) {
                ForEach(slides.indices, id: \.self) { index in
                    OnboardingSlideCardView(slide: slides[index], lang: lang)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            .animation(.spring(response: 0.45, dampingFraction: 0.85), value: currentSlide)

            // ── Top: segmented progress + skip ─────────────────────────────
            VStack(spacing: 12) {
                segmentedProgress
                    .padding(.horizontal, 18)
                    .padding(.top, 4)

                if currentSlide < slides.count - 1 {
                    HStack {
                        Spacer()
                        Button(lang.s("onboarding_skip")) {
                            withAnimation(.easeInOut(duration: 0.3)) { onComplete() }
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.88))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(.white.opacity(0.14), in: Capsule())
                        .overlay(Capsule().stroke(.white.opacity(0.22), lineWidth: 1))
                    }
                    .padding(.horizontal, 20)
                }
            }

            // ── Bottom controls ────────────────────────────────────────────
            VStack {
                Spacer()
                VStack(spacing: 18) {
                    dotIndicators
                    bottomButton
                        .padding(.horizontal, 24)
                        .frame(maxWidth: isPad ? 460 : .infinity)
                }
                .padding(.bottom, 36)
            }
        }
    }

    // MARK: - Segmented progress (Stories-style)

    private var segmentedProgress: some View {
        HStack(spacing: 5) {
            ForEach(slides.indices, id: \.self) { i in
                Capsule()
                    .fill(.white.opacity(i <= currentSlide ? 0.92 : 0.20))
                    .frame(height: 3)
                    .animation(
                        .spring(response: 0.5, dampingFraction: 0.85),
                        value: currentSlide
                    )
            }
        }
    }

    // MARK: - Dot indicators

    private var dotIndicators: some View {
        HStack(spacing: 6) {
            ForEach(slides.indices, id: \.self) { i in
                if i == currentSlide {
                    Capsule()
                        .fill(.white)
                        .frame(width: 22, height: 7)
                } else {
                    Circle()
                        .fill(.white.opacity(0.28))
                        .frame(width: 7, height: 7)
                }
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentSlide)
    }

    // MARK: - Bottom Button

    private var bottomButton: some View {
        let isCTA = currentSlide == slides.count - 1

        return Button(isCTA ? lang.s("onboarding_get_started") : lang.s("onboarding_next")) {
            if isCTA {
                onComplete()
            } else {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    currentSlide += 1
                }
            }
        }
        .font(.system(size: 17, weight: .semibold))
        .foregroundStyle(isCTA ? Color(hex: 0x1A1400) : .white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 17)
        .background(
            isCTA
            ? AnyShapeStyle(LinearGradient(
                colors: [Color(hex: 0xF5D020), Color(hex: 0xD4AF37)],
                startPoint: .leading, endPoint: .trailing))
            : AnyShapeStyle(Color.white.opacity(0.18)),
            in: RoundedRectangle(cornerRadius: 16)
        )
        .overlay(
            isCTA ? nil :
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.3), lineWidth: 1)
        )
    }
}

#Preview {
    OnboardingSliderView(onComplete: {})
        .environment(LocalizationManager.shared)
}
