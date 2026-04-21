package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TaxSummary(
    val year: Int,
    @SerialName("total_income") val totalIncome: Double = 0.0,
    @SerialName("total_deductions") val totalDeductions: Double = 0.0,
    @SerialName("taxable_income") val taxableIncome: Double = 0.0,
    @SerialName("estimated_tax") val estimatedTax: Double = 0.0,
    @SerialName("tax_paid") val taxPaid: Double = 0.0,
    @SerialName("tax_owed") val taxOwed: Double = 0.0,
    @SerialName("effective_rate") val effectiveRate: Double = 0.0,
    @SerialName("income_categories") val incomeCategories: List<TaxCategory>? = null,
    @SerialName("deduction_categories") val deductionCategories: List<TaxCategory>? = null,
    @SerialName("quarterly_payments") val quarterlyPayments: List<QuarterlyPayment>? = null,
    val currency: String = "USD",
    @SerialName("generated_at") val generatedAt: String? = null
)

@Serializable
data class TaxCategory(
    val name: String,
    val amount: Double = 0.0,
    @SerialName("is_deductible") val isDeductible: Boolean = false,
    @SerialName("tax_form_line") val taxFormLine: String? = null
)

@Serializable
data class QuarterlyPayment(
    val quarter: Int,
    @SerialName("due_date") val dueDate: String,
    val amount: Double = 0.0,
    @SerialName("is_paid") val isPaid: Boolean = false,
    @SerialName("paid_date") val paidDate: String? = null,
    @SerialName("paid_amount") val paidAmount: Double = 0.0
)
