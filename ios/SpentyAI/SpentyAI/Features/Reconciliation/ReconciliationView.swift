import SwiftUI
import UniformTypeIdentifiers

struct ReconciliationView: View {

    @State private var viewModel = ReconciliationViewModel()
    @Environment(AppState.self) private var appState

    // File importer
    @State private var showFileImporter = false
    @State private var passwordInput = ""

    // Accounts for picker (loaded from repository)
    @State private var accounts: [Account] = []

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary
                    .ignoresSafeArea()

                if viewModel.isLoading && viewModel.statements.isEmpty {
                    ProgressView()
                        .controlSize(.large)
                        .tint(SpentyColors.brandAccent)
                } else if viewModel.statements.isEmpty && !viewModel.showUploadSheet {
                    EmptyState(
                        icon: "doc.text.magnifyingglass",
                        title: "No Statements",
                        message: "Upload a bank statement (PDF or CSV) to reconcile transactions with your records.",
                        actionTitle: "Upload Statement"
                    ) {
                        viewModel.showUploadSheet = true
                    }
                } else {
                    statementsList
                }
            }
            .navigationTitle("Reconciliation")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.showUploadSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(SpentyColors.brandAccent)
                    }
                }
            }
            .task {
                await loadAccounts()
                await viewModel.loadStatements()
            }
            .sheet(isPresented: $viewModel.showUploadSheet) {
                uploadSheet
            }
            .alert("Enter Password", isPresented: passwordAlertBinding) {
                SecureField("Password", text: $passwordInput)
                Button("Cancel", role: .cancel) {
                    passwordInput = ""
                    viewModel.showPasswordSheet = nil
                }
                Button("Unlock") {
                    if let statement = viewModel.showPasswordSheet {
                        Task {
                            await viewModel.unlockStatement(statement.statementId, password: passwordInput)
                            passwordInput = ""
                        }
                    }
                }
            } message: {
                Text("This PDF is password-protected. Enter the password to unlock it.")
            }
            .alert("Delete Statement", isPresented: deleteAlertBinding) {
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = nil
                }
                Button("Delete", role: .destructive) {
                    if let statement = viewModel.showDeleteConfirm {
                        Task { await viewModel.deleteStatement(statement.statementId) }
                    }
                }
            } message: {
                if let statement = viewModel.showDeleteConfirm {
                    Text("Are you sure you want to delete \"\(statement.filename ?? "this statement")\"? This action cannot be undone.")
                }
            }
            .overlay {
                if let error = viewModel.errorMessage {
                    errorBanner(error)
                }
            }
        }
    }

    // MARK: - Computed Bindings

    private var passwordAlertBinding: Binding<Bool> {
        Binding(
            get: { viewModel.showPasswordSheet != nil },
            set: { if !$0 { viewModel.showPasswordSheet = nil } }
        )
    }

    private var deleteAlertBinding: Binding<Bool> {
        Binding(
            get: { viewModel.showDeleteConfirm != nil },
            set: { if !$0 { viewModel.showDeleteConfirm = nil } }
        )
    }

    // MARK: - Statements List

    private var statementsList: some View {
        ScrollView {
            LazyVStack(spacing: SpentySpacing.md) {
                ForEach(viewModel.statements) { statement in
                    NavigationLink(value: statement) {
                        statementCard(statement)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) {
                            viewModel.showDeleteConfirm = statement
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
        }
        .refreshable {
            await viewModel.refresh()
        }
        .navigationDestination(for: Statement.self) { statement in
            StatementDetailView(
                statement: statement,
                viewModel: viewModel,
                accounts: accounts
            )
        }
    }

    // MARK: - Statement Card

    private func statementCard(_ statement: Statement) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        HStack(spacing: SpentySpacing.sm) {
                            if statement.status == .passwordNeeded {
                                Image(systemName: "lock.fill")
                                    .font(.system(size: 12))
                                    .foregroundStyle(SpentyColors.warning)
                            }

                            Text(statement.filename ?? "Statement")
                                .font(SpentyFonts.subheading)
                                .foregroundStyle(SpentyColors.textPrimary)
                                .lineLimit(1)
                        }

                        if let accountName = accountName(for: statement.accountId) {
                            Text(accountName)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                    }

                    Spacer()

                    statusBadge(for: statement.status)
                }

                // Period range
                if let from = statement.periodFrom, let to = statement.periodTo {
                    HStack(spacing: SpentySpacing.xs) {
                        Image(systemName: "calendar")
                            .font(.system(size: 11))
                            .foregroundStyle(SpentyColors.textMuted)
                        Text("\(from) - \(to)")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }
                }

                // Entry count
                if let entries = statement.parsedEntries, !entries.isEmpty {
                    Text("\(entries.count) entries")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textMuted)
                }

                // Parsing progress indicator
                if statement.status == .parsing {
                    HStack(spacing: SpentySpacing.sm) {
                        ProgressView()
                            .controlSize(.small)
                            .tint(SpentyColors.info)
                        Text("Parsing statement...")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.info)
                    }
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if statement.status == .passwordNeeded {
                viewModel.showPasswordSheet = statement
            }
        }
    }

    // MARK: - Upload Sheet

    private var uploadSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: SpentySpacing.xl) {
                    SheetHeader("Upload Statement") {
                        viewModel.showUploadSheet = false
                    }

                    // Account picker
                    VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                        Text("Account")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker("Select Account", selection: $viewModel.selectedAccountId) {
                            Text("Select an account")
                                .tag(String?.none)

                            ForEach(accounts) { account in
                                Text(account.name)
                                    .tag(Optional(account.accountId))
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(SpentyColors.textPrimary)
                        .padding(SpentySpacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(SpentyColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: SpentyRadius.md)
                                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                        )
                    }

                    // Sub-type picker
                    VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                        Text("Statement Type")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker("Statement Type", selection: $viewModel.selectedSubType) {
                            Text("Auto-detect")
                                .tag(String?.none)
                            Text("Bank Statement")
                                .tag(Optional("bank"))
                            Text("Credit Card")
                                .tag(Optional("credit_card"))
                            Text("Loan Statement")
                                .tag(Optional("loan"))
                        }
                        .pickerStyle(.menu)
                        .tint(SpentyColors.textPrimary)
                        .padding(SpentySpacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(SpentyColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: SpentyRadius.md)
                                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                        )
                    }

                    // Period pickers
                    HStack(spacing: SpentySpacing.md) {
                        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                            Text("Period From")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)

                            DatePicker(
                                "From",
                                selection: Binding(
                                    get: { viewModel.periodFrom ?? Date() },
                                    set: { viewModel.periodFrom = $0 }
                                ),
                                displayedComponents: .date
                            )
                            .labelsHidden()
                            .tint(SpentyColors.brandAccent)
                        }

                        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                            Text("Period To")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)

                            DatePicker(
                                "To",
                                selection: Binding(
                                    get: { viewModel.periodTo ?? Date() },
                                    set: { viewModel.periodTo = $0 }
                                ),
                                displayedComponents: .date
                            )
                            .labelsHidden()
                            .tint(SpentyColors.brandAccent)
                        }
                    }

                    // File picker button
                    PrimaryButton(
                        "Choose File",
                        icon: "doc.badge.plus",
                        isLoading: viewModel.isUploading,
                        isDisabled: !viewModel.canUpload,
                        isFullWidth: true
                    ) {
                        showFileImporter = true
                    }

                    if !viewModel.canUpload {
                        Text("Please select an account before uploading.")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.warning)
                    }
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
            .background(SpentyColors.bgPrimary)
            .fileImporter(
                isPresented: $showFileImporter,
                allowedContentTypes: [UTType.pdf, UTType.commaSeparatedText],
                allowsMultipleSelection: false
            ) { result in
                handleFileSelection(result)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        viewModel.showUploadSheet = false
                    }
                    .foregroundStyle(SpentyColors.brandAccent)
                }
            }
        }
        .presentationDetents([.large])
    }

    // MARK: - File Handling

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else {
                viewModel.errorMessage = "Cannot access the selected file."
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            do {
                let data = try Data(contentsOf: url)
                let fileName = url.lastPathComponent
                let mimeType = url.pathExtension.lowercased() == "pdf"
                    ? "application/pdf"
                    : "text/csv"

                Task {
                    await viewModel.uploadStatement(data: data, name: fileName, mimeType: mimeType)
                    viewModel.showUploadSheet = false
                }
            } catch {
                viewModel.errorMessage = "Failed to read file."
            }

        case .failure:
            viewModel.errorMessage = "File selection failed."
        }
    }

    // MARK: - Helpers

    private func statusBadge(for status: StatementStatus?) -> some View {
        let (label, bgColor, fgColor) = statusInfo(status)

        return Text(label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(fgColor)
            .padding(.horizontal, SpentySpacing.sm)
            .padding(.vertical, SpentySpacing.xs)
            .background(bgColor)
            .clipShape(Capsule())
    }

    private func statusInfo(_ status: StatementStatus?) -> (String, Color, Color) {
        switch status {
        case .parsing:
            return ("Parsing", SpentyColors.info.opacity(0.15), SpentyColors.info)
        case .ready:
            return ("Ready", SpentyColors.warning.opacity(0.15), SpentyColors.warning)
        case .reconciled:
            return ("Reconciled", SpentyColors.success.opacity(0.15), SpentyColors.success)
        case .failed:
            return ("Failed", SpentyColors.danger.opacity(0.15), SpentyColors.danger)
        case .passwordNeeded:
            return ("Locked", SpentyColors.warning.opacity(0.15), SpentyColors.warning)
        case .none:
            return ("Unknown", SpentyColors.textMuted.opacity(0.15), SpentyColors.textMuted)
        }
    }

    private func accountName(for accountId: String?) -> String? {
        guard let accountId else { return nil }
        return accounts.first(where: { $0.accountId == accountId })?.name
    }

    private func loadAccounts() async {
        do {
            let repo = AccountRepository()
            accounts = try await repo.getAccounts()
        } catch {
            // Silently fail; accounts picker will be empty
        }
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        VStack {
            HStack(spacing: SpentySpacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(SpentyColors.danger)
                    .font(.system(size: 14))
                Text(message)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textPrimary)
                Spacer()
                Button {
                    viewModel.errorMessage = nil
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12))
                        .foregroundStyle(SpentyColors.textMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(SpentySpacing.md)
            .background(SpentyColors.danger.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.top, SpentySpacing.sm)

            Spacer()
        }
    }
}

#Preview {
    ReconciliationView()
        .environment(AppState())
}
