package com.spentyai.app.features.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.Account
import com.spentyai.app.core.models.CashFlowProjection
import com.spentyai.app.core.models.DashboardSummary
import com.spentyai.app.core.models.PendingTransaction
import com.spentyai.app.core.models.Transaction
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DashboardUiState(
    val summary: DashboardSummary? = null,
    val isLoading: Boolean = false,
    val showError: Boolean = false,
    val errorMessage: String = "",
    val pendingTransactions: List<PendingTransaction> = emptyList(),
    val isLoadingPending: Boolean = false,
    val cashFlowProjection: CashFlowProjection? = null
)

class DashboardViewModel(private val apiClient: ApiClient) : ViewModel() {

    private val repository = DashboardRepository(apiClient)

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    // --- Computed properties ---

    val netWorth: Double get() = _uiState.value.summary?.netWorth ?: 0.0
    val incomeThisMonth: Double get() = _uiState.value.summary?.incomeThisMonth ?: 0.0
    val expenseThisMonth: Double get() = _uiState.value.summary?.expenseThisMonth ?: 0.0
    val pendingReview: Int get() = _uiState.value.summary?.pendingReview ?: 0

    val accounts: List<Account> get() = _uiState.value.summary?.accounts ?: emptyList()

    val recentTransactions: List<Transaction>
        get() {
            val txns = _uiState.value.summary?.recentTransactions ?: emptyList()
            val approved = txns.filter { (it.status ?: "approved").lowercase() == "approved" }
            return approved.take(10)
        }

    val hasData: Boolean get() = _uiState.value.summary != null

    val hasProjectionData: Boolean get() = _uiState.value.cashFlowProjection != null

    val nextMonthExpense: Double
        get() {
            val projection = _uiState.value.cashFlowProjection
            val expense = projection?.monthlyRecurringExpense ?: 0.0
            val mandate = projection?.monthlyMandateExpense ?: 0.0
            return expense + mandate
        }

    val nextMonthEMI: Double
        get() = _uiState.value.cashFlowProjection?.monthlyEmiTotal ?: 0.0

    val nextMonthODInterest: Double
        get() = _uiState.value.cashFlowProjection?.monthlyOdInterest ?: 0.0

    val nextMonthTotalOutflow: Double
        get() = nextMonthExpense + nextMonthEMI + nextMonthODInterest

    // --- Actions ---

    fun loadSummary() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, showError = false) }

            when (val result = repository.getSummary()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(summary = result.data) }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            showError = true,
                            errorMessage = result.error.message ?: "Failed to load dashboard"
                        )
                    }
                }
            }

            _uiState.update { it.copy(isLoading = false) }

            // Load pending and projection in background
            loadPendingTransactions()
            loadCashFlowProjection()
        }
    }

    fun refresh() {
        viewModelScope.launch {
            when (val result = repository.getSummary()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(summary = result.data, showError = false) }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            showError = true,
                            errorMessage = result.error.message ?: "Failed to refresh"
                        )
                    }
                }
            }
            loadPendingTransactions()
            loadCashFlowProjection()
        }
    }

    fun dismissError() {
        _uiState.update { it.copy(showError = false) }
    }

    private suspend fun loadPendingTransactions() {
        _uiState.update { it.copy(isLoadingPending = true) }
        when (val result = repository.getPendingReview()) {
            is ApiResult.Success -> {
                _uiState.update { it.copy(pendingTransactions = result.data.transactions) }
            }
            is ApiResult.Failure -> {
                _uiState.update { it.copy(pendingTransactions = emptyList()) }
            }
        }
        _uiState.update { it.copy(isLoadingPending = false) }
    }

    private suspend fun loadCashFlowProjection() {
        when (val result = repository.getCashFlowProjection()) {
            is ApiResult.Success -> {
                _uiState.update { it.copy(cashFlowProjection = result.data) }
            }
            is ApiResult.Failure -> {
                _uiState.update { it.copy(cashFlowProjection = null) }
            }
        }
    }
}
