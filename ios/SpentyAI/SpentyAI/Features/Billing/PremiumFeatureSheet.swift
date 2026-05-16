import SwiftUI
import StoreKit  // Required for `AppStore.sync()` in restorePurchases()

// MARK: - Premium Feature Sheet
//
// Modern, focused upsell modal — presented when a free user opens a
// Premium-gated surface (Email Sync, SMS Auto-detection). Replaces the
// previous full-app SubscriptionPaywall (which kept the entire app
// behind a wall after sign-in and was killing conversion). This sheet
// is invoked CONTEXTUALLY: the user is mid-action on a feature they
// already want, so the value prop is already clear; we just have to
// look credible enough that ₹199/month feels right.
//
// Design notes:
//   - Dark hero with brand green gradient + animated soft glow. Mirrors
//     the "premium" cards used by Linear / Cursor / Stripe paywalls.
//   - Single CTA (subscribe) — no plan picker. Pivot from 4-plan ladder
//     to one monthly SKU is intentional (decision fatigue was the bug).
//   - Restore Purchases + Maybe later + price clarity = App Store
//     guideline 3.1.1 + 3.1.2 compliance.
//
// Caller responsibility: instantiate this with the feature's branded
// copy (icon, title, two-line value prop, 3 bullets). The sheet handles
// purchase, restore, dismiss.

struct PremiumFeatureSheet: View {

    // MARK: - Configuration
    let featureIcon: String       // SF Symbol, e.g. "envelope.badge.shield.half.filled.fill"
    let featureName: String       // e.g. "Email Sync"
    let headline: String          // 1 line, e.g. "Your inbox, parsed into clean transactions."
    let subhead: String           // 1 line, e.g. "We scan every receipt, statement, UPI alert and bank email — automatically."
    let bullets: [(icon: String, title: String, sub: String)]

    let onClose: () -> Void

    /// Called the moment the StoreKit purchase + backend /verify return
    /// success — BEFORE we await `authManager.checkSession()` and BEFORE
    /// `onClose()` fires. Lets the parent record "the user paid" in
    /// local state so the `.sheet(onDismiss:)` doesn't kick them out
    /// if the subsequent /auth/me network refresh happens to fail.
    var onSubscribed: (() -> Void)? = nil

    // MARK: - State
    @Environment(AuthManager.self) private var authManager
    @State private var viewModel = BillingViewModel()
    @State private var isAnimating = false
    @State private var showError = false
    @State private var errorMessage = ""

    /// True between "StoreKit returned success" and "we've fully closed
    /// the sheet". Used to keep the Subscribe button disabled across the
    /// auth-refresh round-trip so a determined user can't double-tap and
    /// trigger a second purchase in that ~500 ms window.
    @State private var isFinalizing = false

    // Brand palette
    private let darkBg = Color(red: 0.055, green: 0.122, blue: 0.071)   // brand deep green
    private let glowGreen = Color(red: 0.204, green: 0.780, blue: 0.349) // brand spentyPrimary
    private let goldAccent = Color(red: 0.831, green: 0.686, blue: 0.216)

