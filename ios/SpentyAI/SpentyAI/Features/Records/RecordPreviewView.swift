import SwiftUI
import WebKit

struct RecordPreviewView: View {


    @Environment(LocalizationManager.self) var lang
    let recordId: String
    @Bindable var viewModel: RecordsViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var preview: RecordPreviewResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showDeleteConfirm = false

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .long
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            if isLoading {
                LoadingView(message: "Loading email...")
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundColor(.spentyError)
                    Text(error)
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextSecondary)
                        .multilineTextAlignment(.center)
                    Button(lang.s("retry")) {
                        Task { await loadPreview() }
                    }
                    .secondaryButtonStyle()
                    .frame(maxWidth: 200)
                }
                .padding(32)
            } else if let preview {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        headerSection(preview)
                        Divider()
                            .padding(.horizontal, 16)
                        bodySection(preview)
                        if let attachments = preview.attachments, !attachments.isEmpty {
                            Divider()
                                .padding(.horizontal, 16)
                            attachmentsSection(attachments)
                        }
                    }
                }
            }
        }
        .navigationTitle("Email")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { previewToolbar }
        .sheet(item: $viewModel.shareItem) { item in
            ShareSheet(items: [item.url])
        }
        .confirmationDialog(
            "Delete Record",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deleteRecord(id: recordId)
                    dismiss()
                }
            }
        } message: {
            Text(lang.s("delete_email_record"))
        }
        .task { await loadPreview() }
    }

    // MARK: - Header

    private func headerSection(_ preview: RecordPreviewResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(preview.subject ?? "No Subject")
                .font(SpentyFonts.title3)
                .foregroundColor(.spentyTextPrimary)

            HStack(spacing: 8) {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.spentyPrimary)

                senderInfoView(sender: preview.sender, date: preview.receivedDate)

                Spacer()

                if let source = preview.source {
                    StatusBadge(status: source)
                }
            }

            if let transactionId = preview.transactionId {
                HStack(spacing: 6) {
                    Image(systemName: "link.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.spentySuccess)
                    Text(lang.s("linked_to_txn"))
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentySuccess)
                    Text(transactionId.prefix(8) + "...")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }
                .padding(10)
                .background(Color.spentySuccess.opacity(0.08))
                .cornerRadius(8)
            }
        }
        .padding(16)
    }

    // MARK: - Body

    private func bodySection(_ preview: RecordPreviewResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let htmlBody = preview.bodyHtml, !htmlBody.isEmpty {
                HTMLView(html: htmlBody)
                    .frame(minHeight: 300)
            } else if let textBody = preview.body, !textBody.isEmpty {
                Text(textBody)
                    .font(SpentyFonts.body)
                    .foregroundColor(.spentyTextPrimary)
                    .textSelection(.enabled)
            } else {
                Text(lang.s("no_content"))
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextSecondary)
                    .italic()
            }
        }
        .padding(16)
    }

    // MARK: - Attachments

    private func attachmentsSection(_ attachments: [RecordAttachment]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "paperclip")
                    .font(.system(size: 14))
                    .foregroundColor(.spentyTextSecondary)
                Text("Attachments (\(attachments.count))")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)
            }

            ForEach(attachments) { attachment in
                attachmentRow(attachment)
            }
        }
        .padding(16)
    }

    private func attachmentRow(_ attachment: RecordAttachment) -> some View {
        Button {
            Task {
                await viewModel.downloadAttachment(
                    recordId: recordId,
                    index: attachment.index,
                    filename: attachment.filename
                )
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: attachmentIcon(for: attachment.mimeType))
                    .font(.system(size: 20))
                    .foregroundColor(.spentyPrimary)
                    .frame(width: 32, height: 32)

                VStack(alignment: .leading, spacing: 2) {
                    Text(attachment.filename ?? "Attachment \(attachment.index + 1)")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)

                    if let size = attachment.size {
                        Text(formatFileSize(size))
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }

                Spacer()

                Image(systemName: "arrow.down.circle")
                    .font(.system(size: 18))
                    .foregroundColor(.spentyPrimary)
            }
            .padding(12)
            .background(Color.spentyBgPrimary)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.spentyBorder, lineWidth: 1)
            )
        }
    }

    private func attachmentIcon(for mimeType: String?) -> String {
        guard let mime = mimeType?.lowercased() else { return "doc" }
        if mime.contains("pdf") { return "doc.fill" }
        if mime.contains("image") { return "photo" }
        if mime.contains("spreadsheet") || mime.contains("excel") || mime.contains("csv") { return "tablecells" }
        if mime.contains("word") || mime.contains("document") { return "doc.text" }
        return "doc"
    }

    private func formatFileSize(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var previewToolbar: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Button {
                    Task { await viewModel.downloadEml(id: recordId, subject: preview?.subject) }
                } label: {
                    Label("Download EML", systemImage: "arrow.down.doc")
                }

                Divider()

                Button(role: .destructive) {
                    showDeleteConfirm = true
                } label: {
                    Label(lang.s("delete"), systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundColor(.spentyPrimary)
                    .font(.system(size: 20))
            }
        }
    }

    // MARK: - Helpers

    /// Renders sender name + email as two separate Text rows.
    /// Computed outside ViewBuilder to avoid tuple-binding limitations.
    private func senderInfoView(sender: String?, date: Date?) -> some View {
        let (name, email) = parseSender(sender)
        return VStack(alignment: .leading, spacing: 2) {
            Text(name)
                .font(SpentyFonts.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.spentyTextPrimary)
            if let em = email {
                Text(em)
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                    .lineLimit(1)
            }
            if let d = date {
                Text(Self.dateFormatter.string(from: d))
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }
        }
    }

    /// Parses "Display Name <email@domain.com>" → ("Display Name", "email@domain.com")
    /// Falls back to showing the raw string as the name if not in that format.
    private func parseSender(_ raw: String?) -> (String, String?) {
        guard let raw = raw?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else {
            return ("Unknown Sender", nil)
        }
        // Split on "<" — handles RFC 2822 "Display Name <email>" format
        let parts = raw.components(separatedBy: "<")
        guard parts.count >= 2 else { return (raw, nil) }
        let name = parts[0].trimmingCharacters(in: .whitespaces)
        let emailPart = parts[1].components(separatedBy: ">").first ?? ""
        let email = emailPart.trimmingCharacters(in: .whitespaces)
        return (name.isEmpty ? email : name, email.isEmpty ? nil : email)
    }

    // MARK: - Load

    private func loadPreview() async {
        isLoading = true
        errorMessage = nil
        do {
            preview = try await RecordsRepository.shared.fetchRecordPreview(id: recordId)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - HTML View

struct HTMLView: UIViewRepresentable {
    let html: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.navigationDelegate = context.coordinator
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let styledHTML = """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 15px;
                color: #2D2D2D;
                background-color: transparent;
                margin: 0;
                padding: 0;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            img { max-width: 100%; height: auto; }
            a { color: #3A5C4A; }
            pre, code { overflow-x: auto; max-width: 100%; }
            table { max-width: 100%; overflow-x: auto; display: block; }
        </style>
        </head>
        <body>\(html)</body>
        </html>
        """
        webView.loadHTMLString(styledHTML, baseURL: nil)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url {
                await MainActor.run {
                    UIApplication.shared.open(url)
                }
                return .cancel
            }
            return .allow
        }
    }
}

#Preview {
    NavigationStack {
        RecordPreviewView(recordId: "test123", viewModel: RecordsViewModel())
    }
}
