import SwiftUI

// MARK: - Onboarding Slide Card View
// Renders a single slide. Used inside ForEach in OnboardingSliderView.
// Separate struct (not a private var) because it is reused in a ForEach.

struct OnboardingSlideCardView: View {

    // MARK: - Properties

    let slide: OnboardingSlide
    let lang: LocalizationManager

    // MARK: - Body

    var body: some View {
        if slide.isCTASlide {
            ctaSlideBody
        } else {
            standardSlideBody
        }
    }

    // MARK: - Standard Slide (slides 1–7)

    private var standardSlideBody: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 24) {
                // Icon with tinted background
                ZStack {
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(slide.accentColor.opacity(0.12))
                        .frame(width: 120, height: 120)

                    Image(systemName: slide.symbolName)
                        .font(.system(size: 64))
                        .foregroundStyle(slide.accentColor)
                }

                // Title
                Text(lang.s(slide.titleKey))
                    .font(SpentyFonts.title2)
                    .foregroundStyle(Color.spentyTextPrimary)
                    .multilineTextAlignment(.center)

                // Description
                Text(lang.s(slide.descriptionKey))
                    .font(SpentyFonts.body)
                    .foregroundStyle(Color.spentyTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Spacer()
        }
        .padding(.horizontal, 32)
        .padding(.top, 60)
    }

    // MARK: - CTA Slide (slide 8)

    private var ctaSlideBody: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 20) {
                // Crown icon
                Image(systemName: slide.symbolName)
                    .font(.system(size: 64))
                    .foregroundStyle(Color.spentyPrimary)

                // Title
                Text(lang.s(slide.titleKey))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.spentyTextPrimary)
                    .multilineTextAlignment(.center)

                // Description
                Text(lang.s(slide.descriptionKey))
                    .font(SpentyFonts.body)
                    .foregroundStyle(Color.spentyTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)

                // Sparkle row
                HStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(Color.spentyPrimary)
                    }
                }
                .padding(.top, 4)

                // Commitment card
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.spentyPrimary)
                    Text("7 days • No commitment • Cancel anytime")
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(Color.spentyTextSecondary)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.spentyPrimary.opacity(0.08))
                )
            }
            .padding(.horizontal, 32)
            .padding(.top, 60)

            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    OnboardingSlideCardView(
        slide: OnboardingSlide.allSlides[0],
        lang: LocalizationManager.shared
    )
    .environment(LocalizationManager.shared)
}
