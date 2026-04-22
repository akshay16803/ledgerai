import SwiftUI

struct EmailSyncView: View {

    @State private var viewModel = EmailSyncViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                connectionSuccessOverlay
                errorSection
                toastSection
                syncProgressSection
                overviewStatsSection
                gmailSection
                outlookSection
                retrySection
                pendingReviewCard
            }
            .padding(16)
        }
        .background(Color.spentyBgPrimary)
        .navigationTitle("Email Sync")
        .navigationBarTitleDisplayMode(.large)
        .refreshable {
            await viewModel.loadAll()
        }
        .task {
            await viewModel.loadAll()
        }
        .overlay {
            if viewModel.isLoading && !viewModel.hasAnyAccount && viewModel.syncStatsResponse == nil {
                LoadingView(message: "Loading sync status...")
            }
        }
        .sheet(isPresented: $viewModel.showSyncDatePicker, onDismiss: {
            viewModel.cancelSyncDatePicker()
        }) {
            SyncDatePickerSheet(viewModel: viewModel)
                .presentationDetents([.large])
        }
        .onChange(of: viewModel.justConnectedProvider) { _, newValue in
            if newValue != nil {
                Task {
                    await viewModel.showSyncPickerForJustConnected()
                }
            }
        }
        .onDisappear {
            viewModel.stopPolling()
        }
    }

    // MARK: - Connection Success Animation (Improvement #12)

    @ViewBuilder
    private var connectionSuccessOverlay: some View {
        if viewModel.showConnectionSuccess {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.spentySuccess)
                    .symbolEffect(.bounce, value: viewModel.showConnectionSuccess)

                VStack(alignment: .leading, spacing: 4) {
                    Text("\(viewModel.connectionSuccessProvider.capitalized) Connected!")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)

                    Text("Setting up sync...")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }

                Spacer()
            }
            .padding(16)
            .background(Color.spentySuccess.opacity(0.1))
            .cornerRadius(12)
            .transition(.scale.combined(with: .opacity))
            .animation(.spring(response: 0.5, dampingFraction: 0.7), value: viewModel.showConnectionSuccess)
        }
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

    // MARK: - Toast (Improvement #9 — auto-dismissing)

    @ViewBuilder
    private var toastSection: some View {
        if viewModel.showSuccess {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.white)

                Text(viewModel.successMessage)
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.white)
                    .lineLimit(3)

                Spacer()

                Button {
                    viewModel.showSuccess = false
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white.opacity(0.8))
                }
            }
            .padding(12)
            .background(Color.spentySuccess)
            .cornerRadius(10)
            .transition(.move(edge: .top).combined(with: .opacity))
            .animation(.easeInOut(duration: 0.3), value: viewModel.showSuccess)
        }
    }

    // MARK: - Sync Progress (Improvement #1 — real backend status)

    @ViewBuilder
    private var syncProgressSection: some View {
        if viewModel.syncPhase != .idle {
            HStack(spacing: 14) {
                if viewModel.syncPhase == .complete {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.spentySuccess)
                } else if viewModel.syncPhase == .failed {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.spentyError)
                } else {
                    ProgressView()
                        .controlSize(.regular)
                        .tint(Color.spentyPrimary)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(viewModel.syncPhase.rawValue)
                        .font(SpentyFonts.headline)
                        .foregroundColor(
                            viewModel.syncPhase == .complete ? .spentySuccess :
                            viewModel.syncPhase == .failed ? .spentyError :
                            .spentyTextPrimary
                        )

                    if !viewModel.syncProgressMessage.isEmpty {
                        Text(viewModel.syncProgressMessage)
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }

                Spacer()
            }
            .padding(16)
            .background(
                viewModel.syncPhase == .complete ? Color.spentySuccess.opacity(0.08) :
                viewModel.syncPhase == .failed ? Color.spentyError.opacity(0.08) :
                Color.spentyPrimary.opacity(0.08)
            )
            .cornerRadius(12)
            .animation(.easeInOut, value: viewModel.syncPhase.rawValue)
        }
    }

    // MARK: - Overall Stats (Improvement #7 — empty state)

    @ViewBuilder
    private var overviewStatsSection: some View {
        if viewModel.syncStatsResponse != nil {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Sync Overview")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)

                    Spacer()

                    // Last refreshed timestamp (Improvement #3 context)
                    if let lastRefresh = viewModel.lastRefreshedAt {
                        Text("Updated \(lastRefresh, format: .relative(presentation: .named))")
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }

                if viewModel.isAnySyncing {
                    HStack(spacing: 6) {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Color.spentyPrimary)
                        Text("Processing emails...")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyPrimary)
                    }
                }

                if viewModel.allStatsZero && (viewModel.syncStatsResponse?.aiPending ?? 0) == 0 {
                    // Improvement #7: Better empty state
                    VStack(spacing: 12) {
                        Image(systemName: "envelope.open")
                            .font(.system(size: 36))
                            .foregroundColor(.spentyTextSecondary.opacity(0.5))

                        Text("No emails processed yet")
                            .font(SpentyFonts.subheadline)
                            .foregroundColor(.spentyTextSecondary)

                        if viewModel.isAnySyncing || viewModel.syncPhase != .idle {
                            Text("SpentyAI is scanning your inbox. This may take a few minutes.")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                                .multilineTextAlignment(.center)
                        } else if viewModel.hasAnyAccount {
                            Text("Tap Sync on your account below to start scanning emails.")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                                .multilineTextAlignment(.center)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                } else if viewModel.allStatsZero && (viewModel.syncStatsResponse?.aiPending ?? 0) > 0 {
                    // Emails fetched but still being processed by AI
                    VStack(spacing: 12) {
                        ProgressView()
                            .controlSize(.large)
                            .tint(Color.spentyPrimary)

                        Text("Analyzing \(viewModel.syncStatsResponse?.aiPending ?? 0) emails...")
                            .font(SpentyFonts.subheadline)
                            .foregroundColor(.spentyTextPrimary)

                        Text("SpentyAI is reading your emails and extracting transactions. This may take a few minutes.")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                } else if let stats = viewModel.syncStatsResponse {
                    LazyVGrid(columns: [
                        GridItem(.flexible(), spacing: 12),
                        GridItem(.flexible(), spacing: 12)
                    ], spacing: 12) {
                        StatCard(
                            label: "Total Emails",
                            value: "\(stats.totalSynced ?? 0)",
                            icon: "envelope.fill",
                            color: .spentyPrimary
                        )
                        StatCard(
                            label: "Transactions",
                            value: "\(stats.transactionsCreated ?? 0)",
                            icon: "banknote.fill",
                            color: .spentySuccess
                        )
                        StatCard(
                            label: "Pending Review",
                            value: "\(stats.pendingReview ?? 0)",
                            icon: "clock.fill",
                            color: .spentyWarning
                        )
                        StatCard(
                            label: "AI Failed",
                            value: "\(stats.aiFailed ?? 0)",
                            icon: "xmark.circle.fill",
                            color: .spentyError
                        )
                    }

                    if let processed = stats.processedByAi, processed > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "cpu")
                                .font(.system(size: 11))
                            Text("\(processed) processed by AI")
                                .font(SpentyFonts.caption1)
                        }
                        .foregroundColor(.spentyTextSecondary)
                    }
                }
            }
            .cardStyle()
        }
    }

    // MARK: - Gmail Section

    private var gmailSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "envelope.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.spentyError)

                Text("Gmail")
                    .font(SpentyFonts.title3)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                if !viewModel.gmailAccounts.isEmpty {
                    Text("\(viewModel.gmailAccounts.count) connected")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentySuccess)
                }
            }

            if viewModel.gmailAccounts.isEmpty {
                Text("No Gmail accounts connected")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextSecondary)
            } else {
                ForEach(viewModel.gmailAccounts) { account in
                    accountRow(account, provider: "gmail")
                }
            }

            Button {
                Task { await viewModel.connectGmail() }
            } label: {
                HStack(spacing: 8) {
                    if viewModel.isConnecting {
                        ProgressView()
                            .controlSize(.small)
                            .tint(viewModel.gmailAccounts.isEmpty ? .white : .spentyPrimary)
                    } else {
                        Image(systemName: "plus.circle.fill")
                    }
                    Text(viewModel.gmailAccounts.isEmpty ? "Connect Gmail" : "Add Another Gmail")
                }
                .font(SpentyFonts.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(viewModel.gmailAccounts.isEmpty ? .white : .spentyPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, viewModel.gmailAccounts.isEmpty ? 14 : 10)
                .background(viewModel.gmailAccounts.isEmpty ? Color.spentyPrimary : Color.spentyPrimary.opacity(0.1))
                .cornerRadius(12)
            }
            .disabled(viewModel.isConnecting)
            .opacity(viewModel.isConnecting ? 0.6 : 1.0)
        }
        .cardStyle()
    }

    // MARK: - Outlook Section (Improvement #6 — collapsible)

    @ViewBuilder
    private var outlookSection: some View {
        if !viewModel.outlookAccounts.isEmpty {
            // Show full section when accounts exist
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.spentyInfo)

                    Text("Outlook")
                        .font(SpentyFonts.title3)
                        .foregroundColor(.spentyTextPrimary)

                    Spacer()

                    Text("\(viewModel.outlookAccounts.count) connected")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentySuccess)
                }

                ForEach(viewModel.outlookAccounts) { account in
                    accountRow(account, provider: "outlook")
                }

                Button {
                    Task { await viewModel.connectOutlook() }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isConnecting {
                            ProgressView()
                                .controlSize(.small)
                                .tint(.white)
                        } else {
                            Image(systemName: "plus.circle.fill")
                        }
                        Text("Connect Outlook")
                    }
                    .primaryButtonStyle()
                }
                .disabled(viewModel.isConnecting)
                .opacity(viewModel.isConnecting ? 0.6 : 1.0)
            }
            .cardStyle()
        } else {
            // Compact "Add Outlook" row when no accounts
            Button {
                Task { await viewModel.connectOutlook() }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.spentyInfo)
                        .frame(width: 32, height: 32)
                        .background(Color.spentyInfo.opacity(0.1))
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Add Outlook Account")
                            .font(SpentyFonts.subheadline)
                            .foregroundColor(.spentyTextPrimary)
                        Text("Connect your Outlook email for sync")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    Spacer()

                    if viewModel.isConnecting {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.spentyPrimary)
                    }
                }
                .padding(14)
                .background(Color.spentyCardBg)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(Color.spentyBorder.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [6]))
                )
            }
            .buttonStyle(.plain)
            .disabled(viewModel.isConnecting)
        }
    }

    // MARK: - Account Row (Improvements #3, #4)

    private func accountRow(_ account: EmailAccount, provider: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(account.email ?? "Unknown")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)

                    if let connectedAt = account.connectedAt {
                        Text("Connected \(connectedAt, format: .relative(presentation: .named))")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    if let syncFromDate = account.syncFromDate {
                        Text("Syncing from \(syncFromDate, format: .dateTime.month(.abbreviated).day().year())")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    // Improvement #3: Last synced timestamp
                    if let lastRefresh = viewModel.lastRefreshedAt, account.syncFromDate != nil {
                        Text("Last checked \(lastRefresh, format: .relative(presentation: .named))")
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary.opacity(0.7))
                    }
                }

                Spacer()

                // Improvement #4: Accurate status badge
                accountStatusBadge(account)
            }

            // Reconnect warning
            if account.needsReconnect == true {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyWarning)
                    Text("This account needs to be reconnected")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyWarning)
                }
                .padding(8)
                .background(Color.spentyWarning.opacity(0.08))
                .cornerRadius(8)
            }

            // Account sync stats
            if let stats = account.stats {
                accountStatsGrid(stats)
            }

            // Action buttons
            HStack(spacing: 10) {
                if account.needsReconnect == true {
                    Button {
                        Task {
                            if provider == "gmail" {
                                await viewModel.connectGmail()
                            } else {
                                await viewModel.connectOutlook()
                            }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.system(size: 12))
                            Text("Reconnect")
                                .font(SpentyFonts.caption1)
                        }
                        .foregroundColor(.spentyWarning)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.spentyWarning.opacity(0.1))
                        .cornerRadius(8)
                    }
                }

                Button {
                    Task { await viewModel.startSync(forAccount: account) }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12))
                        Text("Sync")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.spentyPrimary.opacity(0.1))
                    .cornerRadius(8)
                }
                .disabled(account.syncing == true || viewModel.isSyncing)

                Spacer()

                Button {
                    viewModel.disconnectProvider = provider
                    viewModel.disconnectEmail = account.email
                    viewModel.showDisconnectConfirm = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "trash")
                            .font(.system(size: 12))
                        Text("Disconnect")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyError)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.spentyError.opacity(0.1))
                    .cornerRadius(8)
                }
            }

            Divider()
                .background(Color.spentyBorder)
        }
        .confirmDialog(
            title: "Disconnect Account",
            message: "Are you sure you want to disconnect this email account? Synced transactions will not be removed.",
            confirmLabel: "Disconnect",
            isPresented: $viewModel.showDisconnectConfirm
        ) {
            Task {
                if viewModel.disconnectProvider == "gmail" {
                    await viewModel.disconnectGmail()
                } else {
                    await viewModel.disconnectOutlook()
                }
            }
        }
    }

    // Improvement #4: Accurate status badge based on real backend state
    @ViewBuilder
    private func accountStatusBadge(_ account: EmailAccount) -> some View {
        if account.syncing == true || viewModel.isAnySyncing {
            HStack(spacing: 4) {
                ProgressView()
                    .controlSize(.mini)
                    .tint(Color.spentyPrimary)
                Text("Syncing...")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyPrimary)
            }
        } else if account.needsReconnect == true {
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.spentyWarning)
                Text("Needs Reconnect")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyWarning)
            }
        } else if account.stats?.aiFailed ?? 0 > 0 && (account.stats?.processedByAi ?? 0) == 0 {
            // All AI processing failed — likely a backend issue
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.spentyError)
                Text("Processing failed")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyError)
            }
        } else if account.stats?.aiPending ?? 0 > 0 {
            // AI is still processing emails
            HStack(spacing: 4) {
                ProgressView()
                    .controlSize(.mini)
                    .tint(Color.spentyAccent)
                Text("Processing \(account.stats?.aiPending ?? 0) emails...")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyAccent)
            }
        } else if account.syncFromDate != nil && (account.stats?.totalSynced ?? 0) > 0 {
            HStack(spacing: 4) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.spentySuccess)
                Text("Up to date")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentySuccess)
            }
        } else if account.syncFromDate != nil {
            // Has sync date but 0 emails — tap Sync to start
            HStack(spacing: 4) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 12))
                    .foregroundColor(.spentyPrimary)
                Text("Tap Sync to start")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyPrimary)
            }
        } else {
            HStack(spacing: 4) {
                Image(systemName: "clock")
                    .font(.system(size: 12))
                    .foregroundColor(.spentyTextSecondary)
                Text("Never synced")
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyTextSecondary)
            }
        }
    }

    private func accountStatsGrid(_ stats: SyncStats) -> some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 8),
            GridItem(.flexible(), spacing: 8),
            GridItem(.flexible(), spacing: 8)
        ], spacing: 8) {
            miniStat(label: "Emails", value: "\(stats.totalSynced ?? 0)", color: .spentyPrimary)
            miniStat(label: "Transactions", value: "\(stats.transactionsCreated ?? 0)", color: .spentySuccess)
            miniStat(label: "Review", value: "\(stats.pendingReview ?? 0)", color: .spentyWarning)
        }
    }

    private func miniStat(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(SpentyFonts.headline)
                .foregroundColor(color)
            Text(label)
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(color.opacity(0.06))
        .cornerRadius(8)
    }

    // MARK: - Retry Section (Improvement #5 — removed redundant "Start Email Sync" button)

    @ViewBuilder
    private var retrySection: some View {
        if let stats = viewModel.syncStatsResponse,
           (stats.aiFailed ?? 0) > 0 || (stats.aiPending ?? 0) > 0 {
            VStack(spacing: 12) {
                Button {
                    Task { await viewModel.retryPending() }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isRetrying {
                            ProgressView()
                                .controlSize(.small)
                                .tint(.white)
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                        Text(viewModel.isRetrying ? "Retrying..." : "Retry Failed Emails")
                    }
                    .primaryButtonStyle()
                }
                .disabled(viewModel.isRetrying)
                .opacity(viewModel.isRetrying ? 0.6 : 1.0)
            }
            .cardStyle()
        }
    }

    // MARK: - Pending Review Card

    @ViewBuilder
    private var pendingReviewCard: some View {
        if viewModel.pendingReviewCount > 0 {
            NavigationLink {
                PendingReviewView(viewModel: viewModel)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "eye.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.spentyWarning)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Pending Review")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)

                        Text("AI-detected transactions awaiting your approval")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    Spacer()

                    Text("\(viewModel.pendingReviewCount)")
                        .font(SpentyFonts.amountSmall)
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.spentyWarning)
                        .clipShape(Capsule())

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.spentyTextSecondary)
                }
                .cardStyle()
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Sync Date Picker Sheet (Improvement #8 — presets first, calendar on demand)

private struct SyncDatePickerSheet: View {
    @Bindable var viewModel: EmailSyncViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Account info
                    if let email = viewModel.pendingSyncAccount?.email {
                        HStack(spacing: 10) {
                            Image(systemName: "envelope.fill")
                                .font(.system(size: 16))
                                .foregroundColor(viewModel.pendingSyncProvider == "outlook" ? .spentyInfo : .spentyError)
                                .frame(width: 32, height: 32)
                                .background((viewModel.pendingSyncProvider == "outlook" ? Color.spentyInfo : Color.spentyError).opacity(0.1))
                                .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 2) {
                                Text(email)
                                    .font(SpentyFonts.subheadline)
                                    .foregroundColor(.spentyTextPrimary)
                                Text(viewModel.pendingSyncProvider.capitalized)
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyTextSecondary)
                            }
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.spentyBgSecondary)
                        .cornerRadius(10)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("How far back should we scan?")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)

                        Text("Pick a time range and SpentyAI will scan your emails from that date onward to detect transactions.")
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    // Quick-select preset buttons (primary UI)
                    VStack(spacing: 10) {
                        presetRow("Last 7 days", days: 7, description: "Quick scan of recent emails")
                        presetRow("Last 30 days", days: 30, description: "Recommended for most users")
                        presetRow("Last 90 days", days: 90, description: "Three months of transactions")
                        presetRow("Last 6 months", days: 180, description: "Comprehensive history")
                    }

                    // Custom date toggle
                    Button {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            viewModel.showCustomDatePicker.toggle()
                        }
                    } label: {
                        HStack {
                            Image(systemName: "calendar")
                                .font(.system(size: 14))
                            Text("Pick a custom date")
                                .font(SpentyFonts.subheadline)
                            Spacer()
                            Image(systemName: viewModel.showCustomDatePicker ? "chevron.up" : "chevron.down")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundColor(.spentyPrimary)
                        .padding(12)
                        .background(Color.spentyPrimary.opacity(0.06))
                        .cornerRadius(10)
                    }

                    if viewModel.showCustomDatePicker {
                        DatePicker(
                            "Sync start date",
                            selection: $viewModel.pendingSyncDate,
                            in: ...Date(),
                            displayedComponents: .date
                        )
                        .datePickerStyle(.graphical)
                        .tint(Color.spentyPrimary)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    // Selected date summary
                    HStack(spacing: 8) {
                        Image(systemName: "calendar.badge.clock")
                            .foregroundColor(.spentyPrimary)
                        Text("Scanning from: **\(viewModel.pendingSyncDate, format: .dateTime.month(.wide).day().year())**")
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextPrimary)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.spentyPrimary.opacity(0.06))
                    .cornerRadius(10)

                    Button {
                        viewModel.showSyncConfirmation = true
                    } label: {
                        HStack(spacing: 8) {
                            if viewModel.isSyncing {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(.white)
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                            }
                            Text(viewModel.isSyncing ? "Starting Sync..." : "Start Sync")
                        }
                        .primaryButtonStyle()
                    }
                    .disabled(viewModel.isSyncing)
                    .opacity(viewModel.isSyncing ? 0.6 : 1.0)
                }
                .padding(16)
            }
            .background(Color.spentyBgPrimary)
            .navigationTitle("Sync Start Date")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        viewModel.cancelSyncDatePicker()
                        dismiss()
                    }
                    .foregroundColor(.spentyTextSecondary)
                }
            }
            .alert("Start Email Sync?", isPresented: $viewModel.showSyncConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Start Sync") {
                    Task { await viewModel.confirmSyncDate() }
                    dismiss()
                }
            } message: {
                Text("SpentyAI will scan all your emails from \(viewModel.pendingSyncDate, format: .dateTime.month(.abbreviated).day().year()) onward and automatically detect transactions. New emails will continue syncing until you disconnect this account.")
            }
        }
    }

    private func presetRow(_ label: String, days: Int, description: String) -> some View {
        let target = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        let isSelected = Calendar.current.isDate(viewModel.pendingSyncDate, inSameDayAs: target)

        return Button {
            viewModel.pendingSyncDate = target
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(SpentyFonts.subheadline)
                        .fontWeight(isSelected ? .semibold : .regular)
                        .foregroundColor(isSelected ? .white : .spentyTextPrimary)

                    Text(description)
                        .font(SpentyFonts.caption2)
                        .foregroundColor(isSelected ? .white.opacity(0.8) : .spentyTextSecondary)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.white)
                }
            }
            .padding(14)
            .background(isSelected ? Color.spentyPrimary : Color.spentyCardBg)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.clear : Color.spentyBorder, lineWidth: 1)
            )
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        EmailSyncView()
    }
}
