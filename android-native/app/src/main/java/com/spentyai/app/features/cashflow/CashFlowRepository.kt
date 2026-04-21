package com.spentyai.app.features.cashflow

import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult

class CashFlowRepository(private val apiClient: ApiClient) {

    // Projection
    suspend fun getProjection(): ApiResult<CashFlowProjection> =
        apiClient.safeApiCall { apiClient.endpoints.getCashFlowProjectionFull() }

    suspend fun getHistory(): ApiResult<CashFlowProjection> =
        apiClient.safeApiCall { apiClient.endpoints.getCashFlowHistory() }

    // Mandates
    suspend fun getMandates(): ApiResult<MandateListResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getMandatesList() }

    suspend fun getUpcoming(): ApiResult<UpcomingMandatesResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getUpcomingMandates() }

    suspend fun createMandate(body: MandateCreateBody): ApiResult<Mandate> =
        apiClient.safeApiCall { apiClient.endpoints.createMandateFull(body) }

    suspend fun updateMandate(id: String, body: MandateUpdateBody): ApiResult<Mandate> =
        apiClient.safeApiCall { apiClient.endpoints.patchMandate(id, body) }

    suspend fun deleteMandate(id: String): ApiResult<MessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.deleteMandateFull(id) }

    suspend fun detectMandates(): ApiResult<DetectMandatesResponse> =
        apiClient.safeApiCall { apiClient.endpoints.detectMandates() }

    // Recurring
    suspend fun getRecurringList(): ApiResult<RecurringListResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getRecurringList() }

    suspend fun toggleRecurring(transactionId: String, body: ToggleRecurringBody): ApiResult<Transaction> =
        apiClient.safeApiCall { apiClient.endpoints.toggleRecurringCashFlow(transactionId, body) }
}
