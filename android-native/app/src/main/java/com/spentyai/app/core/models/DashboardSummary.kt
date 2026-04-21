package com.spentyai.app.core.models

import kotlinx.serialization.Serializable

@Serializable
data class DashboardSummary(
    val netWorth: Double? = null,
    val incomeThisMonth: Double? = null,
    val expenseThisMonth: Double? = null,
    val pendingReview: Int? = null,
    val totalAssets: Double? = null,
    val totalLiabilities: Double? = null,
    val savingsThisMonth: Double? = null,
    val accounts: List<Account>? = null,
    val recentTransactions: List<Transaction>? = null
)
