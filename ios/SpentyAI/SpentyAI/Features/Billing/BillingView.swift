import SwiftUI
import StoreKit

struct BillingView: View {


    @Environment(LocalizationManager.self) var lang
    @State private var viewModel = BillingViewModel()
    @State private var showLifetimeOffer = false
    @State private var isUpgradeMode = false

    // MARK: - Brand Colors

    private let brandPrimary = Color.spentyPrimary
    private let brandBg      = Color.spentyBgPrimary
    private let brandError   = Color.spentyError

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
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
        .sheet(isPresented: $showLifetimeOffer) {
            let upgrade = isUpgradeMode
            LifetimeOfferSheet(
                showTimer: !upgrade,
                onAccept: {
                    await viewModel.purchasePlan("com.spentyai.lifetime_offer")
                    showLifetimeOffer = false
                    isUpgradeMode = false
                },
                onDecline: {
                    let wasUpgrade = isUpgradeMode
                    showLifetimeOffer = false
                    isUpgradeMode = false
                    if !wasUpgrade {
                        Task { await viewModel.purchasePlan("com.spentyai.monthly") }
                    }
                }
            )
        }
    }

    // MARK: - Current Plan Header

    @ViewBuilder
    private var currentPlanHeader: some View {
        if let status = viewModel.currentStatus, status.isActive {
            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.title2)
                        .foregroundStyle(brandPrimary)

                    Text(lang.s("active_subscription"))
                        .font(.headline)
                        .foregroundStyle(brandPrimary)
                }

                if let plan = status.plan {
                    Text(plan)
                        .font(.title3.weight(.semibold))
                }

                if let expires = status.expiresAt {
                    Text("Renews \(expires)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let provider = status.provider {
                    Text("via \(provider.capitalized)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(brandPrimary.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    // MARK: - Plan Cards

    private var planCardsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(lang.s("choose_plan"))
                .font(.title3.weight(.semibold))

            ForEach(Self.fallbackPlans, id: \.productId) { plan in
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
                Button {
                    if plan.productId == "com.spentyai.monthly" && LifetimeOfferManager.shared.isOfferActive {
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
                .disabled(viewModel.isPurchasing)
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
                    Text("₹9,999")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .strikethrough(true, color: .secondary)
                    Text("₹4,999")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(brandPrimary)
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
                        Text("₹4,999")
                            .font(.headline)
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

    // MARK: - Cancel

    private var cancelSection: some View {
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
        FallbackPlan(name: "Monthly",  productId: "com.spentyai.monthly",  displayPrice: "\u{20B9}199",   perUnit: "/month",   subtitle: "Flexible, cancel anytime",                 badge: nil),
        FallbackPlan(name: "Quarterly", productId: "com.spentyai.quarterly", displayPrice: "\u{20B9}449",  perUnit: "/3 months", subtitle: "Save 25% vs monthly",                     badge: nil),
        FallbackPlan(name: "Yearly",   productId: "com.spentyai.yearly",   displayPrice: "\u{20B9}1,499", perUnit: "/year",     subtitle: "Save 37% — most popular",                  badge: "Popular"),
        FallbackPlan(name: "Lifetime", productId: "com.spentyai.lifetime", displayPrice: "\u{20B9}9,999", perUnit: "one-time",  subtitle: "Pay once, use forever",                    badge: "Best Value"),
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
