import SwiftUI
import StoreKit

struct BillingView: View {

    @State private var viewModel = BillingViewModel()

    // MARK: - Brand Colors

    private let brandPrimary = Color.spentyPrimary
    private let brandBg      = Color.spentyBgPrimary
    private let brandError   = Color.spentyError

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                currentPlanHeader

                planCardsSection

                promoCodeSection

                if !viewModel.paymentHistory.isEmpty {
                    paymentHistorySection
                }

                if viewModel.isSubscribed {
                    cancelSection
                }
            }
            .padding()
        }
        .background(brandBg.ignoresSafeArea())
        .navigationTitle("Subscription")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await viewModel.loadAll()
            await viewModel.checkEntitlements()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK") { viewModel.showError = false }
        } message: {
            Text(viewModel.errorMessage)
        }
        .alert("Cancel Subscription", isPresented: $viewModel.showCancelConfirmation) {
            Button("Keep Plan", role: .cancel) {}
            Button("Cancel Plan", role: .destructive) {
                Task { await viewModel.cancelSubscription() }
            }
        } message: {
            Text("Are you sure you want to cancel your subscription? You'll retain access until the end of your current billing period.")
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
                    .scaleEffect(1.2)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.ultraThinMaterial)
            }
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

                    Text("Active Subscription")
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
            Text("Choose a Plan")
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

            if !isCurrent {
                Button {
                    Task { await viewModel.purchasePlan(plan.productId) }
                } label: {
                    Group {
                        if isPurchasingThis {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Subscribe")
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
            Text("Promo Code")
                .font(.title3.weight(.semibold))

            HStack(spacing: 8) {
                TextField("Enter promo code", text: $viewModel.promoCode)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()

                Button {
                    Task { await viewModel.validatePromo() }
                } label: {
                    if viewModel.isValidatingPromo {
                        ProgressView()
                    } else {
                        Text("Validate")
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
                        Text("Activate Promo Code")
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
                Text("Payment History")
                    .font(.title3.weight(.semibold))

                Spacer()

                NavigationLink {
                    PaymentHistoryView(orders: viewModel.paymentHistory)
                } label: {
                    Text("See All")
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
                Text(order.createdAt ?? "")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("\(order.currency ?? "") \(String(format: "%.0f", order.amount ?? 0))")
                    .font(.subheadline.weight(.semibold))
                Text((order.status ?? "").capitalized)
                    .font(.caption2)
                    .foregroundStyle(order.status == "completed" || order.status == "paid" ? brandPrimary : brandError)
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Cancel

    private var cancelSection: some View {
        Button(role: .destructive) {
            viewModel.showCancelConfirmation = true
        } label: {
            HStack {
                Image(systemName: "xmark.circle")
                Text("Cancel Subscription")
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
        FallbackPlan(name: "Lifetime", productId: "com.spentyai.lifetime", displayPrice: "\u{20B9}4,999", perUnit: "one-time",  subtitle: "Pay once, use forever",                    badge: "Best Value"),
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
