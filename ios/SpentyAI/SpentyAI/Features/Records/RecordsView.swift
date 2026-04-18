import SwiftUI

struct RecordsView: View {

    @State private var viewModel = RecordsViewModel()
    @State private var showDeleteConfirm = false
    @State private var deleteTargetId: String?
    @State private var showDateFilter = false
    @State private var showAmountFilter = false
    @State private var showUploadSheet = false
    @State private var deleteReceiptId: String?
    @State private var showDeleteReceiptConfirm = false

    private static let rowDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    private static let receiptDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    tabBar
                    switch viewModel.activeTab {
                    case .emails:
                        emailsContent
                    case .receipts:
                        receiptsContent
                    }
                }
            }
            .navigationTitle("Records")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { toolbarContent }
            .sheet(item: $viewModel.shareItem) { item in
                ShareSheet(activityItems: [item.url])
            }
            .sheet(isPresented: $showUploadSheet) {
                ReceiptUploadView(viewModel: viewModel, isPresented: $showUploadSheet)
            }
            .confirmationDialog(
                "Delete Record",
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    if let id = deleteTargetId {
                        Task { await viewModel.deleteRecord(id: id) }
                    }
                }
            } message: {
                Text("This action cannot be undone.")
            }
            .confirmationDialog(
                "Delete Receipt",
                isPresented: $showDeleteReceiptConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    if let id = deleteReceiptId {
                        Task { await viewModel.deleteReceipt(id: id) }
                    }
                }
            } message: {
                Text("This receipt will be permanently removed.")
            }
            .task {
                await viewModel.loadRecords()
                await viewModel.loadReceipts()
            }
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        Picker("Tab", selection: $viewModel.activeTab) {
            ForEach(RecordsTab.allCases, id: \.self) { tab in
                Text(tab.rawValue).tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    // MARK: - Emails Content

    private var emailsContent: some View {
        VStack(spacing: 0) {
            emailSearchSection
            emailFilterSection
            emailList
        }
    }

    private var emailSearchSection: some View {
        SearchBar(
            placeholder: "Search emails...",
            text: $viewModel.searchQuery,
            onCommit: {
                Task { await viewModel.searchRecords() }
            },
            onDebounced: { _ in
                Task { await viewModel.searchRecords() }
            }
        )
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var emailFilterSection: some View {
        HStack(spacing: 8) {
            dateRangeButton
            amountRangeButton
            Spacer()
            downloadZipButton
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var dateRangeButton: some View {
        Button {
            showDateFilter.toggle()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "calendar")
                    .font(.system(size: 12))
                Text(hasDateFilter ? "Date Set" : "Date Range")
                    .font(SpentyFonts.footnote)
                if hasDateFilter {
                    Button {
                        viewModel.dateFrom = nil
                        viewModel.dateTo = nil
                        Task { await viewModel.refreshRecords() }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                    }
                }
            }
            .foregroundColor(hasDateFilter ? .spentyPrimary : .spentyTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(hasDateFilter ? Color.spentyPrimary.opacity(0.1) : Color.spentyBgPrimary)
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(hasDateFilter ? Color.spentyPrimary.opacity(0.3) : Color.spentyBorder, lineWidth: 1)
            )
        }
        .popover(isPresented: $showDateFilter) {
            dateFilterPopover
        }
    }

    private var amountRangeButton: some View {
        Button {
            showAmountFilter.toggle()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "indianrupeesign")
                    .font(.system(size: 12))
                Text(hasAmountFilter ? "Amount Set" : "Amount")
                    .font(SpentyFonts.footnote)
                if hasAmountFilter {
                    Button {
                        viewModel.amountMin = ""
                        viewModel.amountMax = ""
                        Task { await viewModel.refreshRecords() }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                    }
                }
            }
            .foregroundColor(hasAmountFilter ? .spentyPrimary : .spentyTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(hasAmountFilter ? Color.spentyPrimary.opacity(0.1) : Color.spentyBgPrimary)
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(hasAmountFilter ? Color.spentyPrimary.opacity(0.3) : Color.spentyBorder, lineWidth: 1)
            )
        }
        .popover(isPresented: $showAmountFilter) {
            amountFilterPopover
        }
    }

    private var downloadZipButton: some View {
        Button {
            Task { await viewModel.downloadZip() }
        } label: {
            HStack(spacing: 4) {
                if viewModel.isDownloadingZip {
                    ProgressView()
                        .controlSize(.mini)
                        .tint(.spentyPrimary)
                } else {
                    Image(systemName: "arrow.down.doc.fill")
                        .font(.system(size: 12))
                }
                Text("ZIP")
                    .font(SpentyFonts.footnote)
            }
            .foregroundColor(.spentyPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.spentyPrimary.opacity(0.1))
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.spentyPrimary.opacity(0.3), lineWidth: 1)
            )
        }
        .disabled(viewModel.isDownloadingZip)
    }

    // MARK: - Filter Popovers

    private var hasDateFilter: Bool {
        viewModel.dateFrom != nil || viewModel.dateTo != nil
    }

    private var hasAmountFilter: Bool {
        !viewModel.amountMin.isEmpty || !viewModel.amountMax.isEmpty
    }

    private var dateFilterPopover: some View {
        VStack(spacing: 16) {
            Text("Date Range")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            VStack(alignment: .leading, spacing: 6) {
                Text("From")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                DatePicker(
                    "From",
                    selection: Binding(
                        get: { viewModel.dateFrom ?? Date() },
                        set: { viewModel.dateFrom = $0 }
                    ),
                    displayedComponents: .date
                )
                .labelsHidden()
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("To")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                DatePicker(
                    "To",
                    selection: Binding(
                        get: { viewModel.dateTo ?? Date() },
                        set: { viewModel.dateTo = $0 }
                    ),
                    displayedComponents: .date
                )
                .labelsHidden()
            }

            Button("Apply") {
                showDateFilter = false
                Task { await viewModel.refreshRecords() }
            }
            .primaryButtonStyle()
        }
        .padding(20)
        .presentationCompactAdaptation(.popover)
    }

    private var amountFilterPopover: some View {
        VStack(spacing: 16) {
            Text("Amount Range")
                .font(SpentyFonts.headline)
                .foregroundColor(.spentyTextPrimary)

            VStack(alignment: .leading, spacing: 6) {
                Text("Min Amount")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                TextField("0", text: $viewModel.amountMin)
                    .keyboardType(.decimalPad)
                    .inputStyle()
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Max Amount")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                TextField("No limit", text: $viewModel.amountMax)
                    .keyboardType(.decimalPad)
                    .inputStyle()
            }

            Button("Apply") {
                showAmountFilter = false
                Task { await viewModel.refreshRecords() }
            }
            .primaryButtonStyle()
        }
        .padding(20)
        .presentationCompactAdaptation(.popover)
    }

    // MARK: - Email List

    private var emailList: some View {
        Group {
            if viewModel.isLoading && viewModel.records.isEmpty {
                LoadingView()
            } else if viewModel.records.isEmpty {
                EmptyStateView(
                    icon: "envelope.open",
                    title: "No Email Records",
                    subtitle: "Synced emails with financial data will appear here."
                )
            } else {
                List {
                    ForEach(viewModel.records) { record in
                        NavigationLink(value: record.id) {
                            emailRow(record)
                        }
                        .listRowBackground(Color.spentyCardBg)
                        .listRowSeparatorTint(.spentyBorder)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                deleteTargetId = record.id
                                showDeleteConfirm = true
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .onAppear {
                            if record.id == viewModel.records.last?.id {
                                Task { await viewModel.loadMoreRecords() }
                            }
                        }
                    }

                    if viewModel.isLoadingMore {
                        HStack {
                            Spacer()
                            ProgressView()
                                .tint(.spentyPrimary)
                            Spacer()
                        }
                        .listRowBackground(Color.clear)
                    }
                }
                .listStyle(.plain)
                .refreshable { await viewModel.refreshRecords() }
                .navigationDestination(for: String.self) { recordId in
                    RecordPreviewView(recordId: recordId, viewModel: viewModel)
                }
            }
        }
    }

    private func emailRow(_ record: Record) -> some View {
        HStack(spacing: 12) {
            sourceIcon(record.source)

            VStack(alignment: .leading, spacing: 4) {
                Text(record.subject ?? "No Subject")
                    .font(SpentyFonts.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                Text(record.sender ?? "Unknown Sender")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
                    .lineLimit(1)

                if let date = record.receivedDate {
                    Text(Self.rowDateFormatter.string(from: date))
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyTextSecondary.opacity(0.7))
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if let amount = record.amount {
                    CurrencyText(
                        amount: amount,
                        font: SpentyFonts.amountSmall,
                        color: amountColor(for: record.transactionType)
                    )
                }

                if let count = record.attachmentCount, count > 0 {
                    HStack(spacing: 2) {
                        Image(systemName: "paperclip")
                            .font(.system(size: 10))
                        Text("\(count)")
                            .font(SpentyFonts.caption2)
                    }
                    .foregroundColor(.spentyTextSecondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.spentyBgPrimary)
                    .cornerRadius(8)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func sourceIcon(_ source: String?) -> some View {
        let (icon, color): (String, Color) = {
            switch source?.lowercased() {
            case "gmail":
                return ("envelope.fill", .spentyError)
            case "outlook":
                return ("envelope.fill", .spentyInfo)
            default:
                return ("envelope.fill", .spentyTextSecondary)
            }
        }()

        return Image(systemName: icon)
            .font(.system(size: 24))
            .foregroundColor(color)
            .frame(width: 36, height: 36)
    }

    private func amountColor(for type: String?) -> Color {
        switch type?.lowercased() {
        case "income", "credit": return .spentySuccess
        case "expense", "debit": return .spentyError
        default: return .spentyTextPrimary
        }
    }

    // MARK: - Receipts Content

    private var receiptsContent: some View {
        Group {
            if viewModel.isLoadingReceipts && viewModel.receipts.isEmpty {
                LoadingView()
            } else if viewModel.receipts.isEmpty {
                EmptyStateView(
                    icon: "doc.text.viewfinder",
                    title: "No Receipts",
                    subtitle: "Upload receipts from camera or photo library to parse and link them.",
                    buttonTitle: "Upload Receipt"
                ) {
                    showUploadSheet = true
                }
            } else {
                List {
                    ForEach(viewModel.receipts) { receipt in
                        receiptRow(receipt)
                            .listRowBackground(Color.spentyCardBg)
                            .listRowSeparatorTint(.spentyBorder)
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    deleteReceiptId = receipt.id
                                    showDeleteReceiptConfirm = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .leading) {
                                Button {
                                    Task { await viewModel.downloadReceipt(id: receipt.id, filename: receipt.filename) }
                                } label: {
                                    Label("Download", systemImage: "arrow.down.circle")
                                }
                                .tint(.spentyInfo)
                            }
                            .onAppear {
                                if receipt.id == viewModel.receipts.last?.id {
                                    Task { await viewModel.loadMoreReceipts() }
                                }
                            }
                    }

                    if viewModel.isLoadingMoreReceipts {
                        HStack {
                            Spacer()
                            ProgressView()
                                .tint(.spentyPrimary)
                            Spacer()
                        }
                        .listRowBackground(Color.clear)
                    }
                }
                .listStyle(.plain)
                .refreshable { await viewModel.refreshReceipts() }
            }
        }
    }

    private func receiptRow(_ receipt: Receipt) -> some View {
        HStack(spacing: 12) {
            Image(systemName: receiptIcon(for: receipt.mimeType))
                .font(.system(size: 28))
                .foregroundColor(.spentyPrimary)
                .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 4) {
                Text(receipt.filename ?? "Unnamed Receipt")
                    .font(SpentyFonts.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let merchant = receipt.parsedData?.merchant {
                        Text(merchant)
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }

                    if receipt.parsedData?.merchant != nil, receipt.uploadedAt != nil {
                        Text("·")
                            .foregroundColor(.spentyTextSecondary)
                    }

                    if let date = receipt.uploadedAt {
                        Text(Self.receiptDateFormatter.string(from: date))
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }

                if receipt.transactionId != nil {
                    HStack(spacing: 4) {
                        Image(systemName: "link")
                            .font(.system(size: 10))
                        Text("Linked")
                            .font(SpentyFonts.caption2)
                    }
                    .foregroundColor(.spentySuccess)
                }
            }

            Spacer()

            if let amount = receipt.parsedData?.total ?? receipt.parsedData?.amount {
                CurrencyText(
                    amount: amount,
                    font: SpentyFonts.amountSmall,
                    color: .spentyTextPrimary
                )
            }
        }
        .padding(.vertical, 4)
    }

    private func receiptIcon(for mimeType: String?) -> String {
        switch mimeType?.lowercased() {
        case let m? where m.contains("pdf"):
            return "doc.fill"
        case let m? where m.contains("image"):
            return "photo.fill"
        default:
            return "doc.text.fill"
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            if viewModel.activeTab == .receipts {
                Button {
                    showUploadSheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(.spentyPrimary)
                        .font(.system(size: 22))
                }
            }
        }
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    RecordsView()
}
