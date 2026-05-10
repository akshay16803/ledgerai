import SwiftUI

// MARK: - Lifetime Offer Sheet
// Two modes:
//   showTimer = true  → non-subscriber monthly intercept; 30-minute countdown displayed
//   showTimer = false → existing subscriber upgrade; no timer, always available

struct LifetimeOfferSheet: View {

    // MARK: - Params
    var showTimer: Bool = true
    /// The StoreKit-localised price string for the lifetime_offer product.
    /// Displayed in the header and CTA button so the user sees the exact charge
    /// before confirming (required by App Store guideline 3.1.1).
    var offerPrice: String? = nil
    /// The StoreKit-localised price string for the regular `com.spentyai.lifetime`
    /// product (the price the user will pay AFTER the 30-min offer expires).
    /// Shown next to the discounted offer price so the urgency is verifiable
    /// rather than implied — closes a dark-pattern concern with the timer.
    var fullPrice: String? = nil
    let onAccept: () async -> Void
    let onDecline: () -> Void

    // MARK: - State
    @State private var isPurchasing = false
    @State private var displayTime: String = ""

    // MARK: - Timer
    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    // MARK: - Palette
    private let accentGold = Color(red: 0.831, green: 0.686, blue: 0.216)
    private let darkBg     = Color(red: 0.055, green: 0.122, blue: 0.071)

