import SwiftUI

struct OnboardingSliderView: View {

    @Environment(LocalizationManager.self) var lang
    @State private var currentSlide = 0
    var onComplete: () -> Void

    private let slides = OnboardingSlide.allSlides

    var body: some View {
        // ─────────────────────────────────────────────────────────────────
        // NOTE: The outer ZStack intentionally has NO .ignoresSafeArea().
        // Only the TabView inside ignores the safe area so it can paint
        // the gradient under the Dynamic Island. The control overlays
        // (skip button, bottom controls) are in a plain VStack that
        // naturally sits within the safe-area layout guide, so the skip
        // button always appears just below the Dynamic Island / status bar
        // and never overlaps it.
        // ─────────────────────────────────────────────────────────────────
        ZStack(alignment: .top) {

            // ── Full-screen paged slides ──────────────────────────────
            TabView(selection: $currentSlide) {
                ForEach(slides.indices, id: \.self) { index in
                    OnboardingSlideCardView(slide: slides[index], lang: lang)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()

            // ── Skip button — respects safe area naturally ────────────
            // padding(.top, 12) is relative to the bottom of the safe
            // area inset, so this is always comfortably below the clock
            // and battery icons on every iPhone model.
            if currentSlide < slides.count - 1 {
                HStack {
                    Spacer()
                    Button(lang.s("onboarding_skip")) {
                        withAnimation(.easeInOut(duration: 0.3)) { onComplete() }
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(.white.opacity(0.14), in: Capsule())
                    .overlay(Capsule().stroke(.white.opacity(0.22), lineWidth: 1))
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .transition(.opacity)
                .animation(.easeInOut(duration: 0.2), value: currentSlide)
            }

            // ── Bottom controls ───────────────────────────────────────
            VStack {
                Spacer()
                VStack(spacing: 18) {
                    dotIndicators
                    bottomButton
                        .padding(.horizontal, 24)
                }
                .padding(.bottom, 40)
            }
        }
    }

    // MARK: - Dot Indicators
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
