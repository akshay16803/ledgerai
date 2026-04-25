package com.spentyai.app.features.paymentplans

import com.spentyai.app.core.models.PaymentPlan
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult

class PaymentPlansRepository(private val apiClient: ApiClient) {

    suspend fun fetchAll(): ApiResult<List<PaymentPlan>> =
        apiClient.safeApiCall { apiClient.endpoints.getPaymentPlans() }
}
