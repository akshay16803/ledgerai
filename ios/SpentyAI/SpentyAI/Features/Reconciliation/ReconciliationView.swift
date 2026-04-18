import SwiftUI
import UniformTypeIdentifiers

struct ReconciliationView: View {

    @State private var viewModel = ReconciliationViewModel()
    @State private var showDeleteConfirm = false
    @State private var deleteTargetId: String?

    private static let rowDateFormatter: DateFormatter = {
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
                    if viewModel.isLoading && viewModel.statements.isEmpty {
                        LoadingView()
                    } else if viewModel.statements.isEmpty {
                        EmptyStateView(
                            icon: "doc.text.magnifyingglass",
                            title: "No Statements",
                            subtitle: "Upload a bank statement to start reconciling.",
                            buttonTitle: "Upload Statement"
                        ) {
                            viewModel.showUploadSheet = true
                        }
                    } else {
                        statementList
                    }
                }
            }
            .navigationTitle("Reconciliation")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        viewModel.showUploadSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.spentyPrimary)
                            .font(.system(size: 22))
                    }
                }
            }
            .sheet(isPresented: $viewModel.showUploadSheet) {
                StatementUploadView(viewModel: viewModel)
            }
            .confirmationDialog(
                "Delete Statement",
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    if let id = deleteTargetId {
                        Task { await viewModel.deleteStatement(id: id) }
                    }
                }
            } message: {
                Text("This action cannot be undone.")
            }
            .task { await viewModel.loadInitial() }
        }
    }

    // MARK: - Statement List

    private var statementList: some View {
        List {
            ForEach(viewModel.statements) { statement in
                NavigationLink(destination: StatementDetailView(viewModel: viewModel, statementId: statement.id)) {
                    statementRow(statement)
                }
                .listRowBackground(Color.spentyCardBg)
                .listRowSeparatorTint(.spentyBorder)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        deleteTargetId = statement.id
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
        .refreshable { await viewModel.refreshStatements() }
    }

    // MARK: - Statement Row

    private func statementRow(_ statement: Statement) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "doc.text.fill")
                .font(.system(size: 28))
                .foregroundColor(.spentyPrimary)

            VStack(alignment: .leading, spacing: 4) {
                Text(statement.filename ?? "Unnamed Statement")
                    .font(SpentyFonts.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(statement.accountName ?? viewModel.accountName(for: statement.accountId))
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)

                    if let from = statement.periodFrom, let to = statement.periodTo {
                        Text("·")
                            .foregroundColor(.spentyTextSecondary)
                        Text("\(Self.rowDateFormatter.string(from: from)) - \(Self.rowDateFormatter.string(from: to))")
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary.opacity(0.7))
                    }
                }

                if let count = statement.entryCount {
                    Text("\(count) entries")
                        .font(SpentyFonts.caption2)
                        .foregroundColor(.spentyTextSecondary.opacity(0.7))
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                if let status = statement.status {
                    StatusBadge(status: status)
                }

                if let progress = statement.processingProgress, progress > 0 && progress < 1 {
                    processingIndicator(progress: progress, label: statement.processingStageLabel)
                }
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Processing Indicator

    private func processingIndicator(progress: Double, label: String?) -> some View {
        VStack(alignment: .trailing, spacing: 2) {
            ProgressView(value: progress)
                .progressViewStyle(.linear)
                .tint(.spentyPrimary)
                .frame(width: 80)

            if let label {
                Text(label)
                    .font(SpentyFonts.caption2)
                    .foregroundColor(.spentyTextSecondary)
            }
        }
    }
}

#Preview {
    ReconciliationView()
}
