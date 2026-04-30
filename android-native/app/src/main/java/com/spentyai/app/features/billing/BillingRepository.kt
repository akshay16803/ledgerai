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
        val fallbackPlans = listOf(
            FallbackPlan("Monthly", "com.spentyai.monthly", "\u20B9199", "/month", "Flexible, cancel anytime", null),
            FallbackPlan("Quarterly", "com.spentyai.quarterly", "\u20B9449", "/3 months", "Save 25% vs monthly", null),
            FallbackPlan("Yearly", "com.spentyai.yearly", "\u20B91,499", "/year", "Save 37% -- most popular", "Popular"),
            FallbackPlan("Lifetime", "com.spentyai.lifetime", "\u20B94,999", "one-time", "Pay once, use forever", "Best Value")
        )
    }

    suspend fun getPlans(): ApiResult<List<PlanDTO>> {
        return apiClient.safeApiCall { apiClient.endpoints.getPaymentPlans() }
            .map { plans ->
                plans.map { p ->
                    PlanDTO(
                        id = p.id,
                        name = p.name,
                        amount = p.totalAmount.toInt(),
                        currency = p.currency
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
        // Use payment plans as proxy if no dedicated history endpoint
        return ApiResult.Success(emptyList())
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
