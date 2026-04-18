import SwiftUI
import UniformTypeIdentifiers

struct DematUploadView: View {

    @Bindable var viewModel: AccountsViewModel
    let accountId: String

    @State private var showFilePicker = false
    @State private var showActionConfirm = false
    @State private var pendingAction: (id: String, approve: Bool)?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            headerSection
            uploadSection
            statementsListSection
        }
        .task {
            await viewModel.loadDematStatements(accountId)
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.pdf, .commaSeparatedText, UTType("public.comma-separated-values-text") ?? .plainText],
            allowsMultipleSelection: false
        ) { result in
            handleFileSelection(result)
        }
        .alert("Confirm Action", isPresented: $showActionConfirm, presenting: pendingAction) { action in
            Button(action.approve ? "Approve" : "Reject", role: action.approve ? nil : .destructive) {
                Task {
                    if action.approve {
                        await viewModel.approveDematStatement(action.id, accountId: accountId)
                    } else {
                        await viewModel.rejectDematStatement(action.id, accountId: accountId)
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: { action in
            Text("Are you sure you want to \(action.approve ? "approve" : "reject") this statement?")
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack(spacing: 8) {
            Image(systemName: "doc.text.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.spentyWarning)
            Text("Demat Statements")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)
        }
    }

    // MARK: - Upload

    private var uploadSection: some View {
        Button {
            showFilePicker = true
        } label: {
            VStack(spacing: 10) {
                if viewModel.isUploadingDemat {
                    ProgressView()
                        .tint(Color.spentyPrimary)
                    Text("Uploading...")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextSecondary)
                } else {
                    Image(systemName: "arrow.up.doc.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.spentyPrimary)
                    Text("Upload CDSL / Demat Statement")
                        .font(SpentyFonts.callout)
                        .fontWeight(.medium)
                        .foregroundColor(.spentyPrimary)
                    Text("PDF or CSV files supported")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(
                        Color.spentyPrimary.opacity(0.3),
                        style: StrokeStyle(lineWidth: 1.5, dash: [8, 4])
                    )
            )
            .background(Color.spentyPrimary.opacity(0.04))
            .cornerRadius(12)
        }
        .disabled(viewModel.isUploadingDemat)
    }

    // MARK: - Statements List

    private var statementsListSection: some View {
        Group {
            if viewModel.isDematLoading && viewModel.dematStatements.isEmpty {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Color.spentyPrimary)
                    Spacer()
                }
                .padding(.vertical, 24)
            } else if viewModel.dematStatements.isEmpty {
                VStack(spacing: 6) {
                    Text("No statements uploaded")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextSecondary)
                    Text("Upload a CDSL statement to view your demat holdings.")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary.opacity(0.7))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else {
                VStack(spacing: 0) {
                    ForEach(viewModel.dematStatements) { statement in
                        statementRow(statement)
                        if statement.id != viewModel.dematStatements.last?.id {
                            Divider().padding(.leading, 48)
                        }
                    }
                }
                .background(Color.spentyCardBg)
                .cornerRadius(12)
            }
        }
    }

    // MARK: - Statement Row

    private func statementRow(_ statement: DematStatement) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "doc.fill")
                .font(.system(size: 20))
                .foregroundColor(.spentyInfo)

            VStack(alignment: .leading, spacing: 3) {
                Text(statement.filename ?? "Statement")
                    .font(SpentyFonts.callout)
                    .fontWeight(.medium)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    if let date = statement.uploadedAt {
                        Text(formatDate(date))
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    if let count = statement.transactionsCount {
                        Text("\(count) entries")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
            }

            Spacer()

            if let status = statement.status {
                StatusBadge(status: status)
            }

            // Actions for pending statements
            if statement.status?.lowercased() == "pending" {
                HStack(spacing: 4) {
                    Button {
                        pendingAction = (id: statement.id, approve: true)
                        showActionConfirm = true
                    } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 22))
                            .foregroundColor(.spentySuccess)
                    }

                    Button {
                        pendingAction = (id: statement.id, approve: false)
                        showActionConfirm = true
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 22))
                            .foregroundColor(.spentyError)
                    }
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    // MARK: - Helpers

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else { return }
            defer { url.stopAccessingSecurityScopedResource() }
            do {
                let data = try Data(contentsOf: url)
                let filename = url.lastPathComponent
                Task {
                    _ = await viewModel.uploadDematStatement(data: data, filename: filename, accountId: accountId)
                }
            } catch {
                viewModel.errorMessage = "Failed to read file: \(error.localizedDescription)"
            }
        case .failure(let error):
            viewModel.errorMessage = "File selection failed: \(error.localizedDescription)"
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

#Preview {
    DematUploadView(viewModel: AccountsViewModel(), accountId: "test-id")
        .padding()
}
