package com.spentyai.app.features.billing

import com.android.billingclient.api.Purchase
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put

@Serializable
data class PlanDTO(
    @SerialName("plan_id") val id: String = "",
    val name: String? = null,
    val amount: Int? = null,
    @SerialName("amount_display") val amountDisplay: String? = null,
    val currency: String? = null,
    @SerialName("duration_days") val durationDays: Int? = null
)

@Serializable
data class SubscriptionStatus(
    @SerialName("is_active") val isActive: Boolean = false,
    val plan: String? = null,
    @SerialName("expires_at") val expiresAt: String? = null,
    val provider: String? = null,
    @SerialName("product_id") val productId: String? = null
)

@Serializable
data class PaymentOrder(
    val id: String = "",
    val plan: String? = null,
    val amount: Double? = null,
    val currency: String? = null,
    val status: String? = null,
    @SerialName("payment_provider") val paymentProvider: String? = null,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class PromoResponse(
    val valid: Boolean? = null,
    val message: String? = null,
    val description: String? = null,
    val plan: String? = null,
    val discount: Double? = null,
    @SerialName("subscription_plan") val subscriptionPlan: String? = null,
    @SerialName("subscription_status") val subscriptionStatus: String? = null
) {
    val displayMessage: String get() = message ?: description ?: ""
}

data class FallbackPlan(
    val name: String,
    val productId: String,
    val displayPrice: String,
    val perUnit: String?,
    val subtitle: String?,
    val badge: String?
)

class BillingRepository(private val apiClient: ApiClient) {

    companion object {
        // iOS-aligned SKU identifiers. Lifetime is the regular full-price product;
        // lifetime_offer is the discounted \u20B94,999 SKU shown via the upgrade banner
        // and the timed offer sheet (matches BillingViewModel.swift line 48-49).
        const val PRODUCT_MONTHLY        = "com.spentyai.monthly"
        const val PRODUCT_QUARTERLY      = "com.spentyai.quarterly"
        const val PRODUCT_YEARLY         = "com.spentyai.yearly"
        const val PRODUCT_LIFETIME       = "com.spentyai.lifetime"
        const val PRODUCT_LIFETIME_OFFER = "com.spentyai.lifetime_offer"

        val fallbackPlans = listOf(
            // Regular Lifetime price reflects the full-price SKU on iOS (\u20B99,999).
            // The \u20B94,999 lifetime_offer is shown separately via the upgrade banner /
            // intercept sheet and is not iterated as its own card.
            FallbackPlan("Monthly", PRODUCT_MONTHLY, "\u20B9199", "/month", "Flexible, cancel anytime", null),
            FallbackPlan("Quarterly", PRODUCT_QUARTERLY, "\u20B9449", "/3 months", "Save 25% vs monthly", null),
            FallbackPlan("Yearly", PRODUCT_YEARLY, "\u20B91,499", "/year", "Save 37% -- most popular", "Popular"),
            FallbackPlan("Lifetime", PRODUCT_LIFETIME, "\u20B99,999", "one-time", "Pay once, use forever", "Best Value")
        )

        /** The 50%-off lifetime SKU. Surfaced via the upgrade banner and the
         *  Monthly-intercept timed offer sheet \u2014 never as its own plan card. */
        val lifetimeOfferPlan = FallbackPlan(
            name = "Lifetime",
            productId = PRODUCT_LIFETIME_OFFER,
            displayPrice = "\u20B94,999",
            perUnit = "one-time",
            subtitle = "Pay once, use forever",
            badge = "50% OFF"
        )
    }

    suspend fun getPlans(): ApiResult<List<PlanDTO>> {
        // iOS-aligned: GET /api/payments/plans → { "plans": [PlanDTO, ...] }
        return apiClient.safeApiCall { apiClient.endpoints.getSubscriptionPlans() }
            .map { json ->
                val arr = json["plans"] as? kotlinx.serialization.json.JsonArray
                    ?: return@map emptyList<PlanDTO>()
                arr.mapNotNull { el ->
                    val obj = el as? JsonObject ?: return@mapNotNull null
                    PlanDTO(
                        id = (obj["plan_id"] as? JsonPrimitive)?.contentOrNull
                            ?: (obj["id"] as? JsonPrimitive)?.contentOrNull ?: "",
                        name = (obj["name"] as? JsonPrimitive)?.contentOrNull,
                        amount = (obj["amount"] as? JsonPrimitive)?.intOrNull,
                        amountDisplay = (obj["amount_display"] as? JsonPrimitive)?.contentOrNull,
                        currency = (obj["currency"] as? JsonPrimitive)?.contentOrNull,
                        durationDays = (obj["duration_days"] as? JsonPrimitive)?.intOrNull
                    )
                }
            }
    }

    suspend fun getStatus(): ApiResult<SubscriptionStatus> {
        return apiClient.safeApiCall { apiClient.endpoints.getSubscriptionStatus() }
            .map { json ->
                SubscriptionStatus(
                    isActive = json["is_active"]?.toString()?.removeSurrounding("\"") == "true",
                    plan = json["plan"]?.toString()?.removeSurrounding("\""),
                    expiresAt = json["expires_at"]?.toString()?.removeSurrounding("\""),
                    provider = json["provider"]?.toString()?.removeSurrounding("\""),
                    productId = json["product_id"]?.toString()?.removeSurrounding("\"")
                )
            }
    }

    suspend fun getHistory(): ApiResult<List<PaymentOrder>> {
        return apiClient.safeApiCall { apiClient.endpoints.getPaymentHistory() }
            .map { items -> items.map { jsonToPaymentOrder(it) } }
    }

    suspend fun validatePromo(code: String): ApiResult<PromoResponse> {
        val body = buildJsonObject { put("code", code) }
        return apiClient.safeApiCall { apiClient.endpoints.validatePromo(body) }
            .map { jsonToPromoResponse(it) }
    }

    suspend fun activatePromo(code: String): ApiResult<PromoResponse> {
        val body = buildJsonObject { put("code", code) }
        return apiClient.safeApiCall { apiClient.endpoints.activatePromo(body) }
            .map { jsonToPromoResponse(it) }
    }

    private fun jsonToPromoResponse(json: JsonObject): PromoResponse {
        return PromoResponse(
            valid = json["valid"]?.let { (it as? JsonPrimitive)?.booleanOrNull },
            message = json["message"]?.let { (it as? JsonPrimitive)?.contentOrNull },
            description = json["description"]?.let { (it as? JsonPrimitive)?.contentOrNull },
            plan = json["plan"]?.let { (it as? JsonPrimitive)?.contentOrNull },
            discount = json["discount"]?.let { (it as? JsonPrimitive)?.doubleOrNull },
            subscriptionPlan = json["subscription_plan"]?.let { (it as? JsonPrimitive)?.contentOrNull },
            subscriptionStatus = json["subscription_status"]?.let { (it as? JsonPrimitive)?.contentOrNull }
        )
    }


    private fun jsonToPaymentOrder(json: JsonObject): PaymentOrder {
        return PaymentOrder(
            id = json["id"]?.let { (it as? JsonPrimitive)?.contentOrNull } ?: "",
            plan = json["plan"]?.let { (it as? JsonPrimitive)?.contentOrNull },
            amount = json["amount"]?.let { (it as? JsonPrimitive)?.doubleOrNull },
            currency = json["currency"]?.let { (it as? JsonPrimitive)?.contentOrNull },
            status = json["status"]?.let { (it as? JsonPrimitive)?.contentOrNull },
            paymentProvider = json["payment_provider"]?.let { (it as? JsonPrimitive)?.contentOrNull },
            createdAt = json["created_at"]?.let { (it as? JsonPrimitive)?.contentOrNull }
        )
    }

    suspend fun verifyPurchase(purchase: Purchase): ApiResult<Unit> {
        val productId = purchase.products.firstOrNull() ?: ""
        val body = buildJsonObject {
            put("platform", "android")
            put("package_name", purchase.packageName)
            put("product_id", productId)
            put("purchase_token", purchase.purchaseToken)
            purchase.orderId?.let { put("order_id", it) }
        }
        return apiClient.safeApiCall { apiClient.endpoints.verifySubscription(body) }
            .map { /* discard JSON body */ }
    }

    suspend fun cancelSubscription(): ApiResult<Unit> {
        return ApiResult.Success(Unit)
    }
}
