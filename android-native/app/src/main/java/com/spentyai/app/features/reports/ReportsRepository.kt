package com.spentyai.app.features.reports

import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ReportsRepository(private val apiClient: ApiClient) {

    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    suspend fun getSummary(from: Date, to: Date): ApiResult<ReportSummary> {
        val fromStr = dateFormatter.format(from)
        val toStr = dateFormatter.format(to)
        return apiClient.safeApiCall {
            apiClient.endpoints.getReportsSummary(fromStr, toStr)
        }
    }

    suspend fun getPeriods(from: Date, to: Date): ApiResult<List<ReportPeriod>> {
        val fromStr = dateFormatter.format(from)
        val toStr = dateFormatter.format(to)
        return apiClient.safeApiCall {
            apiClient.endpoints.getReportsByPeriod(fromStr, toStr)
        }.map { it.periods }
    }

    suspend fun getCategories(from: Date, to: Date, type: String = "expense"): ApiResult<List<ReportCategory>> {
        val fromStr = dateFormatter.format(from)
        val toStr = dateFormatter.format(to)
        return apiClient.safeApiCall {
            apiClient.endpoints.getReportsByCategory(fromStr, toStr, type)
        }.map { it.categories }
    }

    suspend fun getIncomeExpense(from: Date, to: Date): ApiResult<IncomeExpenseResponse> {
        val fromStr = dateFormatter.format(from)
        val toStr = dateFormatter.format(to)
        return apiClient.safeApiCall {
            apiClient.endpoints.getReportsIncomeExpense(fromStr, toStr)
        }
    }

    suspend fun exportCSV(from: Date, to: Date): ApiResult<ByteArray> {
        val fromStr = dateFormatter.format(from)
        val toStr = dateFormatter.format(to)
        return apiClient.safeApiCall {
            apiClient.endpoints.exportReportCSV(fromStr, toStr)
        }.map { it.bytes() }
    }

    suspend fun exportPDF(from: Date, to: Date): ApiResult<ByteArray> {
        val fromStr = dateFormatter.format(from)
        val toStr = dateFormatter.format(to)
        return apiClient.safeApiCall {
            apiClient.endpoints.exportReportPDF(fromStr, toStr)
        }.map { it.bytes() }
    }
}
