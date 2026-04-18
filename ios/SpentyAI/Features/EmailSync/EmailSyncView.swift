import SwiftUI

struct EmailSyncView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = EmailSyncViewModel()
    @State private var editingTransaction: PendingTransaction?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: SpentySpacing.xl) {
                    gmailSection
                    outlookSection
                    pendingReviewSection
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
            .background(SpentyColors.bgPrimary)
            .navigationTitle("Email Sync")
            .refreshable {
                await viewModel.refresh()
            }
            .overlay {
                if viewModel.isLoading {
                    LoadingOverlay(isPresented: .constant(true))
                }
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.error != nil },
                set: { if !$0 { viewModel.error = nil } }
            )) {
                Button("OK") { viewModel.error = nil }
            } message: {
                Text(viewModel.error ?? "")
            }
            .confirmationDialog(
                "Disconnect \(viewModel.showDisconnectConfirm ?? "")?",
                isPresented: .init(
                    get: { viewModel.showDisconnectConfirm != nil },
                    set: { if !$0 { viewModel.showDisconnectConfirm = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Disconnect", role: .destructive) {
                    let provider = viewModel.showDisconnectConfirm
                    Task {
                        if provider == "Gmail" {
                            await viewModel.disconnectGmail()
                        } else {
                            await viewModel.disconnectOutlook()
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will remove the email connection and stop syncing transactions.")
            }
            .sheet(item: $editingTransaction) { transaction in
                PendingReviewSheet(transaction: transaction) { action in
                    Task {
                        switch action {
                        case .approved:
                            await viewModel.approveTransaction(transaction.id)
                        case .rejected:
                            await viewModel.rejectTransaction(transaction.id)
                        }
                    }
                    editingTransaction = nil
                }
            }
            .task {
                await viewModel.loadAll()
            }
        }
    }

    // MARK: - Gmail Section

    private var gmailSection: some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                HStack(spacing: SpentySpacing.sm) {
                    Image(systemName: "envelope.fill")
                        .foregroundStyle(.red)
                        .font(.title3)
                    Text("Gmail")
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)
                    Spacer()
                    if viewModel.gmailStatus?.connected == true {
                        StatusBadge(.active)
                    }
                }

                if let status = viewModel.gmailStatus, status.connected {
                    connectedProviderContent(status: status, provider: "Gmail")
                } else {
                    PrimaryButton("Connect Gmail") {
                        Task { await viewModel.connectGmail() }
                    }
                }
            }
        }
    }

    // MARK: - Outlook Section

    private var outlookSection: some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                HStack(spacing: SpentySpacing.sm) {
                    Image(systemName: "envelope.fill")
                        .foregroundStyle(.blue)
                        .font(.title3)
                    Text("Outlook")
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)
                    Spacer()
                    if viewModel.outlookStatus?.connected == true {
                        StatusBadge(.active)
                    }
                }

                if let status = viewModel.outlookStatus, status.connected {
                    connectedProviderContent(status: status, provider: "Outlook")
                } else {
                    PrimaryButton("Connect Outlook") {
                        Task { await viewModel.connectOutlook() }
                    }
                }
            }
        }
    }

    // MARK: - Connected Provider Content

    @ViewBuilder
    private func connectedProviderContent(status: EmailSyncStatus, provider: String) -> some View {
        if let lastSync = status.lastSyncDate {
            HStack {
                Text("Last synced:")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
                Text(lastSync)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
            }
        }

        if viewModel.isSyncing {
            syncStatsGrid(status: status)
                .modifier(ShimmerEffect())
        } else {
            syncStatsGrid(status: status)
        }

        HStack(spacing: SpentySpacing.sm) {
            PrimaryButton("Sync Now") {
                Task {
                    if provider == "Gmail" {
                        await viewModel.syncGmail()
                    } else {
                        await viewModel.syncOutlook()
                    }
                }
            }
            .disabled(viewModel.isSyncing)

            SecondaryButton("Disconnect") {
                viewModel.showDisconnectConfirm = provider
            }
            .tint(SpentyColors.danger)
        }
    }

    // MARK: - Sync Stats Grid

    private func syncStatsGrid(status: EmailSyncStatus) -> some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: SpentySpacing.sm) {
            StatCard(
                title: "Total",
                value: "\(status.totalRecords ?? 0)",
                icon: "doc.text"
            )
            StatCard(
                title: "Found",
                value: "\(status.foundTransactions ?? 0)",
                icon: "checkmark.circle",
                iconColor: SpentyColors.success
            )
            StatCard(
                title: "Skipped",
                value: "\(status.skippedCount ?? 0)",
                icon: "forward.fill",
                iconColor: SpentyColors.textMuted
            )
            StatCard(
                title: "Pending",
                value: "\(status.pendingCount ?? 0)",
                icon: "clock",
                iconColor: SpentyColors.warning
            )
            StatCard(
                title: "Failed",
                value: "\(status.failedCount ?? 0)",
                icon: "xmark.circle",
                iconColor: SpentyColors.danger
            )
        }
    }

    // MARK: - Pending Review Section

    @ViewBuilder
    private var pendingReviewSection: some View {
        if !viewModel.pendingTransactions.isEmpty {
            VStack(alignment: .leading, spacing: SpentySpacing.md) {
                HStack {
                    SectionHeader("Pending Review")
                    Spacer()
                    Text("\(viewModel.pendingTransactions.count)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(.white)
                        .padding(.horizontal, SpentySpacing.sm)
                        .padding(.vertical, SpentySpacing.xs)
                        .background(SpentyColors.warning)
                        .clipShape(Capsule())
                }

                ForEach(viewModel.pendingTransactions) { transaction in
                    pendingTransactionCard(transaction)
                }
            }
        } else if !viewModel.isLoading && viewModel.gmailStatus != nil {
            EmptyState(
                icon: "envelope.open",
                title: "No Pending Transactions",
                message: "All synced email transactions have been reviewed."
            )
        }
    }

    // MARK: - Pending Transaction Card

    private func pendingTransactionCard(_ transaction: PendingTransaction) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        if let date = transaction.date {
                            Text(date)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                        Text(transaction.description ?? "Unknown Transaction")
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textPrimary)
                            .lineLimit(2)
                    }
                    Spacer()
                    if let amount = transaction.amount {
                        MoneyText(
                            amount: amount,
                            type: transaction.type == "income" ? .income : .expense
                        )
                    }
                }

                if let category = transaction.suggestedCategory {
                    FilterChip(category, isSelected: true, action: {})
                }

                HStack(spacing: SpentySpacing.md) {
                    Button {
                        Task { await viewModel.approveTransaction(transaction.id) }
                    } label: {
                        Label("Approve", systemImage: "checkmark.circle.fill")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.success)
                    }

                    Button {
                        Task { await viewModel.rejectTransaction(transaction.id) }
                    } label: {
                        Label("Reject", systemImage: "xmark.circle.fill")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.danger)
                    }

                    Spacer()

                    Button {
                        editingTransaction = transaction
                    } label: {
                        Label("Edit", systemImage: "pencil.circle.fill")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.brandAccent)
                    }
                }
            }
        }
    }
}

#Preview {
    EmailSyncView()
        .environment(AppState())
}
