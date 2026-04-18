import SwiftUI
import UniformTypeIdentifiers

struct DematView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DematViewModel()

    // Upload form state
    @State private var periodFrom = Date()
    @State private var periodTo = Date()
    @State private var showFilePicker = false
    @State private var selectedFileData: Data?
    @State private var selectedFileName: String?
    @State private var selectedFileMime: String?

    private let statsColumns = [
        GridItem(.flexible(), spacing: SpentySpacing.md),
        GridItem(.flexible(), spacing: SpentySpacing.md)
    ]

    private var investmentAccounts: [Account] {
        (appState.accounts ?? []).filter { account in
            let type = account.accountType.lowercased()
            let subType = (account.subType ?? "").lowercased()
            return type == "investment" || type == "demat" || subType == "demat" || subType == "trading"
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        summarySection
                        statementsSection
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.vertical, SpentySpacing.md)
                    .padding(.bottom, 80)
                }
                .refreshable {
                    await viewModel.refresh()
                }
                .shimmer(isActive: viewModel.isLoading && viewModel.statements.isEmpty)

                // FAB to upload
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button {
                            viewModel.showUploadSheet = true
                        } label: {
                            Image(systemName: "arrow.up.doc")
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(.white)
                                .frame(width: 56, height: 56)
                                .background(SpentyColors.brandPrimary)
                                .clipShape(Circle())
                                .shadow(color: SpentyColors.brandPrimary.opacity(0.3), radius: 8, y: 4)
                        }
                        .padding(.trailing, SpentySpacing.lg)
                        .padding(.bottom, SpentySpacing.lg)
                    }
                }
            }
            .background(SpentyColors.bgPrimary)
            .navigationTitle("Demat / Trading")
            .task {
                if viewModel.statements.isEmpty {
                    await viewModel.loadAll()
                }
            }
            .overlay {
                LoadingOverlay(isPresented: .constant(viewModel.isUploading))
            }
            .sheet(isPresented: $viewModel.showUploadSheet) {
                uploadSheet
            }
            .alert("Delete Statement", isPresented: .init(
                get: { viewModel.showDeleteConfirm != nil },
                set: { if !$0 { viewModel.showDeleteConfirm = nil } }
            )) {
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = nil
                }
                Button("Delete", role: .destructive) {
                    if let stmt = viewModel.showDeleteConfirm {
                        Task { await viewModel.deleteStatement(stmt.statementId) }
                    }
                }
            } message: {
                Text("Are you sure you want to delete this statement? This action cannot be undone.")
            }
        }
    }

    // MARK: - Summary Section

    @ViewBuilder
    private var summarySection: some View {
        if let summary = viewModel.overallSummary {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                SectionHeader(title: "Portfolio Summary", actionTitle: nil, action: nil)

                LazyVGrid(columns: statsColumns, spacing: SpentySpacing.md) {
                    StatCard(
                        title: "Total Buy",
                        value: formatCurrency(summary.totalBuyValue),
                        subtitle: "Invested",
                        icon: "arrow.down.circle",
                        iconColor: SpentyColors.info
                    )

                    StatCard(
                        title: "Total Sell",
                        value: formatCurrency(summary.totalSellValue),
                        subtitle: "Realized",
                        icon: "arrow.up.circle",
                        iconColor: SpentyColors.success
                    )

                    StatCard(
                        title: "Total Charges",
                        value: formatCurrency(summary.totalCharges),
                        subtitle: "Brokerage & fees",
                        icon: "indianrupeesign.circle",
                        iconColor: SpentyColors.danger
                    )

                    StatCard(
                        title: "Net P&L",
                        value: formatCurrency(summary.netPnl),
                        subtitle: (summary.netPnl ?? 0) >= 0 ? "Profit" : "Loss",
                        icon: (summary.netPnl ?? 0) >= 0
                            ? "chart.line.uptrend.xyaxis"
                            : "chart.line.downtrend.xyaxis",
                        iconColor: (summary.netPnl ?? 0) >= 0
                            ? SpentyColors.success
                            : SpentyColors.danger
                    )
                }
            }
        }
    }

    // MARK: - Statements Section

    @ViewBuilder
    private var statementsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader(
                title: "Statements",
                actionTitle: "Upload",
                action: { viewModel.showUploadSheet = true }
            )

            if viewModel.statements.isEmpty && !viewModel.isLoading {
                EmptyState(
                    icon: "chart.bar.doc.horizontal",
                    title: "No Statements",
                    message: "Upload your demat or trading statements to analyze your portfolio."
                )
            } else {
                ForEach(viewModel.statements) { statement in
                    SpentyCard {
                        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                            HStack {
                                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                    Text(statement.accountId ?? "Unknown Account")
                                        .font(SpentyFonts.body)
                                        .foregroundStyle(SpentyColors.textPrimary)

                                    if let from = statement.periodFrom, let to = statement.periodTo {
                                        Text("\(from) - \(to)")
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textMuted)
                                    }
                                }
                                Spacer()

                                if let status = statement.status {
                                    StatusBadge(
                                        text: status.capitalized,
                                        color: statusColor(status)
                                    )
                                }
                            }

                            if let summary = statement.parsedSummary {
                                Divider()

                                HStack(spacing: SpentySpacing.lg) {
                                    if let buy = summary.totalBuyValue {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Buy")
                                                .font(SpentyFonts.caption)
                                                .foregroundStyle(SpentyColors.textMuted)
                                            Text(formatCurrency(buy))
                                                .font(SpentyFonts.mono)
                                                .foregroundStyle(SpentyColors.info)
                                        }
                                    }

                                    if let sell = summary.totalSellValue {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Sell")
                                                .font(SpentyFonts.caption)
                                                .foregroundStyle(SpentyColors.textMuted)
                                            Text(formatCurrency(sell))
                                                .font(SpentyFonts.mono)
                                                .foregroundStyle(SpentyColors.success)
                                        }
                                    }

                                    if let pnl = summary.netRealizedPnl {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("P&L")
                                                .font(SpentyFonts.caption)
                                                .foregroundStyle(SpentyColors.textMuted)
                                            Text(formatCurrency(pnl))
                                                .font(SpentyFonts.mono)
                                                .foregroundStyle(pnl >= 0 ? SpentyColors.success : SpentyColors.danger)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            viewModel.showDeleteConfirm = statement
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Upload Sheet

    private var uploadSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: SpentySpacing.xl) {
                    SheetHeader(title: "Upload Statement")

                    // Account Picker
                    VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                        Text("Account")
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(SpentyColors.textPrimary)

                        Picker("Account", selection: $viewModel.selectedAccountId) {
                            Text("Select Account").tag("")
                            ForEach(investmentAccounts) { account in
                                Text(account.name).tag(account.accountId)
                            }
                        }
                        .pickerStyle(.menu)
                        .padding(SpentySpacing.md)
                        .background(SpentyColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: SpentyRadius.md)
                                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                        )
                    }

                    // Period Pickers
                    VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                        Text("Period")
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(SpentyColors.textPrimary)

                        HStack(spacing: SpentySpacing.md) {
                            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                Text("From")
                                    .font(SpentyFonts.caption)
                                    .foregroundStyle(SpentyColors.textMuted)
                                DatePicker("", selection: $periodFrom, displayedComponents: .date)
                                    .labelsHidden()
                            }

                            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                Text("To")
                                    .font(SpentyFonts.caption)
                                    .foregroundStyle(SpentyColors.textMuted)
                                DatePicker("", selection: $periodTo, displayedComponents: .date)
                                    .labelsHidden()
                            }
                        }
                    }

                    // File Picker
                    VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                        Text("Statement File")
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(SpentyColors.textPrimary)

                        Button {
                            showFilePicker = true
                        } label: {
                            HStack {
                                Image(systemName: selectedFileName != nil ? "doc.fill" : "doc.badge.plus")
                                    .foregroundStyle(SpentyColors.brandPrimary)
                                Text(selectedFileName ?? "Choose PDF or CSV file")
                                    .font(SpentyFonts.body)
                                    .foregroundStyle(
                                        selectedFileName != nil
                                            ? SpentyColors.textPrimary
                                            : SpentyColors.textMuted
                                    )
                                Spacer()
                            }
                            .padding(SpentySpacing.lg)
                            .background(SpentyColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: SpentyRadius.md)
                                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                            )
                        }
                    }

                    // Upload Button
                    PrimaryButton(
                        title: "Upload",
                        isLoading: viewModel.isUploading,
                        isDisabled: viewModel.selectedAccountId.isEmpty || selectedFileData == nil
                    ) {
                        if let data = selectedFileData,
                           let name = selectedFileName,
                           let mime = selectedFileMime {
                            Task { await viewModel.uploadStatement(fileData: data, fileName: name, mimeType: mime) }
                        }
                    }

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.danger)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
            .background(SpentyColors.bgPrimary)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.showUploadSheet = false
                    }
                }
            }
            .fileImporter(
                isPresented: $showFilePicker,
                allowedContentTypes: [UTType.pdf, UTType.commaSeparatedText],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }
                    guard url.startAccessingSecurityScopedResource() else { return }
                    defer { url.stopAccessingSecurityScopedResource() }

                    if let data = try? Data(contentsOf: url) {
                        selectedFileData = data
                        selectedFileName = url.lastPathComponent

                        let ext = url.pathExtension.lowercased()
                        selectedFileMime = ext == "pdf" ? "application/pdf" : "text/csv"
                    }
                case .failure(let error):
                    viewModel.errorMessage = "Failed to select file: \(error.localizedDescription)"
                }
            }
        }
        .presentationDetents([.large])
    }

    // MARK: - Helpers

    private func formatCurrency(_ amount: Double?) -> String {
        guard let amount else { return "--" }
        return CurrencyFormatter.format(
            amount: amount,
            currencyCode: appState.user?.settings?.baseCurrency ?? "INR"
        )
    }

    private func formatCurrency(_ amount: Double) -> String {
        CurrencyFormatter.format(
            amount: amount,
            currencyCode: appState.user?.settings?.baseCurrency ?? "INR"
        )
    }

    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "parsed", "completed": return SpentyColors.success
        case "processing", "pending": return SpentyColors.warning
        case "failed", "error": return SpentyColors.danger
        default: return SpentyColors.textMuted
        }
    }
}
