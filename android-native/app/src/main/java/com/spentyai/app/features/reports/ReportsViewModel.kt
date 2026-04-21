package com.spentyai.app.features.reports

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.util.*

enum class PeriodPreset(val label: String) {
    THIS_MONTH("This Month"),
    LAST_3_MONTHS("Last 3 Months"),
    LAST_6_MONTHS("Last 6 Months"),
    THIS_YEAR("This Year"),
    ALL_TIME("All Time"),
    CUSTOM("Custom");

    companion object {
        val allPresets = entries.toList()
    }
}

enum class ReportCategoryType(val label: String) {
    EXPENSE("Expense"),
    INCOME("Income");

    companion object {
        val allTypes = entries.toList()
    }
}

data class ReportsUiState(
    val summary: ReportSummary? = null,
    val periods: List<ReportPeriod> = emptyList(),
    val categories: List<ReportCategory> = emptyList(),
    val activePreset: PeriodPreset = PeriodPreset.THIS_MONTH,
    val startDate: Date = Date(),
    val endDate: Date = Date(),
    val catType: ReportCategoryType = ReportCategoryType.EXPENSE,
    val isLoading: Boolean = false,
    val errorMessage: String = "",
    val showError: Boolean = false,
    val isExporting: Boolean = false,
    val exportedFilePath: String? = null
)

class ReportsViewModel(private val apiClient: ApiClient) : ViewModel() {

    private val repository = ReportsRepository(apiClient)

    private val _uiState = MutableStateFlow(ReportsUiState())
    val uiState: StateFlow<ReportsUiState> = _uiState.asStateFlow()

    init {
        applyPreset(PeriodPreset.THIS_MONTH)
    }

    // MARK: - Computed

    fun totalIncome(): Double = _uiState.value.summary?.totalIncome ?: 0.0
    fun totalExpense(): Double = _uiState.value.summary?.totalExpense ?: 0.0
    fun net(): Double = _uiState.value.summary?.net ?: 0.0
    fun transactionCount(): Int = _uiState.value.summary?.transactionCount ?: 0
    fun hasData(): Boolean = _uiState.value.summary != null

    fun totalCategoryAmount(): Double {
        return _uiState.value.categories.sumOf { kotlin.math.abs(it.amount ?: 0.0) }
    }

    // MARK: - Preset

    fun applyPreset(preset: PeriodPreset) {
        val calendar = Calendar.getInstance()
        val now = Date()

        val (start, end) = when (preset) {
            PeriodPreset.THIS_MONTH -> {
                calendar.time = now
                calendar.set(Calendar.DAY_OF_MONTH, 1)
                val s = calendar.time
                calendar.add(Calendar.MONTH, 1)
                calendar.add(Calendar.DAY_OF_MONTH, -1)
                Pair(s, calendar.time)
            }
            PeriodPreset.LAST_3_MONTHS -> {
                calendar.time = now
                calendar.add(Calendar.MONTH, -3)
                Pair(calendar.time, now)
            }
            PeriodPreset.LAST_6_MONTHS -> {
                calendar.time = now
                calendar.add(Calendar.MONTH, -6)
                Pair(calendar.time, now)
            }
            PeriodPreset.THIS_YEAR -> {
                calendar.time = now
                calendar.set(Calendar.DAY_OF_YEAR, 1)
                val s = calendar.time
                calendar.add(Calendar.YEAR, 1)
                calendar.add(Calendar.DAY_OF_YEAR, -1)
                Pair(s, calendar.time)
            }
            PeriodPreset.ALL_TIME -> {
                calendar.set(2000, 0, 1)
                Pair(calendar.time, now)
            }
            PeriodPreset.CUSTOM -> {
                _uiState.update { it.copy(activePreset = preset) }
                return
            }
        }

        _uiState.update { it.copy(activePreset = preset, startDate = start, endDate = end) }
    }

    fun setStartDate(date: Date) {
        _uiState.update { it.copy(startDate = date) }
    }

    fun setEndDate(date: Date) {
        _uiState.update { it.copy(endDate = date) }
    }

    fun setCatType(type: ReportCategoryType) {
        _uiState.update { it.copy(catType = type) }
        reloadCategories()
    }

    fun dismissError() {
        _uiState.update { it.copy(showError = false, errorMessage = "") }
    }

    // MARK: - Load Data

    fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, showError = false) }
            val state = _uiState.value
            val from = state.startDate
            val to = state.endDate
            val type = state.catType.label.lowercase()

            var newSummary: ReportSummary? = state.summary
            var newPeriods: List<ReportPeriod> = state.periods
            var newCategories: List<ReportCategory> = state.categories

            when (val result = repository.getSummary(from, to)) {
                is ApiResult.Success -> newSummary = result.data
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load summary")
            }

            when (val result = repository.getPeriods(from, to)) {
                is ApiResult.Success -> newPeriods = result.data
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load periods")
            }

            when (val result = repository.getCategories(from, to, type)) {
                is ApiResult.Success -> newCategories = result.data
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load categories")
            }

            _uiState.update {
                it.copy(
                    summary = newSummary,
                    periods = newPeriods,
                    categories = newCategories,
                    isLoading = false
                )
            }
        }
    }

    fun reloadCategories() {
        viewModelScope.launch {
            val state = _uiState.value
            when (val result = repository.getCategories(state.startDate, state.endDate, state.catType.label.lowercase())) {
                is ApiResult.Success -> _uiState.update { it.copy(categories = result.data) }
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load categories")
            }
        }
    }

    // MARK: - Export

    fun exportCSV(context: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(isExporting = true) }
            val state = _uiState.value
            when (val result = repository.exportCSV(state.startDate, state.endDate)) {
                is ApiResult.Success -> {
                    val file = File(context.cacheDir, "SpentyAI_Report.csv")
                    file.writeBytes(result.data)
                    _uiState.update { it.copy(exportedFilePath = file.absolutePath, isExporting = false) }
                }
                is ApiResult.Failure -> {
                    handleError(result.error.message ?: "Failed to export CSV")
                    _uiState.update { it.copy(isExporting = false) }
                }
            }
        }
    }

    fun exportPDF(context: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(isExporting = true) }
            val state = _uiState.value
            when (val result = repository.exportPDF(state.startDate, state.endDate)) {
                is ApiResult.Success -> {
                    val file = File(context.cacheDir, "SpentyAI_Report.pdf")
                    file.writeBytes(result.data)
                    _uiState.update { it.copy(exportedFilePath = file.absolutePath, isExporting = false) }
                }
                is ApiResult.Failure -> {
                    handleError(result.error.message ?: "Failed to export PDF")
                    _uiState.update { it.copy(isExporting = false) }
                }
            }
        }
    }

    fun clearExport() {
        _uiState.update { it.copy(exportedFilePath = null) }
    }

    private fun handleError(message: String) {
        _uiState.update { it.copy(errorMessage = message, showError = true) }
    }
}
