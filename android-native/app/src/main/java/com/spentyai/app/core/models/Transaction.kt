package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Transaction(
    @SerialName("transactionId") val id: String = "",
    val transactionType: String? = null,
    val amount: Double? = null,
    val date: String? = null,
    val accountId: String? = null,
    val toAccountId: String? = null,
    val categoryId: String? = null,
    val subcategoryId: String? = null,
    val description: String? = null,
    val paymentMethod: String? = null,
    var status: String? = null,
    val isRecurring: Boolean? = null,
    val recurringFrequency: String? = null,
    val recurrenceDate: Int? = null,
    val source: String? = null,
    val receiptId: String? = null,
    val originalCurrency: String? = null,
    val originalAmount: Double? = null,
    val exchangeRate: Double? = null,
    val isEstimatedRate: Boolean? = null,
    @SerialName("source_email_id") val sourceEmailId: String? = null,
    @SerialName("source_sms_id") val sourceSmsId: String? = null,
    val categoryName: String? = null,
    var subcategoryName: String? = null,
    val accountName: String? = null,
    val toAccountName: String? = null
) {
    val sourceId: String? get() = sourceEmailId ?: sourceSmsId
}

@Serializable
data class TransactionListResponse(
    val transactions: List<Transaction> = emptyList(),
    val total: Int? = null
)

@Serializable
data class TransactionItemsResponse(
    val items: List<Transaction> = emptyList(),
    val total: Int? = null
) {
    fun asListResponse() = TransactionListResponse(transactions = items, total = total)
}

@Serializable
data class BulkIdsBody(
    @SerialName("transaction_ids") val transactionIds: List<String>
)

@Serializable
data class RecurringToggleBody(
    @SerialName("is_recurring") val isRecurring: Boolean,
    @SerialName("recurring_frequency") val recurringFrequency: String? = null
)

// Legacy enum kept for backward compatibility but the API uses string types
@Serializable
enum class TransactionType {
    @SerialName("income") INCOME,
    @SerialName("expense") EXPENSE,
    @SerialName("transfer") TRANSFER,
    @SerialName("refund") REFUND,
    @SerialName("adjustment") ADJUSTMENT
}
