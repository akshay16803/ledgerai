package com.spentyai.app.features.billing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class BillingUiState(
    val plans: List<PlanDTO> = emptyList(),
    val currentStatus: SubscriptionStatus? = null,
    val paymentHistory: List<PaymentOrder> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String = "",
    val showError: Boolean = false,
    // Promo
    val promoCode: String = "",
    val promoMessage: String = "",
    val promoValid: Boolean? = null,
    val isValidatingPromo: Boolean = false,
    val isActivatingPromo: Boolean = false,
    // Purchase
    val isPurchasing: Boolean = false,
    val purchasingProductId: String? = null,
    // Cancel
    val showCancelConfirmation: Boolean = false,
    val isCancelling: Boolean = false
) {
    val isSubscribed: Boolean get() = currentStatus?.isActive == true
}

class BillingViewModel(
    private val repository: BillingRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BillingUiState())
    val uiState: StateFlow<BillingUiState> = _uiState.asStateFlow()

    fun loadAll() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, showError = false) }
            // Load status
            when (val statusResult = repository.getStatus()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(currentStatus = statusResult.data) }
                }
                is ApiResult.Failure -> { /* continue */ }
            }
            // Load history
            when (val historyResult = repository.getHistory()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(paymentHistory = historyResult.data) }
                }
                is ApiResult.Failure -> { /* continue */ }
            }
            _uiState.update { it.copy(isLoading = false) }
        }
    }

    fun isCurrentPlan(productId: String): Boolean {
        val status = _uiState.value.currentStatus
        return status?.isActive == true && status.productId == productId
    }

    fun purchasePlan(productId: String) {
        // Google Play Billing integration placeholder
        _uiState.update {
            it.copy(
                showError = true,
                errorMessage = "Google Play Billing integration coming soon. Please use the web or iOS app to subscribe."
            )
        }
    }

    fun onPromoCodeChange(code: String) {
        _uiState.update { it.copy(promoCode = code) }
    }

    fun validatePromo() {
        val code = _uiState.value.promoCode.trim()
        if (code.isEmpty()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isValidatingPromo = true, promoValid = null, promoMessage = "") }
            when (val result = repository.validatePromo(code)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isValidatingPromo = false,
                            promoValid = result.data.valid,
                            promoMessage = result.data.displayMessage
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isValidatingPromo = false,
                            promoValid = false,
                            promoMessage = "Failed to validate promo code."
                        )
                    }
                }
            }
        }
    }

    fun activatePromo() {
        val code = _uiState.value.promoCode.trim()
        if (code.isEmpty() || _uiState.value.promoValid != true) return

        viewModelScope.launch {
            _uiState.update { it.copy(isActivatingPromo = true) }
            when (val result = repository.activatePromo(code)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isActivatingPromo = false,
                            promoMessage = result.data.displayMessage,
                            promoCode = "",
                            promoValid = null
                        )
                    }
                    loadAll()
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isActivatingPromo = false,
                            promoMessage = "Failed to activate promo code."
                        )
                    }
                }
            }
        }
    }

    fun showCancelConfirmation() {
        _uiState.update { it.copy(showCancelConfirmation = true) }
    }

    fun dismissCancelConfirmation() {
        _uiState.update { it.copy(showCancelConfirmation = false) }
    }

    fun cancelSubscription() {
        viewModelScope.launch {
            _uiState.update { it.copy(isCancelling = true, showCancelConfirmation = false) }
            repository.cancelSubscription()
            loadAll()
            _uiState.update { it.copy(isCancelling = false) }
        }
    }

    fun dismissError() {
        _uiState.update { it.copy(showError = false, errorMessage = "") }
    }
}
