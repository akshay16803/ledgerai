import SwiftUI

struct StatementDetailView: View {

    @Bindable var viewModel: ReconciliationViewModel
    let statementId: String

    @State private var showBulkCategoryPicker = false
    @State private var selectedBulkCategoryId: String = ""
    @State private var showApproveConfirm = false
    @State private var showRejectConfirm = false

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    private static let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencySymbol = ""
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            if viewModel.isLoading && viewModel.activeStatement == nil {
                LoadingView()
            } else if let statement = viewModel.activeStatement {
                ScrollView {
                    VStack(spacing: 16) {
                        headerCard(statement)
                        actionButtons(statement)
                        reconciliationResultsCard
                        entriesSection
                    }
                    .padding(16)
                }
            }
        }
        .navigationTitle("Statement Details")
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if let error = viewModel.errorMessage {
                ErrorBanner(message: error) {
                    viewModel.errorMessage = nil
                }
            }
            if let success = viewModel.successMessage {
                successBanner(success)
            }
        }
        .sheet(isPresented: $viewModel.showUnlockSheet) {
            unlockSheet
        }
        .sheet(isPresented: $showBulkCategoryPicker) {
            bulkCategorizeSheet
        }
        .confirmationDialog("Approve Statement", isPresented: $showApproveConfirm, titleVisibility: .visible) {
            Button("Approve") {
                Task { await viewModel.approveStatement(id: statementId) }
            }
        } message: {
            Text("Mark this statement as approved?")
        }
        .confirmationDialog("Reject Statement", isPresented: $showRejectConfirm, titleVisibility: .visible) {
            Button("Reject", role: .destructive) {
                Task { await viewModel.rejectStatement(id: statementId) }
            }
        } message: {
            Text("Mark this statement as rejected?")
        }
        .task { await viewModel.loadStatement(id: statementId) }
    }

    // MARK: - Header Card

    private func headerCard(_ statement: Statement) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.spentyPrimary)

                VStack(alignment: .leading, spacing: 2) {
                    Text(statement.filename ?? "Statement")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)

                    Text(statement.accountName ?? viewModel.accountName(for: statement.accountId))
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }

                Spacer()

                if let status = statement.status {
                    StatusBadge(status: status)
                }
            }

            Divider()
                .background(Color.spentyBorder)

            detailRow(label: "Period", value: periodString(from: statement.periodFrom, to: statement.periodTo))
            detailRow(label: "Entries", value: "\(statement.entryCount ?? viewModel.parsedEntries.count)")
            detailRow(label: "Type", value: statement.statementType?.capitalized ?? "N/A")

            if let auditStatus = statement.auditStatus {
                HStack {
                    Text("Audit Status")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                    Spacer()
                    StatusBadge(status: auditStatus)
                }
            }

            if let progress = statement.processingProgress, progress > 0 && progress < 1 {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Processing")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                        Spacer()
                        Text("\(Int(progress * 100))%")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyPrimary)
                    }
                    ProgressView(value: progress)
                        .progressViewStyle(.linear)
                        .tint(.spentyPrimary)

                    if let label = statement.processingStageLabel {
                        Text(label)
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
            }
        }
        .cardStyle()
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
            Spacer()
            Text(value)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextPrimary)
        }
    }

    private func periodString(from: Date?, to: Date?) -> String {
        guard let from, let to else { return "N/A" }
        return "\(Self.dateFormatter.string(from: from)) - \(Self.dateFormatter.string(from: to))"
    }

    // MARK: - Action Buttons

    private func actionButtons(_ statement: Statement) -> some View {
        VStack(spacing: 10) {
            // Primary actions row
            HStack(spacing: 10) {
                Button {
                    Task { await viewModel.reconcile(statementId: statementId) }
                } label: {
                    HStack(spacing: 6) {
                        if viewModel.isReconciling {
                            ProgressView().tint(.white)
                        }
                        Image(systemName: "arrow.triangle.2.circlepath")
                        Text("Reconcile")
                    }
                    .font(SpentyFonts.footnote)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentyPrimary)
                    .cornerRadius(10)
                }
                .disabled(viewModel.isReconciling)

                Button {
                    showBulkCategoryPicker = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "tag.fill")
                        Text("Bulk Categorize")
                    }
                    .font(SpentyFonts.footnote)
                    .fontWeight(.semibold)
                    .foregroundColor(.spentyPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentyPrimary.opacity(0.1))
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.spentyPrimary, lineWidth: 1)
                    )
                }
            }

            // Secondary actions row
            HStack(spacing: 10) {
                if viewModel.reconciliationResult?.missing ?? 0 > 0 {
                    Button {
                        Task { await viewModel.addMissingToLedger(statementId: statementId) }
                    } label: {
                        actionLabel(icon: "plus.circle", text: "Add Missing", color: .spentyInfo)
                    }
                }

                Button {
                    Task { await viewModel.reaudit(statementId: statementId) }
                } label: {
                    actionLabel(icon: "arrow.clockwise", text: "Re-audit", color: .spentyWarning)
                }

                Button {
                    viewModel.showUnlockSheet = true
                } label: {
                    actionLabel(icon: "lock.open", text: "Unlock", color: .spentyTextSecondary)
                }
            }

            // Approve / Reject row
            HStack(spacing: 10) {
                Button {
                    showApproveConfirm = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Approve")
                    }
                    .font(SpentyFonts.footnote)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentySuccess)
                    .cornerRadius(10)
                }

                Button {
                    showRejectConfirm = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "xmark.circle.fill")
                        Text("Reject")
                    }
                    .font(SpentyFonts.footnote)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.spentyError)
                    .cornerRadius(10)
                }
            }
        }
    }

    private func actionLabel(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
            Text(text)
        }
        .font(SpentyFonts.caption1)
        .fontWeight(.medium)
        .foregroundColor(color)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }

    // MARK: - Reconciliation Results

    @ViewBuilder
    private var reconciliationResultsCard: some View {
        if let result = viewModel.reconciliationResult {
            VStack(alignment: .leading, spacing: 12) {
                Text("Reconciliation Results")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)

                Divider().background(Color.spentyBorder)

                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 12) {
                    resultStat(label: "Total Entries", value: "\(result.totalEntries ?? 0)", color: .spentyTextPrimary)
                    resultStat(label: "Matched", value: "\(result.matched ?? 0)", color: .spentySuccess)
                    resultStat(label: "Unmatched", value: "\(result.unmatched ?? 0)", color: .spentyWarning)
                    resultStat(label: "Missing", value: "\(result.missing ?? 0)", color: .spentyError)
                }

                if let opening = result.openingBalance {
                    detailRow(label: "Opening Balance", value: formatAmount(opening))
                }
                if let closing = result.closingBalance {
                    detailRow(label: "Closing Balance", value: formatAmount(closing))
                }
                if let computed = result.computedClosing {
                    detailRow(label: "Computed Closing", value: formatAmount(computed))
                }
                if let diff = result.difference, diff != 0 {
                    HStack {
                        Text("Difference")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                        Spacer()
                        Text(formatAmount(diff))
                            .font(SpentyFonts.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(diff == 0 ? .spentySuccess : .spentyError)
                    }
                }
            }
            .cardStyle()
        }
    }

    private func resultStat(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(SpentyFonts.title3)
                .foregroundColor(color)
            Text(label)
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(color.opacity(0.06))
        .cornerRadius(8)
    }

    // MARK: - Entries Section

    private var entriesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Parsed Entries")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)
                Spacer()
                Text("\(viewModel.parsedEntries.count) entries")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }

            if viewModel.parsedEntries.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "tray")
                            .font(.system(size: 32))
                            .foregroundColor(.spentyTextSecondary.opacity(0.5))
                        Text("No entries parsed yet")
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextSecondary)
                    }
                    .padding(.vertical, 24)
                    Spacer()
                }
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(Array(viewModel.parsedEntries.enumerated()), id: \.offset) { index, entry in
                        entryRow(entry, index: index)
                    }
                }
            }
        }
        .cardStyle()
    }

    private func entryRow(_ entry: ParsedEntry, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                if let date = entry.date {
                    Text(Self.dateFormatter.string(from: date))
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }

                Spacer()

                if let amount = entry.amount {
                    Text(formatAmount(amount))
                        .font(SpentyFonts.amountSmall)
                        .foregroundColor(amount >= 0 ? .spentySuccess : .spentyError)
                }
            }

            if let desc = entry.description {
                Text(desc)
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                    .lineLimit(2)
            }

            HStack(spacing: 8) {
                // Category picker
                categoryPicker(for: entry, index: index)

                // Match indicator
                if entry.matched == true {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 10))
                        Text("Matched")
                            .font(SpentyFonts.caption2)
                    }
                    .foregroundColor(.spentySuccess)
                }
            }
        }
        .padding(12)
        .background(Color.spentyBgPrimary)
        .cornerRadius(8)
    }

    private func categoryPicker(for entry: ParsedEntry, index: Int) -> some View {
        Menu {
            ForEach(viewModel.categories) { category in
                if let children = category.children, !children.isEmpty {
                    Menu(category.name ?? "Unnamed") {
                        Button(category.name ?? "Unnamed") {
                            Task {
                                await viewModel.updateEntryCategory(
                                    statementId: statementId,
                                    index: index,
                                    categoryId: category.id,
                                    categoryName: category.name
                                )
                            }
                        }
                        ForEach(children) { sub in
                            Button(sub.name ?? "Unnamed") {
                                Task {
                                    await viewModel.updateEntryCategory(
                                        statementId: statementId,
                                        index: index,
                                        categoryId: sub.id,
                                        categoryName: sub.name
                                    )
                                }
                            }
                        }
                    }
                } else {
                    Button(category.name ?? "Unnamed") {
                        Task {
                            await viewModel.updateEntryCategory(
                                statementId: statementId,
                                index: index,
                                categoryId: category.id,
                                categoryName: category.name
                            )
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "tag")
                    .font(.system(size: 10))
                Text(entry.categoryName ?? viewModel.categoryName(for: entry.categoryId))
                    .font(SpentyFonts.caption1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 8))
            }
            .foregroundColor(.spentyPrimary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.spentyPrimary.opacity(0.1))
            .cornerRadius(6)
        }
    }

    // MARK: - Unlock Sheet

    private var unlockSheet: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 48))
                    .foregroundColor(.spentyPrimary)

                Text("Unlock PDF")
                    .font(SpentyFonts.title2)
                    .foregroundColor(.spentyTextPrimary)

                Text("Enter the password to unlock this password-protected PDF statement.")
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextSecondary)
                    .multilineTextAlignment(.center)

                SecureField("PDF Password", text: $viewModel.unlockPassword)
                    .inputStyle()

                Button {
                    Task { await viewModel.unlock(statementId: statementId) }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isProcessing {
                            ProgressView().tint(.white)
                        }
                        Text(viewModel.isProcessing ? "Unlocking..." : "Unlock")
                    }
                    .primaryButtonStyle()
                }
                .disabled(viewModel.unlockPassword.isEmpty || viewModel.isProcessing)

                Spacer()
            }
            .padding(24)
            .background(Color.spentyBgPrimary)
            .navigationTitle("Unlock Statement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.showUnlockSheet = false
                        viewModel.unlockPassword = ""
                    }
                    .foregroundColor(.spentyPrimary)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Bulk Categorize Sheet

    private var bulkCategorizeSheet: some View {
        NavigationStack {
            List {
                ForEach(viewModel.categories) { category in
                    if let children = category.children, !children.isEmpty {
                        Section(category.name ?? "Unnamed") {
                            Button {
                                selectedBulkCategoryId = category.id
                                performBulkCategorize()
                            } label: {
                                Text(category.name ?? "Unnamed")
                                    .foregroundColor(.spentyTextPrimary)
                            }
                            ForEach(children) { sub in
                                Button {
                                    selectedBulkCategoryId = sub.id
                                    performBulkCategorize()
                                } label: {
                                    Text(sub.name ?? "Unnamed")
                                        .foregroundColor(.spentyTextPrimary)
                                        .padding(.leading, 16)
                                }
                            }
                        }
                    } else {
                        Button {
                            selectedBulkCategoryId = category.id
                            performBulkCategorize()
                        } label: {
                            Text(category.name ?? "Unnamed")
                                .foregroundColor(.spentyTextPrimary)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Select Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showBulkCategoryPicker = false }
                        .foregroundColor(.spentyPrimary)
                }
            }
        }
    }

    private func performBulkCategorize() {
        showBulkCategoryPicker = false
        Task {
            await viewModel.bulkCategorize(statementId: statementId, categoryId: selectedBulkCategoryId)
        }
    }

    // MARK: - Success Banner

    private func successBanner(_ message: String) -> some View {
        VStack {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.spentySuccess)
                Text(message)
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextPrimary)
                Spacer()
                Button {
                    viewModel.successMessage = nil
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyTextSecondary)
                }
            }
            .padding(12)
            .background(Color.spentySuccess.opacity(0.1))
            .cornerRadius(10)
            .padding(.horizontal, 16)
            .padding(.top, 8)

            Spacer()
        }
        .transition(.move(edge: .top).combined(with: .opacity))
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                withAnimation { viewModel.successMessage = nil }
            }
        }
    }

    // MARK: - Helpers

    private func formatAmount(_ amount: Double) -> String {
        Self.currencyFormatter.string(from: NSNumber(value: amount)) ?? String(format: "%.2f", amount)
    }
}

#Preview {
    NavigationStack {
        StatementDetailView(viewModel: ReconciliationViewModel(), statementId: "preview-id")
    }
}
