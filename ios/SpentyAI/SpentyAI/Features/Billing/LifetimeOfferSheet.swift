import SwiftUI

// MARK: - Lifetime Offer Sheet
// Shown as a bottom sheet when the user taps Monthly plan.
// Upsells lifetime access at ₹4,999 (vs regular ₹9,999).

struct LifetimeOfferSheet: View {

    // MARK: - Callbacks
    let onAccept: () async -> Void   // perform lifetime_offer purchase
    let onDecline: () -> Void         // proceed with monthly purchase

    // MARK: - State
    @State private var isPurchasing = false

    // MARK: - Palette
    private let accentGold = Color(red: 0.831, green: 0.686, blue: 0.216)  // #D4AF37
    private let darkBg     = Color(red: 0.055, green: 0.122, blue: 0.071)  // #0E1F12

    // MARK: - Body
    var body: some View {
        VStack(spacing: 0) {
            premiumHeader
            offerContent
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(isPurchasing)
    }

    // MARK: - Dark premium header
    private var premiumHeader: some View {
        VStack(spacing: 18) {
            Spacer().frame(height: 8)

            // Badge
            HStack(spacing: 5) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 10, weight: .bold))
                Text("ONE-TIME SPECIAL OFFER")
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

            // Price display
            VStack(spacing: 8) {
                Text("₹9,999")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.white.opacity(0.38))
                    .strikethrough(true, color: .white.opacity(0.38))

                HStack(alignment: .top, spacing: 2) {
                    Text("₹")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                        .offset(y: 8)
                    Text("4,999")
                        .font(.system(size: 54, weight: .bold))
                        .foregroundStyle(.white)
                }

                Text("YOU SAVE ₹5,000  ·  50% OFF")
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
            VStack(spacing: 0) {
                offerRow(icon: "infinity",               title: "Use forever, no renewals",      sub: "No annual fees, ever")
                Divider().padding(.leading, 60).padding(.trailing, 20)
                offerRow(icon: "arrow.up.circle.fill",   title: "All future updates included",   sub: "Everything we build, free")
                Divider().padding(.leading, 60).padding(.trailing, 20)
                offerRow(icon: "brain.head.profile",     title: "Full AI features",              sub: "Unlimited insights & analysis")
                Divider().padding(.leading, 60).padding(.trailing, 20)
                offerRow(icon: "shield.lefthalf.filled", title: "Priority support",              sub: "We're here when you need us")
            }
            .padding(.top, 20)

            // Urgency note
            HStack(spacing: 8) {
                Image(systemName: "clock.badge.exclamationmark.fill")
                    .foregroundStyle(.orange)
                Text("This offer disappears when you close this screen")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.orange.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 20)
            .padding(.top, 20)

            // Buttons
            VStack(spacing: 14) {
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
                                    Text("Get Lifetime Access")
                                        .font(.headline)
                                    Text("One-time · no subscriptions")
                                        .font(.caption)
                                        .opacity(0.8)
                                }
                                Spacer()
                                Text("₹4,999")
                                    .font(.headline)
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 16)
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .background(Color.spentyPrimary, in: RoundedRectangle(cornerRadius: 14))
                }
                .disabled(isPurchasing)

                Button {
                    onDecline()
                } label: {
                    Text("No thanks, I'll pay ₹199/month")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
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
    LifetimeOfferSheet(onAccept: {}, onDecline: {})
}
