package com.spentyai.app.features.transactions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class TransactionViewMode(val label: String) {
    LIST("List"),
    LEDGER("Ledger")
}

data class TransactionsUiState(
    // Data
    val transactions: List<Transaction> = emptyList(),
    val total: Int = 0,
    val accounts: List<Account> = emptyList(),
    val categories: List<Category> = emptyList(),

    // Filters
    val filterType: String = "All",
    val filterAccountId: String = "",
    val searchQuery: String = "",
    val dateFrom: String? = null,
    val dateTo: String? = null,

    // UI State
    val viewMode: TransactionViewMode = TransactionViewMode.LIST,
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val page: Int = 1,
    val hasMore: Boolean = true,
    val showForm: Boolean = false,
    val editingTransaction: Transaction? = null,
    val errorMessage: String? = null,

    // Bulk Selection
    val isSelecting: Boolean = false,
    val selectedIds: Set<String> = emptySet()
)

class TransactionsViewModel(internal val apiClient: ApiClient) : ViewModel() {

    private val repository = TransactionRepository(apiClient)
    private val pageSize = 30

    private val _uiState = MutableStateFlow(TransactionsUiState())
    val uiState: StateFlow<TransactionsUiState> = _uiState.asStateFlow()

    private val queryDateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    // MARK: - Load

