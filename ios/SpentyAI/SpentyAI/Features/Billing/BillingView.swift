import SwiftUI
import StoreKit

struct BillingView: View {


    @Environment(LocalizationManager.self) var lang
    @State private var viewModel = BillingViewModel()
    @State private var showLifetimeOffer = false
    @State private var isUpgradeMode = false
    /// Once the user has tapped "No thanks" on the lifetime intercept once
    /// in this view's lifetime, do NOT intercept again — taking the user
    /// straight to their chosen plan. Without this flag they're stuck in a
    /// loop because LifetimeOfferManager.isOfferActive stays true for the
    /// full 30-min window.
    @State private var lifetimeUpsellDismissedThisSession = false
    /// Restore Purchases UI state. Apple Guideline 3.1.1 requires Restore
    /// to be reachable everywhere a Subscribe button is shown — paywall +
    /// Settings → Subscription both qualify.
    @State private var isRestoring = false
    @State private var restoreResultMessage: String? = nil
    @State private var showRestoreResult = false

    // MARK: - Brand Colors

    private let brandPrimary = Color.spentyPrimary
    private let brandBg      = Color.spentyBgPrimary
    private let brandError   = Color.spentyError

    /// True when the user already has an active subscription via a non-Apple
    /// gateway (web PayU / Android Google Play). Tapping Subscribe in this
    /// state would charge them via Apple too, leaving them double-billed.
    /// The block also covers the in-app management screen (this view), not
    /// just the launch-time paywall — a Settings → Subscription tap should
    /// not become a billing trap.
    private var crossPlatformBlock: (active: Bool, message: String) {
        let provider = (viewModel.currentStatus?.provider ?? "").lowercased()
        let active = viewModel.currentStatus?.isActive == true
        if active && provider == "payu" {
            return (true, "You're subscribed via the SpentyAI website (PayU). Manage at www.spentyai.com — subscribing here would double-charge you.")
        }
        if active && provider == "google" {
            return (true, "You're subscribed via Google Play (Android). Manage in the Play Store on your phone — subscribing here would double-charge you.")
        }
        return (false, "")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if crossPlatformBlock.active {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(brandError)
                            .padding(.top, 1)
                        Text(crossPlatformBlock.message)
                            .font(.subheadline)
                            .foregroundStyle(Color.spentyTextPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .background(brandError.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                }

                currentPlanHeader

                subscriberUpgradeBanner

                planCardsSection

                promoCodeSection

                if !viewModel.paymentHistory.isEmpty {
                    paymentHistorySection
                }

                if viewModel.isSubscribed && !viewModel.isLifetime {
                    cancelSection
                }

                // Restore Purchases — required by App Store Guideline 3.1.1
                // alongside any Subscribe affordance. Lets reinstalled users
                // OR cross-device users (same Apple ID, new device) recover
                // their existing subscription without paying again.
                restoreSection
            }
            .padding()
        }
        .background(brandBg.ignoresSafeArea())
        .navigationTitle(lang.s("subscription"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            await viewModel.loadAll()
            await viewModel.checkEntitlements()
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
        .alert(lang.s("cancel_subscription"), isPresented: $viewModel.showCancelConfirmation) {
            Button("Keep Plan", role: .cancel) {}
            Button("Cancel Plan", role: .destructive) {
                Task { await viewModel.cancelSubscription() }
            }
        } message: {
            Text(lang.s("cancel_sub_confirm"))
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .scaleEffect(1.2)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.ultraThinMaterial)
            }
        }
        .sheet(isPresented: $showLifetimeOffer, onDismiss: {
            // Treat ANY dismissal — explicit "No thanks" tap, swipe-down,
            // even an iOS gesture — as a hard decline. Without this, the
            // pull-down gesture closed the sheet without setting the
            // "dismissed this session" flag, so the next Subscribe tap
            // re-presented the upsell — an inescapable loop until the
            // user found the small grey "No thanks, go back" link.
            // Reported by user 2026-05-10.
            isUpgradeMode = false
            lifetimeUpsellDismissedThisSession = true
        }) {
            let upgrade = isUpgradeMode
            LifetimeOfferSheet(
                showTimer: !upgrade,
                // Pass the actual StoreKit price so it is visible before purchase (guideline 3.1.1).
                offerPrice: viewModel.displayPrice(for: "com.spentyai.lifetime_offer"),
                fullPrice: viewModel.displayPrice(for: "com.spentyai.lifetime"),
                onAccept: {
                    await viewModel.purchasePlan("com.spentyai.lifetime_offer")
                    await MainActor.run {
                        showLifetimeOffer = false
                        isUpgradeMode = false
                    }
                },
                onDecline: {
                    // User declined the lifetime offer — close the sheet only.
                    // Do NOT auto-purchase anything. The .sheet's onDismiss
                    // handler ALSO sets the session flag, so both swipe-down
                    // and the explicit button end up at the same state.
                    // (Auto-purchasing here would violate App Store guideline 3.1.1.)
                    showLifetimeOffer = false
                    isUpgradeMode = false
                    lifetimeUpsellDismissedThisSession = true
                }
            )
        }
    }

