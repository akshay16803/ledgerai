package com.spentyai.app.features.featurerequests

import com.spentyai.app.core.models.FeatureRequest
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
data class VoteResponse(
    val votes: Int = 0
)

enum class FeatureRequestCategory(val value: String, val displayName: String) {
    FEATURE("feature", "Feature"),
    IMPROVEMENT("improvement", "Improvement"),
    INTEGRATION("integration", "Integration"),
    UI("ui", "UI/UX"),
    OTHER("other", "Other")
}

class FeatureRequestsRepository(private val apiClient: ApiClient) {

    suspend fun getAll(): ApiResult<List<FeatureRequest>> {
        return apiClient.safeApiCall { apiClient.endpoints.getFeatureRequests() }
    }

    suspend fun create(
        title: String,
        description: String,
        category: String
    ): ApiResult<FeatureRequest> {
        val body = buildJsonObject {
            put("title", title)
            put("description", description)
            put("category", category)
        }
        return apiClient.safeApiCall { apiClient.endpoints.createFeatureRequest(body) }
    }

    suspend fun vote(id: String): ApiResult<FeatureRequest> {
        return apiClient.safeApiCall { apiClient.endpoints.voteFeatureRequest(id) }
    }
}
