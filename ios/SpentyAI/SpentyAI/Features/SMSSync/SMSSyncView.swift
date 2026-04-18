import SwiftUI

struct SMSSyncView: View {

    @State private var viewModel = SMSSyncViewModel()

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
            await viewModel.loadStats()
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
                Task { await viewModel.uploadAndParse() }
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
                    resultRow(icon: "arrow.up.circle.fill", label: "Uploaded", value: "\(upload.uploaded)", color: .spentyPrimary)
                    if upload.duplicates > 0 {
                        resultRow(icon: "doc.on.doc", label: "Duplicates skipped", value: "\(upload.duplicates)", color: .spentyWarning)
                    }
                }

                if let parse = viewModel.lastParseResult {
                    resultRow(icon: "banknote.fill", label: "Transactions found", value: "\(parse.transactionsFound)", color: .spentySuccess)
                    if parse.failed > 0 {
                        resultRow(icon: "exclamationmark.triangle.fill", label: "Failed to parse", value: "\(parse.failed)", color: .spentyError)
                    }
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
                    StatCard(label: "Total Uploaded", value: "\(stats.totalUploaded)", icon: "envelope.fill", color: .spentyPrimary)
                    StatCard(label: "Transactions", value: "\(stats.transactionsFound)", icon: "banknote.fill", color: .spentySuccess)
                    StatCard(label: "Pending Review", value: "\(stats.pendingReview)", icon: "clock.fill", color: .spentyWarning)
                    StatCard(label: "Failed", value: "\(stats.failed)", icon: "xmark.circle.fill", color: .spentyError)
                }

                if let lastSync = stats.lastSyncDate {
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

    // MARK: - Action Buttons

    @ViewBuilder
    private var actionsSection: some View {
        if viewModel.hasStats {
            VStack(spacing: 12) {
                if let stats = viewModel.syncStats, stats.pendingReview > 0 || stats.failed > 0 {
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
                            Text("Retried \(retry.retried): \(retry.succeeded) succeeded, \(retry.failed) failed")
                                .font(SpentyFonts.caption1)
                                .foregroundColor(.spentyTextSecondary)
                        }
                    }
                }

                Button {
                    Task { await viewModel.detectMandates() }
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
                        Text("\(mandate.mandatesFound) recurring mandate\(mandate.mandatesFound == 1 ? "" : "s") detected")
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
