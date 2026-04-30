import SwiftUI

// MARK: - Onboarding Slide Model

struct OnboardingSlide: Identifiable {
    let id: Int
    let symbolName: String
    let accentColor: Color       // Bright glow / pill colour
    let titleKey: String
    let descriptionKey: String
    let categoryLabel: String
    let statPills: [String]
    let gradientColors: [Color]  // Deep dark full-screen gradient
    let isCTASlide: Bool

    init(
        id: Int,
        symbolName: String,
        accentColor: Color,
        titleKey: String,
        descriptionKey: String,
        categoryLabel: String = "",
        statPills: [String] = [],
        gradientColors: [Color] = [],
        isCTASlide: Bool = false
    ) {
        self.id            = id
        self.symbolName    = symbolName
        self.accentColor   = accentColor
        self.titleKey      = titleKey
        self.descriptionKey = descriptionKey
        self.categoryLabel = categoryLabel
        self.statPills     = statPills
        self.gradientColors = gradientColors
        self.isCTASlide    = isCTASlide
    }
}

// MARK: - Static Slide Data

extension OnboardingSlide {
    static let allSlides: [OnboardingSlide] = [

        // 1 – Email Auto-Tracking  →  Royal Blue
        OnboardingSlide(
            id: 1,
            symbolName: "envelope.badge.fill",
            accentColor: Color(hex: 0x4A8EFF),
            titleKey: "onboarding_slide1_title",
            descriptionKey: "onboarding_slide1_desc",
            categoryLabel: "AUTO TRACKING",
            statPills: ["Zero typing", "Auto-detected"],
            gradientColors: [Color(hex: 0x060E2E), Color(hex: 0x0D2B6B), Color(hex: 0x1565C0)]
        ),

        // 2 – AI Finance Buddy  →  Forest Green
        OnboardingSlide(
            id: 2,
            symbolName: "brain.head.profile",
            accentColor: Color(hex: 0x30D158),
            titleKey: "onboarding_slide2_title",
            descriptionKey: "onboarding_slide2_desc",
            categoryLabel: "AI ASSISTANT",
            statPills: ["Instant answers", "No jargon"],
            gradientColors: [Color(hex: 0x041A0C), Color(hex: 0x0A3D1E), Color(hex: 0x1B6B38)]
        ),

        // 3 – Dashboard  →  Deep Violet
        OnboardingSlide(
            id: 3,
            symbolName: "chart.bar.fill",
            accentColor: Color(hex: 0xBF5AF2),
            titleKey: "onboarding_slide3_title",
            descriptionKey: "onboarding_slide3_desc",
            categoryLabel: "DASHBOARD",
            statPills: ["All accounts", "Real-time"],
            gradientColors: [Color(hex: 0x0D0026), Color(hex: 0x2A0A5E), Color(hex: 0x4527A0)]
        ),

        // 4 – AI Insights  →  Sunset Orange
        OnboardingSlide(
            id: 4,
            symbolName: "bubble.left.and.bubble.right.fill",
            accentColor: Color(hex: 0xFF9F0A),
            titleKey: "onboarding_slide4_title",
            descriptionKey: "onboarding_slide4_desc",
            categoryLabel: "SMART INSIGHTS",
            statPills: ["Ask anything", "Like a CA"],
            gradientColors: [Color(hex: 0x200500), Color(hex: 0x6B1A00), Color(hex: 0xBF3200)]
        ),

        // 5 – Reports  →  Emerald
        OnboardingSlide(
            id: 5,
            symbolName: "chart.line.uptrend.xyaxis",
            accentColor: Color(hex: 0x34D399),
            titleKey: "onboarding_slide5_title",
            descriptionKey: "onboarding_slide5_desc",
            categoryLabel: "REPORTS",
            statPills: ["Visual charts", "Any period"],
            gradientColors: [Color(hex: 0x001E18), Color(hex: 0x004A38), Color(hex: 0x00785A)]
        ),

        // 6 – Cash Flow  →  Deep Indigo
        OnboardingSlide(
            id: 6,
            symbolName: "arrow.triangle.2.circlepath",
            accentColor: Color(hex: 0x818CF8),
            titleKey: "onboarding_slide6_title",
            descriptionKey: "onboarding_slide6_desc",
            categoryLabel: "CASH FLOW",
            statPills: ["Never miss EMI", "Plan ahead"],
            gradientColors: [Color(hex: 0x06082E), Color(hex: 0x111566), Color(hex: 0x1E2BA0)]
        ),

        // 7 – Invoices  →  Ocean Blue
        OnboardingSlide(
            id: 7,
            symbolName: "doc.text.fill",
            accentColor: Color(hex: 0x38BDF8),
            titleKey: "onboarding_slide7_title",
            descriptionKey: "onboarding_slide7_desc",
            categoryLabel: "INVOICING",
            statPills: ["GST ready", "Professional"],
            gradientColors: [Color(hex: 0x001929), Color(hex: 0x003456), Color(hex: 0x015A8C)]
        ),

        // 8 – CTA  →  Dark Gold
        OnboardingSlide(
            id: 8,
            symbolName: "crown.fill",
            accentColor: Color(hex: 0xD4AF37),
            titleKey: "onboarding_slide8_title",
            descriptionKey: "onboarding_slide8_desc",
            categoryLabel: "GO PREMIUM",
            statPills: ["7 days free", "Cancel anytime"],
            gradientColors: [Color(hex: 0x0A0800), Color(hex: 0x1C1500), Color(hex: 0x2E2200)],
            isCTASlide: true
        ),
    ]
}
