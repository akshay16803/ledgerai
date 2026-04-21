package com.spentyai.app.features.dashboard

import com.spentyai.app.core.models.CashFlowProjection
import com.spentyai.app.core.models.DashboardSummary
import com.spentyai.app.core.models.PendingReviewResponse
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult

class DashboardRepository(private val apiClient: ApiClient) {

    suspend fun getSummary(): ApiResult<DashboardSummary> =
        apiClient.safeApiCall { apiClient.endpoints.getDashboardSummary() }

    suspend fun getPendingReview(): ApiResult<PendingReviewResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getPendingReview() }

    suspend fun getCashFlowProjection(): ApiResult<CashFlowProjection> =
        apiClient.safeApiCall { apiClient.endpoints.getCashFlowProjectionFull() }
}