    fun loadInitial() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, page = 1) }

            // Load transactions, accounts, and categories in parallel
            val txnResult = fetchTransactionsPage(1)
            val accountsResult = repository.fetchAccounts()
            val categoriesResult = repository.fetchCategories()

            when (txnResult) {
                is ApiResult.Success -> {
                    val data = txnResult.data
                    val total = data.total ?: data.transactions.size
                    _uiState.update {
                        it.copy(
                            transactions = data.transactions,
                            total = total,
                            hasMore = data.transactions.size < total
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = txnResult.error.message) }
                }
            }

            when (accountsResult) {
                is ApiResult.Success -> _uiState.update { it.copy(accounts = accountsResult.data) }
                is ApiResult.Failure -> { /* silent */ }
            }

            when (categoriesResult) {
                is ApiResult.Success -> _uiState.update { it.copy(categories = categoriesResult.data) }
                is ApiResult.Failure -> { /* silent */ }
            }

            _uiState.update { it.copy(isLoading = false) }
        }
    }

    fun loadMore() {
        val state = _uiState.value
        if (state.isLoadingMore || !state.hasMore) return
        viewModelScope.launch {
            val nextPage = state.page + 1
            _uiState.update { it.copy(isLoadingMore = true) }
            when (val result = fetchTransactionsPage(nextPage)) {
                is ApiResult.Success -> {
                    val newTxns = result.data.transactions
                    _uiState.update {
                        val all = it.transactions + newTxns
                        it.copy(
                            transactions = all,
                            page = nextPage,
                            hasMore = all.size < it.total,
                            isLoadingMore = false
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(errorMessage = result.error.message, isLoadingMore = false)
                    }
                }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(page = 1, errorMessage = null) }
            when (val result = fetchTransactionsPage(1)) {
                is ApiResult.Success -> {
                    val data = result.data
                    val total = data.total ?: data.transactions.size
                    _uiState.update {
                        it.copy(
                            transactions = data.transactions,
                            total = total,
                            hasMore = data.transactions.size < total
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = result.error.message) }
                }
            }
        }
    }

    // MARK: - Search

    fun performSearch() {
        val query = _uiState.value.searchQuery
        if (query.isEmpty()) {
            refresh()
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = repository.search(query)) {
                is ApiResult.Success -> {
                    val data = result.data
                    _uiState.update {
                        it.copy(
                            transactions = data.transactions,
                            total = data.total ?: data.transactions.size,
                            hasMore = false,
                            isLoading = false
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(errorMessage = result.error.message, isLoading = false)
                    }
                }
            }
        }
    }

    // MARK: - Filter Updates

    fun updateFilterType(type: String) {
        _uiState.update { it.copy(filterType = type) }
        refresh()
    }

    fun updateFilterAccountId(accountId: String) {
        _uiState.update { it.copy(filterAccountId = accountId) }
        refresh()
    }

    fun updateSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun updateDateRange(from: String?, to: String?) {
        _uiState.update { it.copy(dateFrom = from, dateTo = to) }
        refresh()
    }

    fun clearDateRange() {
        _uiState.update { it.copy(dateFrom = null, dateTo = null) }
        refresh()
    }

    fun updateViewMode(mode: TransactionViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
    }

    // MARK: - CRUD

    fun saveTransaction(
        payload: JsonObject,
        editId: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            if (editId != null) {
                when (val result = repository.updateTransaction(editId, payload)) {
                    is ApiResult.Success -> {
                        _uiState.update { state ->
                            val updated = state.transactions.map {
                                if (it.id == editId) result.data else it
                            }
                            state.copy(
                                transactions = updated,
                                showForm = false,
                                editingTransaction = null
                            )
                        }
                        onSuccess()
                    }
                    is ApiResult.Failure -> onError(result.error.message ?: "Failed to update transaction")
                }
            } else {
                when (val result = repository.createTransaction(payload)) {
                    is ApiResult.Success -> {
                        _uiState.update { state ->
                            state.copy(
                                transactions = listOf(result.data) + state.transactions,
                                total = state.total + 1,
                                showForm = false,
                                editingTransaction = null
                            )
                        }
                        onSuccess()
                    }
                    is ApiResult.Failure -> onError(result.error.message ?: "Failed to create transaction")
                }
            }
        }
    }

    fun deleteTransaction(id: String) {
        viewModelScope.launch {
            when (repository.deleteTransaction(id)) {
                is ApiResult.Success -> {
                    _uiState.update { state ->
                        state.copy(
                            transactions = state.transactions.filter { it.id != id },
                            total = state.total - 1,
                            selectedIds = state.selectedIds - id
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = "Failed to delete transaction") }
                }
            }
        }
    }

    // MARK: - Bulk Operations

    fun toggleSelection(id: String) {
        _uiState.update { state ->
            val newSelected = if (state.selectedIds.contains(id)) {
                state.selectedIds - id
            } else {
                state.selectedIds + id
            }
            state.copy(selectedIds = newSelected)
        }
    }

    fun selectAll() {
        _uiState.update { state ->
            state.copy(selectedIds = state.transactions.map { it.id }.toSet())
        }
    }

    fun clearSelection() {
        _uiState.update { it.copy(selectedIds = emptySet(), isSelecting = false) }
    }

    fun setSelecting(selecting: Boolean) {
        _uiState.update { it.copy(isSelecting = selecting) }
    }

    fun bulkApprove() {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            when (repository.bulkApprove(ids)) {
                is ApiResult.Success -> {
                    clearSelection()
                    refresh()
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = "Failed to approve transactions") }
                }
            }
        }
    }

    fun bulkReject() {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            when (repository.bulkReject(ids)) {
                is ApiResult.Success -> {
                    clearSelection()
                    refresh()
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = "Failed to reject transactions") }
                }
            }
        }
    }

    fun bulkDelete() {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            when (repository.bulkDelete(ids)) {
                is ApiResult.Success -> {
                    _uiState.update { state ->
                        val idSet = ids.toSet()
                        state.copy(
                            transactions = state.transactions.filter { it.id !in idSet },
                            total = state.total - ids.size
                        )
                    }
                    clearSelection()
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = "Failed to delete transactions") }
                }
            }
        }
    }

    // MARK: - Form

    fun beginCreate() {
        _uiState.update { it.copy(editingTransaction = null, showForm = true) }
    }

    fun beginEdit(transaction: Transaction) {
        _uiState.update { it.copy(editingTransaction = transaction, showForm = true) }
    }

    fun hideForm() {
        _uiState.update { it.copy(showForm = false, editingTransaction = null) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    // MARK: - Helpers

    fun accountName(id: String?): String {
        if (id.isNullOrEmpty()) return "Unknown"
        return _uiState.value.accounts.firstOrNull { it.id == id }?.name ?: "Unknown"
    }

    fun categoryName(id: String?): String {
        if (id.isNullOrEmpty()) return "Uncategorized"
        return _uiState.value.categories.firstOrNull { it.id == id }?.name ?: "Uncategorized"
    }

    fun subcategoryName(categoryId: String?, subcategoryId: String?): String? {
        if (categoryId.isNullOrEmpty() || subcategoryId.isNullOrEmpty()) return null
        val parent = _uiState.value.categories.firstOrNull { it.id == categoryId } ?: return null
        return parent.children?.firstOrNull { it.id == subcategoryId }?.name
    }

    fun subcategories(categoryId: String?): List<Category> {
        if (categoryId.isNullOrEmpty()) return emptyList()
        return _uiState.value.categories.firstOrNull { it.id == categoryId }?.children ?: emptyList()
    }

    // MARK: - Approve (used by TransactionFormScreen approve mode, P0 #12)

    fun approveTransaction(
        id: String,
        onSuccess: () -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            when (val result = repository.approveTransaction(id)) {
                is ApiResult.Success -> {
                    // Surface the now-approved transaction in the local list.
                    _uiState.update { state ->
                        val exists = state.transactions.any { it.id == id }
                        val merged = if (exists) {
                            state.transactions.map { if (it.id == id) result.data else it }
                        } else {
                            listOf(result.data) + state.transactions
                        }
                        state.copy(transactions = merged)
                    }
                    onSuccess()
                }
                is ApiResult.Failure -> onError(result.error.message ?: "Failed to approve transaction")
            }
        }
    }

    // MARK: - Inline-create helpers (used by TransactionFormScreen + PendingReviewScreen, P0 #12, #15)

    fun upsertAccount(account: Account) {
        _uiState.update { state ->
            val existing = state.accounts.indexOfFirst { it.id == account.id }
            val accounts = if (existing >= 0) {
                state.accounts.toMutableList().also { it[existing] = account }
            } else {
                state.accounts + account
            }
            state.copy(accounts = accounts)
        }
    }

    fun upsertCategory(category: Category) {
        _uiState.update { state ->
            val existing = state.categories.indexOfFirst { it.id == category.id }
            val categories = if (existing >= 0) {
                state.categories.toMutableList().also { it[existing] = category }
            } else {
                state.categories + category
            }
            state.copy(categories = categories)
        }
    }

    fun upsertSubcategory(parentId: String, sub: Category) {
        _uiState.update { state ->
            val categories = state.categories.map { cat ->
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
            state.copy(categories = categories)
        }
    }

    // MARK: - Private

    private suspend fun fetchTransactionsPage(page: Int): ApiResult<TransactionListResponse> {
        val state = _uiState.value
        val typeParam = if (state.filterType == "All") null else state.filterType.lowercase()
        val acctId = state.filterAccountId.ifEmpty { null }
        return repository.fetchTransactions(
            page = page,
            limit = pageSize,
            type = typeParam,
            accountId = acctId,
            dateFrom = state.dateFrom,
            dateTo = state.dateTo,
            status = "approved"
        )
    }
}
