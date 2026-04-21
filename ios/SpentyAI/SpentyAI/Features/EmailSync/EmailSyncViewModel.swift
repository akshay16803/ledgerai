import Foundation
import AuthenticationServices

/// Lightweight presentation anchor for ASWebAuthenticationSession
private final class AuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        ASPresentationAnchor()
    }
}

@Observable
final class EmailSyncViewModel {

    // MARK: - State

    var gmailAccounts: [EmailAccount] = []
    var outlookAccounts: [EmailAccount] = []
    var smsStats: SMSSyncStats?
    var syncStatsResponse: EmailSyncStatsResponse?
    var pendingTransactions: [PendingTransaction] = []

    var isLoading = false
    var isConnecting = false
    var isSyncing = false
    var isRetrying = false
    var isLoadingPending = false

    var errorMessage = ""
    var showError = false
    var successMessage = ""
    var showSuccess = false

    var showDisconnectConfirm = false
    var disconnectProvider: String?
    var disconnectEmail: String?

    // MARK: - Pending Review Edit

    var editingTransaction: PendingTransaction?
    var showEditSheet = false
    var editDescription = ""
    var editAmount = ""
    var editAccountId = ""
    var editCategoryId = ""
    var editSubcategoryId = ""
    var editTransactionType = "expense"

    // MARK: - View Source

    var sourceContent: SourceContent?
    var showSourceSheet = false
    var isLoadingSource = false

    // MARK: - Selection for bulk actions

    var selectedTransactionIds: Set<String> = []

    // MARK: - Sync Date Picker
    // When an account has no syncFromDate yet (first-time sync, or after Reset Data),
    // we ask the user to pick a start date instead of silently defaulting.

    var showSyncDatePicker = false
    var pendingSyncAccount: EmailAccount?
    var pendingSyncProvider: String = "gmail"
    var pendingSyncDate: Date = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()

    /// Set to the provider name ("gmail" / "outlook") right after a successful OAuth.
    /// The view observes this and shows the sync-date picker once the OAuth web view
    /// is fully dismissed, avoiding SwiftUI sheet-presentation race conditions.
    var justConnectedProvider: String?

    // MARK: - Dependencies

    private let repository: EmailSyncRepository
    private let authContextProvider = AuthPresentationContext()

    // MARK: - Init

    init(repository: EmailSyncRepository = .shared) {
        self.repository = repository
    }

    // MARK: - Load All Data

    @MainActor
    func loadAll() async {
        isLoading = true
        showError = false

        async let gmailTask: () = loadGmailStatus()
        async let outlookTask: () = loadOutlookStatus()
        async let statsTask: () = loadSyncStats()
        async let smsTask: () = loadSMSStats()

        _ = await (gmailTask, outlookTask, statsTask, smsTask)

        isLoading = false

        // After every full load, check whether any connected account still
        // needs a sync-start date (first-time connect, or post-Reset reconnect).
        // This ensures the date picker appears even if the OAuth callback's
        // prompt was missed due to timing, network issues, or the user
        // navigating away and back.
        promptForSyncDateIfNeeded()
    }

    // MARK: - Gmail

    @MainActor
    func connectGmail() async {
        isConnecting = true
        showError = false

        do {
            let response = try await repository.connectGmail()
            if let urlString = response.authUrl, let url = URL(string: urlString) {
                await openOAuthSession(url: url, provider: "gmail")
            }
        } catch {
            handleError(error)
        }

        isConnecting = false
    }

    @MainActor
    func loadGmailStatus() async {
        do {
            let status = try await repository.gmailStatus()
            gmailAccounts = status.accounts ?? []
            print("[SyncDatePicker] loadGmailStatus succeeded: \(gmailAccounts.count) accounts")
            for a in gmailAccounts {
                print("[SyncDatePicker]   email=\(a.email ?? "nil") syncFromDate=\(String(describing: a.syncFromDate)) provider=\(a.provider ?? "nil")")
            }
        } catch {
            print("[SyncDatePicker] loadGmailStatus FAILED: \(error)")
            // Silently handle — may not have Gmail connected
        }
    }

