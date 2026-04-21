package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class FeatureRequest(
    @SerialName("request_id") val id: String,
    val title: String,
    val description: String,
    val status: FeatureRequestStatus = FeatureRequestStatus.OPEN,
    val votes: Int = 0,
    @SerialName("has_voted") val hasVoted: Boolean = false,
    val category: String? = null,
    @SerialName("submitted_by") val submittedBy: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
enum class FeatureRequestStatus {
    @SerialName("open") OPEN,
    @SerialName("planned") PLANNED,
    @SerialName("in_progress") IN_PROGRESS,
    @SerialName("completed") COMPLETED,
    @SerialName("declined") DECLINED
}
