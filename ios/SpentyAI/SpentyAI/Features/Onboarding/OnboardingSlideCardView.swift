import SwiftUI

// MARK: - Onboarding Slide Card View
// Full-screen dark gradient. Phone mock uses a real-looking iPhone frame
// (Space Black titanium shell + black bezel + Dynamic Island + side buttons).
// SF Symbols only — no emoji (renders as "?" in simulator).

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
        // Maintain real iPhone aspect ratio (≈ 1 : 2.16).
        // Height-constrained so the text block below still has room.
        let phoneAspect: CGFloat = 2.16
        let maxPhoneH   = geo.size.height * 0.52
        let phoneW      = min(geo.size.width * 0.62, maxPhoneH / phoneAspect)
        let phoneH      = phoneW * phoneAspect

        return ZStack {
            // ── 1. Full-screen gradient ──────────────────────────────────
            LinearGradient(
                colors: slide.gradientColors.isEmpty
                    ? [Color.black, Color(hex: 0x1C1C1E)]
                    : slide.gradientColors,
                startPoint: .top,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // ── 2. Dot grid texture (subtle depth) ───────────────────────
            Canvas { ctx, size in
                let spacing: CGFloat = 30
                let dot: CGFloat = 1.4
                var row: CGFloat = 0
                while row < size.height {
                    var col: CGFloat = 0
                    while col < size.width {
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: col, y: row, width: dot, height: dot)),
                            with: .color(.white.opacity(0.05))
                        )
                        col += spacing
                    }
                    row += spacing
                }
            }
            .allowsHitTesting(false)

            // ── 3. Primary glow blob ─────────────────────────────────────
            Ellipse()
                .fill(slide.accentColor.opacity(0.20))
                .frame(width: 240, height: 160)
                .blur(radius: 70)
                .offset(x: geo.size.width * 0.08, y: -(geo.size.height * 0.18))

            // ── 4. Concentric accent rings ───────────────────────────────
            ForEach([260, 185, 118] as [CGFloat], id: \.self) { d in
                Circle()
                    .stroke(
                        slide.accentColor.opacity(d == 260 ? 0.06 : d == 185 ? 0.10 : 0.16),
                        lineWidth: 1
                    )
                    .frame(width: d, height: d)
                    .offset(x: geo.size.width * 0.14, y: -(geo.size.height * 0.18))
            }

            // ── 5. Content column ────────────────────────────────────────
            VStack(spacing: 0) {
                // Space for skip button + safe area (skip button is in the
                // ZStack's safe-area layer, so slides must respect its height)
                Spacer().frame(height: 72)

                // ── Phone frame mockup ───────────────────────────────────
                phoneFrame(geo: geo)
                    .frame(width: phoneW, height: phoneH)

                // ── Text block ───────────────────────────────────────────
                VStack(alignment: .leading, spacing: 11) {

                    if !slide.categoryLabel.isEmpty {
                        HStack(spacing: 6) {
                            Image(systemName: slideIcon(slide.id))
                                .font(.system(size: 9, weight: .bold))
                            Text(slide.categoryLabel)
                                .font(.system(size: 10, weight: .bold))
                                .tracking(1.3)
                        }
                        .foregroundStyle(slide.accentColor)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(slide.accentColor.opacity(0.15))
                        .overlay(Capsule().stroke(slide.accentColor.opacity(0.35), lineWidth: 1))
                        .clipShape(Capsule())
                    }

                    Text(lang.s(slide.titleKey))
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .lineSpacing(2)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(lang.s(slide.descriptionKey))
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.66))
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
                .padding(.horizontal, 26)
                .padding(.top, 20)

                Spacer(minLength: 80)
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - SF Symbol per slide

    private func slideIcon(_ id: Int) -> String {
        switch id {
        case 1:  return "envelope.badge.fill"
        case 2:  return "brain.head.profile"
        case 3:  return "chart.bar.fill"
        case 4:  return "bubble.left.and.bubble.right.fill"
        case 5:  return "chart.line.uptrend.xyaxis"
        case 6:  return "arrow.triangle.2.circlepath"
        case 7:  return "doc.text.fill"
        default: return "sparkles"
        }
    }

    // MARK: - Realistic Phone Frame
    // All measurements are proportional to the phone frame's own width/height
    // so the frame looks correct at any size.

    private func phoneFrame(geo: GeometryProxy) -> some View {
        GeometryReader { pf in
            let pw = pf.size.width
            // Corner radii proportional to phone width (calibrated at 283pt)
            let outerCR: CGFloat = pw * 0.128   // ≈ 36pt
            let innerCR: CGFloat = pw * 0.102   // ≈ 29pt
            let screenCR: CGFloat = pw * 0.080  // ≈ 23pt
            let bezel: CGFloat   = pw * 0.016   // ≈ 4.5pt
            // Dynamic Island
            let diW: CGFloat = pw * 0.245        // ≈ 69pt
            let diH: CGFloat = pw * 0.046        // ≈ 13pt
            let diPad: CGFloat = pw * 0.050      // ≈ 14pt top pad
            // Home indicator
            let hiW: CGFloat = pw * 0.176        // ≈ 50pt
            let hiBot: CGFloat = pw * 0.025      // ≈ 7pt bottom pad

            ZStack {
                // Side buttons behind main body
                phoneButtons

                // ── Main phone body ──────────────────────────────────────
                ZStack(alignment: .top) {

                    // Outer shell: Space Black titanium gradient
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

                    // Accent tint (ties phone to slide colour)
                    RoundedRectangle(cornerRadius: outerCR, style: .continuous)
                        .fill(slide.accentColor.opacity(0.09))

                    // Frame highlight edge
                    RoundedRectangle(cornerRadius: outerCR, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [.white.opacity(0.32), .white.opacity(0.09), .clear],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.0
                        )

                    // Black screen bezel (inner)
                    RoundedRectangle(cornerRadius: innerCR, style: .continuous)
                        .fill(Color.black)
                        .padding(bezel)

                    // App screen content
                    mockScreen(for: slide.id)
                        .clipShape(RoundedRectangle(cornerRadius: screenCR, style: .continuous))
                        .padding(bezel + 0.5)

                    // Dynamic Island pill
                    Capsule()
                        .fill(Color.black)
                        .frame(width: diW, height: diH)
                        .padding(.top, diPad)

                    // Home indicator bar
                    VStack {
                        Spacer()
                        Capsule()
                            .fill(Color(white: 0.60).opacity(0.38))
                            .frame(width: hiW, height: 3)
                            .padding(.bottom, hiBot)
                    }
                }
            }
            .shadow(color: slide.accentColor.opacity(0.25), radius: 32, x: 0, y: 18)
            .shadow(color: .black.opacity(0.75), radius: 16, x: 0, y: 8)
        }
    }

    // Left (volume + silent) and right (power) buttons — fully proportional
    private var phoneButtons: some View {
        GeometryReader { g in
            let pw  = g.size.width
            let ph  = g.size.height
            let bw  = pw * 0.020   // button thickness ≈ 5.7pt
            let br  = pw * 0.011   // corner radius ≈ 3pt
            let frameColor = Color(white: 0.26)
            ZStack {
                // Silent switch (left)
                RoundedRectangle(cornerRadius: br)
                    .fill(frameColor)
                    .frame(width: bw, height: ph * 0.040)
                    .position(x: 0, y: ph * 0.20)
                // Volume up (left)
                RoundedRectangle(cornerRadius: br)
                    .fill(frameColor)
                    .frame(width: bw, height: ph * 0.062)
                    .position(x: 0, y: ph * 0.33)
                // Volume down (left)
                RoundedRectangle(cornerRadius: br)
                    .fill(frameColor)
                    .frame(width: bw, height: ph * 0.062)
                    .position(x: 0, y: ph * 0.44)
                // Power (right)
                RoundedRectangle(cornerRadius: br)
                    .fill(frameColor)
                    .frame(width: bw, height: ph * 0.076)
                    .position(x: pw, y: ph * 0.34)
            }
        }
    }

    // MARK: - Stat Pill

    private func statPillView(_ text: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: "checkmark")
                .font(.system(size: 9, weight: .bold))
            Text(text)
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(.white.opacity(0.90))
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(.white.opacity(0.10))
        .overlay(Capsule().stroke(.white.opacity(0.20), lineWidth: 1))
        .clipShape(Capsule())
    }

    // MARK: - Mock Screen Dispatcher

    @ViewBuilder
    private func mockScreen(for id: Int) -> some View {
        ZStack(alignment: .top) {
            Color(hex: 0xF5F3F0)
            switch id {
            case 1:  emailMock
            case 2:  aiChatMock
            case 3:  dashboardMock
            case 4:  insightsMock
            case 5:  reportsMock
            case 6:  cashFlowMock
            case 7:  invoiceMock
            default: EmptyView()
            }
        }
    }

    // MARK: - Shared: Mini Status Bar

    private var statusBar: some View {
        HStack {
            Text("9:41")
                .font(.system(size: 10, weight: .semibold))
                .padding(.leading, 12)
            Spacer()
            HStack(spacing: 3) {
                Image(systemName: "wifi")
                Image(systemName: "battery.75")
            }
            .font(.system(size: 10))
            .padding(.trailing, 12)
        }
        .frame(height: 22)
        .background(Color(hex: 0xF5F3F0))
    }

    // MARK: - Mock 1: Email Auto-Tracking

    private var emailMock: some View {
        VStack(spacing: 0) {
            statusBar
            HStack {
                Text("Transactions")
                    .font(.system(size: 13, weight: .bold))
                Spacer()
                Image(systemName: "envelope.badge.fill")
                    .foregroundStyle(Color(hex: 0x0A84FF))
                    .font(.system(size: 12))
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 7)
            HStack(spacing: 5) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.spentyPrimary)
                Text("3 new from email")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.spentyPrimary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Color.spentyPrimary.opacity(0.09))
            Divider()
            VStack(spacing: 0) {
                txnRow(sfSymbol: "fork.knife",             iconColor: .orange,
                       name: "Zomato",      cat: "Food",     amt: "−₹847",    pos: false)
                Divider().padding(.leading, 46)
                txnRow(sfSymbol: "bag.fill",               iconColor: Color(hex: 0x0A84FF),
                       name: "Amazon Pay",  cat: "Shopping", amt: "−₹2,199",  pos: false)
                Divider().padding(.leading, 46)
                txnRow(sfSymbol: "indianrupeesign.circle.fill", iconColor: Color.spentyPrimary,
                       name: "HDFC Salary", cat: "Income",   amt: "+₹45,000", pos: true)
                Divider().padding(.leading, 46)
                txnRow(sfSymbol: "play.rectangle.fill",    iconColor: Color(hex: 0xE50914),
                       name: "Netflix",     cat: "Entertain",amt: "−₹649",    pos: false)
            }
            Spacer()
        }
    }

    private func txnRow(sfSymbol: String, iconColor: Color, name: String,
                        cat: String, amt: String, pos: Bool) -> some View {
        HStack(spacing: 9) {
            ZStack {
                Circle().fill(iconColor.opacity(0.15)).frame(width: 32, height: 32)
                Image(systemName: sfSymbol)
                    .font(.system(size: 13))
                    .foregroundStyle(iconColor)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(name).font(.system(size: 11, weight: .semibold))
                Text(cat).font(.system(size: 9)).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(amt)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(pos ? Color.spentyPrimary : Color.spentyError)
                Image(systemName: "envelope.fill")
                    .font(.system(size: 8))
                    .foregroundStyle(Color(hex: 0x0A84FF).opacity(0.55))
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 7)
    }

    // MARK: - Mock 2: AI Chat

    private var aiChatMock: some View {
        VStack(spacing: 0) {
            statusBar
            HStack {
                Text("AI Buddy")
                    .font(.system(size: 13, weight: .bold))
                Spacer()
                Image(systemName: "sparkles")
                    .foregroundStyle(Color.spentyPrimary)
                    .font(.system(size: 12))
            }
            .padding(.horizontal, 13).padding(.vertical, 7)
            Divider()
            VStack(spacing: 10) {
                HStack {
                    Spacer()
                    Text("How much did I spend on food?")
                        .font(.system(size: 11))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(Color.spentyPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                        .frame(maxWidth: 150)
                }
                HStack(alignment: .top, spacing: 7) {
                    ZStack {
                        Circle().fill(Color.spentyPrimary.opacity(0.15)).frame(width: 24, height: 24)
                        Image(systemName: "sparkles")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.spentyPrimary)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text("₹4,230 on food")
                            .font(.system(size: 11, weight: .bold))
                        Text("23 orders · avg ₹184")
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                        HStack(spacing: 4) {
                            Image(systemName: "flame.fill").foregroundStyle(.orange)
                            Text("Zomato is top spend")
                                .foregroundStyle(Color.spentyWarning)
                        }
                        .font(.system(size: 9))
                    }
                    .padding(10)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 13))
                    Spacer()
                }
                HStack {
                    Spacer()
                    Text("I spent ₹500 on lunch today")
                        .font(.system(size: 11))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(Color.spentyPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                }
            }
            .padding(12)
            Spacer()
            HStack {
                Text("Ask or tell me anything...")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
                    .padding(.leading, 9)
                Spacer()
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.spentyPrimary)
            }
            .padding(.horizontal, 9).padding(.vertical, 7)
            .background(Color.gray.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 11))
            .padding(12)
        }
    }

    // MARK: - Mock 3: Dashboard

    private var dashboardMock: some View {
        VStack(spacing: 0) {
            statusBar
            VStack(spacing: 3) {
                Text("Total Balance")
                    .font(.system(size: 10))
                    .foregroundStyle(.white.opacity(0.8))
                Text("₹1,24,560")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                HStack(spacing: 3) {
                    Image(systemName: "arrow.up").font(.system(size: 8, weight: .bold))
                    Text("+₹12,000 this month").font(.system(size: 9))
                }
                .foregroundStyle(.white.opacity(0.85))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                LinearGradient(colors: [Color(hex: 0x3634A3), Color(hex: 0x5E5CE6)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            VStack(spacing: 5) {
                Text("Monthly Spend")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 13)
                HStack(alignment: .bottom, spacing: 5) {
                    ForEach([0.42, 0.56, 0.48, 0.70, 0.62, 0.88] as [Double], id: \.self) { h in
                        RoundedRectangle(cornerRadius: 3)
                            .fill(h == 0.88
                                  ? Color(hex: 0x5E5CE6)
                                  : Color(hex: 0x5E5CE6).opacity(0.30))
                            .frame(height: CGFloat(h) * 36)
                            .frame(maxWidth: .infinity)
                    }
                }
                .frame(height: 36)
                .padding(.horizontal, 13)
            }
            .padding(.top, 9)
            Divider().padding(.horizontal, 13).padding(.top, 6)
            VStack(spacing: 0) {
                acctRow(sfSymbol: "building.columns.fill", iconColor: Color(hex: 0x5E5CE6),
                        name: "HDFC Bank",    balance: "₹82,400", frac: 0.66)
                Divider().padding(.leading, 46)
                acctRow(sfSymbol: "creditcard.fill",       iconColor: Color(hex: 0x0A84FF),
                        name: "Paytm Wallet", balance: "₹42,160", frac: 0.34)
            }
            .padding(.horizontal, 13).padding(.top, 4)
            Spacer()
        }
    }

    private func acctRow(sfSymbol: String, iconColor: Color, name: String,
                         balance: String, frac: CGFloat) -> some View {
        HStack(spacing: 9) {
            ZStack {
                Circle().fill(iconColor.opacity(0.15)).frame(width: 30, height: 30)
                Image(systemName: sfSymbol)
                    .font(.system(size: 12))
                    .foregroundStyle(iconColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 10, weight: .semibold))
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.spentyBorder)
                        .frame(width: 64, height: 3)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(iconColor)
                        .frame(width: 64 * frac, height: 3)
                }
            }
            Spacer()
            Text(balance)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(iconColor)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Mock 4: AI Insights / Spending Breakdown

    private var insightsMock: some View {
        VStack(spacing: 0) {
            statusBar
            HStack {
                Text("Spending Breakdown")
                    .font(.system(size: 11, weight: .bold))
                Spacer()
                Text("This Month").font(.system(size: 9)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 13).padding(.vertical, 7)
            Divider()
            ZStack {
                Circle().trim(from: 0,    to: 0.38).stroke(Color.spentyPrimary,   lineWidth: 16).rotationEffect(.degrees(-90))
                Circle().trim(from: 0.38, to: 0.62).stroke(Color(hex: 0x0A84FF), lineWidth: 16).rotationEffect(.degrees(-90))
                Circle().trim(from: 0.62, to: 0.80).stroke(Color.spentyWarning,  lineWidth: 16).rotationEffect(.degrees(-90))
                Circle().trim(from: 0.80, to: 1.00).stroke(Color(hex: 0xFF6B35), lineWidth: 16).rotationEffect(.degrees(-90))
                VStack(spacing: 1) {
                    Text("₹11,030").font(.system(size: 12, weight: .bold))
                    Text("total").font(.system(size: 9)).foregroundStyle(.secondary)
                }
            }
            .frame(width: 74, height: 74)
            .padding(.vertical, 10)
            VStack(spacing: 5) {
                legendRow(c: Color.spentyPrimary,  cat: "Food",     pct: "38%", amt: "₹4,190")
                legendRow(c: Color(hex: 0x0A84FF), cat: "Shopping", pct: "24%", amt: "₹2,647")
                legendRow(c: Color.spentyWarning,  cat: "Bills",    pct: "18%", amt: "₹1,985")
                legendRow(c: Color(hex: 0xFF6B35), cat: "Other",    pct: "20%", amt: "₹2,208")
            }
            .padding(.horizontal, 13)
            Spacer()
        }
    }

    private func legendRow(c: Color, cat: String, pct: String, amt: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(c).frame(width: 8, height: 8)
            Text(cat).font(.system(size: 10))
            Spacer()
            Text(pct).font(.system(size: 9)).foregroundStyle(.secondary)
            Text(amt).font(.system(size: 10, weight: .semibold)).frame(width: 44, alignment: .trailing)
        }
    }

    // MARK: - Mock 5: Reports

    private var reportsMock: some View {
        VStack(spacing: 0) {
            statusBar
            HStack {
                Text("Monthly Report").font(.system(size: 11, weight: .bold))
                Spacer()
                Text("Apr 2025").font(.system(size: 9)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 13).padding(.vertical, 7)
            Divider()
            HStack(spacing: 6) {
                summaryCard(label: "Income",  val: "₹45k", c: Color.spentyPrimary)
                summaryCard(label: "Expense", val: "₹33k", c: Color.spentyError)
                summaryCard(label: "Saved",   val: "₹12k", c: Color(hex: 0x0A84FF))
            }
            .padding(.horizontal, 13).padding(.top, 8)
            VStack(spacing: 4) {
                Text("Spending Trend")
                    .font(.system(size: 9, weight: .medium)).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Canvas { ctx, size in
                    let pts: [CGFloat] = [0.65, 0.50, 0.72, 0.42, 0.58, 0.33]
                    let w = size.width / CGFloat(pts.count - 1)
                    var p = Path()
                    for (i, y) in pts.enumerated() {
                        let pt = CGPoint(x: CGFloat(i) * w, y: size.height * y)
                        if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                    }
                    ctx.stroke(p, with: .color(Color(hex: 0x1B5E20)), lineWidth: 2.0)
                    var fill = p
                    fill.addLine(to: CGPoint(x: size.width, y: size.height))
                    fill.addLine(to: CGPoint(x: 0, y: size.height))
                    fill.closeSubpath()
                    ctx.fill(fill, with: .color(Color(hex: 0x1B5E20).opacity(0.12)))
                }
                .frame(height: 40)
            }
            .padding(.horizontal, 13).padding(.top, 9)
            Divider().padding(.horizontal, 13).padding(.top, 5)
            VStack(spacing: 4) {
                Text("Top Categories")
                    .font(.system(size: 9, weight: .medium)).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                catBar(name: "Food",     pct: 0.38, amt: "₹4,190", c: Color.spentyPrimary)
                catBar(name: "Shopping", pct: 0.24, amt: "₹2,647", c: Color(hex: 0x0A84FF))
                catBar(name: "Bills",    pct: 0.18, amt: "₹1,985", c: Color.spentyWarning)
            }
            .padding(.horizontal, 13).padding(.top, 5)
            Spacer()
        }
    }

    private func summaryCard(label: String, val: String, c: Color) -> some View {
        VStack(spacing: 2) {
            Text(val).font(.system(size: 11, weight: .bold)).foregroundStyle(c)
            Text(label).font(.system(size: 8)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 6)
        .background(c.opacity(0.09))
        .clipShape(RoundedRectangle(cornerRadius: 7))
    }

    private func catBar(name: String, pct: CGFloat, amt: String, c: Color) -> some View {
        HStack(spacing: 6) {
            Text(name).font(.system(size: 9)).frame(width: 46, alignment: .leading)
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2).fill(Color.spentyBorder).frame(height: 4)
                    RoundedRectangle(cornerRadius: 2).fill(c)
                        .frame(width: g.size.width * pct, height: 4)
                }
            }
            .frame(height: 4)
            Text(amt).font(.system(size: 9, weight: .medium)).frame(width: 40, alignment: .trailing)
        }
    }

    // MARK: - Mock 6: Cash Flow / Upcoming Payments

    private var cashFlowMock: some View {
        VStack(spacing: 0) {
            statusBar
            HStack {
                Text("Upcoming Payments").font(.system(size: 11, weight: .bold))
                Spacer()
                Text("May 2025").font(.system(size: 9)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 13).padding(.vertical, 7)
            HStack(spacing: 5) {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 10)).foregroundStyle(Color.spentyError)
                Text("₹28,149 going out this month")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.spentyError)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Color.spentyError.opacity(0.09))
            Divider()
            VStack(spacing: 0) {
                upcomingRow(sfSymbol: "house.fill",          iconColor: Color.spentyError,
                            name: "SBI Home EMI", amt: "₹22,500", date: "5 May",  urgent: true)
                Divider().padding(.leading, 46)
                upcomingRow(sfSymbol: "play.rectangle.fill", iconColor: Color(hex: 0xE50914),
                            name: "Netflix",       amt: "₹649",    date: "8 May",  urgent: false)
                Divider().padding(.leading, 46)
                upcomingRow(sfSymbol: "shield.fill",         iconColor: Color(hex: 0x0A84FF),
                            name: "LIC Insurance", amt: "₹3,200",  date: "10 May", urgent: false)
                Divider().padding(.leading, 46)
                upcomingRow(sfSymbol: "figure.run",          iconColor: Color.spentyPrimary,
                            name: "Cult.fit",      amt: "₹1,800",  date: "15 May", urgent: false)
            }
            Spacer()
        }
    }

    private func upcomingRow(sfSymbol: String, iconColor: Color, name: String,
                             amt: String, date: String, urgent: Bool) -> some View {
        HStack(spacing: 9) {
            ZStack {
                Circle().fill(iconColor.opacity(0.15)).frame(width: 30, height: 30)
                Image(systemName: sfSymbol)
                    .font(.system(size: 11))
                    .foregroundStyle(iconColor)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(name).font(.system(size: 10, weight: .semibold))
                Text(date).font(.system(size: 9)).foregroundStyle(.secondary)
            }
            Spacer()
            Text(amt)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(urgent ? Color.spentyError : Color.spentyTextPrimary)
        }
        .padding(.horizontal, 13).padding(.vertical, 8)
    }

    // MARK: - Mock 7: Invoice

    private var invoiceMock: some View {
        VStack(spacing: 0) {
            statusBar
            HStack {
                Text("Invoices").font(.system(size: 11, weight: .bold))
                Spacer()
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(Color(hex: 0x0062CC))
                    .font(.system(size: 15))
            }
            .padding(.horizontal, 13).padding(.vertical, 7)
            Divider()
            VStack(spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("INVOICE")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color(hex: 0x0062CC))
                        Text("#INV-2025-024")
                            .font(.system(size: 8)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("Sent")
                        .font(.system(size: 9, weight: .semibold)).foregroundStyle(.white)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(Color.spentyPrimary)
                        .clipShape(Capsule())
                }
                .padding(12)
                .background(Color(hex: 0x0062CC).opacity(0.07))
                Divider()
                VStack(spacing: 5) {
                    HStack {
                        Text("Bill to:").font(.system(size: 8)).foregroundStyle(.secondary)
                        Spacer()
                        Text("Rohan Mehta").font(.system(size: 9, weight: .semibold))
                    }
                    Divider()
                    HStack {
                        Text("Design Services").font(.system(size: 9))
                        Spacer()
                        Text("₹15,000").font(.system(size: 9, weight: .semibold))
                    }
                    HStack {
                        Text("GST (18%)").font(.system(size: 9)).foregroundStyle(.secondary)
                        Spacer()
                        Text("₹2,700").font(.system(size: 9)).foregroundStyle(.secondary)
                    }
                    Divider()
                    HStack {
                        Text("Total").font(.system(size: 10, weight: .bold))
                        Spacer()
                        Text("₹17,700")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color(hex: 0x0062CC))
                    }
                }
                .padding(12)
            }
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 11))
            .shadow(color: .black.opacity(0.07), radius: 4, x: 0, y: 2)
            .padding(12)
            Spacer()
            HStack(spacing: 9) {
                Label("Share", systemImage: "square.and.arrow.up")
                    .font(.system(size: 9, weight: .medium))
                    .padding(.vertical, 5).frame(maxWidth: .infinity)
                    .background(Color(hex: 0x0062CC).opacity(0.1))
                    .foregroundStyle(Color(hex: 0x0062CC))
                    .clipShape(RoundedRectangle(cornerRadius: 7))
                Label("PDF", systemImage: "doc.fill")
                    .font(.system(size: 9, weight: .medium))
                    .padding(.vertical, 5).frame(maxWidth: .infinity)
                    .background(Color.gray.opacity(0.1))
                    .foregroundStyle(Color.spentyTextPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 7))
            }
            .padding(.horizontal, 12).padding(.bottom, 9)
        }
    }

    // MARK: - CTA Slide (Slide 8)

    private var ctaSlide: some View {
        GeometryReader { geo in
            ZStack {
                // Background
                LinearGradient(
                    colors: slide.gradientColors.isEmpty
                        ? [Color(hex: 0x111111), Color(hex: 0x1C1C1E)]
                        : slide.gradientColors,
                    startPoint: .top,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                // Dot grid
                Canvas { ctx, size in
                    let spacing: CGFloat = 30
                    let dot: CGFloat = 1.4
                    var row: CGFloat = 0
                    while row < size.height {
                        var col: CGFloat = 0
                        while col < size.width {
                            ctx.fill(
                                Path(ellipseIn: CGRect(x: col, y: row, width: dot, height: dot)),
                                with: .color(.white.opacity(0.05))
                            )
                            col += spacing
                        }
                        row += spacing
                    }
                }
                .allowsHitTesting(false)

                // Gold glow blobs
                Circle()
                    .fill(Color(hex: 0xD4AF37).opacity(0.18))
                    .frame(width: 300, height: 300)
                    .blur(radius: 90)
                    .offset(x: -50, y: -(geo.size.height * 0.26))
                Circle()
                    .fill(Color(hex: 0xD4AF37).opacity(0.10))
                    .frame(width: 200, height: 200)
                    .blur(radius: 60)
                    .offset(x: 110, y: geo.size.height * 0.17)

                // Concentric gold rings
                ForEach([240, 165, 100] as [CGFloat], id: \.self) { d in
                    Circle()
                        .stroke(Color(hex: 0xD4AF37).opacity(d == 240 ? 0.06 : d == 165 ? 0.10 : 0.16), lineWidth: 1)
                        .frame(width: d, height: d)
                        .offset(x: geo.size.width * 0.10, y: -(geo.size.height * 0.20))
                }

                VStack(spacing: 0) {
                    Spacer()

                    // Crown badge
                    ZStack {
                        Circle()
                            .fill(Color(hex: 0xD4AF37).opacity(0.14))
                            .frame(width: 116, height: 116)
                            .blur(radius: 18)
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [Color(hex: 0xF5D020).opacity(0.55), Color(hex: 0xD4AF37).opacity(0.18)],
                                    startPoint: .topLeading, endPoint: .bottomTrailing
                                ),
                                lineWidth: 1.5
                            )
                            .frame(width: 94, height: 94)
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [Color(hex: 0xD4AF37), Color(hex: 0xF0C040)],
                                    startPoint: .topLeading, endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 78, height: 78)
                        Image(systemName: "crown.fill")
                            .font(.system(size: 34))
                            .foregroundStyle(.white)
                    }

                    // Title + description
                    VStack(spacing: 10) {
                        Text(lang.s(slide.titleKey))
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                        Text(lang.s(slide.descriptionKey))
                            .font(.system(size: 14))
                            .foregroundStyle(.white.opacity(0.65))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                            .lineSpacing(5)
                    }
                    .padding(.top, 22)

                    // Feature rows
                    VStack(spacing: 12) {
                        ctaFeatureRow("All 7 features fully unlocked")
                        ctaFeatureRow("Zero limits — all accounts & history")
                        ctaFeatureRow("7-day trial — charged only after day 7")
                    }
                    .padding(.horizontal, 32)
                    .padding(.top, 24)

                    // Pricing nudge
                    HStack(spacing: 8) {
                        Image(systemName: "calendar.badge.checkmark")
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: 0xD4AF37))
                        Text("Monthly, yearly & lifetime plans available")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white.opacity(0.80))
                    }
                    .padding(.horizontal, 20).padding(.vertical, 12)
                    .background(.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22)
                            .stroke(.white.opacity(0.12), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 22))
                    .padding(.top, 18)

                    Spacer()
                    Spacer()
                }
            }
        }
    }

    private func ctaFeatureRow(_ text: String) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(Color(hex: 0xD4AF37).opacity(0.18))
                    .frame(width: 26, height: 26)
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color(hex: 0xD4AF37))
            }
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.85))
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
}
