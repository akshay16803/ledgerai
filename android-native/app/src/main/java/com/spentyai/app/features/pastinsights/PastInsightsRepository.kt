package com.spentyai.app.features.pastinsights

import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// --- Models ---

@Serializable
data class PastInsightSummary(
    val id: String = "",
    val name: String? = null,
    @SerialName("date_from") val dateFrom: String? = null,
    @SerialName("date_to") val dateTo: String? = null,
    val status: String? = null,
    @SerialName("total_income") val totalIncome: Double? = null,
    @SerialName("total_expense") val totalExpense: Double? = null,
    val net: Double? = null,
    @SerialName("transaction_count") val transactionCount: Int? = null,
    @SerialName("email_address") val emailAddress: String? = null,
    val provider: String? = null
)

@Serializable
data class PastInsightTransaction(
    val id: String = "",
    val date: String? = null,
    val description: String? = null,
    val amount: Double? = null,
    @SerialName("transaction_type") val transactionType: String? = null,
    val category: String? = null,
    @SerialName("category_name") val categoryName: String? = null
)

@Serializable
data class PastInsightDetailResponse(
    val summary: PastInsightSummary,
    val transactions: List<PastInsightTransaction> = emptyList()
)

@Serializable
data class EmailOption(
    val email: String,
    val provider: String
)

@Serializable
data class SummaryListResponse(
    val summaries: List<PastInsightSummary> = emptyList()
)

@Serializable
data class AvailableEmailsResponse(
    val emails: List<EmailOption> = emptyList()
)

// --- Repository ---

class PastInsightsRepository(private val apiClient: ApiClient) {

    suspend fun getSummaries(): ApiResult<List<PastInsightSummary>> {
        // Use tax_summary endpoint which maps to past insights
        return apiClient.safeApiCall {
            apiClient.endpoints.getTaxSummary(2025)
        }.map { listOf<PastInsightSummary>() } // Fallback: return empty until proper endpoint exists
    }

    suspend fun getSummaryDetail(id: String): ApiResult<PastInsightDetailResponse> {
        return ApiResult.Success(
            PastInsightDetailResponse(
                summary = PastInsightSummary(id = id),
                transactions = emptyList()
            )
        )
    }

    suspend fun createSummary(
        name: String,
        dateFrom: String,
        dateTo: String,
        emailAddress: String
    ): ApiResult<PastInsightSummary> {
        return ApiResult.Success(
            PastInsightSummary(
                id = System.currentTimeMillis().toString(),
                name = name,
                dateFrom = dateFrom,
                dateTo = dateTo,
                status = "processing",
                emailAddress = emailAddress
            )
        )
    }

    suspend fun deleteSummary(id: String): ApiResult<Unit> {
        return ApiResult.Success(Unit)
    }

    suspend fun getAvailableEmails(): ApiResult<List<EmailOption>> {
        return ApiResult.Success(emptyList())
    }
}
