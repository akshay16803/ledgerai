package com.spentyai.app.features.records

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

enum class RecordsTab(val label: String) {
    EMAILS("Emails"),
    RECEIPTS("Receipts")
}

class RecordsViewModel(private val repository: RecordsRepository) : ViewModel() {

    // Data
    var records by mutableStateOf<List<Record>>(emptyList()); private set
    var receipts by mutableStateOf<List<Receipt>>(emptyList()); private set
    var recordsTotal by mutableStateOf(0); private set
    var receiptsTotal by mutableStateOf(0); private set

    // Tab
    var activeTab by mutableStateOf(RecordsTab.EMAILS)

    // Filters (Emails)
    var searchQuery by mutableStateOf("")
    var dateFrom by mutableStateOf<Date?>(null)
    var dateTo by mutableStateOf<Date?>(null)
    var amountMin by mutableStateOf("")
    var amountMax by mutableStateOf("")

    // UI State
    var isLoading by mutableStateOf(false); private set
    var isLoadingMore by mutableStateOf(false); private set
    var hasMore by mutableStateOf(true); private set

    var isLoadingReceipts by mutableStateOf(false); private set
    var isLoadingMoreReceipts by mutableStateOf(false); private set
    var receiptsHasMore by mutableStateOf(true); private set

    var errorMessage by mutableStateOf<String?>(null)
    var successMessage by mutableStateOf<String?>(null)

    var isDownloadingZip by mutableStateOf(false); private set
    var isDownloadingEml by mutableStateOf(false); private set

    // Record Preview State
    var activePreview by mutableStateOf<RecordPreviewResponse?>(null); private set
    var isLoadingPreview by mutableStateOf(false); private set
    var previewError by mutableStateOf<String?>(null); private set

    // Receipt Upload State
    var isUploading by mutableStateOf(false); private set
    var isParsing by mutableStateOf(false); private set
    var uploadedReceiptId by mutableStateOf<String?>(null)
    var parsedReceipt by mutableStateOf<Receipt?>(null)
    var linkedTransactionId by mutableStateOf("")

    private val pageSize = 30
    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    val hasDateFilter: Boolean get() = dateFrom != null || dateTo != null
    val hasAmountFilter: Boolean get() = amountMin.isNotEmpty() || amountMax.isNotEmpty()

    // Record Operations
    fun loadRecords() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null

            when (val r = fetchRecordsPage(0)) {
                is ApiResult.Success -> {
                    records = r.data.records
                    recordsTotal = r.data.total
                    hasMore = records.size < recordsTotal
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isLoading = false
        }
    }

