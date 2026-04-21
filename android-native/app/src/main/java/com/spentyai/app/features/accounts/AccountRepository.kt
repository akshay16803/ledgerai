package com.spentyai.app.features.accounts

import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AccountRepository(private val apiClient: ApiClient) {

    // MARK: - Accounts

    suspend fun fetchAccounts(): ApiResult<List<Account>> {
        return apiClient.safeApiCall { apiClient.endpoints.getAccounts() }
            .map { it.accounts }
    }

    suspend fun fetchAccount(id: String): ApiResult<Account> {
        return apiClient.safeApiCall { apiClient.endpoints.getAccount(id) }
            .map { it.account }
    }

    suspend fun createAccount(payload: JsonObject): ApiResult<Account> {
        return apiClient.safeApiCall { apiClient.endpoints.createAccount(payload) }
    }

    suspend fun updateAccount(id: String, payload: JsonObject): ApiResult<Account> {
        return apiClient.safeApiCall { apiClient.endpoints.updateAccount(id, payload) }
    }

    suspend fun deleteAccount(id: String): ApiResult<JsonObject> {
        return apiClient.safeApiCall { apiClient.endpoints.deleteAccount(id) }
    }

    // MARK: - Amortization & OD

    suspend fun fetchAmortization(accountId: String): ApiResult<AmortizationResponse> {
        return apiClient.safeApiCall { apiClient.endpoints.getAccountAmortization(accountId) }
    }

    suspend fun calculateODInterest(accountId: String, from: Date): ApiResult<ODInterestResponse> {
        val formatter = SimpleDateFormat("yyyy-MM", Locale.US)
        val monthStr = formatter.format(from)
        return apiClient.safeApiCall {
            apiClient.endpoints.getAccountODInterest(accountId, monthStr)
        }
    }

    // MARK: - Account Transactions

    suspend fun fetchAccountTransactions(accountId: String): ApiResult<List<Transaction>> {
        return apiClient.safeApiCall {
            apiClient.endpoints.getAccountTransactions(accountId, status = "approved")
        }.map { response ->
            response.transactions.filter {
                (it.source ?: "approved").lowercase() == "approved" || true
            }
        }
    }

    suspend fun fetchFilteredAccountTransactions(
        accountId: String,
        transactionType: String? = null,
        categoryId: String? = null,
        startDate: String? = null,
        endDate: String? = null,
        minAmount: Double? = null,
        maxAmount: Double? = null,
        search: String? = null
    ): ApiResult<Pair<List<Transaction>, Int>> {
        return apiClient.safeApiCall {
            apiClient.endpoints.getAccountTransactions(
                id = accountId,
                status = "approved",
                limit = 100,
                transactionType = transactionType,
                categoryId = categoryId,
                fromDate = startDate,
                toDate = endDate,
                minAmount = minAmount,
                maxAmount = maxAmount,
                search = search
            )
        }.map { response ->
            Pair(response.transactions, response.total ?: 0)
        }
    }

    // MARK: - Sub-Types

    suspend fun fetchSubTypes(): ApiResult<List<AccountSubType>> {
        return apiClient.safeApiCall { apiClient.endpoints.getAccountSubTypes() }
            .map { it.subTypes }
    }

    suspend fun createSubType(name: String, accountType: String): ApiResult<AccountSubType> {
        val payload = JsonObject(
            mapOf(
                "name" to JsonPrimitive(name),
                "accountType" to JsonPrimitive(accountType)
            )
        )
        return apiClient.safeApiCall { apiClient.endpoints.createAccountSubType(payload) }
            .map { it.subType }
    }

    suspend fun updateSubType(id: String, name: String): ApiResult<AccountSubType> {
        val payload = JsonObject(mapOf("name" to JsonPrimitive(name)))
        return apiClient.safeApiCall { apiClient.endpoints.updateAccountSubType(id, payload) }
            .map { it.subType }
    }

    suspend fun deleteSubType(id: String): ApiResult<JsonObject> {
        return apiClient.safeApiCall { apiClient.endpoints.deleteAccountSubType(id) }
    }

    // MARK: - Demat

    suspend fun fetchDematStatements(accountId: String): ApiResult<List<DematStatement>> {
        return apiClient.safeApiCall { apiClient.endpoints.getDematStatements(accountId) }
            .map { it.statements }
    }

    suspend fun approveDematStatement(id: String): ApiResult<DematActionResponse> {
        return apiClient.safeApiCall { apiClient.endpoints.approveDematStatement(id) }
    }

    suspend fun rejectDematStatement(id: String): ApiResult<DematActionResponse> {
        return apiClient.safeApiCall { apiClient.endpoints.rejectDematStatement(id) }
    }
}
