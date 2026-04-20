import SwiftUI

struct TransactionDetailView: View {

    @Environment(\.dismiss) private var dismiss

    let transactionId: String
    var onTransactionUpdated: (() -> Void)?

    @State private var transaction: Transaction
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showEditSheet = false
    @State private var showDeleteConfirm = false
    @State private var showReceiptSheet = false
    @State private var isPerformingAction = false

    // Source document state
    @State private var sourceContent: SourceContent?
    @State private var isLoadingSource = false
    @State private var sourceError: String?
    @State private var isSourceExpanded = false

    // Archive / attachments state
    @State private var archiveRecord: RecordPreviewResponse?
    @State private var isLoadingArchive = false
    @State private var downloadingAttachmentIndex: Int?
    @State private var showShareSheet = false
    @State private var shareData: Data?
    @State private var shareFilename: String?

    private let repository = TransactionRepository.shared
    private let emailSyncRepo = EmailSyncRepository.shared
    private let recordsRepo = RecordsRepository.shared

    // MARK: - Init

    init(transaction: Transaction, onTransactionUpdated: (() -> Void)? = nil) {
        self.transactionId = transaction.id
        self._transaction = State(initialValue: transaction)
        self.onTransactionUpdated = onTransactionUpdated
    }

    // MARK: - Computed

    private var amountColor: Color {
        switch transaction.transactionType?.lowercased() {
        case "income":
            return .spentySuccess
        case "expense":
            return .spentyError
        case "transfer":
            return .spentyAccent3
        default:
            return .spentyTextPrimary
        }
    }

    private var amountPrefix: String {
        switch transaction.transactionType?.lowercased() {
        case "income":
            return "+"
        case "expense":
            return "-"
        default:
            return ""
        }
    }

