import SwiftUI
import StoreKit  // Required for `AppStore.sync()` in restorePurchases()

// MARK: - Premium Feature Sheet
//
// Unified upsell modal — presented when a free user opens ANY Premium-gated
// surface (Email Sync, SMS Auto-detection, Invoices, Purchases, Mandates,
// Reconciliation, Records, Past Insights).
//
// Pivot 2026-05-27:
//   - The sheet was per-feature ("Unlock Invoices" with invoice bullets).
//     We now show the FULL bundle: every premium feature listed, with both
//     price options visible — ₹199/month and the ₹4,999 lifetime_offer.
//   - The 8 convenience builders (`.emailSync`, `.invoices`, etc.) now all
//     route through `.bundle(...)` and produce identical content. Kept the
//     old names as no-op shims so existing call sites compile, but every
//     new call site should use `.bundle()`.
//
// Caller responsibility: present the sheet, dismiss on `onClose`, optionally
// record the local "they paid" flag via `onSubscribed` (which fires AFTER
// StoreKit + backend `/verify` succeed but BEFORE the /auth/me refresh).

struct PremiumFeatureSheet: View {

    // MARK: - Configuration
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
    /// the sheet". Used to keep both CTAs disabled across the auth-refresh
    /// round-trip so a determined user can't double-tap.
    @State private var isFinalizing = false

    // Brand palette
    private let darkBg = Color(red: 0.055, green: 0.122, blue: 0.071)   // brand deep green
    private let glowGreen = Color(red: 0.204, green: 0.780, blue: 0.349) // brand spentyPrimary
    private let goldAccent = Color(red: 0.831, green: 0.686, blue: 0.216)

    private static let monthlyProductId = "com.spentyai.monthly"
    private static let lifetimeProductId = "com.spentyai.lifetime_offer"

    // Unified bundle bullets — same content regardless of which feature
    // triggered the sheet. Keep in sync with Android PremiumFeatureSheet.kt
    // and web PremiumGateModal.jsx.
    private static let bundleBullets: [(icon: String, title: String, sub: String)] = [
        ("envelope.badge.shield.half.filled.fill",
         "Email Sync",
         "Auto-import expenses from Gmail and Outlook."),
        // SMS Sync intentionally omitted on iOS — Apple sandbox does not expose
        // SMS messages to third-party apps, so the feature is Android-only.
        ("doc.text.fill",
         "Invoices",
         "Create and send GST-ready invoices."),
        ("cart.fill",
         "Purchases",
         "Track every bill end-to-end."),
        ("arrow.left.arrow.right.circle.fill",
         "Reconciliation",
         "Match bank statements in one tap."),
        ("tray.full.fill",
         "Records",
         "Full email and attachment archive."),
        ("chart.line.uptrend.xyaxis",
         "Past Insights",
         "Monthly and yearly analytics."),
        ("arrow.triangle.2.circlepath",
         "Mandates",
         "Track UPI auto-pay subscriptions."),
    ]


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

            // Animated glow blob
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

                // Bundle hero icon — sparkles-in-circle (not per-feature)
                ZStack {
                    Circle()
                        .fill(glowGreen.opacity(0.18))
                        .frame(width: 92, height: 92)
                    Circle()
                        .fill(glowGreen.opacity(0.28))
                        .frame(width: 66, height: 66)
                    Image(systemName: "sparkles")
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.top, 4)