    // MARK: - Current Plan Header

    @ViewBuilder
    private var currentPlanHeader: some View {
        if let status = viewModel.currentStatus, status.isActive {
            let rawStatus = (status.status ?? "").lowercased()
            let isTrial = rawStatus == "trialing"
            let isGrace = rawStatus == "in_grace_period"
            VStack(spacing: 8) {
                HStack {
                    Image(systemName: isTrial ? "hourglass" : (isGrace ? "exclamationmark.triangle.fill" : "checkmark.seal.fill"))
                        .font(.title2)
                        .foregroundStyle(isGrace ? brandError : brandPrimary)

                    Text(isTrial ? "Free Trial Active"
                         : isGrace ? "Payment Retrying"
                         : lang.s("active_subscription"))
                        .font(.headline)
                        .foregroundStyle(isGrace ? brandError : brandPrimary)
                }

                if let plan = status.plan {
                    Text(plan)
                        .font(.title3.weight(.semibold))
                }

                if let expires = status.expiresAt {
                    if isTrial {
                        // Tell the user EXACTLY when the first real charge lands +
                        // the recurring amount, so the trial isn't a black box.
                        Text("First charge on \(Self.formatPaymentDate(expires))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if isGrace {
                        Text("Auto-charge retrying — access continues until \(Self.formatPaymentDate(expires))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    } else {
                        Text("Renews \(Self.formatPaymentDate(expires))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if let provider = status.provider {
                    Text("via \(provider.capitalized)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background((isGrace ? brandError : brandPrimary).opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: - Plan Cards

    /// Plans visible in Manage Subscription after the 2026-05-13 pivot:
    ///   • Free users see ONLY the monthly tier (₹199/month) — the legacy
    ///     quarterly/yearly/lifetime SKUs are retired from the UI even
    ///     though the records remain Active in ASC for existing subs.
    ///   • Active subscribers see ONLY their current plan so they can read
    ///     pricing + "Current Plan" without being shown upsell ladders.
    private var visiblePlans: [FallbackPlan] {
        if let activePid = viewModel.currentStatus?.productId,
           viewModel.isSubscribed,
           let match = Self.fallbackPlans.first(where: { $0.productId == activePid }) {
            return [match]
        }
        return Self.fallbackPlans.filter { $0.productId == "com.spentyai.monthly" }
    }

    private var planCardsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(lang.s("choose_plan"))
                .font(.title3.weight(.semibold))

            ForEach(visiblePlans, id: \.productId) { plan in
                planCard(plan)
            }
        }
    }

    private func planCard(_ plan: FallbackPlan) -> some View {
        let isCurrent = viewModel.isCurrentPlan(plan.productId)
        let isPurchasingThis = viewModel.purchasingProductId == plan.productId

        return VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(plan.name)
                            .font(.headline)

                        if isCurrent {
                            Text("Active")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(brandPrimary)
                                .clipShape(Capsule())
                        }

                        if plan.badge != nil {
                            Text(plan.badge!)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(.orange)
                                .clipShape(Capsule())
                        }
                    }

                    if let subtitle = plan.subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(viewModel.displayPrice(for: plan.productId) ?? plan.displayPrice)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(brandPrimary)

                    if let per = plan.perUnit {
                        Text(per)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if !isCurrent && !viewModel.isLifetime {
                // Apple App Review 2.1(b): keep Subscribe disabled until the
                // StoreKit price for this specific plan has loaded so reviewer
                // never taps a button that triggers an unfulfillable purchase.
                let priceLoaded = viewModel.displayPrice(for: plan.productId) != nil

                Button {
                    if crossPlatformBlock.active { return }
                    // Lifetime upsell intercept: shown ONCE per session for any
                    // recurring plan (monthly / quarterly / yearly) when the
                    // 30-min offer window is still open. Lifetime tap goes
                    // straight through (no point upselling lifetime to itself).
                    // After the user dismisses once, every subsequent tap goes
                    // direct to purchase — otherwise they'd be trapped in a
                    // loop because isOfferActive stays true for 30 min.
                    let isRecurringPlan = plan.productId == "com.spentyai.monthly"
                        || plan.productId == "com.spentyai.quarterly"
                        || plan.productId == "com.spentyai.yearly"
                    let shouldIntercept = isRecurringPlan
                        && LifetimeOfferManager.shared.isOfferActive
                        && !lifetimeUpsellDismissedThisSession
                    if shouldIntercept {
                        isUpgradeMode = false
                        showLifetimeOffer = true
                    } else {
                        Task { await viewModel.purchasePlan(plan.productId) }
                    }
                } label: {
                    Group {
                        if isPurchasingThis {
                            ProgressView()
                                .tint(.white)
                        } else if !priceLoaded && !crossPlatformBlock.active {
                            HStack(spacing: 6) {
                                ProgressView().tint(.white).scaleEffect(0.8)
                                Text("Loading…")
                                    .font(.subheadline.weight(.semibold))
                            }
                        } else if crossPlatformBlock.active {
                            Text("Manage on your other device")
                                .font(.subheadline.weight(.semibold))
                        } else {
                            Text(lang.s("subscribe"))
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
                .tint(brandPrimary)
                .disabled(viewModel.isPurchasing || !priceLoaded || crossPlatformBlock.active)
            }
        }
        .padding()
        .background(Color.spentyCardBg)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(isCurrent ? brandPrimary : Color.clear, lineWidth: 2)
        )
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }

    // MARK: - Promo Code

    private var promoCodeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(lang.s("promo_code"))
                .font(.title3.weight(.semibold))

            HStack(spacing: 8) {
                TextField(lang.s("promo_code"), text: $viewModel.promoCode)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()

                Button {
                    Task { await viewModel.validatePromo() }
                } label: {
                    if viewModel.isValidatingPromo {
                        ProgressView()
                    } else {
                        Text(lang.s("validate"))
                    }
                }
                .buttonStyle(.bordered)
                .tint(brandPrimary)
                .disabled(viewModel.promoCode.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isValidatingPromo)
            }

            if !viewModel.promoMessage.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: viewModel.promoValid == true ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(viewModel.promoValid == true ? brandPrimary : brandError)

                    Text(viewModel.promoMessage)
                        .font(.caption)
                        .foregroundStyle(viewModel.promoValid == true ? brandPrimary : brandError)
                }
            }

            if viewModel.promoValid == true {
                Button {
                    Task { await viewModel.activatePromo() }
                } label: {
                    if viewModel.isActivatingPromo {
                        ProgressView().tint(.white)
                    } else {
                        Text(lang.s("activate_promo"))
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .buttonStyle(.borderedProminent)
                .tint(brandPrimary)
                .disabled(viewModel.isActivatingPromo)
            }
        }
        .padding()
        .background(Color.spentyCardBg)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }

    // MARK: - Payment History

    private var paymentHistorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(lang.s("payment_history"))
                    .font(.title3.weight(.semibold))

                Spacer()

                NavigationLink {
                    PaymentHistoryView(orders: viewModel.paymentHistory)
                } label: {
                    Text(lang.s("see_all"))
                        .font(.subheadline)
                        .foregroundStyle(brandPrimary)
                }
            }

            ForEach(viewModel.paymentHistory.prefix(3)) { order in
                paymentRow(order)
            }
        }
    }

    private func paymentRow(_ order: PaymentOrder) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(order.plan ?? "Unknown")
                    .font(.subheadline.weight(.medium))
                Text(Self.formatPaymentDate(order.createdAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(Self.formatPaymentAmount(order.amount, currency: order.currency))
                    .font(.subheadline.weight(.semibold))
                Text((order.status ?? "").capitalized)
                    .font(.caption2)
                    .foregroundStyle(order.status == "completed" || order.status == "paid" ? brandPrimary : brandError)
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Payment Formatting Helpers

    static func formatPaymentAmount(_ amount: Double?, currency: String?) -> String {
        guard let amount = amount else { return "—" }
        let rupees = amount / 100.0
        let formatted = rupees.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "₹%.0f", rupees)
            : String(format: "₹%.2f", rupees)
        return formatted
    }

    static func formatPaymentDate(_ dateString: String?) -> String {
        guard let dateString = dateString, !dateString.isEmpty else { return "" }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "dd MMM yyyy"
            return displayFormatter.string(from: date)
        }
        // Fallback: try without fractional seconds
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "dd MMM yyyy"
            return displayFormatter.string(from: date)
        }
        // Last fallback: return first 10 chars (date part)
        if dateString.count >= 10 {
            return String(dateString.prefix(10))
        }
        return dateString
    }

    // MARK: - Subscriber Upgrade Banner

    @ViewBuilder
    private var subscriberUpgradeBanner: some View {
        if viewModel.isSubscribed && !viewModel.isLifetime {
            let gold = Color(red: 0.831, green: 0.686, blue: 0.216)
            VStack(alignment: .leading, spacing: 14) {

                // Badge
                HStack(spacing: 4) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 9, weight: .bold))
                    Text("SUBSCRIBER EXCLUSIVE")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.8)
                }
                .foregroundStyle(gold)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(gold.opacity(0.12))
                .clipShape(Capsule())

                VStack(alignment: .leading, spacing: 4) {
                    Text("Upgrade to Lifetime Access")
                        .font(.title3.weight(.bold))
                    Text("Pay once and never subscribe again.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                HStack(alignment: .bottom, spacing: 10) {
                    // Show original price from StoreKit if available, else hide until loaded
                    if let regularPrice = viewModel.displayPrice(for: "com.spentyai.lifetime") {
                        Text(regularPrice)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .strikethrough(true, color: .secondary)
                    }
                    // Show offer price from StoreKit — guideline 3.1.1 requires displayed
                    // price to match the actual App Store price in the user's currency.
                    if let offerPrice = viewModel.displayPrice(for: "com.spentyai.lifetime_offer") {
                        Text(offerPrice)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(brandPrimary)
                    } else {
                        ProgressView()
                            .scaleEffect(0.8)
                            .tint(brandPrimary)
                    }
                    Text("50% OFF")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange)
                        .clipShape(Capsule())
                }

                Button {
                    isUpgradeMode = true
                    showLifetimeOffer = true
                } label: {
                    HStack {
                        Text("Upgrade Now")
                            .font(.headline)
                        Spacer()
                        if let offerPrice = viewModel.displayPrice(for: "com.spentyai.lifetime_offer") {
                            Text(offerPrice)
                                .font(.headline)
                        } else {
                            ProgressView()
                                .scaleEffect(0.7)
                                .tint(.white)
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity)
                    .background(brandPrimary, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(18)
            .background(Color.spentyCardBg)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(gold.opacity(0.3), lineWidth: 1.5)
            )
            .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        }
    }

    // MARK: - Restore Purchases

    /// Always-visible Restore button. Calls `AppStore.sync()` (StoreKit 2)
    /// then re-checks entitlements through the existing BillingViewModel
    /// path. Mirrors `SubscriptionPaywall.restoreButton` so the behavior
    /// is identical from either entry point. Posts `subscriptionActivated`
    /// indirectly via `viewModel.checkEntitlements` → `loadStatus` (which
    /// now updates `currentStatus`); also explicitly fires the notification
    /// here so any other observer (AuthManager → AppRouter) reroutes.
    @ViewBuilder
    private var restoreSection: some View {
        VStack(spacing: 8) {
            Button {
                Task {
                    isRestoring = true
                    do {
                        try await AppStore.sync()
                        await viewModel.checkEntitlements()
                        if viewModel.isSubscribed {
                            // Notify AuthManager so AppRouter sees the new
                            // active state immediately. Without this the
                            // restore appears to "do nothing" until the
                            // user backgrounds + foregrounds.
                            NotificationCenter.default.post(name: .subscriptionActivated, object: nil)
                            restoreResultMessage = "Subscription restored successfully."
                        } else {
                            restoreResultMessage = "No active subscription found for this Apple ID."
                        }
                    } catch {
                        restoreResultMessage = "Restore failed. Please try again or contact us at customersupport@spentyai.com."
                    }
                    showRestoreResult = true
                    isRestoring = false
                }
            } label: {
                HStack(spacing: 8) {
                    if isRestoring {
                        ProgressView().scaleEffect(0.8)
                    }
                    Text(isRestoring ? "Restoring…" : "Restore Purchases")
                }
                .font(.subheadline)
                .foregroundStyle(brandPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .disabled(isRestoring)

            Text("Already paid on another device or reinstalled? Tap to restore.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 8)
    }

    // MARK: - Cancel / Manage

    /// For Apple IAP subscribers: opens the App Store subscription management
    /// page (guideline 3.1.2 — cancellation must go through Apple).
    /// For web / promo subscribers: shows the in-app cancel confirmation.
    @ViewBuilder
    private var cancelSection: some View {
        let isAppleSubscriber = viewModel.currentStatus?.provider?.lowercased() == "apple"
            || viewModel.currentStatus?.provider?.lowercased() == "ios"

        if isAppleSubscriber {
            // Guideline 3.1.2 — direct Apple subscribers to Apple's page.
            Link(destination: URL(string: "https://apps.apple.com/account/subscriptions")!) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.up.right.square")
                    Text("Manage Subscription")
                }
                .font(.subheadline)
                .foregroundStyle(brandPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .padding(.top, 8)

            Text("To cancel or change your plan, tap above to open your Apple subscription settings.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        } else {
            // Web / promo subscribers — backend cancel is fine.
            Button(role: .destructive) {
                viewModel.showCancelConfirmation = true
            } label: {
                HStack {
                    Image(systemName: "xmark.circle")
                    Text(lang.s("cancel_subscription"))
                }
                .font(.subheadline)
                .foregroundStyle(brandError)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Fallback Plan Data

    struct FallbackPlan {
        let name: String
        let productId: String
        let displayPrice: String
        let perUnit: String?
        let subtitle: String?
        let badge: String?
    }

    static let fallbackPlans: [FallbackPlan] = [
        FallbackPlan(name: "Monthly",  productId: "com.spentyai.monthly",  displayPrice: "Monthly",    perUnit: nil,         subtitle: "Flexible, cancel anytime",                 badge: nil),
        FallbackPlan(name: "Quarterly", productId: "com.spentyai.quarterly", displayPrice: "Quarterly", perUnit: nil,         subtitle: "Save 25% vs monthly",                     badge: nil),
        FallbackPlan(name: "Yearly",   productId: "com.spentyai.yearly",   displayPrice: "Yearly",     perUnit: nil,         subtitle: "Save 37% — most popular",                  badge: "Popular"),
        FallbackPlan(name: "Lifetime", productId: "com.spentyai.lifetime", displayPrice: "Lifetime",   perUnit: "one-time",  subtitle: "Pay once, use forever",                    badge: "Best Value"),
    ]
}

// MARK: - Color Hex Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)

        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double(rgbValue & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}

#Preview {
    NavigationStack {
        BillingView()
    }
}
