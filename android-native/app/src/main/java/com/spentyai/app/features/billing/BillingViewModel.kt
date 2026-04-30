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
        // Subscriptions: monthly, quarterly, yearly. Match iOS-style identifiers.
        val subsList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("com.spentyai.monthly")
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("com.spentyai.quarterly")
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("com.spentyai.yearly")
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )

        // Lifetime is a non-renewable in-app purchase, must be queried separately.
        val inAppList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("com.spentyai.lifetime")
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )

        val combined = mutableListOf<ProductDetails>()

        val subsParams = QueryProductDetailsParams.newBuilder()
            .setProductList(subsList)
            .build()
        val subsResult = billingClient.queryProductDetails(subsParams)
        if (subsResult.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            combined.addAll(subsResult.productDetailsList ?: emptyList())
        }

        val inAppParams = QueryProductDetailsParams.newBuilder()
            .setProductList(inAppList)
            .build()
        val inAppResult = billingClient.queryProductDetails(inAppParams)
        if (inAppResult.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            combined.addAll(inAppResult.productDetailsList ?: emptyList())
        }

        _uiState.update { it.copy(productDetailsList = combined) }
    }

    private suspend fun restorePurchases() {
        // Restore both SUBS (monthly/quarterly/yearly) and INAPP (lifetime) purchases.
        for (productType in listOf(BillingClient.ProductType.SUBS, BillingClient.ProductType.INAPP)) {
            val params = QueryPurchasesParams.newBuilder()
                .setProductType(productType)
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
    }

    fun purchaseSubscription(productDetails: ProductDetails, activity: Activity) {
        // SUBS products require an offer token; INAPP (lifetime) does not.
        val isSubs = productDetails.productType == BillingClient.ProductType.SUBS
        val productDetailsParamsBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(productDetails)

        if (isSubs) {
            val offerToken = productDetails.subscriptionOfferDetails?.firstOrNull()?.offerToken
            if (offerToken == null) {
                _uiState.update {
                    it.copy(
                        showError = true,
                        errorMessage = "Subscription offer not available. Please try again."
                    )
                }
                return
            }
            productDetailsParamsBuilder.setOfferToken(offerToken)
        }

        val productDetailsParamsList = listOf(productDetailsParamsBuilder.build())

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

            // Notify backend so server has a record of the purchase. iOS calls
            // /api/payments/apple/verify; Android equivalent is /api/subscription/verify.
            // Failure here is shown as an error but we do NOT re-charge the user.
            when (val verifyResult = repository.verifyPurchase(purchase)) {
                is ApiResult.Success -> {
                    // Server now knows about the purchase; refresh status.
                    loadAll()
                    _uiState.update { it.copy(isPurchasing = false, purchasingProductId = null) }
                }
                is ApiResult.Failure -> {
                    // Local Play purchase succeeded but server verification failed.
                    // Refresh status anyway in case server has independent record.
                    loadAll()
                    _uiState.update {
                        it.copy(
                            isPurchasing = false,
                            purchasingProductId = null,
                            showError = true,
                            errorMessage = "Purchase succeeded but verification failed: " +
                                "${verifyResult.error.message}. Please contact support if your subscription does not appear."
                        )
                    }
                }
            }
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

    /**
     * Returns the Play Store deep link the UI should open to manage / cancel
     * the active subscription. Returns null if the current subscription is
     * not a recurring SUBS purchase (e.g. lifetime in-app purchase).
     *
     * Android cannot programmatically cancel a Play subscription — the user
     * must do it through the Play Store. This URL drops them on the right
     * screen, pre-filtered to this app + this SKU.
     */
    fun getCancelSubscriptionUrl(): String {
        val productId = _uiState.value.currentStatus?.productId
        val packageName = getApplication<Application>().packageName
        return if (!productId.isNullOrEmpty()) {
            "https://play.google.com/store/account/subscriptions?sku=$productId&package=$packageName"
        } else {
            "https://play.google.com/store/account/subscriptions?package=$packageName"
        }
    }

    /**
     * Refresh subscription status after returning from the Play Store cancel
     * flow. Intended to be invoked from the UI's onResume after the cancel
     * link has been opened.
     */
    fun refreshAfterCancelReturn() {
        viewModelScope.launch {
            _uiState.update { it.copy(showCancelConfirmation = false, isCancelling = false) }
            loadAll()
        }
    }

    /**
     * Legacy entry point. The Play Store cancel flow is launched from the UI
     * layer (Intent.ACTION_VIEW with [getCancelSubscriptionUrl]) because the
     * ViewModel cannot start activities. This method just dismisses the
     * confirmation dialog so the UI can navigate.
     */
    fun cancelSubscription() {
        _uiState.update { it.copy(showCancelConfirmation = false) }
    }

    fun dismissError() {
        _uiState.update { it.copy(showError = false, errorMessage = "") }
    }

    override fun onCleared() {
        super.onCleared()
        billingClient.endConnection()
    }
}
