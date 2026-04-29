import SwiftUI

// MARK: - Onboarding Slide Model
// Plain struct — no ViewModel, no @Observable. Slide data is purely static/compile-time.

struct OnboardingSlide: Identifiable {
    let id: Int
    let symbolName: String
    let accentColor: Color
    let titleKey: String
    let descriptionKey: String
    let isCTASlide: Bool

    init(
        id: Int,
        symbolName: String,
        accentColor: Color,
        titleKey: String,
        descriptionKey: String,
        isCTASlide: Bool = false
    ) {
        self.id = id
        self.symbolName = symbolName
        self.accentColor = accentColor
        self.titleKey = titleKey
        self.descriptionKey = descriptionKey
        self.isCTASlide = isCTASlide
    }
}

// MARK: - Static Slide Data

extension OnboardingSlide {
    static let allSlides: [OnboardingSlide] = [
        OnboardingSlide(
            id: 1,
            symbolName: "envelope.badge.fill",
            accentColor: Color.spentyInfo,
            titleKey: "onboarding_slide1_title",
            descriptionKey: "onboarding_slide1_desc"
        ),
        OnboardingSlide(
            id: 2,
            symbolName: "brain.head.profile",
            accentColor: Color.spentyPrimary,
            titleKey: "onboarding_slide2_title",
            descriptionKey: "onboarding_slide2_desc"
        ),
        OnboardingSlide(
            id: 3,
            symbolName: "chart.bar.fill",
            accentColor: Color.spentyAccent3,
            titleKey: "onboarding_slide3_title",
            descriptionKey: "onboarding_slide3_desc"
        ),
        OnboardingSlide(
            id: 4,
            symbolName: "bubble.left.and.bubble.right.fill",
            accentColor: Color.spentyAccent1,
            titleKey: "onboarding_slide4_title",
            descriptionKey: "onboarding_slide4_desc"
        ),
        OnboardingSlide(
            id: 5,
            symbolName: "chart.line.uptrend.xyaxis",
            accentColor: Color.spentyWarning,
            titleKey: "onboarding_slide5_title",
            descriptionKey: "onboarding_slide5_desc"
        ),
        OnboardingSlide(
            id: 6,
            symbolName: "arrow.triangle.2.circlepath",
            accentColor: Color.spentyInfo,
            titleKey: "onboarding_slide6_title",
            descriptionKey: "onboarding_slide6_desc"
        ),
        OnboardingSlide(
            id: 7,
            symbolName: "doc.text.fill",
            accentColor: Color.spentyPrimary,
            titleKey: "onboarding_slide7_title",
            descriptionKey: "onboarding_slide7_desc"
        ),
        OnboardingSlide(
            id: 8,
            symbolName: "crown.fill",
            accentColor: Color.spentyPrimary,
            titleKey: "onboarding_slide8_title",
            descriptionKey: "onboarding_slide8_desc",
            isCTASlide: true
        ),
    ]
}
