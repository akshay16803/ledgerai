import SwiftUI
import StoreKit

struct BillingView: View {
    @Environment(AppState.self) private var appState
    @Environment(SubscriptionManager.self) private var subscriptionManager
    @State private var viewModel = BillingViewModel()
    @State private var purchaseSuccess = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: SpentySpacing.xl) {
                    header
                    planCards
                    promoSection
                    restoreButton
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.xl)
            }
            .background(SpentyColors.bgPrimary.ignoresSafeArea())
            .navigationTitle("Choose Your Plan")
            .navigationBarTitleDisplayMode(.inline)
            .overlay {
                if purchaseSuccess {
                    successOverlay
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: SpentySpacing.sm) {
            Image(systemName: "crown.fill")
                .font(.system(size: 44))
                .foregroundStyle(SpentyColors.warning)

            Text("Unlock SpentyAI")
                .font(SpentyFonts.heading)
                .foregroundStyle(SpentyColors.textPrimary)

            Text("Get full access to autonomous accounting, AI insights, and all premium features.")
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
        }
        .padding(.top, SpentySpacing.lg)
    }

    // MARK: - Plan Cards

    private var planCards: some View {
        VStack(spacing: SpentySpacing.lg) {
            if subscriptionManager.isLoading && subscriptionManager.products.isEmpty {
                ProgressView()
                    .controlSize(.large)
                    .tint(SpentyColors.brandAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, SpentySpacing.xxl)
            } else if subscriptionManager.products.isEmpty {
                EmptyState(
                    icon: "wifi.slash",
                    title: "Unable to Load Plans",
                    message: "Check your connection and try again.",
                    actionTitle: "Retry"
                ) {
                    Task { await subscriptionManager.loadProducts() }
                }
            } else {
                ForEach(subscriptionManager.products, id: \.id) { product in
                    planCard(for: product)
                }
            }

            if let error = subscriptionManager.errorMessage {
                Text(error)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.danger)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private func planCard(for product: Product) -> some View {
        let isYearly = product.id.contains("yearly")
        let isBusiness = product.id.contains("business")
        let displayName = StoreKitProducts.displayName(for: product.id)

        return SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                // Plan name + badge
                HStack {
                    Text(displayName)
                        .font(SpentyFonts.heading)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Spacer()

                    if isYearly {
                        Text("Best Value")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, SpentySpacing.sm)
                            .padding(.vertical, SpentySpacing.xs)
                            .background(SpentyColors.success)
                            .clipShape(Capsule())
                    }
                }

                // Price
                HStack(alignment: .firstTextBaseline, spacing: SpentySpacing.xs) {
                    Text(product.displayPrice)
                        .font(SpentyFonts.stat)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Text(isYearly ? "/ year" : "/ month")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                // Features
                VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                    featureRow("Unlimited transactions")
                    featureRow("AI-powered categorization")
                    featureRow("Bank statement reconciliation")
                    featureRow("Cash flow projections")
                    if isBusiness {
                        featureRow("Sales invoices & purchase bills")
                        featureRow("Customer & vendor management")
                        featureRow("Tax summaries & reports")
                    }
                }
                .padding(.top, SpentySpacing.xs)

                // Subscribe button
                PrimaryButton(
                    "Subscribe",
                    icon: "lock.open.fill",
                    isLoading: subscriptionManager.isLoading,
                    isFullWidth: true
                ) {
                    Task {
                        do {
                            let success = try await subscriptionManager.purchase(product: product)
                            if success {
                                await appState.refreshSubscription()
                                purchaseSuccess = true
                            }
                        } catch {
                            // Error is handled by SubscriptionManager
                        }
                    }
                }
            }
        }
    }

    private func featureRow(_ text: String) -> some View {
        HStack(spacing: SpentySpacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 14))
                .foregroundStyle(SpentyColors.success)

            Text(text)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
        }
    }

    // MARK: - Promo Section

    private var promoSection: some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                SectionHeader("Have a promo code?")

                HStack(spacing: SpentySpacing.sm) {
                    TextField("Enter code", text: $viewModel.promoCode)
                        .font(SpentyFonts.body)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .padding(.horizontal, SpentySpacing.md)
                        .padding(.vertical, SpentySpacing.sm + 2)
                        .background(SpentyColors.bgSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))

                    if viewModel.promoValid == true {
                        PrimaryButton(
                            "Activate",
                            isLoading: viewModel.isActivating
                        ) {
                            Task {
                                await viewModel.activatePromo(appState: appState)
                                await appState.refreshSubscription()
                                if appState.hasActiveSubscription {
                                    purchaseSuccess = true
                                }
                            }
                        }
                    } else {
                        SecondaryButton(
                            "Apply",
                            isLoading: viewModel.isValidating,
                            isDisabled: viewModel.promoCode.trimmingCharacters(in: .whitespaces).isEmpty
                        ) {
                            Task { await viewModel.validatePromo() }
                        }
                    }
                }

                if let error = viewModel.promoError {
                    Text(error)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.danger)
                }

                if let message = viewModel.promoMessage, viewModel.promoValid == true {
                    Text(message)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.success)
                }
            }
        }
    }

    // MARK: - Restore

    private var restoreButton: some View {
        Button {
            Task {
                await subscriptionManager.restorePurchases()
                await appState.refreshSubscription()
                if appState.hasActiveSubscription {
                    purchaseSuccess = true
                }
            }
        } label: {
            Text("Restore Purchases")
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.brandAccent)
        }
        .disabled(subscriptionManager.isLoading)
        .padding(.bottom, SpentySpacing.lg)
    }

    // MARK: - Success Overlay

    private var successOverlay: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()

            VStack(spacing: SpentySpacing.xl) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(SpentyColors.success)

                Text("You're all set!")
                    .font(SpentyFonts.heading)
                    .foregroundStyle(SpentyColors.textPrimary)

                Text("Your subscription is now active. Enjoy SpentyAI.")
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textSecondary)
                    .multilineTextAlignment(.center)

                PrimaryButton("Get Started", icon: "arrow.right", isFullWidth: true) {
                    purchaseSuccess = false
                }
            }
            .padding(SpentySpacing.xxl)
            .background(SpentyColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.lg))
            .padding(.horizontal, SpentySpacing.xl)
            .shadow(color: .black.opacity(0.2), radius: 20, y: 8)
        }
        .transition(.opacity)
        .animation(.easeInOut(duration: 0.3), value: purchaseSuccess)
    }
}

#Preview {
    BillingView()
        .environment(AppState())
        .environment(SubscriptionManager())
}
