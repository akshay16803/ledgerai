import SwiftUI

// MARK: - Onboarding Slide Card View (modern, presentable rebuild)
// Each slide keeps its existing dark gradient + accent colour identity but
// the busy texture / concentric rings / tiny iPhone mockup are gone. In their
// place: one large halo'd icon orb and a single floating "result card" that
// shows the outcome of the feature in plain language. Every claim still maps
// to a real backend endpoint — no new capabilities are invented here.

struct OnboardingSlideCardView: View {
    let slide: OnboardingSlide
    let lang: LocalizationManager

    var body: some View {
        if slide.isCTASlide {
            ctaSlide
        } else {
            GeometryReader { geo in
                regularSlide(geo: geo)
            }
        }
    }

    // MARK: - Regular Slide

    private func regularSlide(geo: GeometryProxy) -> some View {
        ZStack {
            // 1. Full-screen dark gradient (per-slide identity)
            LinearGradient(
                colors: slide.gradientColors.isEmpty
                    ? [Color.black, Color(hex: 0x1C1C1E)]
                    : slide.gradientColors,
                startPoint: .top,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // 2. One soft accent halo (replaces dot-grid + concentric rings)
            Ellipse()
                .fill(slide.accentColor.opacity(0.30))
                .frame(width: geo.size.width * 1.1, height: geo.size.height * 0.55)
                .blur(radius: 110)
                .offset(x: -geo.size.width * 0.10,
                        y: -geo.size.height * 0.25)
                .allowsHitTesting(false)

            // 3. Centre content
            VStack(spacing: 0) {
                Spacer().frame(height: 92) // breathe past skip + progress bar

                heroOrb
                    .padding(.top, 6)

                resultCard
                    .padding(.top, 26)
                    .padding(.horizontal, 26)

                VStack(alignment: .leading, spacing: 12) {
                    if !slide.categoryLabel.isEmpty {
                        categoryPill
                    }

                    Text(lang.s(slide.titleKey))
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .lineSpacing(2)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(lang.s(slide.descriptionKey))
                        .font(.system(size: 15))
                        .foregroundStyle(.white.opacity(0.72))
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)

                    if !slide.statPills.isEmpty {
                        HStack(spacing: 8) {
                            ForEach(slide.statPills, id: \.self) { pill in
                                statPillView(pill)
                            }
                        }
                        .padding(.top, 4)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 26)
                .padding(.top, 28)

                Spacer(minLength: 150) // room for dots + Next button overlay
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Hero icon orb

    private var heroOrb: some View {
        ZStack {
            Circle()
                .fill(slide.accentColor.opacity(0.22))
                .frame(width: 168, height: 168)
                .blur(radius: 30)

            Circle()
                .stroke(slide.accentColor.opacity(0.45), lineWidth: 1)
                .frame(width: 132, height: 132)

            Circle()
                .fill(
                    LinearGradient(
                        colors: [slide.accentColor, slide.accentColor.opacity(0.65)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 108, height: 108)
                .shadow(color: slide.accentColor.opacity(0.55), radius: 24, x: 0, y: 14)

            Image(systemName: slide.symbolName)
                .font(.system(size: 46, weight: .semibold))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.15), radius: 6, x: 0, y: 2)
        }
    }

    // MARK: - Category pill

    private var categoryPill: some View {
        HStack(spacing: 6) {
            Image(systemName: slide.symbolName)
                .font(.system(size: 9, weight: .bold))
            Text(slide.categoryLabel)
                .font(.system(size: 10, weight: .bold))
                .tracking(1.4)
        }
        .foregroundStyle(slide.accentColor)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(slide.accentColor.opacity(0.16))
        .overlay(Capsule().stroke(slide.accentColor.opacity(0.35), lineWidth: 1))
        .clipShape(Capsule())
    }

    // MARK: - Result card (per-slide)

    @ViewBuilder
    private var resultCard: some View {
        switch slide.id {
        case 1: emailResultCard
        case 2: aiChatResultCard
        case 3: dashboardResultCard
        case 4: insightsResultCard
        case 5: reportsResultCard
        case 6: cashFlowResultCard
        case 7: invoiceResultCard
        default: EmptyView()
        }
    }

    // Reusable glassmorphism card wrapper
    private func glassCard<Content: View>(
        @ViewBuilder _ content: () -> Content
    ) -> some View {
        content()
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white.opacity(0.07))
            .background(.ultraThinMaterial.opacity(0.22))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(.white.opacity(0.15), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: .black.opacity(0.30), radius: 18, x: 0, y: 10)
    }

    // 1 — Email auto-tracking
    private var emailResultCard: some View {
        glassCard {
            HStack(spacing: 12) {
                resultIcon("fork.knife", color: .orange)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Swiggy")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(slide.accentColor)
                        Text("Auto-tagged from email")
                            .font(.system(size: 11))
                            .foregroundStyle(.white.opacity(0.65))
                    }
                }
                Spacer(minLength: 6)
                Text("−₹847")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
        }
    }

    // 2 — AI Finance Buddy
    private var aiChatResultCard: some View {
        glassCard {
            VStack(alignment: .leading, spacing: 10) {
                chatBubble(
                    text: "Spent ₹500 on lunch",
                    isUser: true
                )
                chatBubble(
                    text: "✓ Logged ₹500 to Food, paid by HDFC",
                    isUser: false
                )
            }
        }
    }

    private func chatBubble(text: String, isUser: Bool) -> some View {
        HStack {
            if isUser { Spacer(minLength: 24) }
            Text(text)
                .font(.system(size: 12.5, weight: isUser ? .medium : .semibold))
                .foregroundStyle(isUser ? .white : .white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    isUser
                        ? AnyShapeStyle(Color.white.opacity(0.16))
                        : AnyShapeStyle(slide.accentColor.opacity(0.30))
                )
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            if !isUser { Spacer(minLength: 24) }
        }
    }

    // 3 — Dashboard / Money in one place
    private var dashboardResultCard: some View {
        glassCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Total balance")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65))
                    Spacer()
                    Text("Live")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(slide.accentColor)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(slide.accentColor.opacity(0.18))
                        .clipShape(Capsule())
                }
                Text("₹1,84,520")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                HStack(spacing: 6) {
                    accountBadge("HDFC", "🏦")
                    accountBadge("ICICI", "💳")
                    accountBadge("Cash", "💵")
                    Text("+1")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.55))
                        .padding(.horizontal, 7).padding(.vertical, 4)
                        .background(.white.opacity(0.10))
                        .clipShape(Capsule())
                }
            }
        }
    }

    private func accountBadge(_ name: String, _ glyph: String) -> some View {
        HStack(spacing: 4) {
            Text(glyph).font(.system(size: 11))
            Text(name).font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.white.opacity(0.85))
        }
        .padding(.horizontal, 7).padding(.vertical, 4)
        .background(.white.opacity(0.10))
        .clipShape(Capsule())
    }

    // 4 — AI Insights
    private var insightsResultCard: some View {
        glassCard {
            VStack(alignment: .leading, spacing: 10) {
                chatBubble(
                    text: "How much did I save this month?",
                    isUser: true
                )
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(slide.accentColor)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("₹12,400 saved")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                        Text("23% more than last month")
                            .font(.system(size: 11))
                            .foregroundStyle(.white.opacity(0.65))
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    // 5 — Reports / Visual story
    private var reportsResultCard: some View {
        glassCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("This month's spend")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
                HStack(alignment: .bottom, spacing: 10) {
                    reportBar("Food", height: 50, value: "₹8.2k")
                    reportBar("Shop", height: 32, value: "₹5.1k")
                    reportBar("Bills", height: 70, value: "₹11k")
                    reportBar("Travel", height: 22, value: "₹3.4k")
                    reportBar("Misc", height: 14, value: "₹2.1k")
                }
            }
        }
    }

    private func reportBar(_ label: String, height: CGFloat, value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.white.opacity(0.85))
            RoundedRectangle(cornerRadius: 4)
                .fill(
                    LinearGradient(
                        colors: [slide.accentColor, slide.accentColor.opacity(0.55)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .frame(height: height)
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
    }

    // 6 — Cash flow / EMI radar
    private var cashFlowResultCard: some View {
        glassCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Next month's outflow")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65))
                    Spacer()
                    Text("Detected")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(slide.accentColor)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(slide.accentColor.opacity(0.18))
                        .clipShape(Capsule())
                }
                Text("₹23,500")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                VStack(spacing: 6) {
                    cashFlowRow("HDFC Home Loan", "5 May", "₹14,200")
                    cashFlowRow("ICICI SIP", "10 May", "₹5,000")
                    cashFlowRow("Netflix", "12 May", "₹649")
                }
            }
        }
    }

    private func cashFlowRow(_ name: String, _ date: String, _ amt: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "calendar")
                .font(.system(size: 10))
                .foregroundStyle(slide.accentColor)
            Text(name)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.85))
            Spacer()
            Text(date)
                .font(.system(size: 10))
                .foregroundStyle(.white.opacity(0.55))
            Text(amt)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
        }
    }

    // 7 — Invoice
    private var invoiceResultCard: some View {
        glassCard {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(slide.accentColor.opacity(0.20))
                        .frame(width: 44, height: 56)
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(slide.accentColor)
                }
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("INV-0024")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        Text("· GST 18%")
                            .font(.system(size: 11))
                            .foregroundStyle(.white.opacity(0.55))
                    }
                    Text("Polaris Ventures")
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.7))
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(slide.accentColor)
                        Text("Sent · PDF ready")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.white.opacity(0.85))
                    }
                }
                Spacer(minLength: 6)
                Text("₹1,77,000")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
        }
    }

    // MARK: - Helpers

    private func resultIcon(_ symbol: String, color: Color) -> some View {
        ZStack {
            Circle().fill(color.opacity(0.20)).frame(width: 38, height: 38)
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
        }
    }

    private func statPillView(_ text: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: "checkmark")
                .font(.system(size: 9, weight: .bold))
            Text(text)
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(.white.opacity(0.92))
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(.white.opacity(0.10))
        .overlay(Capsule().stroke(.white.opacity(0.20), lineWidth: 1))
        .clipShape(Capsule())
    }

    // MARK: - CTA Slide

    private var ctaSlide: some View {
        GeometryReader { geo in
            ZStack {
                LinearGradient(
                    colors: slide.gradientColors.isEmpty
                        ? [Color(hex: 0x111111), Color(hex: 0x1C1C1E)]
                        : slide.gradientColors,
                    startPoint: .top,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                Ellipse()
                    .fill(Color(hex: 0xD4AF37).opacity(0.30))
                    .frame(width: geo.size.width * 1.1, height: geo.size.height * 0.55)
                    .blur(radius: 110)
                    .offset(x: -geo.size.width * 0.10,
                            y: -geo.size.height * 0.25)

                VStack(spacing: 0) {
                    Spacer().frame(height: 92)

                    // Crown badge — single layered orb (consistent with feature slides)
                    ZStack {
                        Circle()
                            .fill(Color(hex: 0xD4AF37).opacity(0.22))
                            .frame(width: 168, height: 168)
                            .blur(radius: 30)

                        Circle()
                            .stroke(Color(hex: 0xD4AF37).opacity(0.45), lineWidth: 1)
                            .frame(width: 132, height: 132)

                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [Color(hex: 0xF5D020), Color(hex: 0xD4AF37)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 108, height: 108)
                            .shadow(color: Color(hex: 0xD4AF37).opacity(0.55),
                                    radius: 24, x: 0, y: 14)

                        Image(systemName: "crown.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(.white)
                    }

                    // Premium trial badge
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 11, weight: .bold))
                        Text("7 DAYS FREE")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(1.6)
                    }
                    .foregroundStyle(Color(hex: 0xD4AF37))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Color(hex: 0xD4AF37).opacity(0.16))
                    .overlay(Capsule().stroke(Color(hex: 0xD4AF37).opacity(0.45), lineWidth: 1))
                    .clipShape(Capsule())
                    .padding(.top, 28)

                    Text(lang.s(slide.titleKey))
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 26)
                        .padding(.top, 16)

                    Text(lang.s(slide.descriptionKey))
                        .font(.system(size: 14.5))
                        .foregroundStyle(.white.opacity(0.72))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 28)
                        .padding(.top, 10)
                        .lineSpacing(5)

                    VStack(spacing: 10) {
                        ctaFeatureRow("All 7 features fully unlocked")
                        ctaFeatureRow("Zero limits — every account & history")
                        ctaFeatureRow("Charged only after day 7 — cancel any time")
                    }
                    .padding(.horizontal, 36)
                    .padding(.top, 22)

                    Spacer(minLength: 150)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func ctaFeatureRow(_ text: String) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(Color(hex: 0xD4AF37).opacity(0.18))
                    .frame(width: 24, height: 24)
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color(hex: 0xD4AF37))
            }
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.88))
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Preview
#Preview("Onboarding · Slide 1") {
    OnboardingSlideCardView(slide: OnboardingSlide.allSlides[0],
                            lang: LocalizationManager.shared)
        .environment(LocalizationManager.shared)
}
