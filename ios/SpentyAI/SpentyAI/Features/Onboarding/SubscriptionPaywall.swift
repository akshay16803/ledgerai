import SwiftUI
import StoreKit

struct SubscriptionPaywall: View {


    @Environment(LocalizationManager.self) var lang
    @Environment(\.scenePhase) private var scenePhase
    @State private var viewModel = BillingViewModel()
    @State private var selectedProductId: String = "com.spentyai.yearly"
    @State private var showLifetimeOffer = false
    /// See BillingView for the full rationale: once the user dismisses the
    /// lifetime intercept once, subsequent Continue taps go straight to the
    /// chosen plan. Prevents an inescapable loop within the 30-min offer
    /// window.
    @State private var lifetimeUpsellDismissedThisSession = false
    @State private var isRestoring = false
    @State private var restoreResultMessage: String? = nil
    @State private var showRestoreResult = false

    /// Caller provides the user's last-known subscription status + provider so
    /// the paywall can show a contextual banner. New users → silent. Expired
    /// users → "Your subscription expired, renew below". Users with an active
    /// sub on PayU/Google → "Manage on Web/Android" (rare on iOS but possible
    /// during cross-platform usage).
    var subscriptionStatus: String? = nil
    var subscriptionProvider: String? = nil
    var onSubscribed: (() -> Void)?

    /// Returns the contextual banner string and whether subscribe should be
    /// blocked (provider mismatch).
    private var paywallContext: (banner: String?, block: Bool) {
        let status = (subscriptionStatus ?? "").lowercased()
        let provider = (subscriptionProvider ?? "").lowercased()
        // Active sub on a non-Apple provider — blocking double-billing.
        if status == "active", provider == "payu" {
            return ("You have an active SpentyAI subscription on the web. Manage it at www.spentyai.com — subscribing here would double-charge you.", true)
        }
        if status == "active", provider == "google" {
            return ("You have an active SpentyAI subscription on Android. Manage it in Google Play — subscribing here would double-charge you.", true)
        }
        // Expired / cancelled — friendly nudge, no block.
        if status == "expired" || status == "cancelled" {
            return ("Your SpentyAI subscription ended. Renew below to restore access — your data is safe.", false)
        }
        if status == "in_grace_period" {
            return ("Your last payment didn't go through. Renew below to keep your access without interruption.", false)
        }
        return (nil, false)
    }

    // MARK: - Brand Colors

    private let brandPrimary = Color.spentyPrimary
    private let brandBg      = Color.spentyBgPrimary
    private let brandError   = Color.spentyError

    /// Apple App Review (May 2026) flagged iPhone-stretched iPad UI; cap
    /// paywall content width on iPad and centre it.
    private var isPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                // Contextual reason banner (expired / managed-elsewhere)
                if let bannerText = paywallContext.banner {
                    reasonBanner(text: bannerText, isBlocking: paywallContext.block)
                }

                // Hero
                heroSection

                // Plan Selection
                planSelectionSection

                // Subscribe Button
                subscribeButton

                // Detection Note
                detectionNote

