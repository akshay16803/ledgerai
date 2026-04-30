package com.spentyai.app.features.emailsync

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class EmailSyncViewModel(internal val repository: EmailSyncRepository) : ViewModel() {

    // Data
    var gmailAccounts by mutableStateOf<List<EmailAccount>>(emptyList()); private set
    var outlookAccounts by mutableStateOf<List<EmailAccount>>(emptyList()); private set
    var smsStats by mutableStateOf<SMSSyncStats?>(null); private set
    var syncStatsResponse by mutableStateOf<EmailSyncStatsResponse?>(null); private set
    var pendingTransactions by mutableStateOf<List<PendingTransaction>>(emptyList()); private set

    // Accounts & Categories for edit form
    var accounts by mutableStateOf<List<Account>>(emptyList()); private set
    var categories by mutableStateOf<List<Category>>(emptyList()); private set

    // Loading States
    var isLoading by mutableStateOf(false); private set
    var isConnecting by mutableStateOf(false); private set
    var isSyncing by mutableStateOf(false); private set
    var isRetrying by mutableStateOf(false); private set
    var isLoadingPending by mutableStateOf(false); private set
    var isLoadingSource by mutableStateOf(false); private set

    // UI State
    var errorMessage by mutableStateOf<String?>(null)
    var successMessage by mutableStateOf<String?>(null)
    var showDisconnectConfirm by mutableStateOf(false)
    var disconnectProvider by mutableStateOf<String?>(null)
    var disconnectEmail by mutableStateOf<String?>(null)

    // Pending Review Edit
    var editingTransaction by mutableStateOf<PendingTransaction?>(null)
    var showEditSheet by mutableStateOf(false)
    var editDescription by mutableStateOf("")
    var editAmount by mutableStateOf("")
    var editAccountId by mutableStateOf("")
    var editCategoryId by mutableStateOf("")
    var editSubcategoryId by mutableStateOf("")
    var editTransactionType by mutableStateOf("expense")

    // View Source
    var sourceContent by mutableStateOf<SourceContent?>(null)
    var showSourceSheet by mutableStateOf(false)

    // Selection for bulk actions
    var selectedTransactionIds by mutableStateOf<Set<String>>(emptySet())

    // OAuth URL (to be opened by the screen)
    var oauthUrl by mutableStateOf<String?>(null)

    // Computed
    val totalConnectedAccounts: Int get() = gmailAccounts.size + outlookAccounts.size
    val hasAnyAccount: Boolean get() = gmailAccounts.isNotEmpty() || outlookAccounts.isNotEmpty()
    val pendingReviewCount: Int get() = syncStatsResponse?.pendingReview ?: 0
    val isAnySyncing: Boolean
        get() = gmailAccounts.any { it.syncing == true } ||
                outlookAccounts.any { it.syncing == true } ||
                syncStatsResponse?.isProcessing == true

    val allSelected: Boolean
        get() = pendingTransactions.isNotEmpty() && selectedTransactionIds.size == pendingTransactions.size

    val filteredCategories: List<Category>
        get() = categories.filter { cat ->
            val catType = cat.categoryType?.lowercase() ?: return@filter true
            catType == editTransactionType
        }

    val subcategories: List<Category>
        get() {
            if (editCategoryId.isEmpty()) return emptyList()
            return categories.firstOrNull { it.id == editCategoryId }?.children ?: emptyList()
        }

    // Load All Data
    fun loadAll() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null

            val gmail = async { loadGmailStatus() }
            val outlook = async { loadOutlookStatus() }
            val stats = async { loadSyncStats() }
            val sms = async { loadSMSStats() }

            gmail.await()
            outlook.await()
            stats.await()
            sms.await()

            isLoading = false
        }
    }

    // Gmail
    fun connectGmail() {
        viewModelScope.launch {
            isConnecting = true
            errorMessage = null

            when (val r = repository.connectGmail()) {
                is ApiResult.Success -> {
                    r.data.authUrl?.let { oauthUrl = it }
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isConnecting = false
        }
    }

    private suspend fun loadGmailStatus() {
        when (val r = repository.gmailStatus()) {
            is ApiResult.Success -> gmailAccounts = r.data.accounts ?: emptyList()
            is ApiResult.Failure -> { /* Silently handle - may not have Gmail connected */ }
        }
    }

    fun disconnectGmail(email: String? = null) {
        val emailToDisconnect = email ?: disconnectEmail ?: return
        viewModelScope.launch {
            isLoading = true
            errorMessage = null

            when (repository.disconnectGmail(emailToDisconnect)) {
                is ApiResult.Success -> {
                    gmailAccounts = gmailAccounts.filter { it.email != emailToDisconnect }
                    successMessage = "Gmail disconnected successfully"
                    loadSyncStats()
                }
                is ApiResult.Failure -> errorMessage = "Failed to disconnect Gmail"
            }

            isLoading = false
        }
    }

    // Outlook
    fun connectOutlook() {
        viewModelScope.launch {
            isConnecting = true
            errorMessage = null

            when (val r = repository.connectOutlook()) {
                is ApiResult.Success -> {
                    r.data.authUrl?.let { oauthUrl = it }
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isConnecting = false
        }
    }

    private suspend fun loadOutlookStatus() {
        when (val r = repository.outlookStatus()) {
            is ApiResult.Success -> outlookAccounts = r.data.accounts ?: emptyList()
            is ApiResult.Failure -> { /* Silently handle */ }
        }
    }

    fun disconnectOutlook(email: String? = null) {
        val emailToDisconnect = email ?: disconnectEmail ?: return
        viewModelScope.launch {
            isLoading = true
            errorMessage = null

            when (repository.disconnectOutlook(emailToDisconnect)) {
                is ApiResult.Success -> {
                    outlookAccounts = outlookAccounts.filter { it.email != emailToDisconnect }
                    successMessage = "Outlook disconnected successfully"
                    loadSyncStats()
                }
                is ApiResult.Failure -> errorMessage = "Failed to disconnect Outlook"
            }

            isLoading = false
        }
    }

    // Sync
    fun startSync(account: EmailAccount? = null) {
        val email = account?.email ?: gmailAccounts.firstOrNull()?.email
        if (email == null) {
            errorMessage = "No Gmail account available to sync"
            return
        }

        val syncFromDate: String = run {
            val existing = account?.syncFromDate ?: gmailAccounts.firstOrNull()?.syncFromDate
            if (existing != null) {
                existing
            } else {
                val cal = Calendar.getInstance()
                cal.add(Calendar.DAY_OF_YEAR, -30)
                val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
                fmt.timeZone = TimeZone.getTimeZone("UTC")
                fmt.format(cal.time)
            }
        }

        viewModelScope.launch {
            isSyncing = true
            errorMessage = null

            when (val r = repository.startSync(email, syncFromDate)) {
                is ApiResult.Success -> {
                    successMessage = r.data.message ?: "Sync started"
                    loadSyncStats()
                    loadGmailStatus()
                    loadOutlookStatus()
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isSyncing = false
        }
    }

    fun retryPending() {
        viewModelScope.launch {
            isRetrying = true
            errorMessage = null

            val gmailEmail = gmailAccounts.firstOrNull()?.email ?: ""
            when (val r = repository.retryPending(gmailEmail)) {
                is ApiResult.Success -> {
                    val msg = r.data.message ?: "Processing ${r.data.count ?: 0} pending emails"
                    successMessage = msg
                    loadSyncStats()
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isRetrying = false
        }
    }

    // Stats
    private suspend fun loadSyncStats() {
        when (val r = repository.syncStats()) {
            is ApiResult.Success -> syncStatsResponse = r.data
            is ApiResult.Failure -> { /* Non-critical */ }
        }
    }

    private suspend fun loadSMSStats() {
        when (val r = repository.smsStats()) {
            is ApiResult.Success -> smsStats = r.data
            is ApiResult.Failure -> { /* Non-critical */ }
        }
    }

    // Pending Review
    fun loadPendingReview() {
        viewModelScope.launch {
            isLoadingPending = true
            errorMessage = null

            when (val r = repository.pendingReview()) {
                is ApiResult.Success -> pendingTransactions = r.data.transactions
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isLoadingPending = false
        }
    }

    fun approveTransaction(id: String) {
        viewModelScope.launch {
            when (repository.approveTransaction(id)) {
                is ApiResult.Success -> {
                    pendingTransactions = pendingTransactions.filter { it.id != id }
                    selectedTransactionIds = selectedTransactionIds - id
                    loadSyncStats()
                }
                is ApiResult.Failure -> errorMessage = "Failed to approve transaction"
            }
        }
    }

    fun rejectTransaction(id: String) {
        viewModelScope.launch {
            when (repository.rejectTransaction(id)) {
                is ApiResult.Success -> {
                    pendingTransactions = pendingTransactions.filter { it.id != id }
                    selectedTransactionIds = selectedTransactionIds - id
                    loadSyncStats()
                }
                is ApiResult.Failure -> errorMessage = "Failed to reject transaction"
            }
        }
    }

    fun bulkApprove() {
        if (selectedTransactionIds.isEmpty()) return
        val ids = selectedTransactionIds.toList()
        viewModelScope.launch {
            when (repository.bulkApproveTransactions(ids)) {
                is ApiResult.Success -> {
                    pendingTransactions = pendingTransactions.filter { it.id !in ids }
                    selectedTransactionIds = emptySet()
                    successMessage = "Approved ${ids.size} transaction${if (ids.size == 1) "" else "s"}"
                    loadSyncStats()
                }
                is ApiResult.Failure -> errorMessage = "Bulk approve failed"
            }
        }
    }

    fun bulkReject() {
        if (selectedTransactionIds.isEmpty()) return
        val ids = selectedTransactionIds.toList()
        viewModelScope.launch {
            when (repository.bulkRejectTransactions(ids)) {
                is ApiResult.Success -> {
                    pendingTransactions = pendingTransactions.filter { it.id !in ids }
                    selectedTransactionIds = emptySet()
                    successMessage = "Rejected ${ids.size} transaction${if (ids.size == 1) "" else "s"}"
                    loadSyncStats()
                }
                is ApiResult.Failure -> errorMessage = "Bulk reject failed"
            }
        }
    }

    // Edit Transaction
    fun beginEditTransaction(transaction: PendingTransaction) {
        editingTransaction = transaction
        editDescription = transaction.description ?: ""
        editAmount = transaction.amount?.let { String.format("%.2f", it) } ?: ""
        editAccountId = transaction.accountId ?: ""
        editCategoryId = transaction.categoryId ?: ""
        editSubcategoryId = transaction.subcategoryId ?: ""
        editTransactionType = transaction.transactionType ?: "expense"
        showEditSheet = true
    }

    fun saveEditedTransaction() {
        val txn = editingTransaction ?: return
        viewModelScope.launch {
            val update = PendingTransactionUpdate(
                description = editDescription.ifEmpty { null },
                amount = editAmount.toDoubleOrNull(),
                accountId = editAccountId.ifEmpty { null },
                categoryId = editCategoryId.ifEmpty { null },
                subcategoryId = editSubcategoryId.ifEmpty { null },
                transactionType = editTransactionType.ifEmpty { null }
            )

            when (repository.updateTransaction(txn.id, update)) {
                is ApiResult.Success -> {
                    showEditSheet = false
                    editingTransaction = null
                    // Update local array in-place
                    pendingTransactions = pendingTransactions.map {
                        if (it.id == txn.id) {
                            it.copy(
                                description = update.description ?: it.description,
                                amount = update.amount ?: it.amount,
                                accountId = update.accountId ?: it.accountId,
                                categoryId = update.categoryId ?: it.categoryId,
                                transactionType = update.transactionType ?: it.transactionType
                            )
                        } else it
                    }
                    successMessage = "Transaction updated"
                }
                is ApiResult.Failure -> errorMessage = "Update failed"
            }
        }
    }

    // View Source
    fun loadSource(transaction: PendingTransaction) {
        val sourceId = transaction.sourceId
        if (sourceId == null) {
            errorMessage = "No source linked to this transaction"
            return
        }
        viewModelScope.launch {
            isLoadingSource = true
            when (val r = repository.sourceContent(sourceId)) {
                is ApiResult.Success -> {
                    sourceContent = r.data
                    showSourceSheet = true
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }
            isLoadingSource = false
        }
    }

    // Load picker data for edit form
    fun loadPickerData() {
        viewModelScope.launch {
            (repository.fetchAccounts() as? ApiResult.Success)?.let { accounts = it.data.accounts }
            (repository.fetchCategories() as? ApiResult.Success)?.let { categories = it.data }
        }
    }

    // Inline-create helpers (P0 #15) — append-or-replace local lists so a
    // freshly-created Account / Category / Subcategory is selectable in the
    // EditTransactionSheet immediately, no full refetch.
    fun upsertAccount(account: Account) {
        val existing = accounts.indexOfFirst { it.id == account.id }
        accounts = if (existing >= 0) {
            accounts.toMutableList().also { it[existing] = account }
        } else {
            accounts + account
        }
    }

    fun upsertCategory(category: Category) {
        val existing = categories.indexOfFirst { it.id == category.id }
        categories = if (existing >= 0) {
            categories.toMutableList().also { it[existing] = category }
        } else {
            categories + category
        }
    }

    fun upsertSubcategory(parentId: String, sub: Category) {
        categories = categories.map { cat ->
            if (cat.id != parentId) cat
            else {
                val existingChildren = cat.children ?: emptyList()
                val newChildren = if (existingChildren.any { it.id == sub.id }) {
                    existingChildren.map { if (it.id == sub.id) sub else it }
                } else {
                    existingChildren + sub
                }
                cat.copy(children = newChildren)
            }
        }
    }

    // Selection Helpers
    fun toggleSelection(id: String) {
        selectedTransactionIds = if (selectedTransactionIds.contains(id)) {
            selectedTransactionIds - id
        } else {
            selectedTransactionIds + id
        }
    }

    fun selectAll() {
        selectedTransactionIds = pendingTransactions.map { it.id }.toSet()
    }

    fun deselectAll() {
        selectedTransactionIds = emptySet()
    }

    // Helpers
    fun dismissError() { errorMessage = null }
    fun dismissSuccess() { successMessage = null }

    fun onOAuthComplete(provider: String) {
        viewModelScope.launch {
            successMessage = "${provider.replaceFirstChar { it.uppercase() }} connected successfully"
            if (provider == "gmail") loadGmailStatus() else loadOutlookStatus()
            loadSyncStats()
        }
    }
}
