import SwiftUI

struct OnboardingSliderView: View {

    @Environment(LocalizationManager.self) var lang
    @State private var currentSlide = 0
    var onComplete: () -> Void

    private let slides = OnboardingSlide.allSlides

    var body: some View {
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

            // ── Skip button ───────────────────────────────────────────
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
                    .background(.white.opacity(0.12), in: Capsule())
                }
                .padding(.horizontal, 20)
                .padding(.top, 56)
                .transition(.opacity)
                .animation(.easeInOut(duration: 0.2), value: currentSlide)
            }

            // ── Bottom controls ───────────────────────────────────────
            VStack {
                Spacer()
                VStack(spacing: 20) {
                    dotIndicators
                    bottomButton
                        .padding(.horizontal, 24)
                }
                .padding(.bottom, 44)
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
