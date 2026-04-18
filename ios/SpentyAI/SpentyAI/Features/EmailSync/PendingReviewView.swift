import SwiftUI

struct PendingReviewView: View {

    @Bindable var viewModel: EmailSyncViewModel

    var body: some View {
        Group {
            if viewModel.isLoadingPending && viewModel.pendingTransactions.isEmpty {
                LoadingView(message: "Loading pending transactions...")
            } else if viewModel.pendingTransactions.isEmpty {
                EmptyStateView(
                    icon: "checkmark.circle",
                    title: "All Caught Up",
                    subtitle: "No transactions pending review. New AI-detected transactions will appear here."
                )
            } else {
                transactionList
            }
        }
        .background(Color.spentyBgPrimary)
        .navigationTitle("Pending Review")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        if viewModel.allSelected {
                            viewModel.deselectAll()
                        } else {
                            viewModel.selectAll()
                        }
                    } label: {
                        Label(
                            viewModel.allSelected ? "Deselect All" : "Select All",
                            systemImage: viewModel.allSelected ? "xmark.circle" : "checkmark.circle"
                        )
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundColor(.spentyPrimary)
                }
            }
        }
        .task {
            await viewModel.loadPendingReview()
        }
        .refreshable {
            await viewModel.loadPendingReview()
        }
        .sheet(isPresented: $viewModel.showEditSheet) {
            editTransactionSheet
        }
    }

    // MARK: - Transaction List

    private var transactionList: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Error
                if viewModel.showError {
                    ErrorBanner(message: viewModel.errorMessage) {
                        viewModel.showError = false
                    }
                }

                // Bulk actions
                if !viewModel.selectedTransactionIds.isEmpty {
                    bulkActionsBar
                }

                // Transactions
                ForEach(viewModel.pendingTransactions) { txn in
                    pendingTransactionRow(txn)
                }
            }
            .padding(16)
        }
    }

    // MARK: - Bulk Actions

    private var bulkActionsBar: some View {
        VStack(spacing: 10) {
            HStack {
                Text("\(viewModel.selectedTransactionIds.count) selected")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                Spacer()

                Button("Deselect") {
                    viewModel.deselectAll()
                }
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyPrimary)
            }

            HStack(spacing: 12) {
                Button {
                    Task { await viewModel.bulkApprove() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Approve All")
                    }
                    .font(SpentyFonts.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentySuccess)
                    .cornerRadius(10)
                }

                Button {
                    Task { await viewModel.bulkReject() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "xmark.circle.fill")
                        Text("Reject All")
                    }
                    .font(SpentyFonts.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentyError)
                    .cornerRadius(10)
                }
            }
        }
        .cardStyle()
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: - Transaction Row

    private func pendingTransactionRow(_ txn: PendingTransaction) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Selection + header
            HStack(spacing: 12) {
                Button {
                    viewModel.toggleSelection(txn.id)
                } label: {
                    Image(systemName: viewModel.selectedTransactionIds.contains(txn.id)
                          ? "checkmark.circle.fill"
                          : "circle")
                        .font(.system(size: 22))
                        .foregroundColor(viewModel.selectedTransactionIds.contains(txn.id)
                                         ? .spentyPrimary
                                         : .spentyTextSecondary.opacity(0.4))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(txn.description ?? "Unknown Transaction")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(2)

                    if let date = txn.date {
                        Text(date, format: .dateTime.day().month(.abbreviated).year())
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }

                Spacer()

                if let amount = txn.amount {
                    Text(formatAmount(amount, type: txn.transactionType))
                        .font(SpentyFonts.amountSmall)
                        .foregroundColor(txn.transactionType == "income" ? .spentySuccess : .spentyTextPrimary)
                }
            }

            // Details
            HStack(spacing: 16) {
                if let account = txn.accountName {
                    Label(account, systemImage: "building.columns")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                        .lineLimit(1)
                }

                if let category = txn.categoryName {
                    Label(category, systemImage: "tag")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                        .lineLimit(1)
                }

                if let source = txn.source {
                    Label(source, systemImage: "envelope")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyInfo)
                        .lineLimit(1)
                }
            }

            // Actions
            HStack(spacing: 10) {
                Button {
                    Task { await viewModel.approveTransaction(txn.id) }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                        Text("Approve")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.spentySuccess)
                    .cornerRadius(8)
                }

                Button {
                    Task { await viewModel.rejectTransaction(txn.id) }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                        Text("Reject")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyError)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.spentyError.opacity(0.1))
                    .cornerRadius(8)
                }

                Button {
                    viewModel.beginEditTransaction(txn)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "pencil")
                            .font(.system(size: 12, weight: .bold))
                        Text("Edit")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.spentyPrimary.opacity(0.1))
                    .cornerRadius(8)
                }

                Spacer()
            }
        }
        .cardStyle()
    }

    // MARK: - Edit Sheet

    private var editTransactionSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)
                        TextField("Transaction description", text: $viewModel.editDescription)
                            .inputStyle()
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Amount")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)
                        TextField("0.00", text: $viewModel.editAmount)
                            .keyboardType(.decimalPad)
                            .inputStyle()
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Account ID")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)
                        TextField("Account ID", text: $viewModel.editAccountId)
                            .inputStyle()
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Category ID")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)
                        TextField("Category ID", text: $viewModel.editCategoryId)
                            .inputStyle()
                    }
                }
                .padding(16)
            }
            .background(Color.spentyBgPrimary)
            .navigationTitle("Edit Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.showEditSheet = false
                    }
                    .foregroundColor(.spentyPrimary)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await viewModel.saveEditedTransaction() }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.spentyPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Helpers

    private func formatAmount(_ amount: Double, type: String?) -> String {
        let formatted = String(format: "%.2f", abs(amount))
        if type == "income" {
            return "+\(formatted)"
        }
        return formatted
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        PendingReviewView(viewModel: EmailSyncViewModel())
    }
}