    // MARK: - Body
    var body: some View {
        VStack(spacing: 0) {
            premiumHeader
            offerContent
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(isPurchasing)
        .onAppear {
            if showTimer {
                LifetimeOfferManager.shared.recordFirstShown()
                displayTime = LifetimeOfferManager.shared.formattedTimeRemaining()
            }
        }
        .onReceive(clock) { _ in
            guard showTimer, !isPurchasing else { return }
            let remaining = LifetimeOfferManager.shared.timeRemaining
            if remaining <= 0 {
                onDecline()
            } else {
                displayTime = LifetimeOfferManager.shared.formattedTimeRemaining()
            }
        }
    }

    // MARK: - Dark premium header
    private var premiumHeader: some View {
        VStack(spacing: 18) {
            Spacer().frame(height: 8)

            // Badge
            HStack(spacing: 5) {
                Image(systemName: showTimer ? "bolt.fill" : "star.fill")
                    .font(.system(size: 10, weight: .bold))
                Text(showTimer ? "ONE-TIME SPECIAL OFFER" : "SUBSCRIBER EXCLUSIVE")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.1)
            }
            .foregroundStyle(accentGold)
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
            .background(accentGold.opacity(0.14))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(accentGold.opacity(0.28), lineWidth: 1))

            // Title
            VStack(spacing: 6) {
                Text("Lifetime Access")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(.white)
                Text("Pay once. Use SpentyAI forever.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.6))
            }

            // Price display — show the discounted offer price PROMINENTLY
            // and the regular post-offer price struck-through next to it
            // so the 50%-off claim is verifiable, not just implied. Without
            // this comparison the 30-min countdown looked like a manipulative
            // dark pattern (price never visibly changed during the timer).
            VStack(spacing: 8) {
                Text("One-time purchase")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.white.opacity(0.38))

                if let price = offerPrice {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(price)
                            .font(.system(size: 36, weight: .bold))
                            .foregroundStyle(.white)
                        if showTimer, let regular = fullPrice, regular != price {
                            Text(regular)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.45))
                                .strikethrough(true, color: .white.opacity(0.6))
                        }
                    }
                } else {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.2)
                        .frame(height: 44)
                }

                Text(showTimer
                     ? "LIMITED TIME OFFER  ·  50% OFF"
                     : "EXCLUSIVE LIFETIME RATE")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(darkBg)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 7)
                    .background(accentGold)
                    .clipShape(Capsule())
            }

            Spacer().frame(height: 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 24)
        .padding(.bottom, 28)
        .background(darkBg)
    }

    // MARK: - Light content section
    private var offerContent: some View {
        VStack(spacing: 0) {
            // Feature rows
            VStack(spacing: 0) {
                offerRow(icon: "infinity",               title: "Use forever, no renewals",     sub: "No annual fees, ever")
                Divider().padding(.leading, 60).padding(.trailing, 20)
                offerRow(icon: "arrow.up.circle.fill",   title: "All future updates included",  sub: "Everything we build, free")
                Divider().padding(.leading, 60).padding(.trailing, 20)
                offerRow(icon: "brain.head.profile",     title: "Full AI features",             sub: "Unlimited insights & analysis")
                Divider().padding(.leading, 60).padding(.trailing, 20)
                offerRow(icon: "shield.lefthalf.filled", title: "Priority support",             sub: "We're here when you need us")
            }
            .padding(.top, 20)

            // Urgency / info note
            urgencyNote
                .padding(.horizontal, 20)
                .padding(.top, 20)

            // Buttons
            VStack(spacing: 14) {
                // Apple App Review 2.1(b): disable CTA until the lifetime_offer
                // price has loaded from StoreKit. Reviewer must not be able to
                // tap a button that triggers an unfulfillable purchase.
                Button {
                    Task {
                        isPurchasing = true
                        await onAccept()
                        isPurchasing = false
                    }
                } label: {
                    Group {
                        if isPurchasing {
                            ProgressView()
                                .tint(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                        } else {
                            HStack(spacing: 0) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(offerPrice == nil
                                         ? "Connecting to App Store…"
                                         : (showTimer ? "Get Lifetime Access" : "Upgrade to Lifetime"))
                                        .font(.headline)
                                    if offerPrice != nil {
                                        Text("One-time · no subscriptions")
                                            .font(.caption)
                                            .opacity(0.8)
                                    }
                                }
                                Spacer()
                                // Show actual price in button (guideline 3.1.1)
                                if let price = offerPrice {
                                    Text(price)
                                        .font(.headline)
                                } else {
                                    ProgressView()
                                        .tint(.white)
                                        .scaleEffect(0.8)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 16)
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .background(Color.spentyPrimary.opacity(offerPrice == nil ? 0.6 : 1.0),
                                in: RoundedRectangle(cornerRadius: 14))
                }
                .disabled(isPurchasing || offerPrice == nil)

                // Secondary "decline" CTA — needs to read as a real
                // button so users have a visible exit. Previous version
                // was tiny grey text below the giant green primary CTA;
                // users couldn't find it and felt trapped (reported by
                // user 2026-05-10). Now full-width with a visible
                // outline + body-sized text matching the primary.
                Button {
                    onDecline()
                } label: {
                    Text(showTimer ? "No thanks, continue with my plan" : "Maybe later")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color.spentyPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.spentyPrimary.opacity(0.06),
                                    in: RoundedRectangle(cornerRadius: 14))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color.spentyPrimary.opacity(0.3), lineWidth: 1.2)
                        )
                }
                .disabled(isPurchasing)

                Text("Secure payment via Apple")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 36)
        }
        .background(Color.spentyBgPrimary)
    }

    // MARK: - Urgency / info note (context-aware)
    @ViewBuilder
    private var urgencyNote: some View {
        if showTimer {
            // Timer countdown — wording explicitly states what changes
            // when the timer hits zero (offer goes away, regular price
            // applies) so the urgency is honest rather than implied.
            HStack(spacing: 10) {
                Image(systemName: "clock.fill")
                    .foregroundStyle(.orange)
                VStack(alignment: .leading, spacing: 2) {
                    if let regular = fullPrice {
                        Text("Offer expires in — then \(regular)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Offer expires in")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text(displayTime)
                        .font(.system(size: 20, weight: .bold, design: .monospaced))
                        .foregroundStyle(.orange)
                }
                Spacer()
                Text("30 min only")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.12))
                    .clipShape(Capsule())
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(Color.orange.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.orange.opacity(0.2), lineWidth: 1))
        } else {
            // Subscriber exclusive note
            HStack(spacing: 8) {
                Image(systemName: "star.fill")
                    .font(.caption)
                    .foregroundStyle(Color(red: 0.831, green: 0.686, blue: 0.216))
                Text("Always available — exclusive rate for SpentyAI subscribers")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(red: 0.831, green: 0.686, blue: 0.216).opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(red: 0.831, green: 0.686, blue: 0.216).opacity(0.2), lineWidth: 1))
        }
    }

    // MARK: - Feature row
    private func offerRow(icon: String, title: String, sub: String) -> some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.spentyPrimary.opacity(0.08))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.spentyPrimary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(sub)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.body)
                .foregroundStyle(Color.spentyPrimary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }
}

#Preview {
    LifetimeOfferSheet(showTimer: true, offerPrice: "₹4,999", onAccept: {}, onDecline: {})
}