    fun loadMoreRecords() {
        if (isLoadingMore || !hasMore) return
        viewModelScope.launch {
            isLoadingMore = true

            when (val r = fetchRecordsPage(records.size)) {
                is ApiResult.Success -> {
                    records = records + r.data.records
                    hasMore = records.size < recordsTotal
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isLoadingMore = false
        }
    }

    fun refreshRecords() {
        viewModelScope.launch {
            errorMessage = null

            when (val r = fetchRecordsPage(0)) {
                is ApiResult.Success -> {
                    records = r.data.records
                    recordsTotal = r.data.total
                    hasMore = records.size < recordsTotal
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }
        }
    }

    fun searchRecords() {
        if (searchQuery.isEmpty()) {
            refreshRecords()
            return
        }
        viewModelScope.launch {
            isLoading = true
            errorMessage = null

            when (val r = repository.searchRecords(searchQuery)) {
                is ApiResult.Success -> {
                    records = r.data.items
                    recordsTotal = r.data.total
                    hasMore = false
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isLoading = false
        }
    }

    fun deleteRecord(id: String) {
        viewModelScope.launch {
            when (repository.deleteRecord(id)) {
                is ApiResult.Success -> {
                    records = records.filter { it.id != id }
                    recordsTotal -= 1
                }
                is ApiResult.Failure -> errorMessage = "Failed to delete record"
            }
        }
    }

    fun downloadZip() {
        viewModelScope.launch {
            isDownloadingZip = true
            val archiveIds = records.map { it.id }
            when (repository.downloadZip(archiveIds)) {
                is ApiResult.Success -> successMessage = "ZIP download started"
                is ApiResult.Failure -> errorMessage = "Failed to download ZIP"
            }
            isDownloadingZip = false
        }
    }

    fun downloadEml(id: String) {
        viewModelScope.launch {
            isDownloadingEml = true
            when (repository.downloadEml(id)) {
                is ApiResult.Success -> successMessage = "EML download started"
                is ApiResult.Failure -> errorMessage = "Failed to download EML"
            }
            isDownloadingEml = false
        }
    }

    fun downloadAttachment(recordId: String, index: Int) {
        viewModelScope.launch {
            when (repository.downloadAttachment(recordId, index)) {
                is ApiResult.Success -> successMessage = "Attachment download started"
                is ApiResult.Failure -> errorMessage = "Failed to download attachment"
            }
        }
    }

    // Record Preview
    fun loadRecordPreview(id: String) {
        viewModelScope.launch {
            isLoadingPreview = true
            previewError = null
            activePreview = null

            when (val r = repository.fetchRecordPreview(id)) {
                is ApiResult.Success -> activePreview = r.data
                is ApiResult.Failure -> previewError = r.error.message
            }

            isLoadingPreview = false
        }
    }

    // Receipt Operations
    fun loadReceipts() {
        viewModelScope.launch {
            isLoadingReceipts = true
            errorMessage = null

            when (val r = repository.fetchReceipts(skip = 0, limit = pageSize)) {
                is ApiResult.Success -> {
                    receipts = r.data.receipts
                    receiptsTotal = r.data.total
                    receiptsHasMore = receipts.size < receiptsTotal
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isLoadingReceipts = false
        }
    }

    fun loadMoreReceipts() {
        if (isLoadingMoreReceipts || !receiptsHasMore) return
        viewModelScope.launch {
            isLoadingMoreReceipts = true

            when (val r = repository.fetchReceipts(skip = receipts.size, limit = pageSize)) {
                is ApiResult.Success -> {
                    receipts = receipts + r.data.receipts
                    receiptsHasMore = receipts.size < receiptsTotal
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }

            isLoadingMoreReceipts = false
        }
    }

    fun refreshReceipts() {
        viewModelScope.launch {
            errorMessage = null

            when (val r = repository.fetchReceipts(skip = 0, limit = pageSize)) {
                is ApiResult.Success -> {
                    receipts = r.data.receipts
                    receiptsTotal = r.data.total
                    receiptsHasMore = receipts.size < receiptsTotal
                }
                is ApiResult.Failure -> errorMessage = r.error.message
            }
        }
    }

    fun deleteReceipt(id: String) {
        viewModelScope.launch {
            when (repository.deleteReceipt(id)) {
                is ApiResult.Success -> {
                    receipts = receipts.filter { it.id != id }
                    receiptsTotal -= 1
                }
                is ApiResult.Failure -> errorMessage = "Failed to delete receipt"
            }
        }
    }

    fun downloadReceipt(id: String) {
        viewModelScope.launch {
            when (repository.downloadReceipt(id)) {
                is ApiResult.Success -> successMessage = "Receipt download started"
                is ApiResult.Failure -> errorMessage = "Failed to download receipt"
            }
        }
    }

    fun parseReceipt(id: String) {
        viewModelScope.launch {
            isParsing = true

            when (repository.parseReceipt(id)) {
                is ApiResult.Success -> {
                    // Fetch updated receipt
                    when (val r = repository.fetchReceipt(id)) {
                        is ApiResult.Success -> {
                            parsedReceipt = r.data
                            receipts = receipts.map { if (it.id == id) r.data else it }
                        }
                        is ApiResult.Failure -> errorMessage = "Parse succeeded but failed to reload receipt"
                    }
                }
                is ApiResult.Failure -> errorMessage = "Failed to parse receipt"
            }

            isParsing = false
        }
    }

    fun linkReceiptToTransaction(receiptId: String, transactionId: String) {
        viewModelScope.launch {
            when (repository.linkReceipt(receiptId, transactionId)) {
                is ApiResult.Success -> {
                    when (val r = repository.fetchReceipt(receiptId)) {
                        is ApiResult.Success -> {
                            receipts = receipts.map { if (it.id == receiptId) r.data else it }
                        }
                        is ApiResult.Failure -> { /* Non-critical */ }
                    }
                    successMessage = "Receipt linked to transaction"
                }
                is ApiResult.Failure -> errorMessage = "Failed to link receipt"
            }
        }
    }

    // Reset upload state
    fun resetUploadState() {
        uploadedReceiptId = null
        parsedReceipt = null
        linkedTransactionId = ""
        isUploading = false
        isParsing = false
    }

    // Clear filters
    fun clearDateFilter() {
        dateFrom = null
        dateTo = null
        refreshRecords()
    }

    fun clearAmountFilter() {
        amountMin = ""
        amountMax = ""
        refreshRecords()
    }

    fun applyFilters() {
        refreshRecords()
    }

    fun dismissError() { errorMessage = null }
    fun dismissSuccess() { successMessage = null }

    // Helper
    private suspend fun fetchRecordsPage(skip: Int): ApiResult<RecordListResponse> {
        val dateFromStr = dateFrom?.let { dateFormatter.format(it) }
        val dateToStr = dateTo?.let { dateFormatter.format(it) }
        val minAmt = amountMin.toDoubleOrNull()
        val maxAmt = amountMax.toDoubleOrNull()

        return repository.fetchRecords(
            skip = skip,
            limit = pageSize,
            dateFrom = dateFromStr,
            dateTo = dateToStr,
            amountMin = minAmt,
            amountMax = maxAmt
        )
    }
}
