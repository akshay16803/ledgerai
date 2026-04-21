package com.spentyai.app.features.accounts

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import com.spentyai.app.core.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class AccountsUiState(
    val accounts: List<Account> = emptyList(),
    val subTypes: List<AccountSubType> = emptyList(),
    val selectedAccount: Account? = null,
    val accountTransactions: List<Transaction> = emptyList(),
    val amortizationSchedule: List<AmortizationEntry> = emptyList(),
    val amortizationTotalInterest: Double = 0.0,
    val amortizationTotalPayment: Double = 0.0,
    val isLoading: Boolean = false,
    val isDetailLoading: Boolean = false,
    val isSaving: Boolean = false,
    val errorMessage: String? = null,
    val searchText: String = "",
    val showingForm: Boolean = false,
    val editingAccount: Account? = null,
    // OD Interest
    val odFromDate: Date = Calendar.getInstance().apply { add(Calendar.MONTH, -1) }.time,
    val odToDate: Date = Date(),
    val odInterestResult: ODInterestResponse? = null,
    val isCalculatingOD: Boolean = false,
    // Sub-type management
    val isLoadingSubTypes: Boolean = false,
    val newSubTypeName: String = "",
    val newSubTypeAccountType: String = "asset",
    val editingSubType: AccountSubType? = null,
    val editingSubTypeName: String = "",
    // Demat
    val dematStatements: List<DematStatement> = emptyList(),
    val isUploadingDemat: Boolean = false,
    val isDematLoading: Boolean = false,
    // Transaction filters
    val filterTransactionType: String = "",
    val filterCategoryId: String = "",
    val filterStartDate: String? = null,
    val filterEndDate: String? = null,
    val filterMinAmount: String = "",
    val filterMaxAmount: String = "",
    val filterSearch: String = "",
    val filterCategories: List<Pair<String, String>> = emptyList(),
    val isLoadingFilteredTransactions: Boolean = false,
    val filteredTransactionTotal: Int = 0
)

data class AccountGroup(
    val type: String,
    val accounts: List<Account>
)

class AccountsViewModel(private val apiClient: ApiClient) : ViewModel() {

    private val repository = AccountRepository(apiClient)

    private val _uiState = MutableStateFlow(AccountsUiState())
    val uiState: StateFlow<AccountsUiState> = _uiState.asStateFlow()

    // MARK: - Computed Properties

    fun filteredAccounts(): List<Account> {
        val state = _uiState.value
        if (state.searchText.isEmpty()) return state.accounts
        val query = state.searchText.lowercase()
        return state.accounts.filter { account ->
            (account.name?.lowercase()?.contains(query) == true) ||
            (account.accountType?.lowercase()?.contains(query) == true) ||
            (account.subType?.lowercase()?.contains(query) == true) ||
            (account.accountNumber?.lowercase()?.contains(query) == true)
        }
    }

    fun groupedAccounts(): List<AccountGroup> {
        val typeOrder = listOf("asset", "liability", "equity", "investment")
        val filtered = filteredAccounts()
        val grouped = filtered.groupBy { it.accountType?.lowercase() ?: "other" }
        val result = mutableListOf<AccountGroup>()
        for (type in typeOrder) {
            val items = grouped[type]
            if (!items.isNullOrEmpty()) {
                result.add(AccountGroup(type, items))
            }
        }
        // Add any remaining types not in the standard order
        for ((type, items) in grouped) {
            if (type !in typeOrder && items.isNotEmpty()) {
                result.add(AccountGroup(type, items))
            }
        }
        return result
    }

    fun totalBalance(): Double {
        return _uiState.value.accounts.fold(0.0) { total, account ->
            val balance = account.balance ?: 0.0
            if (account.accountType?.lowercase() == "liability") {
                total - balance
            } else {
                total + balance
            }
        }
    }

    fun subTypesForType(accountType: String): List<AccountSubType> {
        return _uiState.value.subTypes.filter {
            (it.accountType?.lowercase() ?: "") == accountType.lowercase()
        }
    }

    // MARK: - State Updates

    fun updateSearchText(text: String) {
        _uiState.update { it.copy(searchText = text) }
    }

    fun showForm(account: Account? = null) {
        _uiState.update { it.copy(showingForm = true, editingAccount = account) }
    }

