import SwiftUI

struct MandatesListView: View {


    @Environment(LocalizationManager.self) var lang
    @Environment(AuthManager.self) var authManager
    @Environment(\.dismiss) private var dismiss
    @Bindable var viewModel: CashFlowViewModel

    @State private var editingMandateId: String?
    @State private var editAmount: String = ""

    // Premium gate — Mandates is the paid Premium tier.
    @State private var showPremiumSheet = false
    @State private var justSubscribed = false

    private var hasPremium: Bool {
        authManager.user?.hasActiveSubscription == true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {

            // Detect mandates button
            detectButton

            // Upcoming mandates
            if !viewModel.upcomingMandates.isEmpty {
                upcomingSection
            }

            // All mandates
            if viewModel.mandates.isEmpty {
                emptyState
            } else {
                mandatesList
            }
        }
        .task {
            if !hasPremium {
                showPremiumSheet = true
            }
        }
        .sheet(isPresented: $showPremiumSheet, onDismiss: {
            if !justSubscribed && !hasPremium { dismiss() }
        }) {
            PremiumFeatureSheet.bundle(
                onClose: { showPremiumSheet = false },
                onSubscribed: { justSubscribed = true }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled(false)
        }
    }

    // MARK: - Detect Button

    private var detectButton: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                Task { await viewModel.detectMandates() }
            } label: {
                HStack(spacing: 8) {
                    if viewModel.isDetecting {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "sparkle.magnifyingglass")
                    }
                    Text(viewModel.isDetecting ? "Detecting..." : "Detect Mandates")
                }
                .primaryButtonStyle()
            }
            .disabled(viewModel.isDetecting)

            Text(lang.s("mandates_info"))
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary.opacity(0.7))
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Upcoming Section

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(title: "Upcoming", icon: "calendar.badge.clock")

            VStack(spacing: 0) {
                ForEach(viewModel.upcomingMandates) { mandate in
                    mandateRow(mandate, showActions: false)

                    if mandate.id != viewModel.upcomingMandates.last?.id {
                        Divider().padding(.leading, 48)
                    }
                }
            }
            .cardStyle()
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Mandates List

    private var mandatesList: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(title: "All Mandates", icon: "doc.text.fill")

            VStack(spacing: 0) {
                ForEach(viewModel.mandates) { mandate in
                    mandateRow(mandate, showActions: true)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task { await viewModel.deleteMandate(id: mandate.id) }
                            } label: {
                                Label(lang.s("delete"), systemImage: "trash")
                            }

                            Button {
                                let newStatus = (mandate.status?.lowercased() == "active") ? "paused" : "active"
                                Task { await viewModel.updateMandate(id: mandate.id, status: newStatus) }
                            } label: {
                                let isActive = mandate.status?.lowercased() == "active"
                                Label(isActive ? "Pause" : "Resume",
                                      systemImage: isActive ? "pause.circle" : "play.circle")
                            }
                            .tint(Color.spentyWarning)
                        }

                    if mandate.id != viewModel.mandates.last?.id {
                        Divider().padding(.leading, 48)
                    }
                }
            }
            .cardStyle()
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Mandate Row

    private func mandateRow(_ mandate: Mandate, showActions: Bool) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.spentyAccent1.opacity(0.12))
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.spentyAccent1)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(mandate.merchant ?? "Unknown Merchant")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let freq = mandate.frequency {
                        Text(freq.capitalized)
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyInfo)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.spentyInfo.opacity(0.1))
                            .clipShape(Capsule())
                    }

                    if let status = mandate.status {
                        StatusBadge(status: status)
                    }
                }
            }

            Spacer()

            // Inline editable amount
            if editingMandateId == mandate.id {
                HStack(spacing: 4) {
                    TextField("Amount", text: $editAmount)
                        .font(SpentyFonts.amountSmall)
                        .keyboardType(.decimalPad)
                        .frame(width: 80)
                        .multilineTextAlignment(.trailing)
                        .inputStyle()

                    Button {
                        if let newAmount = Double(editAmount) {
                            Task { await viewModel.updateMandate(id: mandate.id, amount: newAmount) }
                        }
                        editingMandateId = nil
                    } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.spentySuccess)
                    }
                }
            } else {
                CurrencyText(
                    amount: -(mandate.amount ?? 0),
                    font: SpentyFonts.amountSmall
                )
                .onTapGesture {
                    if showActions {
                        editingMandateId = mandate.id
                        editAmount = String(format: "%.2f", mandate.amount ?? 0)
                    }
                }
            }
        }
        .padding(.vertical, 10)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 32))
                .foregroundColor(.spentyTextSecondary.opacity(0.4))

            Text(lang.s("no_mandates_found"))
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)

            Text("Tap \"Detect Mandates\" to scan your transactions")
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .padding(.horizontal, 16)
    }

    // MARK: - Section Header

    private func sectionHeader(title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.spentyPrimary)

            Text(title)
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            Spacer()
        }
    }
}

#Preview {
    MandatesListView(viewModel: CashFlowViewModel())
}
