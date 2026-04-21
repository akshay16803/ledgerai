package com.spentyai.app.features.invoices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.Account
import com.spentyai.app.core.models.Customer
import com.spentyai.app.core.models.Invoice
import com.spentyai.app.core.models.InvoiceStatus
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
import java.time.format.DateTimeFormatter

data class InvoicesUiState(
    val invoices: List<Invoice> = emptyList(),
    val stats: InvoiceStats = InvoiceStats(),
    val debtors: List<InvoiceDebtor> = emptyList(),
    val aging: List<InvoiceAgingBucket> = emptyList(),
    val customers: List<Customer> = emptyList(),
    val accounts: List<Account> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val searchText: String = "",
    val statusFilter: String = "all",
    val nextNumber: String = ""
)

class InvoicesViewModel(apiClient: ApiClient) : ViewModel() {

    private val repository = InvoiceRepository(apiClient)

    private val _uiState = MutableStateFlow(InvoicesUiState())
    val uiState: StateFlow<InvoicesUiState> = _uiState.asStateFlow()

    val filteredInvoices: StateFlow<List<Invoice>> = combine(
        _uiState
    ) { states ->
        val state = states[0]
        var result = state.invoices

        if (state.statusFilter != "all") {
            if (state.statusFilter == "overdue") {
                val today = LocalDate.now()
                result = result.filter { invoice ->
                    val status = invoice.status
                    status != InvoiceStatus.PAID && invoice.dueDate.isNotBlank() &&
                        try {
                            LocalDate.parse(invoice.dueDate.take(10)).isBefore(today)
                        } catch (_: Exception) { false }
                }
            } else {
                result = result.filter {
                    it.status.name.lowercase() == state.statusFilter ||
                    (state.statusFilter == "unpaid" && it.status == InvoiceStatus.DRAFT) ||
                    (state.statusFilter == "unpaid" && it.status == InvoiceStatus.SENT) ||
                    (state.statusFilter == "partial" && it.status == InvoiceStatus.PARTIALLY_PAID)
                }
            }
        }

        if (state.searchText.isNotBlank()) {
            val query = state.searchText.lowercase()
            result = result.filter { invoice ->
                invoice.invoiceNumber.lowercase().contains(query) ||
                (invoice.customerName?.lowercase()?.contains(query) == true)
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
            loadInvoices()
            loadCustomers()
            loadAccounts()
            computeStats()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadInvoices() {
        when (val result = repository.fetchAll()) {
            is ApiResult.Success -> {
                _uiState.value = _uiState.value.copy(invoices = result.data)
            }
            is ApiResult.Failure -> {
                _uiState.value = _uiState.value.copy(errorMessage = result.error.message)
            }
        }
    }

    private fun computeStats() {
        val invoices = _uiState.value.invoices
        val today = LocalDate.now()

        val totalInvoiced = invoices.sumOf { it.total }
        val totalPaid = invoices.sumOf { it.amountPaid }
        val totalOutstanding = invoices.sumOf { it.amountDue }
        val totalOverdue = invoices.filter { invoice ->
            invoice.status != InvoiceStatus.PAID && invoice.dueDate.isNotBlank() &&
                try { LocalDate.parse(invoice.dueDate.take(10)).isBefore(today) } catch (_: Exception) { false }
        }.sumOf { it.amountDue }

        val stats = InvoiceStats(totalInvoiced, totalPaid, totalOutstanding, totalOverdue)

        // Compute debtors
        val debtorMap = mutableMapOf<String, Pair<Double, Int>>()
        invoices.filter { it.amountDue > 0 }.forEach { inv ->
            val name = inv.customerName ?: "Unknown"
            val current = debtorMap[name] ?: (0.0 to 0)
            debtorMap[name] = (current.first + inv.amountDue) to (current.second + 1)
        }
        val debtors = debtorMap.map { (name, pair) ->
            InvoiceDebtor(customerName = name, totalOutstanding = pair.first, invoiceCount = pair.second)
        }.sortedByDescending { it.totalOutstanding }

        // Compute aging buckets
        val agingBuckets = mutableMapOf(
            "Current" to (0.0 to 0),
            "1-30 days" to (0.0 to 0),
            "31-60 days" to (0.0 to 0),
            "61-90 days" to (0.0 to 0),
            "90+ days" to (0.0 to 0)
        )
        invoices.filter { it.amountDue > 0 }.forEach { inv ->
            val daysOverdue = try {
                val due = LocalDate.parse(inv.dueDate.take(10))
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
            agingBuckets[bucket] = (current.first + inv.amountDue) to (current.second + 1)
        }
        val aging = agingBuckets.map { (label, pair) ->
            InvoiceAgingBucket(label = label, amount = pair.first, count = pair.second)
        }.filter { it.count > 0 }

        _uiState.value = _uiState.value.copy(
            stats = stats,
            debtors = debtors,
            aging = aging
        )
    }

    private suspend fun loadCustomers() {
        when (val result = repository.fetchCustomers()) {
            is ApiResult.Success -> {
                _uiState.value = _uiState.value.copy(customers = result.data)
            }
            is ApiResult.Failure -> { /* non-fatal */ }
        }
    }

    private suspend fun loadAccounts() {
        when (val result = repository.fetchAccounts()) {
            is ApiResult.Success -> {
                _uiState.value = _uiState.value.copy(accounts = result.data)
            }
            is ApiResult.Failure -> { /* non-fatal */ }
        }
    }

    fun createInvoice(payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.create(payload)) {
                is ApiResult.Success -> {
                    val updated = listOf(result.data) + _uiState.value.invoices
                    _uiState.value = _uiState.value.copy(invoices = updated, isLoading = false)
                    computeStats()
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        errorMessage = result.error.message,
                        isLoading = false
                    )
                }
            }
        }
    }

    fun updateInvoice(id: String, payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.update(id, payload)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.invoices.map {
                        if (it.id == id) result.data else it
                    }
                    _uiState.value = _uiState.value.copy(invoices = updated, isLoading = false)
                    computeStats()
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        errorMessage = result.error.message,
                        isLoading = false
                    )
                }
            }
        }
    }

    fun deleteInvoice(id: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(errorMessage = null)
            when (repository.delete(id)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.invoices.filter { it.id != id }
                    _uiState.value = _uiState.value.copy(invoices = updated)
                    computeStats()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = "Failed to delete invoice")
                }
            }
        }
    }

    fun recordPayment(id: String, payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(errorMessage = null)
            when (val result = repository.recordPayment(id, payload)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.invoices.map {
                        if (it.id == id) result.data else it
                    }
                    _uiState.value = _uiState.value.copy(invoices = updated)
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
            _uiState.value = _uiState.value.copy(errorMessage = null)
            when (val result = repository.markPaid(id)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.invoices.map {
                        if (it.id == id) result.data else it
                    }
                    _uiState.value = _uiState.value.copy(invoices = updated)
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
        val STATUS_FILTERS = listOf("all", "paid", "unpaid", "partial", "overdue")
    }
}
