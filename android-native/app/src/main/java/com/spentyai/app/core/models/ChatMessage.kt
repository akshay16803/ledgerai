package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ChatMessage(
    @SerialName("message_id") val id: String,
    val role: ChatRole,
    val content: String,
    val timestamp: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    val metadata: ChatMetadata? = null
)

@Serializable
enum class ChatRole {
    @SerialName("user") USER,
    @SerialName("assistant") ASSISTANT,
    @SerialName("system") SYSTEM
}

@Serializable
data class ChatMetadata(
    @SerialName("tokens_used") val tokensUsed: Int? = null,
    val model: String? = null,
    @SerialName("processing_time") val processingTime: Double? = null,
    val actions: List<ChatAction>? = null
)

@Serializable
data class ChatAction(
    val type: String,
    val description: String? = null,
    val data: kotlinx.serialization.json.JsonObject? = null
)
