package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SupportTicket(
    @SerialName("ticket_id") val id: String,
    val subject: String,
    val description: String,
    val status: TicketStatus = TicketStatus.OPEN,
    val priority: TicketPriority = TicketPriority.NORMAL,
    val category: String? = null,
    val messages: List<TicketMessage>? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("resolved_at") val resolvedAt: String? = null
)

@Serializable
enum class TicketStatus {
    @SerialName("open") OPEN,
    @SerialName("in_progress") IN_PROGRESS,
    @SerialName("waiting_on_customer") WAITING_ON_CUSTOMER,
    @SerialName("resolved") RESOLVED,
    @SerialName("closed") CLOSED
}

@Serializable
enum class TicketPriority {
    @SerialName("low") LOW,
    @SerialName("normal") NORMAL,
    @SerialName("high") HIGH,
    @SerialName("urgent") URGENT
}

@Serializable
data class TicketMessage(
    @SerialName("message_id") val id: String,
    val content: String,
    @SerialName("is_staff") val isStaff: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null
)
