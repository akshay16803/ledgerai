package com.spentyai.app.features.reconciliation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

class ReconciliationViewModel(private val repository: ReconciliationRepository) : ViewModel() {

    // Data
    var statements by mutableStateOf<List<Statement>>(emptyList()); private set
    var accounts by mutableStateOf<List<Account>>(emptyList()); private set
    var accountSubTypes by mutableStateOf<List<AccountSubType>>(emptyList()); private set
    var categories by mutableStateOf<List<Category>>(emptyList()); private set
    var activeStatement by mutableStateOf<Statement?>(null); private set
    var parsedEntries by mutableStateOf<List<ParsedEntry>>(emptyList()); private set
    var reconciliationResult by mutableStateOf<ReconciliationResult?>(null); private set

    // Upload State
    var selectedSubType by mutableStateOf("")
    var selectedAccountId by mutableStateOf("")
    var periodFrom by mutableStateOf(Date())
    var periodTo by mutableStateOf(Date())
    var isUploading by mutableStateOf(false); private set

    // UI State
    var isLoading by mutableStateOf(false); private set
    var isReconciling by mutableStateOf(false); private set
    var isProcessing by mutableStateOf(false); private set
    var showUploadSheet by mutableStateOf(false)
    var showUnlockSheet by mutableStateOf(false)
    var unlockPassword by mutableStateOf("")
    var errorMessage by mutableStateOf<String?>(null)
    var successMessage by mutableStateOf<String?>(null)

    // Polling
    private var pollingJob: Job? = null

    val filteredAccounts: List<Account>
        get() = if (selectedSubType.isEmpty()) accounts
        else accounts.filter { it.subType?.lowercase() == selectedSubType.lowercase() }

    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    // Load
    fun loadInitial() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null

            val stmts = async { repository.fetchStatements() }
            val accts = async { repository.fetchAccounts() }
            val subs = async { repository.fetchAccountSubTypes() }
            val cats = async { repository.fetchCategories() }

            when (val r = stmts.await()) {
                is ApiResult.Success -> statements = r.data.statements
                is ApiResult.Failure -> errorMessage = r.error.message
            }
            (accts.await() as? ApiResult.Success)?.let { accounts = it.data.accounts }
            (subs.await() as? ApiResult.Success)?.let { accountSubTypes = it.data }
            (cats.await() as? ApiResult.Success)?.let { categories = it.data }

