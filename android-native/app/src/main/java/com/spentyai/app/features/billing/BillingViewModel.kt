package com.spentyai.app.features.billing

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.acknowledgePurchase
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
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
    val isCancelling: Boolean = false,
    // Play Billing
    val productDetailsList: List<ProductDetails> = emptyList(),
    val isBillingReady: Boolean = false
) {
    val isSubscribed: Boolean get() = currentStatus?.isActive == true
}

class BillingViewModel(
    application: Application,
    private val repository: BillingRepository
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(BillingUiState())
    val uiState: StateFlow<BillingUiState> = _uiState.asStateFlow()

    private val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
        when {
            billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null -> {
                viewModelScope.launch {
                    for (purchase in purchases) {
                        handlePurchase(purchase)
                    }
                }
            }
            billingResult.responseCode == BillingClient.BillingResponseCode.USER_CANCELED -> {
                _uiState.update { it.copy(isPurchasing = false, purchasingProductId = null) }
            }
            else -> {
                _uiState.update {
                    it.copy(
                        isPurchasing = false,
                        purchasingProductId = null,
                        showError = true,
                        errorMessage = "Purchase failed: ${billingResult.debugMessage}"
                    )
                }
            }
        }
    }

    private val billingClient: BillingClient = BillingClient.newBuilder(application)
        .setListener(purchasesUpdatedListener)
        .enablePendingPurchases()
        .build()

    init {
        connectToPlayStore()
    }

    private fun connectToPlayStore() {
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    _uiState.update { it.copy(isBillingReady = true) }
                    viewModelScope.launch {
                        queryProductDetails()
                        restorePurchases()
                    }
                }
            }

            override fun onBillingServiceDisconnected() {
                _uiState.update { it.copy(isBillingReady = false) }
                // Retry connection on next purchase attempt
            }
        })
    }

    suspend fun queryProductDetails() {
        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("spenty_monthly")
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("spenty_yearly")
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        val result = billingClient.queryProductDetails(params)
        if (result.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            val details = result.productDetailsList ?: emptyList()
            _uiState.update { it.copy(productDetailsList = details) }
        }
    }

    private suspend fun restorePurchases() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        val result = billingClient.queryPurchasesAsync(params)
        if (result.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            for (purchase in result.purchasesList) {
                if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                    acknowledgePurchaseIfNeeded(purchase)
                }
            }
        }
    }

    fun purchaseSubscription(productDetails: ProductDetails, activity: Activity) {
        val offerToken = productDetails.subscriptionOfferDetails?.firstOrNull()?.offerToken ?: return

        val productDetailsParamsList = listOf(
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(productDetails)
                .setOfferToken(offerToken)
                .build()
        )

        val billingFlowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build()

        _uiState.update {
            it.copy(isPurchasing = true, purchasingProductId = productDetails.productId)
        }

        if (!billingClient.isReady) {
            connectToPlayStore()
            _uiState.update {
                it.copy(
                    isPurchasing = false,
                    purchasingProductId = null,
                    showError = true,
                    errorMessage = "Play Store is not ready. Please try again."
                )
            }
            return
        }

        billingClient.launchBillingFlow(activity, billingFlowParams)
    }

    private suspend fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            acknowledgePurchaseIfNeeded(purchase)
            // Notify backend and refresh status
            loadAll()
            _uiState.update { it.copy(isPurchasing = false, purchasingProductId = null) }
        } else if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
            _uiState.update {
                it.copy(
                    isPurchasing = false,
                    purchasingProductId = null,
                    showError = true,
                    errorMessage = "Purchase is pending. It will be activated once payment is confirmed."
                )
            }
        }
    }

    private suspend fun acknowledgePurchaseIfNeeded(purchase: Purchase) {
        if (!purchase.isAcknowledged) {
            val params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken)
                .build()
            billingClient.acknowledgePurchase(params)
        }
    }

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

    /** Legacy shim — used by paywall before Play details are loaded. */
    fun purchasePlan(productId: String) {
        val productDetails = _uiState.value.productDetailsList.find { it.productId == productId }
        if (productDetails == null) {
            _uiState.update {
                it.copy(
                    showError = true,
                    errorMessage = "Product details not available. Please check your connection and try again."
                )
            }
        }
        // Actual launch is triggered via purchaseSubscription(productDetails, activity)
        // from the UI layer once it has an Activity reference.
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

    override fun onCleared() {
        super.onCleared()
        billingClient.endConnection()
    }
}
