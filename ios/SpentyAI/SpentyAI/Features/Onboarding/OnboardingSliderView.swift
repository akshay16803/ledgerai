import SwiftUI

struct OnboardingSliderView: View {

    // MARK: - Environment
    @Environment(LocalizationManager.self) var lang

    // MARK: - State
    @State private var currentSlide = 0

    // MARK: - Callbacks
    var onComplete: () -> Void

    // MARK: - Brand Colors
    private let brandPrimary = Color.spentyPrimary
    private let brandBg = Color.spentyBgPrimary

    private let slides = OnboardingSlide.allSlides

    // MARK: - Body
    var body: some View {
        ZStack(alignment: .top) {
            brandBg.ignoresSafeArea()

            VStack(spacing: 0) {
                // Skip button row
                HStack {
                    Spacer()
                    if currentSlide < slides.count - 1 {
                        Button(lang.s("onboarding_skip")) {
                            onComplete()
                        }
                        .font(.subheadline)
                        .foregroundStyle(Color.spentyTextSecondary)
                        .padding(.trailing, 20)
                        .padding(.top, 16)
                    }
                }
                .frame(height: 52)

                // Slide content
                TabView(selection: $currentSlide) {
                    ForEach(slides.indices, id: \.self) { index in
                        OnboardingSlideCardView(slide: slides[index], lang: lang)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut(duration: 0.3), value: currentSlide)

                // Dot indicators
                dotIndicators
                    .padding(.top, 16)

                // Bottom buttons
                bottomButtons
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                    .padding(.bottom, 48)
            }
        }
    }

    // MARK: - Sub-views

    private var dotIndicators: some View {
        HStack(spacing: 6) {
            ForEach(slides.indices, id: \.self) { index in
                Circle()
                    .fill(index == currentSlide ? brandPrimary : Color.spentyBorder)
                    .frame(width: 8, height: 8)
                    .animation(.easeInOut(duration: 0.2), value: currentSlide)
            }
        }
    }

    private var bottomButtons: some View {
        Group {
            if currentSlide == slides.count - 1 {
                // Get Started (CTA slide)
                Button(lang.s("onboarding_get_started")) {
                    onComplete()
                }
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(brandPrimary, in: RoundedRectangle(cornerRadius: 14))
            } else {
                // Next
                Button(lang.s("onboarding_next")) {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        currentSlide += 1
                    }
                }
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(brandPrimary, in: RoundedRectangle(cornerRadius: 14))
            }
        }
    }
}

#Preview {
    OnboardingSliderView(onComplete: {})
        .environment(LocalizationManager.shared)
}