    private var formattedAmount: String {
        guard let amount = transaction.amount else { return "--" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }

    private var formattedDate: String {
        guard let date = transaction.date else { return "--" }
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private var typeDisplayName: String {
        guard let type = transaction.transactionType else { return "--" }
        return type.capitalized
    }

    private var isTransfer: Bool {
        transaction.transactionType?.lowercased() == "transfer"
    }

    private var isPending: Bool {
        transaction.status?.lowercased() == "pending"
    }

    private var hasForeignCurrency: Bool {
        transaction.originalCurrency != nil && transaction.originalAmount != nil
    }

    private var hasSourceDocument: Bool {
        transaction.sourceId != nil
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                if isLoading && transaction.amount == nil {
                    LoadingView(message: "Loading transaction...")
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            amountSection
                            statusSection
                            detailCard
                            if hasSourceDocument {
                                sourceDocumentCard
                            }
                            supportingDocumentCard
                            actionButtons
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 20)
                    }
                }
            }
            .navigationTitle("Transaction Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyTextPrimary)
                    }
                }
            }
            .task {
                await loadTransaction()
                await loadSourceDocument()
                await loadArchiveRecord()
            }
            .sheet(isPresented: $showEditSheet) {
                TransactionFormView(
                    viewModel: TransactionsViewModel(),
                    transaction: transaction
                )
                .onDisappear {
                    Task { await loadTransaction() }
                    onTransactionUpdated?()
                }
            }
            .sheet(isPresented: $showReceiptSheet) {
                receiptPreviewSheet
            }
            .alert("Delete Transaction", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task { await deleteTransaction() }
                }
            } message: {
                Text("Are you sure you want to delete this transaction? This action cannot be undone.")
            }
        }
    }

    // MARK: - Amount Section

    private var amountSection: some View {
        VStack(spacing: 8) {
            Text("\(amountPrefix)\(formattedAmount)")
                .font(SpentyFonts.amountLarge)
                .foregroundColor(amountColor)

            Text(typeDisplayName)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    // MARK: - Status Section

    @ViewBuilder
    private var statusSection: some View {
        if let status = transaction.status, !status.isEmpty {
            HStack {
                Spacer()
                StatusBadge(status: status)
                Spacer()
            }
        }
    }

    // MARK: - Detail Card

    private var detailCard: some View {
        VStack(spacing: 0) {
            detailRow(label: "Type", value: typeDisplayName)
            divider
            detailRow(label: "Date", value: formattedDate)
            divider
            if let desc = transaction.description, !desc.isEmpty {
                detailRow(label: "Description", value: desc)
                divider
            }
            if let name = transaction.categoryName, !name.isEmpty {
                detailRow(label: "Category", value: name)
                divider
            }
            if let name = transaction.subcategoryName, !name.isEmpty {
                detailRow(label: "Subcategory", value: name)
                divider
            }
            if let name = transaction.accountName, !name.isEmpty {
                detailRow(label: "Account", value: name)
                divider
            }
            if isTransfer, let name = transaction.toAccountName, !name.isEmpty {
                detailRow(label: "To Account", value: name)
                divider
            }
            if let paymentMethod = transaction.paymentMethod, !paymentMethod.isEmpty {
                detailRow(label: "Payment Method", value: paymentMethod)
                divider
            }
            // Source hidden per user request
            recurringRow
            if hasForeignCurrency {
                foreignCurrencyRows
            }
        }
        .cardStyle()
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextSecondary)
            Spacer()
            Text(value)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextPrimary)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 10)
    }

    private var divider: some View {
        Divider()
            .background(Color.spentyBorder)
    }

    @ViewBuilder
    private var recurringRow: some View {
        let isRecurring = transaction.isRecurring ?? false
        detailRow(
            label: "Recurring",
            value: isRecurring
                ? "Yes\(transaction.recurringFrequency.map { " (\($0.capitalized))" } ?? "")"
                : "No"
        )
    }

    @ViewBuilder
    private var foreignCurrencyRows: some View {
        divider
        if let currency = transaction.originalCurrency {
            detailRow(label: "Original Currency", value: currency.uppercased())
        }
        if let originalAmount = transaction.originalAmount {
            divider
            let formatter = NumberFormatter()
            let _ = formatter.numberStyle = .decimal
            let _ = formatter.maximumFractionDigits = 2
            detailRow(
                label: "Original Amount",
                value: formatter.string(from: NSNumber(value: originalAmount)) ?? "\(originalAmount)"
            )
        }
        if let exchangeRate = transaction.exchangeRate {
            divider
            let rateLabel = transaction.isEstimatedRate == true ? "Exchange Rate (Est.)" : "Exchange Rate"
            detailRow(label: rateLabel, value: String(format: "%.4f", exchangeRate))
        }
    }

    // MARK: - Source Document Card

    private var sourceDocumentCard: some View {
        VStack(spacing: 12) {
            // Header with expand/collapse
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    isSourceExpanded.toggle()
                }
            } label: {
                HStack {
                    Image(systemName: "envelope.open")
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyPrimary)
                    Text("Source Document")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)
                    Spacer()
                    if isLoadingSource || isLoadingArchive {
                        ProgressView()
                            .tint(.spentyPrimary)
                    } else {
                        Image(systemName: isSourceExpanded ? "chevron.up" : "chevron.down")
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
            }

            // Source badge
            if let source = transaction.source, !source.isEmpty {
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: source.lowercased() == "email" ? "envelope.fill" : "message.fill")
                            .font(.system(size: 10))
                        Text("Via \(source.capitalized)")
                            .font(SpentyFonts.caption)
                    }
                    .foregroundColor(.spentyAccent3)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.spentyAccent3.opacity(0.12))
                    .cornerRadius(6)
                    Spacer()
                }
            }

            if isSourceExpanded {
                if let error = sourceError {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(SpentyFonts.footnote)
                        Text(error)
                            .font(SpentyFonts.footnote)
                    }
                    .foregroundColor(.spentyError)
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else if let content = sourceContent {
                    sourceContentView(content)
                } else if !isLoadingSource {
                    Text("No source content available")
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                }

                // Attachments section
                if let archive = archiveRecord, let attachments = archive.attachments, !attachments.isEmpty {
                    Divider().background(Color.spentyBorder)
                    attachmentsSection(attachments, archiveId: archive.id)
                }
            }
        }
        .cardStyle()
    }

    @ViewBuilder
    private func sourceContentView(_ content: SourceContent) -> some View {
        VStack(spacing: 8) {
            if content.type == "email" {
                if let subject = content.subject, !subject.isEmpty {
                    sourceRow(label: "Subject", value: subject)
                }
                if let from = content.from, !from.isEmpty {
                    sourceRow(label: "From", value: from)
                }
                if let date = content.date, !date.isEmpty {
                    sourceRow(label: "Date", value: date)
                }
                if let body = content.body, !body.isEmpty {
                    Divider().background(Color.spentyBorder)
                    Text(stripHTML(body))
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(20)
                }
            } else if content.type == "sms" {
                if let sender = content.sender, !sender.isEmpty {
                    sourceRow(label: "Sender", value: sender)
                }
                if let date = content.date, !date.isEmpty {
                    sourceRow(label: "Date", value: date)
                }
                if let body = content.body, !body.isEmpty {
                    Divider().background(Color.spentyBorder)
                    Text(body)
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func sourceRow(label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(SpentyFonts.caption)
                .foregroundColor(.spentyTextSecondary)
                .frame(width: 60, alignment: .leading)
            Text(value)
                .font(SpentyFonts.caption)
                .foregroundColor(.spentyTextPrimary)
                .textSelection(.enabled)
            Spacer()
        }
    }

    @ViewBuilder
    private func attachmentsSection(_ attachments: [RecordAttachment], archiveId: String) -> some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "paperclip")
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextSecondary)
                Text("Attachments (\(attachments.count))")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                Spacer()
            }

            ForEach(attachments) { attachment in
                Button {
                    Task { await downloadAttachment(archiveId: archiveId, attachment: attachment) }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: attachmentIcon(for: attachment.mimeType))
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyPrimary)
                            .frame(width: 28)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(attachment.filename ?? "Attachment \(attachment.index + 1)")
                                .font(SpentyFonts.subheadline)
                                .foregroundColor(.spentyTextPrimary)
                                .lineLimit(1)

                            if let size = attachment.size, size > 0 {
                                Text(formatFileSize(size))
                                    .font(SpentyFonts.caption)
                                    .foregroundColor(.spentyTextSecondary)
                            }
                        }

                        Spacer()

                        if downloadingAttachmentIndex == attachment.index {
                            ProgressView()
                                .tint(.spentyPrimary)
                        } else {
                            Image(systemName: "arrow.down.circle")
                                .font(SpentyFonts.body)
                                .foregroundColor(.spentyPrimary)
                        }
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .background(Color.spentyBgSecondary)
                    .cornerRadius(8)
                }
                .disabled(downloadingAttachmentIndex != nil)
            }
        }
    }

    // MARK: - Supporting Document (Receipt)

    private var supportingDocumentCard: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Receipt")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)
                Spacer()
            }

            if let receiptId = transaction.receiptId, !receiptId.isEmpty {
                Button {
                    showReceiptSheet = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "doc.text.image")
                            .font(SpentyFonts.body)
                        Text("View Receipt")
                            .font(SpentyFonts.subheadline)
                    }
                    .foregroundColor(.spentyPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentyPrimary.opacity(0.08))
                    .cornerRadius(10)
                }
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "doc.text.image")
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                    Text("No receipt attached")
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
        }
        .cardStyle()
    }

    private var receiptPreviewSheet: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    Image(systemName: "doc.text.image")
                        .font(.system(size: 48))
                        .foregroundColor(.spentyPrimary)

                    Text("Receipt")
                        .font(SpentyFonts.title3)
                        .foregroundColor(.spentyTextPrimary)

                    if let receiptId = transaction.receiptId {
                        Text("Receipt ID: \(receiptId)")
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextSecondary)
                            .textSelection(.enabled)
                    }

                    Text("Full receipt preview will be available in a future update.")
                        .font(SpentyFonts.subheadline)
                        .foregroundColor(.spentyTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
            }
            .navigationTitle("Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showReceiptSheet = false
                    }
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyPrimary)
                }
            }
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button {
                showEditSheet = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "pencil")
                    Text("Edit Transaction")
                }
                .primaryButtonStyle()
            }
            .disabled(isPerformingAction)

            if isPending {
                HStack(spacing: 12) {
                    Button {
                        Task { await approveTransaction() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle")
                            Text("Approve")
                        }
                        .primaryButtonStyle()
                    }
                    .disabled(isPerformingAction)

                    Button {
                        Task { await rejectTransaction() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "xmark.circle")
                            Text("Reject")
                        }
                        .destructiveButtonStyle()
                    }
                    .disabled(isPerformingAction)
                }
            }

            Button {
                showDeleteConfirm = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "trash")
                    Text("Delete Transaction")
                }
                .destructiveButtonStyle()
            }
            .disabled(isPerformingAction)
        }
        .padding(.top, 8)
    }

    // MARK: - Actions

    @MainActor
    private func loadTransaction() async {
        isLoading = true
        defer { isLoading = false }
        do {
            transaction = try await repository.fetchTransaction(id: transactionId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func loadSourceDocument() async {
        guard let sourceId = transaction.sourceId else { return }
        isLoadingSource = true
        defer { isLoadingSource = false }
        do {
            sourceContent = try await emailSyncRepo.sourceContent(id: sourceId)
            isSourceExpanded = true
        } catch {
            sourceError = "Could not load source document"
        }
    }

    @MainActor
    private func loadArchiveRecord() async {
        // Only try for email-sourced transactions
        guard transaction.sourceEmailId != nil else { return }
        isLoadingArchive = true
        defer { isLoadingArchive = false }
        do {
            archiveRecord = try await recordsRepo.fetchRecordByTransaction(transactionId: transactionId)
        } catch {
            // Archive may not exist yet (not all emails are archived) — fail silently
        }
    }

    @MainActor
    private func downloadAttachment(archiveId: String, attachment: RecordAttachment) async {
        downloadingAttachmentIndex = attachment.index
        defer { downloadingAttachmentIndex = nil }
        do {
            let data = try await recordsRepo.downloadAttachment(id: archiveId, index: attachment.index)
            let filename = attachment.filename ?? "attachment_\(attachment.index)"
            // Save to temp and share
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            try data.write(to: tempURL)
            await MainActor.run {
                let activityVC = UIActivityViewController(activityItems: [tempURL], applicationActivities: nil)
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                   let root = windowScene.windows.first?.rootViewController {
                    var topVC = root
                    while let presented = topVC.presentedViewController {
                        topVC = presented
                    }
                    if let popover = activityVC.popoverPresentationController {
                        popover.sourceView = topVC.view
                        popover.sourceRect = CGRect(x: topVC.view.bounds.midX, y: topVC.view.bounds.midY, width: 0, height: 0)
                    }
                    topVC.present(activityVC, animated: true)
                }
            }
        } catch {
            sourceError = "Failed to download attachment"
        }
    }

    @MainActor
    private func deleteTransaction() async {
        isPerformingAction = true
        defer { isPerformingAction = false }
        do {
            _ = try await repository.deleteTransaction(id: transactionId)
            onTransactionUpdated?()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func approveTransaction() async {
        isPerformingAction = true
        defer { isPerformingAction = false }
        do {
            transaction = try await repository.approveTransaction(id: transactionId)
            onTransactionUpdated?()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func rejectTransaction() async {
        isPerformingAction = true
        defer { isPerformingAction = false }
        do {
            _ = try await repository.rejectTransaction(id: transactionId)
            transaction.status = "rejected"
            onTransactionUpdated?()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func stripHTML(_ html: String) -> String {
        guard let data = html.data(using: .utf8),
              let attributed = try? NSAttributedString(
                data: data,
                options: [.documentType: NSAttributedString.DocumentType.html,
                          .characterEncoding: String.Encoding.utf8.rawValue],
                documentAttributes: nil
              ) else {
            return html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        }
        return attributed.string.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func attachmentIcon(for mimeType: String?) -> String {
        guard let mime = mimeType?.lowercased() else { return "doc" }
        if mime.contains("pdf") { return "doc.richtext" }
        if mime.contains("image") { return "photo" }
        if mime.contains("spreadsheet") || mime.contains("excel") || mime.contains("csv") { return "tablecells" }
        if mime.contains("word") || mime.contains("document") { return "doc.text" }
        if mime.contains("zip") || mime.contains("archive") { return "doc.zipper" }
        return "doc"
    }

    private func formatFileSize(_ bytes: Int) -> String {
        if bytes < 1024 { return "\(bytes) B" }
        let kb = Double(bytes) / 1024.0
        if kb < 1024 { return String(format: "%.1f KB", kb) }
        let mb = kb / 1024.0
        return String(format: "%.1f MB", mb)
    }
}

// MARK: - Preview

#Preview {
    TransactionDetailView(
        transaction: Transaction(
            id: "preview-1",
            transactionType: "expense",
            amount: 12500.50,
            date: Date(),
            accountId: "acc-001",
            categoryId: "cat-food",
            subcategoryId: "sub-restaurant",
            description: "Dinner with client at The Grand",
            paymentMethod: "Credit Card",
            status: "pending",
            isRecurring: false,
            source: "manual",
            receiptId: "rec-abc123"
        )
    )
}