    @MainActor
    func disconnectGmail(email: String? = nil) async {
        guard let emailToDisconnect = email ?? disconnectEmail else {
            handleError(NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "No email address specified for disconnect"]))
            return
        }
        isLoading = true
        showError = false

        do {
            _ = try await repository.disconnectGmail(email: emailToDisconnect)
            gmailAccounts.removeAll { $0.email == emailToDisconnect }
            showSuccessMessage("Gmail disconnected successfully")
            await loadSyncStats()
        } catch {
            handleError(error)
        }

        isLoading = false
    }

    // MARK: - Outlook

    @MainActor
    func connectOutlook() async {
        isConnecting = true
        showError = false

        do {
            let response = try await repository.connectOutlook()
            if let urlString = response.authUrl, let url = URL(string: urlString) {
                await openOAuthSession(url: url, provider: "outlook")
            }
        } catch {
            handleError(error)
        }

        isConnecting = false
    }

    @MainActor
    func loadOutlookStatus() async {
        do {
            let status = try await repository.outlookStatus()
            outlookAccounts = status.accounts ?? []
        } catch {
            // Silently handle — may not have Outlook connected
        }
    }

    @MainActor
    func disconnectOutlook(email: String? = nil) async {
        guard let emailToDisconnect = email ?? disconnectEmail else {
            handleError(NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "No email address specified for disconnect"]))
            return
        }
        isLoading = true
        showError = false

        do {
            _ = try await repository.disconnectOutlook(email: emailToDisconnect)
            outlookAccounts.removeAll { $0.email == emailToDisconnect }
            showSuccessMessage("Outlook disconnected successfully")
            await loadSyncStats()
        } catch {
            handleError(error)
        }

        isLoading = false
    }

    // MARK: - Sync

    @MainActor
    func startSync(forAccount account: EmailAccount? = nil) async {
        // Resolve the account the user is about to sync (explicit > first Gmail > first Outlook).
        let resolved: EmailAccount? = account ?? gmailAccounts.first ?? outlookAccounts.first
        guard let email = resolved?.email else {
            handleError(NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "No email account available to sync"]))
            return
        }

        // Determine the provider for this account
        let provider: String
        if gmailAccounts.contains(where: { $0.email == email }) {
            provider = "gmail"
        } else {
            provider = "outlook"
        }

        // First-time sync (or post-Reset reconnect): no saved start date.
        // Ask the user which date to start scanning emails from, instead of
        // silently defaulting.
        guard let existingDate = resolved?.syncFromDate else {
            pendingSyncAccount = resolved
            pendingSyncProvider = provider
            pendingSyncDate = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
            showSyncDatePicker = true
            return
        }

        let formatter = ISO8601DateFormatter()
        let syncFromDate = formatter.string(from: existingDate)

        isSyncing = true
        showError = false

        do {
            let response = try await repository.startSync(gmailEmail: email, syncFromDate: syncFromDate)
            showSuccessMessage(response.message ?? "Sync started")
            await loadSyncStats()
            await loadGmailStatus()
            await loadOutlookStatus()
        } catch {
            handleError(error)
        }

        isSyncing = false
    }

    /// Called from the sync-date picker sheet once the user confirms their choice.
    /// Fires the sync with the picked date and clears the pending state.
    @MainActor
    func confirmSyncDate() async {
        guard let email = pendingSyncAccount?.email ?? gmailAccounts.first?.email ?? outlookAccounts.first?.email else {
            showSyncDatePicker = false
            handleError(NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "No email account available to sync"]))
            return
        }

        // Close the sheet first so the sync progress UI becomes visible.
        showSyncDatePicker = false
        let formatter = ISO8601DateFormatter()
        let syncFromDate = formatter.string(from: pendingSyncDate)

        isSyncing = true
        showError = false

        do {
            let response = try await repository.startSync(gmailEmail: email, syncFromDate: syncFromDate)
            showSuccessMessage(response.message ?? "Sync started")
            await loadSyncStats()
            await loadGmailStatus()
            await loadOutlookStatus()
        } catch {
            handleError(error)
        }

        isSyncing = false
        pendingSyncAccount = nil
    }

    /// Called when the user cancels the sync-date picker sheet.
    @MainActor
    func cancelSyncDatePicker() {
        showSyncDatePicker = false
        pendingSyncAccount = nil
    }

    /// Proactively opens the sync-date picker if any connected account has
    /// no saved start date (first-time connect, or reconnect after Reset).
    /// Also called at the end of `loadAll()` as a safety net.
    @MainActor
    func promptForSyncDateIfNeeded() {
        guard !showSyncDatePicker else { return }

        // Check Gmail accounts first, then Outlook
        if let account = gmailAccounts.first(where: { $0.syncFromDate == nil }) {
            print("[SyncDatePicker] Found Gmail account without syncFromDate: \(account.email ?? "nil")")
            pendingSyncAccount = account
            pendingSyncProvider = "gmail"
            pendingSyncDate = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
            showSyncDatePicker = true
        } else if let account = outlookAccounts.first(where: { $0.syncFromDate == nil }) {
            print("[SyncDatePicker] Found Outlook account without syncFromDate: \(account.email ?? "nil")")
            pendingSyncAccount = account
            pendingSyncProvider = "outlook"
            pendingSyncDate = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
            showSyncDatePicker = true
        } else {
            print("[SyncDatePicker] No accounts need sync date. Gmail: \(gmailAccounts.count), Outlook: \(outlookAccounts.count)")
            for a in gmailAccounts {
                print("[SyncDatePicker]   Gmail \(a.email ?? "nil") syncFromDate=\(String(describing: a.syncFromDate))")
            }
        }
    }

    /// Called by the view when `justConnectedProvider` transitions from nil to a value.
    /// Uses a generous delay so the ASWebAuthenticationSession web view finishes
    /// its full dismiss animation before we present the sync-date sheet.
    @MainActor
    func showSyncPickerForJustConnected() async {
        guard let provider = justConnectedProvider else { return }
        print("[SyncDatePicker] showSyncPickerForJustConnected provider=\(provider)")

        // Clear the flag immediately so we don't fire twice.
        justConnectedProvider = nil

        // Wait 1.5s for the OAuth web view to fully dismiss.
        try? await Task.sleep(nanoseconds: 1_500_000_000)

        // First try the standard check (relies on API having returned data).
        promptForSyncDateIfNeeded()

        // If promptForSyncDateIfNeeded didn't open the picker (e.g., API call
        // failed or returned unexpected data), force-open it using what we know.
        if !showSyncDatePicker {
            print("[SyncDatePicker] Standard prompt didn't fire — force-opening picker for \(provider)")
            let accounts = provider == "gmail" ? gmailAccounts : outlookAccounts
            if let account = accounts.first {
                // Use the first account even if syncFromDate isn't nil —
                // this handles the edge case where the API already has a date.
                pendingSyncAccount = account
            } else {
                // API call must have failed; create a minimal placeholder.
                // confirmSyncDate() only needs pendingSyncAccount.email.
                print("[SyncDatePicker] No accounts found — creating placeholder")
                pendingSyncAccount = nil  // confirmSyncDate will use gmailAccounts.first
            }
            pendingSyncProvider = provider
            pendingSyncDate = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
            showSyncDatePicker = true
        }
    }

    @MainActor
    func retryPending() async {
        isRetrying = true
        showError = false

        do {
            let gmailEmail = gmailAccounts.first?.email
            let response = try await repository.retryPending(gmailEmail: gmailEmail)
            let msg = response.message ?? "Processing \(response.count ?? 0) pending emails"
            showSuccessMessage(msg)
            await loadSyncStats()
        } catch {
            handleError(error)
        }

        isRetrying = false
    }

    // MARK: - Stats

    @MainActor
    func loadSyncStats() async {
        do {
            syncStatsResponse = try await repository.syncStats()
        } catch {
            // Non-critical
        }
    }

    @MainActor
    func loadSMSStats() async {
        do {
            smsStats = try await repository.smsStats()
        } catch {
            // Non-critical
        }
    }

    // MARK: - Pending Review

    @MainActor
    func loadPendingReview() async {
        isLoadingPending = true
        showError = false

        do {
            pendingTransactions = try await repository.pendingReview()
        } catch {
            handleError(error)
        }

        isLoadingPending = false
    }

    @MainActor
    func approveTransaction(_ id: String) async {
        do {
            _ = try await repository.approveTransaction(id)
            pendingTransactions.removeAll { $0.id == id }
            selectedTransactionIds.remove(id)
            Task { await loadSyncStats() }
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func rejectTransaction(_ id: String) async {
        do {
            _ = try await repository.rejectTransaction(id)
            pendingTransactions.removeAll { $0.id == id }
            selectedTransactionIds.remove(id)
            Task { await loadSyncStats() }
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func bulkApprove() async {
        guard !selectedTransactionIds.isEmpty else { return }
        let ids = Array(selectedTransactionIds)

        do {
            _ = try await repository.bulkApproveTransactions(ids: ids)
            pendingTransactions.removeAll { ids.contains($0.id) }
            selectedTransactionIds.removeAll()
            showSuccessMessage("Approved \(ids.count) transaction\(ids.count == 1 ? "" : "s")")
            Task { await loadSyncStats() }
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func bulkReject() async {
        guard !selectedTransactionIds.isEmpty else { return }
        let ids = Array(selectedTransactionIds)

        do {
            _ = try await repository.bulkRejectTransactions(ids: ids)
            pendingTransactions.removeAll { ids.contains($0.id) }
            selectedTransactionIds.removeAll()
            showSuccessMessage("Rejected \(ids.count) transaction\(ids.count == 1 ? "" : "s")")
            Task { await loadSyncStats() }
        } catch {
            handleError(error)
        }
    }

    @MainActor
    func beginEditTransaction(_ transaction: PendingTransaction) {
        editingTransaction = transaction
        editDescription = transaction.description ?? ""
        editAmount = transaction.amount.map { String(format: "%.2f", $0) } ?? ""
        editAccountId = transaction.accountId ?? ""
        editCategoryId = transaction.categoryId ?? ""
        editSubcategoryId = ""
        editTransactionType = transaction.transactionType ?? "expense"
        showEditSheet = true
    }

    @MainActor
    func saveEditedTransaction() async {
        guard let txn = editingTransaction else { return }

        let update = PendingTransactionUpdate(
            description: editDescription.isEmpty ? nil : editDescription,
            amount: Double(editAmount),
            accountId: editAccountId.isEmpty ? nil : editAccountId,
            categoryId: editCategoryId.isEmpty ? nil : editCategoryId,
            subcategoryId: editSubcategoryId.isEmpty ? nil : editSubcategoryId,
            transactionType: editTransactionType.isEmpty ? nil : editTransactionType
        )

        do {
            _ = try await repository.updateTransaction(txn.id, body: update)
            showEditSheet = false
            editingTransaction = nil

            // Update the local array in-place instead of refetching the entire list
            if let index = pendingTransactions.firstIndex(where: { $0.id == txn.id }) {
                var updated = pendingTransactions[index]
                if let desc = update.description { updated.description = desc }
                if let amt = update.amount { updated.amount = amt }
                if let acct = update.accountId { updated.accountId = acct }
                if let cat = update.categoryId { updated.categoryId = cat }
                pendingTransactions[index] = updated
            }

            showSuccessMessage("Transaction updated")
        } catch {
            handleError(error)
        }
    }

    // MARK: - View Source

    @MainActor
    func loadSource(for transaction: PendingTransaction) async {
        guard let sourceId = transaction.sourceId else {
            errorMessage = "No source linked to this transaction"
            showError = true
            return
        }

        isLoadingSource = true
        do {
            sourceContent = try await repository.sourceContent(id: sourceId)
            showSourceSheet = true
        } catch {
            handleError(error)
        }
        isLoadingSource = false
    }

    // MARK: - Selection Helpers

    func toggleSelection(_ id: String) {
        if selectedTransactionIds.contains(id) {
            selectedTransactionIds.remove(id)
        } else {
            selectedTransactionIds.insert(id)
        }
    }

    func selectAll() {
        selectedTransactionIds = Set(pendingTransactions.map(\.id))
    }

    func deselectAll() {
        selectedTransactionIds.removeAll()
    }

    var allSelected: Bool {
        !pendingTransactions.isEmpty && selectedTransactionIds.count == pendingTransactions.count
    }

    // MARK: - OAuth

    @MainActor
    private func openOAuthSession(url: URL, provider: String) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "spentyai"
            ) { [weak self] callbackURL, error in
                if let error {
                    // User explicitly cancelled — don't show an error
                    if (error as NSError).code != ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        Task { @MainActor in
                            self?.errorMessage = "Authentication failed. Please try again."
                            self?.showError = true
                        }
                    }
                } else if let callbackURL {
                    // Check callback URL for error param from backend
                    let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)
                    let errorParam = components?.queryItems?.first(where: { $0.name == "error" })?.value
                    if let errorParam, !errorParam.isEmpty {
                        Task { @MainActor in
                            self?.errorMessage = "Connection failed: \(errorParam.replacingOccurrences(of: "_", with: " "))"
                            self?.showError = true
                        }
                    } else {
                        Task { @MainActor in
                            guard let self else { return }
                            self.showSuccessMessage("\(provider.capitalized) connected successfully")

                            // Reload accounts so the UI is up to date.
                            if provider == "gmail" {
                                await self.loadGmailStatus()
                            } else {
                                await self.loadOutlookStatus()
                            }
                            await self.loadSyncStats()

                            // Signal that an OAuth just completed. The view watches
                            // this flag and shows the sync-date picker after the
                            // ASWebAuthenticationSession web view finishes
                            // its dismiss animation (~1-1.5 s).
                            print("[SyncDatePicker] OAuth succeeded for \(provider). Setting justConnectedProvider.")
                            self.justConnectedProvider = provider
                        }
                    }
                }
                continuation.resume()
            }
            session.presentationContextProvider = self.authContextProvider
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }

    // MARK: - Computed

    var totalConnectedAccounts: Int {
        gmailAccounts.count + outlookAccounts.count
    }

    var hasAnyAccount: Bool {
        !gmailAccounts.isEmpty || !outlookAccounts.isEmpty
    }

    var pendingReviewCount: Int {
        syncStatsResponse?.pendingReview ?? 0
    }

    var isAnySyncing: Bool {
        gmailAccounts.contains { $0.syncing == true } ||
        outlookAccounts.contains { $0.syncing == true } ||
        syncStatsResponse?.isProcessing == true
    }

    // MARK: - Helpers

    @MainActor
    private func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            errorMessage = apiError.localizedDescription
        } else {
            errorMessage = error.localizedDescription
        }
        showError = true
    }

    @MainActor
    private func showSuccessMessage(_ message: String) {
        successMessage = message
        showSuccess = true
    }
}
