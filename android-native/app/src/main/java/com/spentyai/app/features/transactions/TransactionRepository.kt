package com.spentyai.app.features.transactions

import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

class TransactionRepository(private val apiClient: ApiClient) {

    // MARK: - List / Pagination

    suspend fun fetchTransactions(
        page: Int = 1,
        limit: Int = 30,
        type: String? = null,
        accountId: String? = null,
        categoryId: String? = null,
        subcategoryId: String? = null,
        dateFrom: String? = null,
        dateTo: String? = null,
        status: String? = null
    ): ApiResult<TransactionListResponse> {
        val skip = (page - 1) * limit
        return apiClient.safeApiCall {
            apiClient.endpoints.getTransactions(
                skip = skip,
                limit = limit,
                transactionType = type,
                accountId = accountId,
                categoryId = categoryId,
                fromDate = dateFrom,
                toDate = dateTo,
                status = status
            )
        }
    }

    suspend fun fetchPending(): ApiResult<TransactionListResponse> {
        return apiClient.safeApiCall { apiClient.endpoints.getPendingTransactions() }
            .map { it.asListResponse() }
    }

    // MARK: - Search

    suspend fun search(
        query: String,
        page: Int = 1,
        limit: Int = 30
    ): ApiResult<TransactionListResponse> {
        val skip = (page - 1) * limit
        return apiClient.safeApiCall {
            apiClient.endpoints.searchTransactions(
                query = query,
                skip = skip,
                limit = limit,
                status = "approved"
            )
        }.map { it.asListResponse() }
    }

    // MARK: - CRUD

    suspend fun fetchTransaction(id: String): ApiResult<Transaction> {
        return apiClient.safeApiCall { apiClient.endpoints.getTransaction(id) }
    }

    suspend fun createTransaction(payload: JsonObject): ApiResult<Transaction> {
        return apiClient.safeApiCall { apiClient.endpoints.createTransaction(payload) }
    }

    suspend fun updateTransaction(id: String, payload: JsonObject): ApiResult<Transaction> {
        return apiClient.safeApiCall { apiClient.endpoints.updateTransaction(id, payload) }
    }

    suspend fun deleteTransaction(id: String): ApiResult<JsonObject> {
        return apiClient.safeApiCall { apiClient.endpoints.deleteTransaction(id) }
    }

    // MARK: - Approve / Reject

    suspend fun approveTransaction(id: String): ApiResult<Transaction> {
        return apiClient.safeApiCall { apiClient.endpoints.approveTransaction(id) }
    }

    suspend fun rejectTransaction(id: String): ApiResult<MessageResponse> {
        return apiClient.safeApiCall { apiClient.endpoints.rejectTransaction(id) }
    }

    // MARK: - Bulk Operations

    suspend fun bulkApprove(ids: List<String>): ApiResult<MessageResponse> {
        return apiClient.safeApiCall {
            apiClient.endpoints.bulkApproveTransactions(BulkIdsBody(ids))
        }
    }

    suspend fun bulkReject(ids: List<String>): ApiResult<MessageResponse> {
        return apiClient.safeApiCall {
            apiClient.endpoints.bulkRejectTransactions(BulkIdsBody(ids))
        }
    }

    suspend fun bulkDelete(ids: List<String>): ApiResult<MessageResponse> {
        return apiClient.safeApiCall {
            apiClient.endpoints.bulkDeleteTransactions(BulkIdsBody(ids))
        }
    }

    suspend fun bulkUpdate(ids: List<String>, fields: JsonObject): ApiResult<Transaction> {
        val body = JsonObject(
            mapOf(
                "transaction_ids" to kotlinx.serialization.json.JsonArray(ids.map { JsonPrimitive(it) }),
                "fields" to fields
            )
        )
        return apiClient.safeApiCall { apiClient.endpoints.createTransaction(body) }
    }

    // MARK: - Recurring

    suspend fun toggleRecurring(
        id: String,
        isRecurring: Boolean,
        frequency: String? = null
    ): ApiResult<Transaction> {
        val body = RecurringToggleBody(
            isRecurring = isRecurring,
            recurringFrequency = frequency
        )
        return apiClient.safeApiCall {
            apiClient.endpoints.toggleRecurring(id, body)
        }
    }

    // MARK: - Supporting Data

    suspend fun fetchAccounts(): ApiResult<List<Account>> {
        return apiClient.safeApiCall { apiClient.endpoints.getAccounts() }
            .map { it.accounts }
    }

    suspend fun fetchCategories(): ApiResult<List<Category>> {
        return apiClient.safeApiCall { apiClient.endpoints.getCategories() }
    }
}
