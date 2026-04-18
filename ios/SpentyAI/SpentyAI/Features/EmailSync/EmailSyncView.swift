import SwiftUI

struct EmailSyncView: View {

    @State private var viewModel = EmailSyncViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                errorSection
                successSection
                overviewStatsSection
                gmailSection
                outlookSection
                syncActionsSection
                smsStatsCard
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
    }

    // MARK: - Error / Success

    @ViewBuilder
    private var errorSection: some View {
        if viewModel.showError {
            ErrorBanner(message: viewModel.errorMessage) {
                viewModel.showError = false
            }
        }
    }

    @ViewBuilder
    private var successSection: some View {
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
        }
    }

    // MARK: - Overall Stats

    @ViewBuilder
    private var overviewStatsSection: some View {
        if let stats = viewModel.syncStatsResponse {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Sync Overview")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)

                    Spacer()

                    if viewModel.isAnySyncing {
                        HStack(spacing: 6) {
                            ProgressView()
                                .controlSize(.small)
                                .tint(Color.spentyPrimary)
                            Text("Syncing...")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyPrimary)
                        }
                    }
                }

                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12)
                ], spacing: 12) {
                    StatCard(
                        label: "Total Emails",
                        value: "\(stats.totalEmails ?? 0)",
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

                if let lastSync = stats.lastSyncAt {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.system(size: 11))
                        Text("Last synced: \(lastSync, format: .relative(presentation: .named))")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyTextSecondary)
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
                            .tint(Color.spentyPrimary)
                    } else {
                        Image(systemName: "plus.circle.fill")
                    }
                    Text("Connect Gmail")
                }
                .secondaryButtonStyle()
            }
            .disabled(viewModel.isConnecting)
            .opacity(viewModel.isConnecting ? 0.6 : 1.0)
        }
        .cardStyle()
    }

    // MARK: - Outlook Section

    private var outlookSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "envelope.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.spentyInfo)

                Text("Outlook")
                    .font(SpentyFonts.title3)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                if !viewModel.outlookAccounts.isEmpty {
                    Text("\(viewModel.outlookAccounts.count) connected")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentySuccess)
                }
            }

            if viewModel.outlookAccounts.isEmpty {
                Text("No Outlook accounts connected")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextSecondary)
            } else {
                ForEach(viewModel.outlookAccounts) { account in
                    accountRow(account, provider: "outlook")
                }
            }

            Button {
                Task { await viewModel.connectOutlook() }
            } label: {
                HStack(spacing: 8) {
                    if viewModel.isConnecting {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Color.spentyPrimary)
                    } else {
                        Image(systemName: "plus.circle.fill")
                    }
                    Text("Connect Outlook")
                }
                .secondaryButtonStyle()
            }
            .disabled(viewModel.isConnecting)
            .opacity(viewModel.isConnecting ? 0.6 : 1.0)
        }
        .cardStyle()
    }

    // MARK: - Account Row

    private func accountRow(_ account: EmailAccount, provider: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(account.email ?? "Unknown")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)

                    if let connectedAt = account.connectedAt {
                        Text("Connected \(connectedAt, format: .relative(presentation: .named))")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }

                Spacer()

                if account.syncing == true {
                    HStack(spacing: 4) {
                        ProgressView()
                            .controlSize(.mini)
                            .tint(Color.spentyPrimary)
                        Text("Syncing")
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyPrimary)
                    }
                } else if account.needsReconnect == true {
                    StatusBadge(status: "failed")
                } else {
                    StatusBadge(status: "connected")
                }
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
                    Task { await viewModel.startSync() }
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

    private func accountStatsGrid(_ stats: SyncStats) -> some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 8),
            GridItem(.flexible(), spacing: 8),
            GridItem(.flexible(), spacing: 8)
        ], spacing: 8) {
            miniStat(label: "Emails", value: "\(stats.totalEmails ?? 0)", color: .spentyPrimary)
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

    // MARK: - Sync Actions

    @ViewBuilder
    private var syncActionsSection: some View {
        if viewModel.hasAnyAccount {
            VStack(spacing: 12) {
                Button {
                    Task { await viewModel.startSync() }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isSyncing {
                            ProgressView()
                                .controlSize(.small)
                                .tint(.white)
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath")
                        }
                        Text(viewModel.isSyncing ? "Syncing..." : "Start Email Sync")
                    }
                    .primaryButtonStyle()
                }
                .disabled(viewModel.isSyncing)
                .opacity(viewModel.isSyncing ? 0.6 : 1.0)

                if let stats = viewModel.syncStatsResponse,
                   (stats.aiFailed ?? 0) > 0 || (stats.aiPending ?? 0) > 0 {
                    Button {
                        Task { await viewModel.retryPending() }
                    } label: {
                        HStack(spacing: 8) {
                            if viewModel.isRetrying {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(Color.spentyPrimary)
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                            Text(viewModel.isRetrying ? "Retrying..." : "Retry Failed Emails")
                        }
                        .secondaryButtonStyle()
                    }
                    .disabled(viewModel.isRetrying)
                    .opacity(viewModel.isRetrying ? 0.6 : 1.0)
                }
            }
            .cardStyle()
        }
    }

    // MARK: - SMS Stats Card

    @ViewBuilder
    private var smsStatsCard: some View {
        if let stats = viewModel.smsStats {
            NavigationLink {
                SMSSyncView()
            } label: {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Image(systemName: "message.fill")
                            .font(.system(size: 18))
                            .foregroundColor(.spentyPrimary)

                        Text("SMS Sync")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.spentyTextSecondary)
                    }

                    HStack(spacing: 16) {
                        Label("\(stats.totalUploaded) messages", systemImage: "envelope.fill")
                        Label("\(stats.transactionsFound) transactions", systemImage: "banknote.fill")
                    }
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                }
                .cardStyle()
            }
            .buttonStyle(.plain)
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

// MARK: - Preview

#Preview {
    NavigationStack {
        EmailSyncView()
    }
}
