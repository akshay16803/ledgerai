package com.spentyai.app.features.paymentplans

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.PaymentPlan
import com.spentyai.app.core.models.PaymentPlanStatus
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PaymentPlansUiState(
    val plans: List<PaymentPlan> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val statusFilter: PaymentPlanStatus? = null
)

class PaymentPlansViewModel(apiClient: ApiClient) : ViewModel() {

    private val repository = PaymentPlansRepository(apiClient)

    private val _uiState = MutableStateFlow(PaymentPlansUiState())
    val uiState: StateFlow<PaymentPlansUiState> = _uiState.asStateFlow()

    fun loadPlans() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.fetchAll()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(plans = result.data, isLoading = false)
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

    fun setStatusFilter(status: PaymentPlanStatus?) {
        _uiState.value = _uiState.value.copy(statusFilter = status)
    }

    fun filteredPlans(): List<PaymentPlan> {
        val state = _uiState.value
        return if (state.statusFilter == null) state.plans
        else state.plans.filter { it.status == state.statusFilter }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
}