    fun hideForm() {
        _uiState.update { it.copy(showingForm = false, editingAccount = null) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun updateFilterTransactionType(type: String) {
        _uiState.update { it.copy(filterTransactionType = type) }
    }

    fun updateFilterSearch(search: String) {
        _uiState.update { it.copy(filterSearch = search) }
    }

    fun updateFilterCategoryId(id: String) {
        _uiState.update { it.copy(filterCategoryId = id) }
    }

    fun updateFilterMinAmount(amount: String) {
        _uiState.update { it.copy(filterMinAmount = amount) }
    }

    fun updateFilterMaxAmount(amount: String) {
        _uiState.update { it.copy(filterMaxAmount = amount) }
    }

    fun updateFilterStartDate(date: String?) {
        _uiState.update { it.copy(filterStartDate = date) }
    }

    fun updateFilterEndDate(date: String?) {
        _uiState.update { it.copy(filterEndDate = date) }
    }

    fun resetFilters() {
        _uiState.update {
            it.copy(
                filterTransactionType = "",
                filterCategoryId = "",
                filterStartDate = null,
                filterEndDate = null,
                filterMinAmount = "",
                filterMaxAmount = "",
                filterSearch = ""
            )
        }
    }

    fun updateNewSubTypeName(name: String) {
        _uiState.update { it.copy(newSubTypeName = name) }
    }

    fun updateNewSubTypeAccountType(type: String) {
        _uiState.update { it.copy(newSubTypeAccountType = type) }
    }

    fun setEditingSubType(subType: AccountSubType?) {
        _uiState.update {
            it.copy(
                editingSubType = subType,
                editingSubTypeName = subType?.name ?: ""
            )
        }
    }

    fun updateEditingSubTypeName(name: String) {
        _uiState.update { it.copy(editingSubTypeName = name) }
    }

    fun updateOdFromDate(date: Date) {
        _uiState.update { it.copy(odFromDate = date) }
    }

    fun updateOdToDate(date: Date) {
        _uiState.update { it.copy(odToDate = date) }
    }

    // MARK: - Account CRUD

    fun loadAccounts() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = repository.fetchAccounts()) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(accounts = result.data, isLoading = false)
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun loadAccountDetail(id: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isDetailLoading = true, errorMessage = null) }
            when (val accountResult = repository.fetchAccount(id)) {
                is ApiResult.Success -> _uiState.update { it.copy(selectedAccount = accountResult.data) }
                is ApiResult.Failure -> _uiState.update { it.copy(errorMessage = accountResult.error.message) }
            }
            when (val txnResult = repository.fetchAccountTransactions(id)) {
                is ApiResult.Success -> {
                    val approved = txnResult.data.filter {
                        (it.source ?: "approved").lowercase() == "approved" || true
                    }
                    _uiState.update {
                        it.copy(
                            accountTransactions = approved,
                            filteredTransactionTotal = approved.size
                        )
                    }
                }
                is ApiResult.Failure -> { /* silent */ }
            }
            _uiState.update { it.copy(isDetailLoading = false) }
        }
    }

    fun saveAccount(payload: Map<String, Any?>, editId: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, errorMessage = null) }
            val jsonMap = mutableMapOf<String, kotlinx.serialization.json.JsonElement>()
            for ((key, value) in payload) {
                when (value) {
                    is String -> jsonMap[key] = JsonPrimitive(value)
                    is Int -> jsonMap[key] = JsonPrimitive(value)
                    is Double -> jsonMap[key] = JsonPrimitive(value)
                    is Boolean -> jsonMap[key] = JsonPrimitive(value)
                    null -> { /* skip null values */ }
                }
            }
            val jsonObject = JsonObject(jsonMap)

            if (editId != null) {
                when (val result = repository.updateAccount(editId, jsonObject)) {
                    is ApiResult.Success -> {
                        _uiState.update { state ->
                            val updated = state.accounts.map {
                                if (it.id == editId) result.data else it
                            }
                            state.copy(
                                accounts = updated,
                                selectedAccount = result.data,
                                isSaving = false,
                                showingForm = false,
                                editingAccount = null
                            )
                        }
                    }
                    is ApiResult.Failure -> _uiState.update {
                        it.copy(errorMessage = result.error.message, isSaving = false)
                    }
                }
            } else {
                when (val result = repository.createAccount(jsonObject)) {
                    is ApiResult.Success -> {
                        _uiState.update {
                            it.copy(
                                accounts = it.accounts + result.data,
                                isSaving = false,
                                showingForm = false,
                                editingAccount = null
                            )
                        }
                    }
                    is ApiResult.Failure -> _uiState.update {
                        it.copy(errorMessage = result.error.message, isSaving = false)
                    }
                }
            }
        }
    }

    fun updateOpeningBalance(accountId: String, amount: Double, asOfDate: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, errorMessage = null) }
            val payload = JsonObject(
                mapOf(
                    "openingBalance" to JsonPrimitive(amount),
                    "balanceAsOfDate" to JsonPrimitive(asOfDate)
                )
            )
            when (val result = repository.updateAccount(accountId, payload)) {
                is ApiResult.Success -> {
                    _uiState.update { state ->
                        val updated = state.accounts.map {
                            if (it.id == accountId) result.data else it
                        }
                        state.copy(
                            accounts = updated,
                            selectedAccount = result.data,
                            isSaving = false
                        )
                    }
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message, isSaving = false)
                }
            }
        }
    }

    fun deleteAccount(id: String) {
        viewModelScope.launch {
            when (repository.deleteAccount(id)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(accounts = state.accounts.filter { it.id != id })
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = "Failed to delete account")
                }
            }
        }
    }

    // MARK: - Amortization

    fun loadAmortization(accountId: String) {
        viewModelScope.launch {
            when (val result = repository.fetchAmortization(accountId)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(
                        amortizationSchedule = result.data.schedule,
                        amortizationTotalInterest = result.data.totalInterest ?: 0.0,
                        amortizationTotalPayment = result.data.totalPayment ?: 0.0
                    )
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message)
                }
            }
        }
    }

    // MARK: - OD Interest

    fun calculateODInterest(accountId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isCalculatingOD = true) }
            when (val result = repository.calculateODInterest(accountId, _uiState.value.odFromDate)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(odInterestResult = result.data, isCalculatingOD = false)
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message, isCalculatingOD = false)
                }
            }
        }
    }

    // MARK: - Sub-Types

    fun loadSubTypes() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingSubTypes = true) }
            when (val result = repository.fetchSubTypes()) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(subTypes = result.data, isLoadingSubTypes = false)
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message, isLoadingSubTypes = false)
                }
            }
        }
    }

    fun createSubType() {
        val state = _uiState.value
        val name = state.newSubTypeName.trim()
        if (name.isEmpty()) return
        viewModelScope.launch {
            when (val result = repository.createSubType(name, state.newSubTypeAccountType)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(
                        subTypes = it.subTypes + result.data,
                        newSubTypeName = ""
                    )
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message)
                }
            }
        }
    }

    fun updateSubType(id: String) {
        val name = _uiState.value.editingSubTypeName.trim()
        if (name.isEmpty()) return
        viewModelScope.launch {
            when (val result = repository.updateSubType(id, name)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(
                        subTypes = state.subTypes.map { if (it.id == id) result.data else it },
                        editingSubType = null,
                        editingSubTypeName = ""
                    )
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message)
                }
            }
        }
    }

    fun deleteSubType(id: String) {
        viewModelScope.launch {
            when (val result = repository.deleteSubType(id)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(subTypes = state.subTypes.filter { it.id != id })
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message)
                }
            }
        }
    }

    // MARK: - Demat

    fun loadDematStatements(accountId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isDematLoading = true) }
            when (val result = repository.fetchDematStatements(accountId)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(dematStatements = result.data, isDematLoading = false)
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = result.error.message, isDematLoading = false)
                }
            }
        }
    }

    fun approveDematStatement(id: String, accountId: String) {
        viewModelScope.launch {
            when (repository.approveDematStatement(id)) {
                is ApiResult.Success -> loadDematStatements(accountId)
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = "Failed to approve statement")
                }
            }
        }
    }

    fun rejectDematStatement(id: String, accountId: String) {
        viewModelScope.launch {
            when (repository.rejectDematStatement(id)) {
                is ApiResult.Success -> loadDematStatements(accountId)
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = "Failed to reject statement")
                }
            }
        }
    }

    // MARK: - Filtered Transactions

    fun loadFilteredTransactions(accountId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingFilteredTransactions = true) }
            val state = _uiState.value
            when (val result = repository.fetchFilteredAccountTransactions(
                accountId = accountId,
                transactionType = state.filterTransactionType.ifEmpty { null },
                categoryId = state.filterCategoryId.ifEmpty { null },
                startDate = state.filterStartDate,
                endDate = state.filterEndDate,
                minAmount = state.filterMinAmount.toDoubleOrNull(),
                maxAmount = state.filterMaxAmount.toDoubleOrNull(),
                search = state.filterSearch.ifEmpty { null }
            )) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(
                        accountTransactions = result.data.first,
                        filteredTransactionTotal = result.data.second,
                        isLoadingFilteredTransactions = false
                    )
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(
                        errorMessage = result.error.message,
                        isLoadingFilteredTransactions = false
                    )
                }
            }
        }
    }

    fun loadFilterCategories() {
        viewModelScope.launch {
            val result = apiClient.safeApiCall { apiClient.endpoints.getCategories() }
            if (result is ApiResult.Success) {
                _uiState.update { state ->
                    state.copy(
                        filterCategories = result.data.mapNotNull { cat ->
                            cat.name?.let { Pair(cat.id, it) }
                        }
                    )
                }
            }
        }
    }

    companion object {
        val ACCOUNT_TYPES = listOf("asset", "liability", "equity", "investment")

        fun iconForAccountType(type: String): androidx.compose.material.icons.Icons.Filled {
            return androidx.compose.material.icons.Icons.Filled
        }

        fun colorForAccountType(type: String): Color {
            return when (type.lowercase()) {
                "asset" -> SpentyPrimary
                "liability" -> SpentyError
                "equity" -> SpentyInfo
                "investment" -> SpentyWarning
                else -> Color.Gray
            }
        }

        fun friendlySubType(subType: String): String {
            return when (subType.lowercase()) {
                "bank" -> "Bank"
                "cash" -> "Cash"
                "credit_card", "credit card" -> "Credit Card"
                "digital_wallet", "wallet" -> "Digital Wallet"
                "overdraft", "od" -> "Overdraft"
                "demat" -> "Demat"
                "loan" -> "Loan"
                "savings" -> "Savings"
                "current" -> "Current"
                "fixed_deposit", "fd" -> "Fixed Deposit"
                else -> subType.replace("_", " ")
                    .split(" ").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
            }
        }
    }
}