                // Title + subhead — same for every gated surface
                VStack(spacing: 8) {
                    Text("Unlock SpentyAI Premium")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text("One subscription. Every premium feature.")
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


    // MARK: - Body card (feature bullets + price boxes + CTAs)
    private var body_card: some View {
        VStack(spacing: 0) {
            // Full bundle bullets
            VStack(spacing: 0) {
                ForEach(Array(Self.bundleBullets.enumerated()), id: \.offset) { idx, b in
                    bulletRow(icon: b.icon, title: b.title, sub: b.sub)
                    if idx < Self.bundleBullets.count - 1 {
                        Divider().padding(.leading, 76).padding(.trailing, 24)
                    }
                }
            }
            .padding(.top, 12)
            .padding(.bottom, 8)

            // Two stacked price boxes — monthly + lifetime
            VStack(spacing: 12) {
                monthlyPriceBox
                lifetimePriceBox
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            // Primary CTA — Subscribe Monthly
            primaryCTA
                .padding(.horizontal, 20)
                .padding(.top, 16)

            // Secondary CTA — Get Lifetime
            secondaryCTA
                .padding(.horizontal, 20)
                .padding(.top, 10)

            // Restore + Maybe later
            HStack(spacing: 24) {
                Button(action: restorePurchases) {
                    Text("Restore Purchases")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.spentyPrimary)
                }
                .disabled(viewModel.isPurchasing || isFinalizing)

                Button(action: onClose) {
                    Text("Maybe later")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .disabled(viewModel.isPurchasing || isFinalizing)
            }
            .padding(.top, 16)

            // Fine print
            Text("Monthly auto-renews until cancelled. Lifetime is a one-time payment. Cancel anytime in iOS Settings → Apple Account → Subscriptions. Payment is charged to your Apple Account at confirmation of purchase.")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
                .padding(.top, 14)

            // Terms / Privacy
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


    // MARK: - Price boxes

    private var monthlyPriceBox: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            if let displayPrice = viewModel.displayPrice(for: Self.monthlyProductId) {
                Text(displayPrice)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.primary)
                Text("/month")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
                    .scaleEffect(0.9)
                    .frame(height: 34)
            }
            Spacer()
            Text("Cancel anytime")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .background(Color.spentyPrimary.opacity(0.07),
                    in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.spentyPrimary.opacity(0.18), lineWidth: 1)
        )
    }

    private var lifetimePriceBox: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            if let displayPrice = viewModel.displayPrice(for: Self.lifetimeProductId) {
                Text(displayPrice)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.primary)
                Text("lifetime")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
                    .scaleEffect(0.9)
                    .frame(height: 34)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("One-time payment")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                Text("50% off")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(goldAccent)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .background(goldAccent.opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(goldAccent.opacity(0.32), lineWidth: 1)
        )
    }

    // MARK: - CTAs

    private var primaryCTA: some View {
        Button(action: purchaseMonthly) {
            HStack(spacing: 10) {
                if (viewModel.isPurchasing && viewModel.purchasingProductId == Self.monthlyProductId) || isFinalizing {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "sparkles")
                        .font(.system(size: 16, weight: .bold))
                    Text("Subscribe Monthly")
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

    private var secondaryCTA: some View {
        Button(action: purchaseLifetime) {
            HStack(spacing: 10) {
                if viewModel.isPurchasing && viewModel.purchasingProductId == Self.lifetimeProductId {
                    ProgressView().tint(Color.spentyPrimary)
                } else {
                    Image(systemName: "infinity")
                        .font(.system(size: 15, weight: .bold))
                    Text("Get Lifetime")
                        .font(.system(size: 16, weight: .semibold))
                }
            }
            .foregroundStyle(Color.spentyPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                Color.spentyPrimary.opacity(0.10),
                in: RoundedRectangle(cornerRadius: 14)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.spentyPrimary.opacity(0.35), lineWidth: 1.5)
            )
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
        .padding(.vertical, 12)
    }


    // MARK: - Actions

    private func purchaseMonthly() {
        runPurchase(productId: Self.monthlyProductId)
    }

    private func purchaseLifetime() {
        runPurchase(productId: Self.lifetimeProductId)
    }

    private func runPurchase(productId: String) {
        Task {
            let ok = await viewModel.purchasePlan(productId)
            if ok {
                await MainActor.run { isFinalizing = true }
                await MainActor.run { onSubscribed?() }
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
//
// As of 2026-05-27 every gated surface advertises the FULL premium bundle —
// see `bundleBullets` and the headline/subhead in `hero`. The 8 named
// builders below are kept as no-op shims so existing call sites compile;
// they all return the same unified sheet. Prefer `.bundle(...)` for new
// callers.

extension PremiumFeatureSheet {

    /// Unified bundle sheet — every gated surface uses this builder.
    static func bundle(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        PremiumFeatureSheet(
            onClose: onClose,
            onSubscribed: onSubscribed
        )
    }

    static func emailSync(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        bundle(onClose: onClose, onSubscribed: onSubscribed)
    }

    static func invoices(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        bundle(onClose: onClose, onSubscribed: onSubscribed)
    }

    static func purchases(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        bundle(onClose: onClose, onSubscribed: onSubscribed)
    }

    static func mandates(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        bundle(onClose: onClose, onSubscribed: onSubscribed)
    }

    static func reconciliation(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        bundle(onClose: onClose, onSubscribed: onSubscribed)
    }

    static func records(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        bundle(onClose: onClose, onSubscribed: onSubscribed)
    }

    static func pastInsights(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        bundle(onClose: onClose, onSubscribed: onSubscribed)
    }

    static func smsSync(
        onClose: @escaping () -> Void,
        onSubscribed: (() -> Void)? = nil
    ) -> PremiumFeatureSheet {
        bundle(onClose: onClose, onSubscribed: onSubscribed)
    }
}

#Preview {
    PremiumFeatureSheet.bundle(onClose: {})
        .environment(AuthManager())
}
