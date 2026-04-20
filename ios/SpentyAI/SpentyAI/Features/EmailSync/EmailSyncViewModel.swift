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
        } catch {
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
        // Use provided account or default to first Gmail account
        guard let email = account?.email ?? gmailAccounts.first?.email else {
            handleError(NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "No Gmail account available to sync"]))
            return
        }

        // Use the account's syncFromDate or default to 30 days ago
        let syncFromDate: String
        if let existingDate = account?.syncFromDate ?? gmailAccounts.first?.syncFromDate {
            let formatter = ISO8601DateFormatter()
            syncFromDate = formatter.string(from: existingDate)
        } else {
            let thirtyDaysAgo = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
            let formatter = ISO8601DateFormatter()
            syncFromDate = formatter.string(from: thirtyDaysAgo)
        }

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
                            self?.showSuccessMessage("\(provider.capitalized) connected successfully")
                            if provider == "gmail" {
                                await self?.loadGmailStatus()
                            } else {
                                await self?.loadOutlookStatus()
                            }
                            await self?.loadSyncStats()
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