    private static let monthlyProductId = "com.spentyai.monthly"

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    hero
                    body_card
                }
            }

            // Close button overlay
            VStack {
                HStack {
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white.opacity(0.9))
                            .frame(width: 34, height: 34)
                            .background(.white.opacity(0.12), in: Circle())
                    }
                    .padding(.trailing, 18)
                    .padding(.top, 18)
                }
                Spacer()
            }
        }
        .task {
            await viewModel.loadStoreProducts()
            withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
        .alert("Something went wrong", isPresented: $showError) {
            Button("OK") { showError = false }
        } message: {
            Text(errorMessage)
        }
    }

    // MARK: - Hero
    private var hero: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [darkBg, darkBg.opacity(0.92), Color.black.opacity(0.6)],
                startPoint: .top, endPoint: .bottom
            )

            // Animated glow blob — gives the "premium card" feeling without being
            // gimmicky. Stays subtle (opacity 0.32) so it reads as ambient light
            // rather than a graphic.
            Circle()
                .fill(glowGreen)
                .frame(width: 320, height: 320)
                .blur(radius: 110)
                .opacity(isAnimating ? 0.32 : 0.18)
                .offset(x: isAnimating ? 60 : -40, y: isAnimating ? -20 : 40)

            VStack(spacing: 18) {
                Spacer().frame(height: 28)

                // Tier badge
                HStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 10, weight: .bold))
                    Text("SPENTYAI PREMIUM")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(1.4)
                }
                .foregroundStyle(goldAccent)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(goldAccent.opacity(0.14))
                .clipShape(Capsule())
                .overlay(Capsule().stroke(goldAccent.opacity(0.32), lineWidth: 1))

                // Feature icon — big circular badge
                ZStack {
                    Circle()
                        .fill(glowGreen.opacity(0.18))
                        .frame(width: 92, height: 92)
                    Circle()
                        .fill(glowGreen.opacity(0.28))
                        .frame(width: 66, height: 66)
                    Image(systemName: featureIcon)
                        .font(.system(size: 32, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.top, 4)

                // Title + subhead
                VStack(spacing: 8) {
                    Text(headline)
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text(subhead)
                        .font(.system(size: 15))
                        .foregroundStyle(.white.opacity(0.65))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 12)
                }
                .padding(.horizontal, 24)

                Spacer().frame(height: 32)
            }
        }
    }

    // MARK: - Body card (feature bullets + CTA)
    private var body_card: some View {
        VStack(spacing: 0) {
            // Feature bullets — clean rows mirroring the existing
            // LifetimeOfferSheet pattern so the brand feels coherent.
            VStack(spacing: 0) {
                ForEach(Array(bullets.enumerated()), id: \.offset) { idx, b in
                    bulletRow(icon: b.icon, title: b.title, sub: b.sub)
                    if idx < bullets.count - 1 {
                        Divider().padding(.leading, 76).padding(.trailing, 24)
                    }
                }
            }
            .padding(.top, 12)
            .padding(.bottom, 8)

            // Price box
            priceBox
                .padding(.horizontal, 20)
                .padding(.top, 16)

            // Primary CTA
            primaryCTA
                .padding(.horizontal, 20)
                .padding(.top, 18)

            // Secondary actions
            HStack(spacing: 24) {
                Button(action: restorePurchases) {
                    Text("Restore Purchases")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.spentyPrimary)
                }
                .disabled(viewModel.isPurchasing)

                Button(action: onClose) {
                    Text("Maybe later")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .disabled(viewModel.isPurchasing)
            }
            .padding(.top, 16)

            // Fine print — Apple guideline 3.1.2 compliance
            Text("Auto-renews monthly until cancelled. Cancel anytime in iOS Settings → Apple Account → Subscriptions. Payment is charged to your Apple Account at confirmation of purchase.")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
                .padding(.top, 14)

            // Terms / Privacy links — App Store guideline 3.1.2
            HStack(spacing: 16) {
                Link("Terms of Service", destination: URL(string: "https://www.spentyai.com/terms")!)
                Text("·").foregroundStyle(.tertiary)
                Link("Privacy Policy", destination: URL(string: "https://www.spentyai.com/privacy")!)
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Color.spentyPrimary)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background(Color.spentyBgPrimary)
    }

    // MARK: - Price box
    private var priceBox: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            if let displayPrice = viewModel.displayPrice(for: Self.monthlyProductId) {
                Text(displayPrice)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(.primary)
                Text("/month")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
                    .scaleEffect(0.9)
                    .frame(height: 38)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("Cancel anytime")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                Text("No hidden fees")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .background(Color.spentyPrimary.opacity(0.07),
                    in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.spentyPrimary.opacity(0.18), lineWidth: 1)
        )
    }

    // MARK: - Primary CTA
    private var primaryCTA: some View {
        Button(action: purchase) {
            HStack(spacing: 10) {
                if viewModel.isPurchasing || isFinalizing {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "sparkles")
                        .font(.system(size: 16, weight: .bold))
                    Text("Unlock \(featureName)")
                        .font(.system(size: 17, weight: .semibold))
                }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(
                LinearGradient(colors: [Color.spentyPrimary, Color.spentyPrimary.opacity(0.85)],
                               startPoint: .top, endPoint: .bottom),
                in: RoundedRectangle(cornerRadius: 16)
            )
            .shadow(color: Color.spentyPrimary.opacity(0.32), radius: 16, x: 0, y: 8)
        }
        .disabled(viewModel.isPurchasing || isFinalizing || !viewModel.areProductsLoaded)
        .opacity(viewModel.areProductsLoaded ? 1 : 0.55)
    }

    // MARK: - Bullet row
    private func bulletRow(icon: String, title: String, sub: String) -> some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.spentyPrimary.opacity(0.10))
                    .frame(width: 40, height: 40)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.spentyPrimary)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
                Text(sub)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 14)
    }

    // MARK: - Actions

    private func purchase() {
        Task {
            let ok = await viewModel.purchasePlan(Self.monthlyProductId)
            if ok {
                // Lock the CTA across the finalize sequence so a determined
                // user can't double-tap during the auth-refresh round-trip
                // and kick off a second StoreKit purchase. viewModel.isPurchasing
                // already flipped back to false (its `defer` block runs at the
                // end of purchasePlan), which is why we need our own flag.
                await MainActor.run { isFinalizing = true }

                // Signal the parent BEFORE the network refresh. This way the
                // parent's local "justSubscribed" state is set even if the
                // subsequent /auth/me call fails — protecting the user from
                // a logout that would otherwise cascade from `user=nil`.
                // The backend has already verified + persisted the purchase,
                // so this is the authoritative "they paid" signal locally.
                await MainActor.run { onSubscribed?() }

                // Best-effort refresh of /api/auth/me so AppRouter, gated
                // surfaces, and Settings see the fresh subscription status.
                // checkSession swallows errors internally; if it fails the
                // user stays signed in with the LOCAL knowledge that they
                // just paid (via onSubscribed), and the next foreground or
                // navigation will retry the refresh.
                await authManager.checkSession()
                await MainActor.run { onClose() }
            } else if !viewModel.errorMessage.isEmpty {
                await MainActor.run {
                    errorMessage = viewModel.errorMessage
                    showError = true
                    viewModel.errorMessage = ""
                    viewModel.showError = false
                }
            }
        }
    }

    private func restorePurchases() {
        Task {
            do {
                try await AppStore.sync()
                await viewModel.checkEntitlements()
                if viewModel.isSubscribed {
                    // Mirror of purchase() finalize sequence — same hardening
                    // for the restore path so a network-flaky checkSession
                    // doesn't log the user out after a successful restore.
                    await MainActor.run { isFinalizing = true }
                    await MainActor.run { onSubscribed?() }
                    await authManager.checkSession()
                    await MainActor.run { onClose() }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Couldn't restore purchases. \(error.localizedDescription)"
                    showError = true
                }
            }
        }
    }
}