            isLoading = false
        }
    }

    fun refreshStatements() {
        viewModelScope.launch {
            errorMessage = null
            when (val r = repository.fetchStatements()) {
                is ApiResult.Success -> statements = r.data.statements
                is ApiResult.Failure -> errorMessage = r.error.message
            }
        }
    }

    // Statement Detail
    fun loadStatement(id: String) {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null

            when (val r = repository.fetchStatement(id)) {
                is ApiResult.Success -> {
                    activeStatement = r.data
                    reconciliationResult = r.data.reconciliation
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            when (val r = repository.fetchEntries(id)) {
                is ApiResult.Success -> parsedEntries = r.data.entries
                is ApiResult.Failure -> if (errorMessage == null) errorMessage = "Failed to load entries"
            }

            isLoading = false
            startParsePollingIfNeeded(id)
        }
    }

    private fun startParsePollingIfNeeded(statementId: String) {
        if (activeStatement?.status?.lowercase() != "parsing") return
        stopParsePolling()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(2000)
                when (val r = repository.fetchStatement(statementId)) {
                    is ApiResult.Success -> {
                        activeStatement = r.data
                        reconciliationResult = r.data.reconciliation
                        if (r.data.status?.lowercase() != "parsing") {
                            (repository.fetchEntries(statementId) as? ApiResult.Success)?.let {
                                parsedEntries = it.data.entries
                            }
                            updateStatementInList(r.data)
                            break
                        }
                    }
                    is ApiResult.Failure -> break
                }
            }
        }
    }

    fun stopParsePolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    // Reconcile
    fun reconcile(statementId: String) {
        viewModelScope.launch {
            isReconciling = true
            errorMessage = null

            when (val r = repository.reconcile(statementId)) {
                is ApiResult.Success -> {
                    val updated = (repository.fetchStatement(statementId) as? ApiResult.Success)?.data
                    if (updated != null) {
                        activeStatement = updated
                        reconciliationResult = updated.reconciliation ?: ReconciliationResult(
                            summary = r.data.summary,
                            matched = r.data.matched,
                            missingFromLedger = r.data.missingFromLedger,
                            missingFromStatement = r.data.missingFromStatement,
                            conflicts = r.data.conflicts
                        )
                        updateStatementInList(updated)
                    }
                    successMessage = "Reconciliation complete."
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isReconciling = false
        }
    }

    // Add Missing
    fun addMissingToLedger(statementId: String, entryIndices: List<Int>? = null) {
        viewModelScope.launch {
            isProcessing = true
            errorMessage = null

            val indices = entryIndices ?: run {
                val count = reconciliationResult?.missingFromLedgerCount ?: 0
                if (count > 0) (0 until count).toList() else emptyList()
            }
            val body = AddMissingBody(entryIndices = indices)

            when (val r = repository.addMissingToLedger(statementId, body)) {
                is ApiResult.Success -> {
                    val updated = (repository.fetchStatement(statementId) as? ApiResult.Success)?.data
                    if (updated != null) { activeStatement = updated; updateStatementInList(updated) }
                    successMessage = r.data.message ?: "Missing entries added to ledger."
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isProcessing = false
        }
    }

    // Re-audit
    fun reaudit(statementId: String) {
        viewModelScope.launch {
            isProcessing = true
            errorMessage = null

            when (repository.reaudit(statementId)) {
                is ApiResult.Success -> {
                    val updated = (repository.fetchStatement(statementId) as? ApiResult.Success)?.data
                    if (updated != null) {
                        activeStatement = updated
                        reconciliationResult = updated.reconciliation
                        updateStatementInList(updated)
                    }
                    successMessage = "Re-audit started."
                }
                is ApiResult.Failure -> errorMessage = "Re-audit failed"
            }

            isProcessing = false
        }
    }

    // Unlock
    fun unlock(statementId: String) {
        if (unlockPassword.isEmpty()) { errorMessage = "Please enter the PDF password."; return }
        viewModelScope.launch {
            isProcessing = true
            errorMessage = null

            when (repository.unlock(statementId, UnlockBody(password = unlockPassword))) {
                is ApiResult.Success -> {
                    val updated = (repository.fetchStatement(statementId) as? ApiResult.Success)?.data
                    if (updated != null) {
                        activeStatement = updated
                        parsedEntries = updated.parsedEntries ?: emptyList()
                        updateStatementInList(updated)
                    }
                    showUnlockSheet = false
                    unlockPassword = ""
                    successMessage = "Statement unlocked and parsing."
                }
                is ApiResult.Failure -> errorMessage = "Unlock failed"
            }

            isProcessing = false
        }
    }

    // Entry Category Update
    fun updateEntryCategory(statementId: String, index: Int, categoryId: String?, categoryName: String?) {
        viewModelScope.launch {
            errorMessage = null
            val body = EntryUpdateBody(categoryId = categoryId, categoryName = categoryName)
            when (val r = repository.updateEntry(statementId, index, body)) {
                is ApiResult.Success -> {
                    val updatedEntry = r.data.entry
                    val entryIndex = r.data.entryIndex
                    if (updatedEntry != null && entryIndex != null && entryIndex < parsedEntries.size) {
                        parsedEntries = parsedEntries.toMutableList().apply { set(entryIndex, updatedEntry) }
                    }
                    (repository.fetchStatement(statementId) as? ApiResult.Success)?.let { activeStatement = it.data }
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }
        }
    }

    // Bulk Categorize
    fun bulkCategorize(statementId: String, categoryId: String) {
        viewModelScope.launch {
            isProcessing = true
            errorMessage = null

            val updates = parsedEntries.mapIndexed { index, _ ->
                BulkCategorizeEntry(entryIndex = index, categoryId = categoryId, subcategoryId = null)
            }
            val body = BulkCategorizeBody(updates = updates)

            when (repository.bulkCategorize(statementId, body)) {
                is ApiResult.Success -> {
                    val updated = (repository.fetchStatement(statementId) as? ApiResult.Success)?.data
                    if (updated != null) {
                        activeStatement = updated
                        parsedEntries = updated.parsedEntries ?: parsedEntries
                    }
                    successMessage = "All entries categorized."
                }
                is ApiResult.Failure -> errorMessage = "Bulk categorize failed"
            }

            isProcessing = false
        }
    }

    // Approve / Reject
    fun approveStatement(id: String) {
        viewModelScope.launch {
            isProcessing = true
            errorMessage = null
            when (repository.approveStatement(id)) {
                is ApiResult.Success -> {
                    val updated = (repository.fetchStatement(id) as? ApiResult.Success)?.data
                    if (updated != null) { activeStatement = updated; updateStatementInList(updated) }
                    successMessage = "Statement approved."
                }
                is ApiResult.Failure -> errorMessage = "Approve failed"
            }
            isProcessing = false
        }
    }

    fun rejectStatement(id: String) {
        viewModelScope.launch {
            isProcessing = true
            errorMessage = null
            when (repository.rejectStatement(id)) {
                is ApiResult.Success -> {
                    val updated = (repository.fetchStatement(id) as? ApiResult.Success)?.data
                    if (updated != null) { activeStatement = updated; updateStatementInList(updated) }
                    successMessage = "Statement rejected."
                }
                is ApiResult.Failure -> errorMessage = "Reject failed"
            }
            isProcessing = false
        }
    }

    // Delete
    fun deleteStatement(id: String) {
        viewModelScope.launch {
            errorMessage = null
            when (repository.deleteStatement(id)) {
                is ApiResult.Success -> statements = statements.filter { it.id != id }
                is ApiResult.Failure -> errorMessage = "Delete failed"
            }
        }
    }

    // Helpers
    fun accountName(id: String?): String {
        if (id == null) return "Unknown"
        return accounts.firstOrNull { it.id == id }?.name ?: "Unknown"
    }

    fun categoryName(id: String?): String {
        if (id == null) return "Uncategorized"
        return categories.firstOrNull { it.id == id }?.name ?: "Uncategorized"
    }

    fun resetUploadForm() {
        selectedSubType = ""
        selectedAccountId = ""
        periodFrom = Date()
        periodTo = Date()
    }

    fun dismissError() { errorMessage = null }
    fun dismissSuccess() { successMessage = null }

    private fun updateStatementInList(statement: Statement) {
        statements = statements.map { if (it.id == statement.id) statement else it }
    }

    override fun onCleared() {
        super.onCleared()
        stopParsePolling()
    }
}
