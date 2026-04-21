package com.spentyai.app.features.support

import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
data class FAQItem(
    val id: String = "",
    val question: String? = null,
    val answer: String? = null
)

@Serializable
data class TicketSubmitResponse(
    val success: Boolean = false,
    val message: String? = null,
    @SerialName("ticket_id") val ticketId: String? = null
)

class SupportRepository(private val apiClient: ApiClient) {

    suspend fun submitTicket(
        subject: String,
        category: String,
        priority: String,
        message: String
    ): ApiResult<TicketSubmitResponse> {
        val body = buildJsonObject {
            put("subject", subject)
            put("category", category)
            put("priority", priority)
            put("description", message)
        }
        return apiClient.safeApiCall { apiClient.endpoints.createSupportTicket(body) }
            .map { TicketSubmitResponse(success = true, ticketId = it.id) }
    }

    suspend fun getFAQ(): ApiResult<List<FAQItem>> {
        // Default FAQ items since API may not have dedicated FAQ endpoint
        return ApiResult.Success(
            listOf(
                FAQItem(
                    id = "1",
                    question = "How do I connect my email for automatic sync?",
                    answer = "Go to More > Email Sync and follow the prompts to connect your Gmail or Outlook account. SpentyAI will automatically categorize transactions from your email receipts."
                ),
                FAQItem(
                    id = "2",
                    question = "How is my data secured?",
                    answer = "All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We never share your financial data with third parties. You can delete all your data at any time from Settings."
                ),
                FAQItem(
                    id = "3",
                    question = "Can I export my data?",
                    answer = "Yes! You can export transactions, invoices, and reports as CSV or PDF from the Reports section or individual list views."
                ),
                FAQItem(
                    id = "4",
                    question = "How do I change my subscription plan?",
                    answer = "Go to More > Billing to view available plans and manage your subscription. Changes take effect immediately."
                ),
                FAQItem(
                    id = "5",
                    question = "What happens if I reset my data?",
                    answer = "Reset Data removes all transactions, accounts, invoices, bills, customers, vendors, and reports. Your account and settings are preserved. This action cannot be undone."
                )
            )
        )
    }
}
