import SwiftUI

// MARK: - Onboarding Slide Card View
// Direction 1 — Real screenshots inside a clean iPhone frame.
// Each slide shows a full-bleed screenshot from the actual SpentyAI iOS app
// (bundled in Assets.xcassets) inside a minimal Space-Black titanium frame
// floating on the per-slide gradient. No fake mocks. No invented capability.

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
        // Phone frame proportions match real iPhone (≈ 1 : 2.04).
        // Limit phone height so title + description + bottom controls all fit
        // on 6.1" devices at the smallest supported safe-area.
        let phoneAspect: CGFloat = 2.04
        let availH = geo.size.height * 0.42
        let phoneW = min(geo.size.width * 0.66, availH / phoneAspect)
        let phoneH = phoneW * phoneAspect

        return ZStack {
            // 1. Full-screen gradient (per-slide identity)
            LinearGradient(
                colors: slide.gradientColors.isEmpty
                    ? [Color.black, Color(hex: 0x1C1C1E)]
                    : slide.gradientColors,
                startPoint: .top,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // 2. Soft accent halo behind the phone
            Ellipse()
                .fill(slide.accentColor.opacity(0.32))
                .frame(width: phoneW * 1.6, height: phoneW * 1.4)
                .blur(radius: 90)
                .offset(x: 0, y: -phoneH * 0.35)
                .allowsHitTesting(false)

            // 3. Centre content stack
            VStack(spacing: 0) {
                Spacer().frame(height: 70) // breathe past skip + progress bar

                phoneFrame(width: phoneW, height: phoneH)

                VStack(alignment: .leading, spacing: 12) {
                    if !slide.categoryLabel.isEmpty {
                        categoryPill
                    }

                    Text(lang.s(slide.titleKey))
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .lineSpacing(2)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(lang.s(slide.descriptionKey))
                        .font(.system(size: 14.5))
                        .foregroundStyle(.white.opacity(0.74))
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
                .padding(.horizontal, 28)
                .padding(.top, 22)

                Spacer(minLength: 200)
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Phone Frame (real screenshot inside)
    // Calibrated to look like a Space Black iPhone 17 Pro:
    // outer titanium shell, black bezel, rounded screen, Dynamic Island,
    // tiny home indicator. Screenshot fills the inside.

    private func phoneFrame(width: CGFloat, height: CGFloat) -> some View {
        // Corner radii proportional to phone width (calibrated at 280pt)
        let outerCR  = width * 0.128
        let innerCR  = width * 0.102
        let screenCR = width * 0.080
        let bezel    = width * 0.018
        let diW      = width * 0.245
        let diH      = width * 0.046
        let diPad    = width * 0.050
        let hiW      = width * 0.176
        let hiBot    = width * 0.025

        return ZStack {
            // Side buttons behind body
            phoneButtons(width: width, height: height)

            // Main body
            ZStack(alignment: .top) {
                // Outer Space Black titanium shell
                RoundedRectangle(cornerRadius: outerCR, style: .continuous)
                    .fill(
                        LinearGradient(
                            stops: [
                                .init(color: Color(white: 0.42), location: 0.00),
                                .init(color: Color(white: 0.24), location: 0.28),
                                .init(color: Color(white: 0.18), location: 0.55),
                                .init(color: Color(white: 0.30), location: 0.78),
                                .init(color: Color(white: 0.15), location: 1.00),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                // Faint accent tint to tie the phone to the slide colour
                RoundedRectangle(cornerRadius: outerCR, style: .continuous)
                    .fill(slide.accentColor.opacity(0.07))

                // Top-edge highlight
                RoundedRectangle(cornerRadius: outerCR, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [.white.opacity(0.32), .white.opacity(0.09), .clear],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.0
                    )

                // Inner black bezel
                RoundedRectangle(cornerRadius: innerCR, style: .continuous)
                    .fill(Color.black)
                    .padding(bezel)

                // Real app screenshot
                screenshotImage()
                    .clipShape(RoundedRectangle(cornerRadius: screenCR, style: .continuous))
                    .padding(bezel + 0.5)

                // Dynamic Island pill on top of the screenshot
                Capsule()
                    .fill(Color.black)
                    .frame(width: diW, height: diH)
                    .padding(.top, diPad)

                // Home indicator
                VStack {
                    Spacer()
                    Capsule()
                        .fill(Color(white: 0.95).opacity(0.55))
                        .frame(width: hiW, height: 3)
                        .padding(.bottom, hiBot)
                }
            }
        }
        .frame(width: width, height: height)
        .shadow(color: slide.accentColor.opacity(0.35), radius: 36, x: 0, y: 22)
        .shadow(color: .black.opacity(0.55), radius: 18, x: 0, y: 10)
    }

    @ViewBuilder
    private func screenshotImage() -> some View {
        if let asset = slide.assetName {
            Image(asset)
                .resizable()
                .scaledToFill()
        } else {
            Color(hex: 0xF5F3F0)
        }
    }

    // Phone side buttons — purely decorative, fully proportional.
    private func phoneButtons(width: CGFloat, height: CGFloat) -> some View {
        let bw  = width * 0.020
        let br  = width * 0.011
        let frameColor = Color(white: 0.26)
        return ZStack {
            RoundedRectangle(cornerRadius: br)
                .fill(frameColor)
                .frame(width: bw, height: height * 0.040)
                .position(x: 0, y: height * 0.20)
            RoundedRectangle(cornerRadius: br)
                .fill(frameColor)
                .frame(width: bw, height: height * 0.062)
                .position(x: 0, y: height * 0.33)
            RoundedRectangle(cornerRadius: br)
                .fill(frameColor)
                .frame(width: bw, height: height * 0.062)
                .position(x: 0, y: height * 0.44)
            RoundedRectangle(cornerRadius: br)
                .fill(frameColor)
                .frame(width: bw, height: height * 0.076)
                .position(x: width, y: height * 0.34)
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

    // MARK: - Stat pill

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
                    .fill(Color(hex: 0xD4AF37).opacity(0.32))
                    .frame(width: geo.size.width * 1.1, height: geo.size.height * 0.55)
                    .blur(radius: 110)
                    .offset(x: 0, y: -geo.size.height * 0.25)

                VStack(spacing: 0) {
                    Spacer().frame(height: 92)

                    // Crown badge — premium feel
                    ZStack {
                        Circle()
                            .fill(Color(hex: 0xD4AF37).opacity(0.22))
                            .frame(width: 188, height: 188)
                            .blur(radius: 32)

                        Circle()
                            .stroke(Color(hex: 0xD4AF37).opacity(0.45), lineWidth: 1)
                            .frame(width: 148, height: 148)

                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [Color(hex: 0xF5D020), Color(hex: 0xD4AF37)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 122, height: 122)
                            .shadow(color: Color(hex: 0xD4AF37).opacity(0.6),
                                    radius: 28, x: 0, y: 16)

                        Image(systemName: "crown.fill")
                            .font(.system(size: 50))
                            .foregroundStyle(.white)
                    }

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
                    .padding(.top, 30)

                    Text(lang.s(slide.titleKey))
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 26)
                        .padding(.top, 16)

                    Text(lang.s(slide.descriptionKey))
                        .font(.system(size: 14.5))
                        .foregroundStyle(.white.opacity(0.74))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)
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
