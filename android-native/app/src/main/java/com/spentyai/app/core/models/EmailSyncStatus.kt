package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class EmailAccount(
    val gmailEmail: String? = null,
    val outlookEmail: String? = null,
    val provider: String? = null,
    val connectedAt: String? = null,
    val syncFromDate: String? = null,
    val syncing: Boolean? = null,
    val needsReconnect: Boolean? = null,
    val stats: SyncStats? = null
) {
    val email: String? get() = gmailEmail ?: outlookEmail
    val id: String get() = email ?: java.util.UUID.randomUUID().toString()
}

@Serializable
data class SyncStats(
    val totalSynced: Int? = null,
    val processedByAi: Int? = null,
    val transactionsCreated: Int? = null,
    val pendingReview: Int? = null,
    val noTransaction: Int? = null,
    val aiPending: Int? = null,
    val aiFailed: Int? = null,
    val isProcessing: Boolean? = null
)

@Serializable
data class OAuthConnectResponse(
    val authUrl: String? = null,
    val message: String? = null
)

@Serializable
data class EmailProviderStatus(
    val connected: Boolean? = null,
    val accounts: List<EmailAccount>? = null,
    val message: String? = null
)

@Serializable
data class EmailSyncResponse(
    val message: String? = null,
    val gmailEmail: String? = null
)

@Serializable
data class EmailRetryResponse(
    val message: String? = null,
    val count: Int? = null,
    val alreadyProcessing: Boolean? = null
)

@Serializable
data class EmailSyncStatsResponse(
    val totalSynced: Int? = null,
    val processedByAi: Int? = null,
    val transactionsCreated: Int? = null,
    val pendingReview: Int? = null,
    val aiFailed: Int? = null,
    val aiPending: Int? = null,
    val isProcessing: Boolean? = null
)

@Serializable
data class GenericMessageResponse(
    val message: String? = null,
    val success: Boolean? = null
)

@Serializable
data class PendingTransaction(
    @SerialName("transactionId") val id: String = "",
    val date: String? = null,
    val description: String? = null,
    val amount: Double? = null,
    val accountId: String? = null,
    val accountName: String? = null,
    val categoryId: String? = null,
    val categoryName: String? = null,
    val subcategoryId: String? = null,
    val paymentMethod: String? = null,
    val transactionType: String? = null,
    val source: String? = null,
    val status: String? = null,
    val sourceEmailId: String? = null,
    val sourceSmsId: String? = null,
    val isRecurring: Boolean? = null,
    val recurringFrequency: String? = null,
    val recurrenceDate: Int? = null
) {
    val sourceId: String? get() = sourceEmailId ?: sourceSmsId
}

@Serializable
data class PendingReviewResponse(
    val transactions: List<PendingTransaction> = emptyList(),
    val total: Int? = null
)

@Serializable
data class PendingTransactionUpdate(
    val description: String? = null,
    val amount: Double? = null,
    val accountId: String? = null,
    val toAccountId: String? = null,
    val categoryId: String? = null,
    val subcategoryId: String? = null,
    val transactionType: String? = null,
    val paymentMethod: String? = null,
    val isRecurring: Boolean? = null,
    val recurringFrequency: String? = null,
    val recurrenceDate: Int? = null
)

@Serializable
data class DisconnectRequest(
    val gmailEmail: String? = null,
    val outlookEmail: String? = null
)

@Serializable
data class StartSyncRequest(
    val gmailEmail: String,
    val syncFromDate: String
)

@Serializable
data class RetryPendingRequest(
    val gmailEmail: String
)

@Serializable
data class BulkTransactionRequest(
    val transactionIds: List<String>
)

@Serializable
data class SourceContent(
    val type: String = "",
    val sourceId: String? = null,
    val subject: String? = null,
    val from: String? = null,
    val sender: String? = null,
    val date: String? = null,
    val snippet: String? = null,
    val body: String? = null
)

@Serializable
data class SMSSyncStats(
    val totalSynced: Int? = null,
    val transactionsCreated: Int? = null,
    val pendingReview: Int? = null,
    val isProcessing: Boolean? = null
)
