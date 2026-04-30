import SwiftUI

struct OnboardingSliderView: View {

    // MARK: - Environment
    @Environment(LocalizationManager.self) var lang

    // MARK: - State
    @State private var currentSlide = 0

    // MARK: - Callbacks
    var onComplete: () -> Void

    private let slides = OnboardingSlide.allSlides
    private let brandPrimary = Color.spentyPrimary

    // MARK: - Body
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

            // ── Skip button (top-right, over gradient) ───────────────
            if currentSlide < slides.count - 1 {
                HStack {
                    Spacer()
                    Button(lang.s("onboarding_skip")) {
                        withAnimation(.easeInOut(duration: 0.3)) { onComplete() }
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(.black.opacity(0.18), in: Capsule())
                }
                .padding(.horizontal, 20)
                .padding(.top, 56)
                .transition(.opacity)
                .animation(.easeInOut(duration: 0.2), value: currentSlide)
            }

            // ── Bottom controls (dots + button) ──────────────────────
            VStack {
                Spacer()
                VStack(spacing: 18) {
                    dotIndicators
                    bottomButton
                        .padding(.horizontal, 24)
                }
                .padding(.bottom, 44)
            }
        }
    }

    // MARK: - Dot Indicators (active = wide capsule)
    private var dotIndicators: some View {
        HStack(spacing: 6) {
            ForEach(slides.indices, id: \.self) { index in
                if index == currentSlide {
                    Capsule()
                        .fill(brandPrimary)
                        .frame(width: 22, height: 7)
                } else {
                    Circle()
                        .fill(Color.primary.opacity(0.18))
                        .frame(width: 7, height: 7)
                }
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentSlide)
    }

    // MARK: - Bottom Button
    private var bottomButton: some View {
        Group {
            if currentSlide == slides.count - 1 {
                Button(lang.s("onboarding_get_started")) { onComplete() }
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 17)
                    .background(
                        LinearGradient(
                            colors: [Color(hex: 0xD4AF37), Color(hex: 0xB8860B)],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 16)
                    )
                    .shadow(color: Color(hex: 0xD4AF37).opacity(0.4), radius: 12, x: 0, y: 6)
            } else {
                Button(lang.s("onboarding_next")) {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                        currentSlide += 1
                    }
                }
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 17)
                .background(brandPrimary, in: RoundedRectangle(cornerRadius: 16))
                .shadow(color: brandPrimary.opacity(0.35), radius: 10, x: 0, y: 5)
            }
        }
    }
}

#Preview {
    OnboardingSliderView(onComplete: {})
        .environment(LocalizationManager.shared)
}
