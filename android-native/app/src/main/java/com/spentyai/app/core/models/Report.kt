package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ReportSummary(
    @SerialName("totalIncome") val totalIncome: Double? = null,
    @SerialName("totalExpense") val totalExpense: Double? = null,
    @SerialName("totalTransfers") val totalTransfers: Double? = null,
    val net: Double? = null,
    @SerialName("transactionCount") val transactionCount: Int? = null,
    @SerialName("topCategories") val topCategories: List<ReportCategory>? = null,
    @SerialName("startDate") val startDate: String? = null,
    @SerialName("endDate") val endDate: String? = null
)

@Serializable
data class ReportPeriod(
    val month: String? = null,
    val income: Double? = null,
    val expense: Double? = null,
    val net: Double? = null,
    val count: Int? = null,
    val transfer: Double? = null
) {
    val period: String? get() = month
    val transactionCount: Int? get() = count
}

@Serializable
data class ReportCategory(
    @SerialName("categoryId") val categoryId: String? = null,
    @SerialName("categoryName") val categoryName: String? = null,
    val total: Double? = null,
    val income: Double? = null,
    val expense: Double? = null,
    val count: Int? = null,
    val subcategories: List<ReportSubcategory>? = null
) {
    val name: String? get() = categoryName
    val amount: Double? get() = total
    val transactionCount: Int? get() = count
    val percentage: Double? get() = null
}

@Serializable
data class ReportSubcategory(
    @SerialName("subcategoryId") val subcategoryId: String? = null,
    @SerialName("subcategoryName") val subcategoryName: String? = null,
    val total: Double? = null,
    val income: Double? = null,
    val expense: Double? = null,
    val count: Int? = null
)

@Serializable
data class IncomeExpenseResponse(
    @SerialName("totalIncome") val totalIncome: Double? = null,
    @SerialName("totalExpense") val totalExpense: Double? = null,
    val net: Double? = null,
    @SerialName("incomeByCategory") val incomeByCategory: List<ReportCategory>? = null,
    @SerialName("expenseByCategory") val expenseByCategory: List<ReportCategory>? = null,
    @SerialName("startDate") val startDate: String? = null,
    @SerialName("endDate") val endDate: String? = null
)

@Serializable
data class PeriodsResponse(
    val periods: List<ReportPeriod> = emptyList()
)

@Serializable
data class CategoriesReportResponse(
    val categories: List<ReportCategory> = emptyList()
)
