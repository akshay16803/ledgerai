package com.spentyai.app.features.reconciliation

import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult

class ReconciliationRepository(private val apiClient: ApiClient) {

    // Statements
    suspend fun fetchStatements(): ApiResult<StatementListResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getStatementsList() }

    suspend fun fetchStatement(id: String): ApiResult<Statement> =
        apiClient.safeApiCall { apiClient.endpoints.getStatementDetail(id) }

    suspend fun deleteStatement(id: String): ApiResult<MessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.deleteStatementFull(id) }

    // Entries
    suspend fun fetchEntries(statementId: String): ApiResult<EntriesResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getStatementEntries(statementId) }

    suspend fun updateEntry(statementId: String, index: Int, body: EntryUpdateBody): ApiResult<EntryUpdateResponse> =
        apiClient.safeApiCall { apiClient.endpoints.updateStatementEntry(statementId, index, body) }

    suspend fun bulkCategorize(statementId: String, body: BulkCategorizeBody): ApiResult<BulkCategorizeResponse> =
        apiClient.safeApiCall { apiClient.endpoints.bulkCategorize(statementId, body) }

    // Reconciliation Actions
    suspend fun reconcile(statementId: String): ApiResult<ReconcileResponse> =
        apiClient.safeApiCall { apiClient.endpoints.reconcileStatement(statementId) }

    suspend fun addMissingToLedger(statementId: String, body: AddMissingBody): ApiResult<AddMissingResponse> =
        apiClient.safeApiCall { apiClient.endpoints.addMissingToLedger(statementId, body) }

    suspend fun reaudit(statementId: String): ApiResult<ReauditResponse> =
        apiClient.safeApiCall { apiClient.endpoints.reauditStatement(statementId) }

    suspend fun unlock(statementId: String, body: UnlockBody): ApiResult<ReauditResponse> =
        apiClient.safeApiCall { apiClient.endpoints.unlockStatement(statementId, body) }

    // Approve / Reject
    suspend fun approveStatement(id: String): ApiResult<ApproveResponse> =
        apiClient.safeApiCall { apiClient.endpoints.approveStatement(id) }

    suspend fun rejectStatement(id: String): ApiResult<MessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.rejectStatement(id) }

    // Supporting Data
    suspend fun fetchAccounts(): ApiResult<AccountListResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getAccounts() }

    suspend fun fetchAccountSubTypes(): ApiResult<List<AccountSubType>> =
        apiClient.safeApiCall { apiClient.endpoints.getAccountSubTypesList() }

    suspend fun fetchCategories(): ApiResult<List<Category>> =
        apiClient.safeApiCall { apiClient.endpoints.getCategories() }
}
