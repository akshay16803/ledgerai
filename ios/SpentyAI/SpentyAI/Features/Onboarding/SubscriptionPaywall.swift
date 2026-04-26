import SwiftUI
import StoreKit

struct SubscriptionPaywall: View {


    @Environment(LocalizationManager.self) var lang
    @State private var viewModel = BillingViewModel()
    @State private var selectedProductId: String = "com.spentyai.yearly"
    @State private var showPromoSection = false
    @State private var showLifetimeOffer = false

    var onSubscribed: (() -> Void)?

    // MARK: - Brand Colors

    private let brandPrimary = Color.spentyPrimary
    private let brandBg      = Color.spentyBgPrimary
    private let brandError   = Color.spentyError

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                // Hero
                heroSection

                // Plan Selection
                planSelectionSection

                // Subscribe Button
                subscribeButton

                // Promo
                promoSection

                // Detection Note
                detectionNote

                // Terms
                termsSection
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
        }
        .background(brandBg.ignoresSafeArea())
        .task {
            await viewModel.loadStoreProducts()
            await viewModel.checkEntitlements()
            if viewModel.isSubscribed {
                onSubscribed?()
            }
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button(lang.s("ok")) { viewModel.showError = false }
        } message: {
            Text(viewModel.errorMessage)
        }
        .sheet(isPresented: $showLifetimeOffer) {
            LifetimeOfferSheet(
                onAccept: {
                    await viewModel.purchasePlan("com.spentyai.lifetime_offer")
                    showLifetimeOffer = false
                    if viewModel.isSubscribed { onSubscribed?() }
                },
                onDecline: {
                    showLifetimeOffer = false
                    Task {
                        await viewModel.purchasePlan("com.spentyai.monthly")
                        if viewModel.isSubscribed { onSubscribed?() }
                    }
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
        VStack(spacing: 16) {
            Spacer().frame(height: 20)

            Image(systemName: "crown.fill")
                .font(.system(size: 48))
                .foregroundStyle(
                    LinearGradient(
                        colors: [brandPrimary, brandPrimary.opacity(0.6)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Text(lang.s("unlock_premium"))
                .font(.title.weight(.bold))
                .multilineTextAlignment(.center)

            Text(lang.s("premium_subtitle"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)

            // Feature pills
            VStack(alignment: .leading, spacing: 10) {
                featureRow(icon: "brain.head.profile", text: "AI-powered transaction insights")
                featureRow(icon: "chart.line.uptrend.xyaxis", text: "Advanced cash flow analytics")
                featureRow(icon: "envelope.badge", text: "Automatic email & SMS sync")
                featureRow(icon: "doc.text.fill", text: "Unlimited invoices & reports")
            }
            .padding(.top, 4)
        }
    }

    private func featureRow(icon: String, text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundStyle(brandPrimary)
                .frame(width: 24)

            Text(text)
                .font(.subheadline)
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
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 1) {
                    Text(viewModel.displayPrice(for: plan.productId) ?? plan.displayPrice)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(brandPrimary)

                    if let per = plan.perUnit {
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
        Button {
            if selectedProductId == "com.spentyai.monthly" {
                showLifetimeOffer = true
            } else {
                Task {
                    await viewModel.purchasePlan(selectedProductId)
                    if viewModel.isSubscribed {
                        onSubscribed?()
                    }
                }
            }
        } label: {
            Text(lang.s("continue_btn"))
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(brandPrimary, in: RoundedRectangle(cornerRadius: 14))
        }
        .disabled(viewModel.isPurchasing)
    }

    // MARK: - Promo Section

    private var promoSection: some View {
        VStack(spacing: 10) {
            Button {
                withAnimation { showPromoSection.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "ticket")
                    Text(lang.s("have_promo"))
                        .font(.subheadline)
                    Spacer()
                    Image(systemName: showPromoSection ? "chevron.up" : "chevron.down")
                        .font(.caption)
                }
                .foregroundStyle(brandPrimary)
            }

            if showPromoSection {
                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        TextField(lang.s("enter_code"), text: $viewModel.promoCode)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()

                        Button {
                            Task { await viewModel.validatePromo() }
                        } label: {
                            if viewModel.isValidatingPromo {
                                ProgressView()
                            } else {
                                Text(lang.s("apply_promo"))
                            }
                        }
                        .buttonStyle(.bordered)
                        .tint(brandPrimary)
                        .disabled(viewModel.promoCode.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isValidatingPromo)
                    }

                    if !viewModel.promoMessage.isEmpty {
                        HStack(spacing: 6) {
                            Image(systemName: viewModel.promoValid == true ? "checkmark.circle.fill" : "xmark.circle.fill")
                            Text(viewModel.promoMessage)
                                .font(.caption)
                        }
                        .foregroundStyle(viewModel.promoValid == true ? brandPrimary : brandError)
                    }

                    if viewModel.promoValid == true {
                        Button {
                            Task {
                                await viewModel.activatePromo()
                                if viewModel.isSubscribed {
                                    onSubscribed?()
                                }
                            }
                        } label: {
                            Text(lang.s("activate_promo_btn"))
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(brandPrimary)
                        .disabled(viewModel.isActivatingPromo)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding()
        .background(Color.spentyCardBg)
        .clipShape(RoundedRectangle(cornerRadius: 14))
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
        VStack(spacing: 4) {
            Text(lang.s("recurring_billing"))
                .font(.caption2)
                .foregroundStyle(.tertiary)

            HStack(spacing: 4) {
                Link("Terms of Service", destination: URL(string: "https://spentyai.com/terms")!)
                Text("·")
                Link("Privacy Policy", destination: URL(string: "https://spentyai.com/privacy")!)
                Text("·")
                Button("Restore Purchases") {
                    Task { try? await AppStore.sync() }
                }
            }
            .font(.caption2)
            .foregroundStyle(.tertiary)
        }
        .multilineTextAlignment(.center)
    }
}

#Preview {
    SubscriptionPaywall()
}
