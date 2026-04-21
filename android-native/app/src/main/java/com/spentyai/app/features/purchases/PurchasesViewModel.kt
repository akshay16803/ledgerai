package com.spentyai.app.features.purchases

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.Account
import com.spentyai.app.core.models.Bill
import com.spentyai.app.core.models.BillStatus
import com.spentyai.app.core.models.Vendor
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import java.time.LocalDate

data class PurchasesUiState(
    val bills: List<Bill> = emptyList(),
    val stats: BillStats = BillStats(),
    val creditors: List<CreditorSummary> = emptyList(),
    val aging: List<BillAgingBucket> = emptyList(),
    val vendors: List<Vendor> = emptyList(),
    val accounts: List<Account> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val searchText: String = "",
    val statusFilter: String = "all"
)

class PurchasesViewModel(apiClient: ApiClient) : ViewModel() {

    private val repository = PurchaseRepository(apiClient)

    private val _uiState = MutableStateFlow(PurchasesUiState())
    val uiState: StateFlow<PurchasesUiState> = _uiState.asStateFlow()

    val filteredBills: StateFlow<List<Bill>> = combine(
        _uiState
    ) { states ->
        val state = states[0]
        var result = state.bills

        if (state.statusFilter != "all") {
            result = result.filter {
                it.status.name.lowercase() == state.statusFilter ||
                (state.statusFilter == "unpaid" && it.status == BillStatus.UNPAID) ||
                (state.statusFilter == "partial" && it.status == BillStatus.PARTIALLY_PAID)
            }
        }

        if (state.searchText.isNotBlank()) {
            val query = state.searchText.lowercase()
            result = result.filter { bill ->
                (bill.billNumber?.lowercase()?.contains(query) == true) ||
                (bill.vendorName?.lowercase()?.contains(query) == true)
            }
        }

        result
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateSearch(text: String) {
        _uiState.value = _uiState.value.copy(searchText = text)
    }

    fun updateStatusFilter(filter: String) {
        _uiState.value = _uiState.value.copy(statusFilter = filter)
    }

    fun loadAll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            loadBills()
            loadVendors()
            loadAccounts()
            computeStats()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadBills() {
        when (val result = repository.fetchAll()) {
            is ApiResult.Success -> {
                _uiState.value = _uiState.value.copy(bills = result.data)
            }
            is ApiResult.Failure -> {
                _uiState.value = _uiState.value.copy(errorMessage = result.error.message)
            }
        }
    }

    private fun computeStats() {
        val bills = _uiState.value.bills
        val today = LocalDate.now()

        val totalBilled = bills.sumOf { it.total }
        val totalPaid = bills.sumOf { it.amountPaid }
        val totalOutstanding = bills.sumOf { it.amountDue }
        val totalOverdue = bills.filter { bill ->
            bill.status != BillStatus.PAID && bill.dueDate.isNotBlank() &&
                try { LocalDate.parse(bill.dueDate.take(10)).isBefore(today) } catch (_: Exception) { false }
        }.sumOf { it.amountDue }

        val stats = BillStats(totalBilled, totalPaid, totalOutstanding, totalOverdue)

        // Creditors
        val creditorMap = mutableMapOf<String, Pair<Double, Int>>()
        bills.filter { it.amountDue > 0 }.forEach { bill ->
            val name = bill.vendorName ?: "Unknown"
            val current = creditorMap[name] ?: (0.0 to 0)
            creditorMap[name] = (current.first + bill.amountDue) to (current.second + 1)
        }
        val creditors = creditorMap.map { (name, pair) ->
            CreditorSummary(vendorName = name, totalOutstanding = pair.first, billCount = pair.second)
        }.sortedByDescending { it.totalOutstanding }

        // Aging
        val agingBuckets = mutableMapOf(
            "Current" to (0.0 to 0),
            "1-30 days" to (0.0 to 0),
            "31-60 days" to (0.0 to 0),
            "61-90 days" to (0.0 to 0),
            "90+ days" to (0.0 to 0)
        )
        bills.filter { it.amountDue > 0 }.forEach { bill ->
            val daysOverdue = try {
                val due = LocalDate.parse(bill.dueDate.take(10))
                java.time.temporal.ChronoUnit.DAYS.between(due, today).toInt()
            } catch (_: Exception) { 0 }

            val bucket = when {
                daysOverdue <= 0 -> "Current"
                daysOverdue <= 30 -> "1-30 days"
                daysOverdue <= 60 -> "31-60 days"
                daysOverdue <= 90 -> "61-90 days"
                else -> "90+ days"
            }
            val current = agingBuckets[bucket]!!
            agingBuckets[bucket] = (current.first + bill.amountDue) to (current.second + 1)
        }
        val aging = agingBuckets.map { (label, pair) ->
            BillAgingBucket(label = label, amount = pair.first, count = pair.second)
        }.filter { it.count > 0 }

        _uiState.value = _uiState.value.copy(
            stats = stats,
            creditors = creditors,
            aging = aging
        )
    }

    private suspend fun loadVendors() {
        when (val result = repository.fetchVendors()) {
            is ApiResult.Success -> _uiState.value = _uiState.value.copy(vendors = result.data)
            is ApiResult.Failure -> { /* non-fatal */ }
        }
    }

    private suspend fun loadAccounts() {
        when (val result = repository.fetchAccounts()) {
            is ApiResult.Success -> _uiState.value = _uiState.value.copy(accounts = result.data)
            is ApiResult.Failure -> { /* non-fatal */ }
        }
    }

    fun createBill(payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.create(payload)) {
                is ApiResult.Success -> {
                    val updated = listOf(result.data) + _uiState.value.bills
                    _uiState.value = _uiState.value.copy(bills = updated, isLoading = false)
                    computeStats()
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun updateBill(id: String, payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.update(id, payload)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.bills.map { if (it.id == id) result.data else it }
                    _uiState.value = _uiState.value.copy(bills = updated, isLoading = false)
                    computeStats()
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun deleteBill(id: String) {
        viewModelScope.launch {
            when (repository.delete(id)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.bills.filter { it.id != id }
                    _uiState.value = _uiState.value.copy(bills = updated)
                    computeStats()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = "Failed to delete bill")
                }
            }
        }
    }

    fun recordPayment(id: String, payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            when (val result = repository.recordPayment(id, payload)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.bills.map { if (it.id == id) result.data else it }
                    _uiState.value = _uiState.value.copy(bills = updated)
                    computeStats()
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message)
                }
            }
        }
    }

    fun markPaid(id: String) {
        viewModelScope.launch {
            when (val result = repository.markPaid(id)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.bills.map { if (it.id == id) result.data else it }
                    _uiState.value = _uiState.value.copy(bills = updated)
                    computeStats()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message)
                }
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    companion object {
        val STATUS_FILTERS = listOf("all", "unpaid", "partial", "paid", "overdue")
    }
}
