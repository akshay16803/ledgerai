import SwiftUI

struct SMSSyncView: View {

    @Environment(AuthManager.self) var authManager
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = SMSSyncViewModel()

    // AI Processing Consent — required by Apple guideline 5.1.1(i)/5.1.2(i) before
    // user data (SMS body text) may be sent to OpenAI for transaction parsing.
    // The pending action is invoked once consent is granted.
    @State private var showConsentSheet = false
    @State private var pendingAIAction: (() -> Void)?

    // Premium gate (added 2026-05-13). SMS Auto-Detection is the paid
    // tier. If the user isn't subscribed, present the modern
    // PremiumFeatureSheet on entry. See EmailSyncView for the matching
    // gate; rationale is identical.
    @State private var showPremiumSheet = false

    /// Local "they paid" flag — set by PremiumFeatureSheet.onSubscribed
    /// before checkSession runs. Lets onDismiss skip the pop-back path
    /// if the auth-refresh fails or hasn't landed yet. Identical to the
    /// pattern in EmailSyncView.
    @State private var justSubscribed = false

    private var hasPremium: Bool {
        authManager.user?.hasActiveSubscription == true
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                introSection
                inputSection
                errorSection
                resultsSection
                statsSection
                actionsSection
            }
            .padding(16)
        }
        .background(Color.spentyBgPrimary)
        .navigationTitle("SMS Sync")
        .navigationBarTitleDisplayMode(.large)
        .task {
            if !hasPremium {
                showPremiumSheet = true
            }
            await viewModel.loadStats()
        }
        .sheet(isPresented: $showPremiumSheet, onDismiss: {
            // Local justSubscribed flag protects the user from being kicked
            // out if /auth/me hasn't refreshed yet (or failed transiently).
            if !justSubscribed && !hasPremium { dismiss() }
        }) {
            PremiumFeatureSheet.smsSync(
                onClose: { showPremiumSheet = false },
                onSubscribed: { justSubscribed = true }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showConsentSheet) {
            AIConsentSheet {
                // User granted consent — run the action that triggered the sheet.
                pendingAIAction?()
                pendingAIAction = nil
            }
        }
    }

    // MARK: - AI Consent Gate

    /// Run `action` immediately if the user has already consented to AI processing,
    /// otherwise stash it in `pendingAIAction` and present `AIConsentSheet`. The action
    /// will fire after the user taps "Allow AI features".
    private func gateAI(_ action: @escaping () -> Void) {
        if AIConsentManager.hasConsented {
            action()
        } else {
            pendingAIAction = action
            showConsentSheet = true
        }
    }

    // MARK: - Intro

    private var introSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "message.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.spentyPrimary)

                Text("Detect Transactions from SMS")
                    .font(SpentyFonts.title3)
                    .foregroundColor(.spentyTextPrimary)
            }

            Text("Paste your bank and financial SMS messages below. SpentyAI will automatically detect transactions, categorize them, and add them to your records.")
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextSecondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.system(size: 12))
                    .foregroundColor(.spentyInfo)

                Text("Tip: Paste each SMS as a separate line. You can copy messages from your Messages app.")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyInfo)
            }
            .padding(10)
            .background(Color.spentyInfo.opacity(0.08))
            .cornerRadius(8)
        }
        .cardStyle()
    }

    // MARK: - Input

    private var inputSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Paste SMS Messages")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                if viewModel.messageCount > 0 {
                    Text("\(viewModel.messageCount) message\(viewModel.messageCount == 1 ? "" : "s")")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.spentyPrimary.opacity(0.1))
                        .cornerRadius(6)
                }
            }

            TextEditor(text: $viewModel.smsText)
                .font(SpentyFonts.body)
                .foregroundColor(.spentyTextPrimary)
                .frame(minHeight: 160)
                .scrollContentBackground(.hidden)
                .padding(12)
                .background(Color.spentyBgPrimary)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.spentyBorder, lineWidth: 1)
                )
                .overlay(alignment: .topLeading) {
                    if viewModel.smsText.isEmpty {
                        Text("e.g.\nRs.2,500 debited from A/c XX1234 on 18-Apr-25. UPI Ref: 1234567890\nRs.15,000 credited to A/c XX5678 via NEFT. Ref: ABCD1234")
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyTextSecondary.opacity(0.5))
                            .padding(16)
                            .allowsHitTesting(false)
                    }
                }

            Button {
                gateAI { Task { await viewModel.uploadAndParse() } }
            } label: {
                HStack(spacing: 8) {
                    if viewModel.isProcessing {
                        ProgressView()
                            .controlSize(.small)
                            .tint(.white)
                    } else {
                        Image(systemName: "arrow.up.doc.fill")
                    }

                    Text(uploadButtonTitle)
                }
                .primaryButtonStyle()
            }
            .disabled(!viewModel.canUpload)
            .opacity(viewModel.canUpload ? 1.0 : 0.5)
        }
        .cardStyle()
    }

    private var uploadButtonTitle: String {
        if viewModel.isUploading { return "Uploading..." }
        if viewModel.isParsing { return "Parsing Transactions..." }
        return "Upload & Parse"
    }

    // MARK: - Error

    @ViewBuilder
    private var errorSection: some View {
        if viewModel.showError {
            ErrorBanner(message: viewModel.errorMessage) {
                viewModel.showError = false
            }
        }
    }

    // MARK: - Results

    @ViewBuilder
    private var resultsSection: some View {
        if viewModel.showResults {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.spentySuccess)
                    Text("Sync Complete")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)
                }

                if let upload = viewModel.lastUploadResult {
                    resultRow(icon: "arrow.up.circle.fill", label: "Stored", value: "\(upload.stored ?? 0)", color: .spentyPrimary)
                    if (upload.skipped ?? 0) > 0 {
                        resultRow(icon: "doc.on.doc", label: "Duplicates skipped", value: "\(upload.skipped ?? 0)", color: .spentyWarning)
                    }
                }

                if let parse = viewModel.lastParseResult {
                    resultRow(icon: "banknote.fill", label: "Processing", value: "\(parse.count ?? 0) messages", color: .spentySuccess)
                }
            }
            .cardStyle()
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    private func resultRow(icon: String, label: String, value: String, color: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(color)
                .frame(width: 20)

            Text(label)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextSecondary)

            Spacer()

            Text(value)
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)
        }
    }

    // MARK: - Stats

    @ViewBuilder
    private var statsSection: some View {
        if viewModel.hasStats, let stats = viewModel.syncStats {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Sync Overview")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)

                    Spacer()

                    if viewModel.isLoadingStats {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Color.spentyPrimary)
                    }
                }

                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12)
                ], spacing: 12) {
                    StatCard(label: "Total Synced", value: "\(stats.totalSynced ?? 0)", icon: "envelope.fill", color: .spentyPrimary)
                    StatCard(label: "Transactions", value: "\(stats.transactionsCreated ?? 0)", icon: "banknote.fill", color: .spentySuccess)
                    StatCard(label: "Pending Approval", value: "\(stats.pendingReview ?? 0)", icon: "clock.fill", color: .spentyWarning)
                    StatCard(label: "Failed", value: "\(stats.aiFailed ?? 0)", icon: "xmark.circle.fill", color: .spentyError)
                }

                if (stats.processedByAi ?? 0) > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "cpu")
                            .font(.system(size: 11))
                        Text("\(stats.processedByAi ?? 0) processed by AI")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyTextSecondary)
                }
            }
            .cardStyle()
        }
    }

    // MARK: - Action Buttons

    @ViewBuilder
    private var actionsSection: some View {
        if viewModel.hasStats {
            VStack(spacing: 12) {
                if let stats = viewModel.syncStats, (stats.pendingReview ?? 0) > 0 || (stats.aiFailed ?? 0) > 0 {
                    Button {
                        gateAI { Task { await viewModel.retryPending() } }
                    } label: {
                        HStack(spacing: 8) {
                            if viewModel.isRetrying {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(Color.spentyPrimary)
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                            Text("Retry Pending Messages")
                        }
                        .secondaryButtonStyle()
                    }
                    .disabled(viewModel.isRetrying)
                    .opacity(viewModel.isRetrying ? 0.6 : 1.0)

                    if let retry = viewModel.lastRetryResult {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle")
                                .font(.system(size: 11))
                                .foregroundColor(.spentySuccess)
                            Text(retry.message ?? "Processing \(retry.count ?? 0) messages")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                        }
                    }
                }

                Button {
                    gateAI { Task { await viewModel.detectMandates() } }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isDetectingMandates {
                            ProgressView()
                                .controlSize(.small)
                                .tint(Color.spentyPrimary)
                        } else {
                            Image(systemName: "repeat.circle")
                        }
                        Text("Detect Auto-Debit Mandates")
                    }
                    .secondaryButtonStyle()
                }
                .disabled(viewModel.isDetectingMandates)
                .opacity(viewModel.isDetectingMandates ? 0.6 : 1.0)

                if let mandate = viewModel.lastMandateResult {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 11))
                            .foregroundColor(.spentySuccess)
                        Text("\(mandate.total ?? 0) recurring mandate\((mandate.total ?? 0) == 1 ? "" : "s") detected")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
            }
            .cardStyle()
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        SMSSyncView()
    }
}