// MARK: - Convenience builders

extension PremiumFeatureSheet {

    /// Premium sheet preset for Email Sync. Use this when a free user
    /// opens EmailSyncView (or tries to start a sync via that screen).
    static func emailSync(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        PremiumFeatureSheet(
            featureIcon: "envelope.badge.shield.half.filled.fill",
            featureName: "Email Sync",
            headline: "Your inbox,\nturned into your books.",
            subhead: "We read every UPI alert, bank statement and receipt — and post the transactions for you, automatically.",
            bullets: [
                ("bolt.fill",
                 "Set it once, forget it",
                 "Connect Gmail in 30 seconds. New emails auto-parse on arrival."),
                ("checkmark.seal.fill",
                 "Smart review queue",
                 "Anything we're unsure about waits for you — never silently wrong."),
                ("lock.shield.fill",
                 "Read-only & encrypted",
                 "We never send, delete or modify mail. Tokens are bank-grade encrypted."),
            ],
            onClose: onClose,
            onSubscribed: onSubscribed
        )
    }

    /// Premium sheet preset for SMS Auto-Detection.
    static func smsSync(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        PremiumFeatureSheet(
            featureIcon: "message.badge.waveform.fill",
            featureName: "Auto Transaction Detection",
            headline: "Every UPI ping\nbecomes a transaction.",
            subhead: "We watch your bank SMS, detect every debit, credit and transfer, and turn them into clean ledger entries.",
            bullets: [
                ("antenna.radiowaves.left.and.right",
                 "Realtime SMS parsing",
                 "Bank, card, UPI, wallet — all the major Indian formats out of the box."),
                ("rectangle.and.text.magnifyingglass",
                 "Smart categorization",
                 "Merchant, amount, account — auto-filled. You just confirm."),
                ("shield.checkered",
                 "Stays on your device",
                 "Messages are parsed locally. We only store the transaction, never the SMS."),
            ],
            onClose: onClose,
            onSubscribed: onSubscribed
        )
    }
}

#Preview {
    PremiumFeatureSheet.emailSync(onClose: {})
        .environment(AuthManager())
}