                // Terms
                termsSection
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
            .frame(maxWidth: isPad ? 640 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .background(brandBg.ignoresSafeArea())
        .task {
            await viewModel.loadStoreProducts()
            await viewModel.checkEntitlements()
            if viewModel.isSubscribed {
                onSubscribed?()
            }
        }
        // Auto-restore on foreground: if Apple already considers the user
        // subscribed (StoreKit Transaction.currentEntitlements has an entry)
        // but our backend hasn't caught up yet (notification still in flight,
        // /verify call previously failed offline, etc), this re-runs the check
        // and silently flips the user back to active without them needing to
        // tap "Restore Purchases".
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task {
                    await viewModel.checkEntitlements()
                    if viewModel.isSubscribed { onSubscribed?() }
                }
            }
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button(lang.s("ok")) { viewModel.showError = false }
        } message: {
            Text(viewModel.errorMessage)
        }
        .alert("Restore Purchases", isPresented: $showRestoreResult) {
            Button("OK") { showRestoreResult = false }
        } message: {
            Text(restoreResultMessage ?? "")
        }
        .sheet(isPresented: $showLifetimeOffer, onDismiss: {
            // Treat ANY dismissal — explicit "No thanks" tap, swipe-down,
            // even an iOS gesture — as a hard decline. Without this, the
            // pull-down gesture closed the sheet without setting the
            // "dismissed this session" flag, so the next Continue tap
            // re-presented the upsell — an inescapable loop until the
            // user found the small grey "No thanks, go back" link.
            // Reported by user 2026-05-10.
            lifetimeUpsellDismissedThisSession = true
        }) {
            LifetimeOfferSheet(
                showTimer: true,
                // Pass the actual StoreKit price so the user sees it before
                // confirming the purchase (required by guideline 3.1.1).
                offerPrice: viewModel.displayPrice(for: "com.spentyai.lifetime_offer"),
                fullPrice: viewModel.displayPrice(for: "com.spentyai.lifetime"),
                onAccept: {
                    let didSucceed = await viewModel.purchasePlan("com.spentyai.lifetime_offer")
                    await MainActor.run {
                        showLifetimeOffer = false
                        // Fire on the verify-success boolean directly, not on
                        // viewModel.isSubscribed — the latter races against the
                        // backend's Mongo write of users.subscription_status.
                        // Failing to fire here is what kept users stuck on the
                        // paywall after a successful Apple charge.
                        if didSucceed { onSubscribed?() }
                    }
                },
                onDecline: {
                    // User declined — return to plan selection, no automatic purchase.
                    // The .sheet's onDismiss handler ALSO sets the flag, so
                    // both the explicit button tap and the swipe-down end
                    // up at the same place.
                    showLifetimeOffer = false
                    lifetimeUpsellDismissedThisSession = true
                }
            )
        }
        .overlay {
            if viewModel.isPurchasing {
                ZStack {
                    Color.black.opacity(0.3).ignoresSafeArea()
                    VStack(spacing: 12) {
                        ProgressView()
                            .scaleEffect(1.3)
                            .tint(.white)
                        Text(lang.s("processing_paywall"))
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.white)
                    }
                    .padding(28)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                }
            }
        }
    }

    // MARK: - Hero

    private var heroSection: some View {
        VStack(spacing: 14) {
            Spacer().frame(height: 12)

            Image(systemName: "crown.fill")
                .font(.system(size: 44))
                .foregroundStyle(
                    LinearGradient(
                        colors: [brandPrimary, brandPrimary.opacity(0.6)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Text(lang.s("unlock_premium"))
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)

            Text(lang.s("premium_subtitle"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)

            // Feature rows with green circle icons
            VStack(spacing: 12) {
                featureRow(icon: "brain.head.profile",
                           text: "AI-powered transaction insights")
                featureRow(icon: "chart.line.uptrend.xyaxis",
                           text: "Advanced cash flow analytics")
                featureRow(icon: "envelope.badge.fill",
                           text: "Automatic email & SMS sync")
                featureRow(icon: "doc.text.fill",
                           text: "Unlimited invoices & reports")
            }
            .padding(.top, 4)
            .padding(.horizontal, 4)
        }
    }

    private func featureRow(icon: String, text: String) -> some View {
        HStack(alignment: .center, spacing: 14) {
            ZStack {
                Circle()
                    .fill(brandPrimary)
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.white)
            }

            Text(text)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Color.spentyTextPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer()
        }
    }

    // MARK: - Plan Selection

    private var planSelectionSection: some View {
        VStack(spacing: 10) {
            ForEach(BillingView.fallbackPlans, id: \.productId) { plan in
                planOption(plan)
            }
        }
    }

    private func planOption(_ plan: BillingView.FallbackPlan) -> some View {
        let isSelected = selectedProductId == plan.productId

        return Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                selectedProductId = plan.productId
            }
        } label: {
            HStack(spacing: 12) {
                // Radio
                Circle()
                    .stroke(isSelected ? brandPrimary : Color.gray.opacity(0.3), lineWidth: 2)
                    .frame(width: 22, height: 22)
                    .overlay {
                        if isSelected {
                            Circle()
                                .fill(brandPrimary)
                                .frame(width: 12, height: 12)
                        }
                    }

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(plan.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)

                        if let badge = plan.badge {
                            Text(badge)
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(badge == "Popular" ? .orange : brandPrimary)
                                .clipShape(Capsule())
                        }
                    }

                    if let subtitle = plan.subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    // Trial summary pill — stacked under subtitle, NOT overlaid.
                    // Previously this was an `.overlay(alignment: .bottomLeading)`
                    // which printed on top of the subtitle text, producing the
                    // double-text artefact Apple App Review noticed (May 2026).
                    if let trial = viewModel.trialSummary(for: plan.productId) {
                        HStack(spacing: 4) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 9, weight: .bold))
                            Text(trial)
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .foregroundStyle(brandPrimary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(brandPrimary.opacity(0.10))
                        .clipShape(Capsule())
                        .padding(.top, 4)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 1) {
                    if let price = viewModel.displayPrice(for: plan.productId) {
                        Text(price)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(brandPrimary)
                    } else {
                        ProgressView()
                            .scaleEffect(0.7)
                            .tint(brandPrimary)
                    }

                    if viewModel.displayPrice(for: plan.productId) != nil, let per = plan.perUnit {
                        Text(per)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            .padding(14)
            .background(isSelected ? brandPrimary.opacity(0.06) : Color.spentyCardBg)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? brandPrimary : Color.gray.opacity(0.12), lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Subscribe Button

    private var subscribeButton: some View {
        // Apple App Review (May 2026, 2.1(b)) failed because reviewers tapped
        // Continue before StoreKit prices loaded and got "Product not available".
        // Keep the CTA disabled with a "Connecting…" hint until the price for
        // the selected plan is in our local cache.
        let priceLoaded = viewModel.displayPrice(for: selectedProductId) != nil
        let crossPlatformBlocked = paywallContext.block

        return Button {
            if crossPlatformBlocked { return }
            // Lifetime upsell intercept: shown ONCE per session for any
            // recurring plan (monthly / quarterly / yearly) when the 30-min
            // offer window is still open. Lifetime tap goes straight through.
            // After the user dismisses once, every subsequent tap goes direct
            // to purchase — otherwise they're trapped in a loop.
            let isRecurringPlan = selectedProductId == "com.spentyai.monthly"
                || selectedProductId == "com.spentyai.quarterly"
                || selectedProductId == "com.spentyai.yearly"
            let shouldIntercept = isRecurringPlan
                && LifetimeOfferManager.shared.isOfferActive
                && !lifetimeUpsellDismissedThisSession
            if shouldIntercept {
                showLifetimeOffer = true
            } else {
                Task {
                    let didSucceed = await viewModel.purchasePlan(selectedProductId)
                    if didSucceed {
                        onSubscribed?()
                    }
                }
            }
        } label: {
            HStack(spacing: 10) {
                if !priceLoaded && !crossPlatformBlocked {
                    ProgressView()
                        .tint(.white)
                }
                Text(crossPlatformBlocked
                     ? "Manage on your other device"
                     : (priceLoaded ? lang.s("continue_btn") : "Connecting to App Store…"))
                    .font(.headline)
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(brandPrimary.opacity((priceLoaded && !crossPlatformBlocked) ? 1.0 : 0.6),
                        in: RoundedRectangle(cornerRadius: 14))
        }
        .disabled(viewModel.isPurchasing || !priceLoaded || crossPlatformBlocked)
    }

    // MARK: - Reason Banner

    /// Contextual banner above the hero — tells users why they're seeing the
    /// paywall (expired sub, grace period, or active sub on a different
    /// platform). Hidden for first-time users.
    private func reasonBanner(text: String, isBlocking: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: isBlocking ? "exclamationmark.triangle.fill" : "info.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(isBlocking ? Color.spentyError : brandPrimary)
                .padding(.top, 1)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Color.spentyTextPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(14)
        .background((isBlocking ? Color.spentyError : brandPrimary).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 12))
        .padding(.top, 4)
    }

    // MARK: - Detection Note

    private var detectionNote: some View {
        HStack(spacing: 10) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.subheadline)
                .foregroundStyle(brandPrimary)

            Text(lang.s("auto_detect_sub"))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(brandPrimary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Terms

    private var termsSection: some View {
        VStack(spacing: 8) {
            Text(lang.s("recurring_billing"))
                .font(.footnote)
                .foregroundStyle(.secondary)

            // Apple guideline 3.1.2: Terms of Service and Privacy Policy must be
            // visible at the moment of purchase. Render full-width, tappable, body-sized.
            HStack(spacing: 12) {
                Link("Terms of Service", destination: URL(string: "https://spentyai.com/terms")!)
                    .frame(maxWidth: .infinity)
                Link("Privacy Policy", destination: URL(string: "https://spentyai.com/privacy")!)
                    .frame(maxWidth: .infinity)
            }
            .font(.body)
            .foregroundStyle(brandPrimary)

            Button("Restore Purchases") {
                Task {
                    isRestoring = true
                    do {
                        try await AppStore.sync()
                        // Re-check entitlements after sync
                        await viewModel.checkEntitlements()
                        if viewModel.isSubscribed {
                            onSubscribed?()
                        } else {
                            restoreResultMessage = "No active subscription found for this Apple ID."
                            showRestoreResult = true
                        }
                    } catch {
                        restoreResultMessage = "Restore failed. Please try again or contact us at customersupport@spentyai.com."
                        showRestoreResult = true
                    }
                    isRestoring = false
                }
            }
            .font(.body)
            .foregroundStyle(brandPrimary)
            .disabled(isRestoring)
            .overlay {
                if isRestoring {
                    ProgressView()
                        .scaleEffect(0.7)
                        .offset(x: 80)
                }
            }
        }
        .multilineTextAlignment(.center)
    }
}

#Preview {
    SubscriptionPaywall()
}
