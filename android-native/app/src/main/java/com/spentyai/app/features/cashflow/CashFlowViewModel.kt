package com.spentyai.app.features.cashflow

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

class CashFlowViewModel(private val repository: CashFlowRepository) : ViewModel() {

    // State
    var projection by mutableStateOf<CashFlowProjection?>(null)
        private set
    var mandates by mutableStateOf<List<Mandate>>(emptyList())
        private set
    var recurringItems by mutableStateOf<List<RecurringItem>>(emptyList())
        private set
    var upcomingMandates by mutableStateOf<List<Mandate>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf("")
        private set
    var showError by mutableStateOf(false)
        private set
    var isDetecting by mutableStateOf(false)
        private set

    // Computed
    val monthlyIncome: Double get() = projection?.monthlyRecurringIncome ?: 0.0
    val monthlyExpense: Double get() = projection?.monthlyRecurringExpense ?: 0.0
    val monthlyMandates: Double get() = projection?.monthlyMandateExpense ?: 0.0
    val monthlyExpenseWithMandates: Double get() = monthlyExpense + monthlyMandates
    val monthlyODInterest: Double get() = projection?.monthlyOdInterest ?: 0.0
    val monthlyEMI: Double get() = projection?.monthlyEmiTotal ?: 0.0
    val monthlyNet: Double get() = projection?.monthlyNet ?: 0.0

    val incomeItems: List<RecurringItem>
        get() = projection?.recurringItems?.filter { it.transactionType?.lowercase() == "income" } ?: emptyList()
    val expenseItems: List<RecurringItem>
        get() = projection?.recurringItems?.filter { it.transactionType?.lowercase() == "expense" } ?: emptyList()
    val mandateItemsList: List<MandateItem>
        get() = projection?.mandateItems ?: emptyList()
    val odInterestItemsList: List<ODInterestItem>
        get() = projection?.odInterestItems ?: emptyList()
    val emiItemsList: List<EMIItem>
        get() = projection?.emiItems ?: emptyList()
    val projectionMonths: List<ProjectionMonth>
        get() = projection?.projection ?: emptyList()
    val hasData: Boolean get() = projection != null

    // Load All
    fun loadAll() {
        viewModelScope.launch {
            isLoading = true
            showError = false

            val projectionDeferred = async { repository.getProjection() }
            val mandatesDeferred = async { repository.getMandates() }
            val recurringDeferred = async { repository.getRecurringList() }
            val upcomingDeferred = async { repository.getUpcoming() }

            when (val result = projectionDeferred.await()) {
                is ApiResult.Success -> projection = result.data
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load projection")
            }
            when (val result = mandatesDeferred.await()) {
                is ApiResult.Success -> mandates = result.data.mandates
                is ApiResult.Failure -> {} // Non-fatal
            }
            when (val result = recurringDeferred.await()) {
                is ApiResult.Success -> recurringItems = result.data.transactions
                is ApiResult.Failure -> {} // Non-fatal
            }
            when (val result = upcomingDeferred.await()) {
                is ApiResult.Success -> upcomingMandates = result.data.upcoming
                is ApiResult.Failure -> {} // Non-fatal
            }

            isLoading = false
        }
    }

    fun loadProjection() {
        viewModelScope.launch {
            when (val result = repository.getProjection()) {
                is ApiResult.Success -> projection = result.data
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load projection")
            }
        }
    }

    fun loadMandates() {
        viewModelScope.launch {
            when (val result = repository.getMandates()) {
                is ApiResult.Success -> mandates = result.data.mandates
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load mandates")
            }
        }
    }

    fun loadUpcoming() {
        viewModelScope.launch {
            when (val result = repository.getUpcoming()) {
                is ApiResult.Success -> upcomingMandates = result.data.upcoming
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load upcoming")
            }
        }
    }

    fun loadRecurring() {
        viewModelScope.launch {
            when (val result = repository.getRecurringList()) {
                is ApiResult.Success -> recurringItems = result.data.transactions
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load recurring")
            }
        }
    }

    // Actions
    fun toggleRecurring(transactionId: String, isRecurring: Boolean = false, recurringFrequency: String? = null) {
        viewModelScope.launch {
            val body = ToggleRecurringBody(isRecurring = isRecurring, recurringFrequency = recurringFrequency)
            repository.toggleRecurring(transactionId, body)
            loadRecurring()
            loadProjection()
        }
    }

    fun createMandate(merchant: String, amount: Double, frequency: String, mandateType: String? = null) {
        viewModelScope.launch {
            val body = MandateCreateBody(merchant = merchant, amount = amount, frequency = frequency, mandateType = mandateType)
            when (val result = repository.createMandate(body)) {
                is ApiResult.Success -> {
                    mandates = mandates + result.data
                    loadProjection()
                }
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to create mandate")
            }
        }
    }

    fun updateMandate(
        id: String,
        merchant: String? = null,
        amount: Double? = null,
        status: String? = null,
        frequency: String? = null,
        mandateType: String? = null
    ) {
        viewModelScope.launch {
            val body = MandateUpdateBody(
                merchant = merchant,
                amount = amount,
                status = status,
                frequency = frequency,
                mandateType = mandateType
            )
            when (val result = repository.updateMandate(id, body)) {
                is ApiResult.Success -> {
                    mandates = mandates.map { if (it.id == id) result.data else it }
                    loadProjection()
                }
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to update mandate")
            }
        }
    }

    fun deleteMandate(id: String) {
        viewModelScope.launch {
            when (repository.deleteMandate(id)) {
                is ApiResult.Success -> {
                    mandates = mandates.filter { it.id != id }
                    loadProjection()
                }
                is ApiResult.Failure -> handleError("Failed to delete mandate")
            }
        }
    }

    fun detectMandates() {
        viewModelScope.launch {
            isDetecting = true
            repository.detectMandates()
            loadMandates()
            loadUpcoming()
            loadProjection()
            isDetecting = false
        }
    }

    fun refresh() {
        loadAll()
    }

    fun dismissError() {
        showError = false
    }

    private fun handleError(message: String) {
        errorMessage = message
        showError = true
    }
}
