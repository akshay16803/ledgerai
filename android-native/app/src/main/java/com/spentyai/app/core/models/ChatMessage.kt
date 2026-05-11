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
    val metadata: ChatMetadata? = null,
    // AI-side entity creation flags (mirror backend response shape).
    // When true the corresponding entity has been saved server-side and
    // the UI should refresh the relevant list. Added 2026-05-12 for AI
    // account creation; transaction/invoice/bill flags wired in same
    // commit for completeness.
    @SerialName("transaction_posted") val transactionPosted: Boolean? = null,
    @SerialName("invoice_created") val invoiceCreated: Boolean? = null,
    @SerialName("bill_created") val billCreated: Boolean? = null,
    @SerialName("account_created") val accountCreated: Boolean? = null
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
