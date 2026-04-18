import SwiftUI

struct RecordsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = RecordsViewModel()

    private var currency: String {
        appState.user?.settings?.baseCurrency ?? "INR"
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                tabBar
                content
            }
            .background(SpentyColors.bgPrimary.ignoresSafeArea())
            .navigationTitle("Records")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await viewModel.loadAll()
            }
            .refreshable {
                await viewModel.refresh()
            }
            .overlay {
                LoadingOverlay(isPresented: .constant(viewModel.isLoading && viewModel.records.isEmpty && viewModel.receipts.isEmpty))
            }
            .alert(
                "Delete",
                isPresented: $viewModel.showDeleteConfirm
            ) {
                Button("Delete", role: .destructive) {
                    Task {
                        if let id = viewModel.deletingRecordId {
                            await viewModel.deleteRecord(id)
                        } else if let id = viewModel.deletingReceiptId {
                            await viewModel.deleteReceipt(id)
                        }
                    }
                }
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = false
                    viewModel.deletingRecordId = nil
                    viewModel.deletingReceiptId = nil
                }
            } message: {
                Text("Are you sure you want to delete this item? This action cannot be undone.")
            }
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SpentySpacing.sm) {
                ForEach(RecordsViewModel.Tab.allCases, id: \.self) { tab in
                    FilterChip(tab.rawValue, isSelected: viewModel.selectedTab == tab) {
                        viewModel.selectedTab = tab
                    }
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
        }
        .padding(.vertical, SpentySpacing.sm)
        .background(SpentyColors.surface)
        .overlay(alignment: .bottom) {
            Divider().overlay(SpentyColors.borderSubtle)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.selectedTab {
        case .emailRecords:
            emailRecordsTab
        case .receipts:
            receiptsTab
        }
    }

    // MARK: - Email Records Tab

    private var emailRecordsTab: some View {
        VStack(spacing: 0) {
            SearchBar(text: $viewModel.searchText, placeholder: "Search by subject or sender...")
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.sm)
                .onChange(of: viewModel.searchText) { _, newValue in
                    Task {
                        try? await Task.sleep(for: .milliseconds(300))
                        await viewModel.searchRecords()
                    }
                }

            if viewModel.filteredRecords.isEmpty && !viewModel.isLoading {
                EmptyState(
                    icon: "envelope.open",
                    title: "No Email Records",
                    message: "Your synced email records will appear here once processed."
                )
            } else {
                List {
                    ForEach(viewModel.filteredRecords) { record in
                        recordRow(record)
                            .listRowInsets(EdgeInsets())
                            .listRowSeparator(.hidden)
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    viewModel.deletingRecordId = record.archiveId
                                    viewModel.showDeleteConfirm = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
    }

    private func recordRow(_ record: Record) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text(record.subject ?? "No Subject")
                            .font(SpentyFonts.subheading)
                            .foregroundStyle(SpentyColors.textPrimary)
                            .lineLimit(1)

                        if let sender = record.sender {
                            Text(sender)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)
                                .lineLimit(1)
                        }
                    }

                    Spacer()

                    if let amount = record.amount {
                        MoneyText(amount, currency: currency, size: SpentyFonts.subheading)
                    }
                }

                HStack(spacing: SpentySpacing.md) {
                    if let date = record.date {
                        HStack(spacing: SpentySpacing.xs) {
                            Image(systemName: "calendar")
                                .font(.system(size: 11))
                            Text(DateFormatting.shortDate(from: date))
                                .font(SpentyFonts.caption)
                        }
                        .foregroundStyle(SpentyColors.textMuted)
                    }

                    if let count = record.attachmentCount, count > 0 {
                        HStack(spacing: SpentySpacing.xs) {
                            Image(systemName: "paperclip")
                                .font(.system(size: 11))
                            Text("\(count)")
                                .font(SpentyFonts.caption)
                        }
                        .foregroundStyle(SpentyColors.textMuted)
                    }
                }
            }
        }
        .padding(.horizontal, SpentySpacing.lg)
        .padding(.vertical, SpentySpacing.xs)
    }

    // MARK: - Receipts Tab

    private let receiptColumns = [
        GridItem(.flexible(), spacing: SpentySpacing.md),
        GridItem(.flexible(), spacing: SpentySpacing.md)
    ]

    private var receiptsTab: some View {
        Group {
            if viewModel.receipts.isEmpty && !viewModel.isLoading {
                EmptyState(
                    icon: "doc.text.viewfinder",
                    title: "No Receipts",
                    message: "Upload receipts to keep track of your expenses and match them to transactions."
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: receiptColumns, spacing: SpentySpacing.md) {
                        ForEach(viewModel.receipts) { receipt in
                            receiptCard(receipt)
                                .contextMenu {
                                    Button(role: .destructive) {
                                        viewModel.deletingReceiptId = receipt.receiptId
                                        viewModel.showDeleteConfirm = true
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.vertical, SpentySpacing.md)
                }
            }
        }
    }

    private func receiptCard(_ receipt: Receipt) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                // File type badge
                HStack {
                    Text((receipt.fileExt ?? "FILE").uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(SpentyColors.info)
                        .padding(.horizontal, SpentySpacing.sm)
                        .padding(.vertical, SpentySpacing.xs)
                        .background(SpentyColors.info.opacity(0.15))
                        .clipShape(Capsule())

                    Spacer()
                }

                // Filename
                Text(receipt.filename ?? "Untitled")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textPrimary)
                    .lineLimit(2)

                // Parsed amount
                if let parsed = receipt.parsedData {
                    if let amount = parsed.amount {
                        MoneyText(amount, currency: currency, size: SpentyFonts.body)
                    }
                    if let date = parsed.date {
                        Text(DateFormatting.shortDate(from: date))
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                    }
                }

                // Upload date
                if let uploaded = receipt.uploadedAt {
                    Text(DateFormatting.relativeDate(from: uploaded))
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textMuted)
                }
            }
        }
    }
}

#Preview {
    RecordsView()
        .environment(AppState())
}
