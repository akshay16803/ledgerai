package com.spentyai.app.features.pastinsights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class PastInsightsUiState(
    val summaries: List<PastInsightSummary> = emptyList(),
    val selectedSummary: PastInsightSummary? = null,
    val detailTransactions: List<PastInsightTransaction> = emptyList(),
    val availableEmails: List<EmailOption> = emptyList(),
    val isLoading: Boolean = false,
    val isCreating: Boolean = false,
    val isLoadingTransactions: Boolean = false,
    val showError: Boolean = false,
    val errorMessage: String = "",
    // Create form
    val showCreateForm: Boolean = false,
    val createName: String = "",
    val createDateFrom: Long = Calendar.getInstance().apply {
        add(Calendar.YEAR, -1)
    }.timeInMillis,
    val createDateTo: Long = System.currentTimeMillis(),
    val createSelectedEmail: String = ""
)

class PastInsightsViewModel(
    private val repository: PastInsightsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PastInsightsUiState())
    val uiState: StateFlow<PastInsightsUiState> = _uiState.asStateFlow()

    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    fun loadSummaries() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = repository.getSummaries()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(summaries = result.data, isLoading = false) }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            showError = true,
                            errorMessage = result.error.message ?: "Failed to load summaries"
                        )
                    }
                }
            }
        }
    }

    fun loadDetail(summaryId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingTransactions = true) }
            when (val result = repository.getSummaryDetail(summaryId)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            selectedSummary = result.data.summary,
                            detailTransactions = result.data.transactions,
                            isLoadingTransactions = false
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoadingTransactions = false,
                            showError = true,
                            errorMessage = result.error.message ?: "Failed to load detail"
                        )
                    }
                }
            }
        }
    }

    fun loadAvailableEmails() {
        viewModelScope.launch {
            when (val result = repository.getAvailableEmails()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            availableEmails = result.data,
                            createSelectedEmail = result.data.firstOrNull()?.email ?: ""
                        )
                    }
                }
                is ApiResult.Failure -> { /* silently fail */ }
            }
        }
    }

    fun startCreate() {
        _uiState.update {
            it.copy(
                showCreateForm = true,
                createName = "",
                createDateFrom = Calendar.getInstance().apply { add(Calendar.YEAR, -1) }.timeInMillis,
                createDateTo = System.currentTimeMillis()
            )
        }
        loadAvailableEmails()
    }

    fun updateCreateName(name: String) {
        _uiState.update { it.copy(createName = name) }
    }

    fun updateCreateDateFrom(millis: Long) {
        _uiState.update { it.copy(createDateFrom = millis) }
    }

    fun updateCreateDateTo(millis: Long) {
        _uiState.update { it.copy(createDateTo = millis) }
    }

    fun updateSelectedEmail(email: String) {
        _uiState.update { it.copy(createSelectedEmail = email) }
    }

    fun createSummary() {
        val state = _uiState.value
        if (state.createName.isBlank()) {
            _uiState.update { it.copy(showError = true, errorMessage = "Please enter a name for the summary.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isCreating = true) }
            val dateFrom = dateFormatter.format(Date(state.createDateFrom))
            val dateTo = dateFormatter.format(Date(state.createDateTo))

            when (val result = repository.createSummary(
                state.createName.trim(),
                dateFrom,
                dateTo,
                state.createSelectedEmail
            )) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            summaries = listOf(result.data) + it.summaries,
                            isCreating = false,
                            showCreateForm = false
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isCreating = false,
                            showError = true,
                            errorMessage = result.error.message ?: "Failed to create summary"
                        )
                    }
                }
            }
        }
    }

    fun deleteSummary(summary: PastInsightSummary) {
        viewModelScope.launch {
            when (repository.deleteSummary(summary.id)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(summaries = it.summaries.filter { s -> s.id != summary.id })
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(showError = true, errorMessage = "Failed to delete summary")
                    }
                }
            }
        }
    }

    fun dismissError() {
        _uiState.update { it.copy(showError = false, errorMessage = "") }
    }

    fun dismissCreateForm() {
        _uiState.update { it.copy(showCreateForm = false) }
    }

    fun setSummaryForDetail(summary: PastInsightSummary) {
        _uiState.update { it.copy(selectedSummary = summary) }
    }
}
