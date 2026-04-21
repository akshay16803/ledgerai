package com.spentyai.app.features.emailsync

import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult

class EmailSyncRepository(private val apiClient: ApiClient) {

    // Gmail
    suspend fun connectGmail(): ApiResult<OAuthConnectResponse> =
        apiClient.safeApiCall { apiClient.endpoints.connectGmail() }

    suspend fun gmailStatus(): ApiResult<EmailProviderStatus> =
        apiClient.safeApiCall { apiClient.endpoints.getGmailStatus() }

    suspend fun disconnectGmail(email: String): ApiResult<GenericMessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.disconnectGmail(DisconnectRequest(gmailEmail = email)) }

    // Outlook
    suspend fun connectOutlook(): ApiResult<OAuthConnectResponse> =
        apiClient.safeApiCall { apiClient.endpoints.connectOutlook() }

    suspend fun outlookStatus(): ApiResult<EmailProviderStatus> =
        apiClient.safeApiCall { apiClient.endpoints.getOutlookStatus() }

    suspend fun disconnectOutlook(email: String): ApiResult<GenericMessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.disconnectOutlook(DisconnectRequest(outlookEmail = email)) }

    // Sync
    suspend fun startSync(gmailEmail: String, syncFromDate: String): ApiResult<EmailSyncResponse> =
        apiClient.safeApiCall { apiClient.endpoints.startEmailSync(StartSyncRequest(gmailEmail = gmailEmail, syncFromDate = syncFromDate)) }

    suspend fun retryPending(gmailEmail: String): ApiResult<EmailRetryResponse> =
        apiClient.safeApiCall { apiClient.endpoints.retryPendingEmails(RetryPendingRequest(gmailEmail = gmailEmail)) }

    // Stats & Review
    suspend fun syncStats(): ApiResult<EmailSyncStatsResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getEmailSyncStats() }

    suspend fun pendingReview(): ApiResult<PendingReviewResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getPendingReview() }

    suspend fun approveTransaction(id: String): ApiResult<GenericMessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.approveTransaction(id) }

    suspend fun rejectTransaction(id: String): ApiResult<GenericMessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.rejectTransaction(id) }

    suspend fun bulkApproveTransactions(ids: List<String>): ApiResult<GenericMessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.bulkApproveTransactions(BulkTransactionRequest(transactionIds = ids)) }

    suspend fun bulkRejectTransactions(ids: List<String>): ApiResult<GenericMessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.bulkRejectTransactions(BulkTransactionRequest(transactionIds = ids)) }

    suspend fun updateTransaction(id: String, body: PendingTransactionUpdate): ApiResult<Transaction> =
        apiClient.safeApiCall { apiClient.endpoints.patchTransaction(id, body) }

    // SMS Stats
    suspend fun smsStats(): ApiResult<SMSSyncStats> =
        apiClient.safeApiCall { apiClient.endpoints.getSmsStats() }

    // Source Content
    suspend fun sourceContent(id: String): ApiResult<SourceContent> =
        apiClient.safeApiCall { apiClient.endpoints.getSourceContent(id) }

    // Accounts & Categories (for edit form)
    suspend fun fetchAccounts(): ApiResult<AccountListResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getAccounts() }

    suspend fun fetchCategories(): ApiResult<List<Category>> =
        apiClient.safeApiCall { apiClient.endpoints.getCategories() }
}
