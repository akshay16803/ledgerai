package com.spentyai.app.features.records

import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult

class RecordsRepository(private val apiClient: ApiClient) {

    // Records
    suspend fun fetchRecords(
        skip: Int = 0,
        limit: Int = 30,
        dateFrom: String? = null,
        dateTo: String? = null,
        amountMin: Double? = null,
        amountMax: Double? = null
    ): ApiResult<RecordListResponse> =
        apiClient.safeApiCall {
            apiClient.endpoints.getRecordsList(
                skip = skip,
                limit = limit,
                dateFrom = dateFrom,
                dateTo = dateTo,
                amountMin = amountMin,
                amountMax = amountMax
            )
        }

    suspend fun searchRecords(query: String, skip: Int = 0, limit: Int = 30): ApiResult<RecordSearchResponse> =
        apiClient.safeApiCall { apiClient.endpoints.searchRecords(query = query, skip = skip, limit = limit) }

    suspend fun fetchRecordPreview(id: String): ApiResult<RecordPreviewResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getRecordPreview(id) }

    suspend fun fetchRecordByTransaction(transactionId: String): ApiResult<RecordPreviewResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getRecordByTransaction(transactionId) }

    suspend fun deleteRecord(id: String): ApiResult<MessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.deleteRecordFull(id) }

    suspend fun downloadEml(id: String): ApiResult<okhttp3.ResponseBody> =
        apiClient.safeApiCall { apiClient.endpoints.downloadEml(id) }

    suspend fun downloadAttachment(id: String, index: Int): ApiResult<okhttp3.ResponseBody> =
        apiClient.safeApiCall { apiClient.endpoints.downloadAttachment(id, index) }

    suspend fun downloadZip(archiveIds: List<String>): ApiResult<okhttp3.ResponseBody> =
        apiClient.safeApiCall { apiClient.endpoints.downloadZip(DownloadZipBody(archiveIds = archiveIds)) }

    // Receipts
    suspend fun fetchReceipts(skip: Int = 0, limit: Int = 30): ApiResult<ReceiptListResponse> =
        apiClient.safeApiCall { apiClient.endpoints.getReceipts(skip = skip, limit = limit) }

    suspend fun fetchReceipt(id: String): ApiResult<Receipt> =
        apiClient.safeApiCall { apiClient.endpoints.getReceipt(id) }

    suspend fun deleteReceipt(id: String): ApiResult<MessageResponse> =
        apiClient.safeApiCall { apiClient.endpoints.deleteReceipt(id) }

    suspend fun downloadReceipt(id: String): ApiResult<okhttp3.ResponseBody> =
        apiClient.safeApiCall { apiClient.endpoints.downloadReceipt(id) }

    suspend fun parseReceipt(id: String): ApiResult<ReceiptParseResponse> =
        apiClient.safeApiCall { apiClient.endpoints.parseReceipt(id) }

    suspend fun linkReceipt(id: String, transactionId: String): ApiResult<ReceiptLinkResponse> =
        apiClient.safeApiCall { apiClient.endpoints.linkReceipt(id, ReceiptLinkBody(transactionId = transactionId)) }

    suspend fun receiptByTransaction(transactionId: String): ApiResult<Receipt> =
        apiClient.safeApiCall { apiClient.endpoints.getReceiptByTransaction(transactionId) }
}
