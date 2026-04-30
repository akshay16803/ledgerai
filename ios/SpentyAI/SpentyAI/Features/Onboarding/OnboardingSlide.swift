import SwiftUI

// MARK: - Onboarding Slide Model

struct OnboardingSlide: Identifiable {
    let id: Int
    let symbolName: String
    let accentColor: Color
    let titleKey: String
    let descriptionKey: String
    let categoryLabel: String   // Short badge label (e.g. "AUTO TRACKING")
    let statPills: [String]     // 2 short benefit bullets
    let gradientColors: [Color] // Top-section gradient
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
        self.id = id
        self.symbolName = symbolName
        self.accentColor = accentColor
        self.titleKey = titleKey
        self.descriptionKey = descriptionKey
        self.categoryLabel = categoryLabel
        self.statPills = statPills
        self.gradientColors = gradientColors
        self.isCTASlide = isCTASlide
    }
}

// MARK: - Static Slide Data

extension OnboardingSlide {
    static let allSlides: [OnboardingSlide] = [

        // 1 – Email Auto-Tracking
        OnboardingSlide(
            id: 1,
            symbolName: "envelope.badge.fill",
            accentColor: Color(hex: 0x0A84FF),
            titleKey: "onboarding_slide1_title",
            descriptionKey: "onboarding_slide1_desc",
            categoryLabel: "AUTO TRACKING",
            statPills: ["Zero typing", "Auto-detected"],
            gradientColors: [Color(hex: 0x0A84FF), Color(hex: 0x00C7BE)]
        ),

        // 2 – AI Accounting
        OnboardingSlide(
            id: 2,
            symbolName: "brain.head.profile",
            accentColor: Color.spentyPrimary,
            titleKey: "onboarding_slide2_title",
            descriptionKey: "onboarding_slide2_desc",
            categoryLabel: "AI ASSISTANT",
            statPills: ["Instant answers", "No jargon"],
            gradientColors: [Color(hex: 0x248A3D), Color(hex: 0x34C759)]
        ),

        // 3 – Dashboard
        OnboardingSlide(
            id: 3,
            symbolName: "chart.bar.fill",
            accentColor: Color(hex: 0x5E5CE6),
            titleKey: "onboarding_slide3_title",
            descriptionKey: "onboarding_slide3_desc",
            categoryLabel: "DASHBOARD",
            statPills: ["All accounts", "Real-time"],
            gradientColors: [Color(hex: 0x3634A3), Color(hex: 0x5E5CE6)]
        ),

        // 4 – AI Insights
        OnboardingSlide(
            id: 4,
            symbolName: "bubble.left.and.bubble.right.fill",
            accentColor: Color(hex: 0xFF9F0A),
            titleKey: "onboarding_slide4_title",
            descriptionKey: "onboarding_slide4_desc",
            categoryLabel: "SMART INSIGHTS",
            statPills: ["Ask anything", "Like a CA"],
            gradientColors: [Color(hex: 0xFF6B35), Color(hex: 0xFF9F0A)]
        ),

        // 5 – Reports
        OnboardingSlide(
            id: 5,
            symbolName: "chart.line.uptrend.xyaxis",
            accentColor: Color(hex: 0x34C759),
            titleKey: "onboarding_slide5_title",
            descriptionKey: "onboarding_slide5_desc",
            categoryLabel: "REPORTS",
            statPills: ["Visual charts", "Any period"],
            gradientColors: [Color(hex: 0x1B5E20), Color(hex: 0x2E7D32)]
        ),

        // 6 – Mandate & Cash Flow
        OnboardingSlide(
            id: 6,
            symbolName: "arrow.triangle.2.circlepath",
            accentColor: Color(hex: 0x0062CC),
            titleKey: "onboarding_slide6_title",
            descriptionKey: "onboarding_slide6_desc",
            categoryLabel: "CASH FLOW",
            statPills: ["Never miss EMI", "Plan ahead"],
            gradientColors: [Color(hex: 0x0040DD), Color(hex: 0x32ADE6)]
        ),

        // 7 – Invoices & Vendors
        OnboardingSlide(
            id: 7,
            symbolName: "doc.text.fill",
            accentColor: Color(hex: 0x0062CC),
            titleKey: "onboarding_slide7_title",
            descriptionKey: "onboarding_slide7_desc",
            categoryLabel: "INVOICING",
            statPills: ["GST ready", "Professional"],
            gradientColors: [Color(hex: 0x004E92), Color(hex: 0x000428)]
        ),

        // 8 – CTA
        OnboardingSlide(
            id: 8,
            symbolName: "crown.fill",
            accentColor: Color(hex: 0xD4AF37),
            titleKey: "onboarding_slide8_title",
            descriptionKey: "onboarding_slide8_desc",
            categoryLabel: "GO PREMIUM",
            statPills: ["7 days free", "Cancel anytime"],
            gradientColors: [Color(hex: 0x1C1C1E), Color(hex: 0x2C2C2E)],
            isCTASlide: true
        ),
    ]
}
