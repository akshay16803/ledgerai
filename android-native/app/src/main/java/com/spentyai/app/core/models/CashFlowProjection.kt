package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CashFlowProjection(
    val monthlyRecurringIncome: Double? = null,
    val monthlyRecurringExpense: Double? = null,
    val monthlyMandateExpense: Double? = null,
    val monthlyOdInterest: Double? = null,
    val monthlyEmiTotal: Double? = null,
    val monthlyNet: Double? = null,
    val recurringItems: List<RecurringItem>? = null,
    val mandateItems: List<MandateItem>? = null,
    val odInterestItems: List<ODInterestItem>? = null,
    val emiItems: List<EMIItem>? = null,
    val projection: List<ProjectionMonth>? = null
)

@Serializable
data class MandateItem(
    val mandateId: String? = null,
    val merchant: String? = null,
    val amount: Double? = null,
    val originalAmount: Double? = null,
    val currency: String? = null,
    val baseCurrency: String? = null,
    val exchangeRate: Double? = null,
    val isEstimatedRate: Boolean? = null,
    val frequency: String? = null,
    val mandateType: String? = null,
    val monthlyEquivalent: Double? = null,
    val source: String? = null,
    val sourceEmailId: String? = null,
    val sourceEmailSubject: String? = null,
    val startDate: String? = null,
    val debitDay: Int? = null
) {
    val id: String get() = mandateId ?: java.util.UUID.randomUUID().toString()

    val isForeignCurrency: Boolean
        get() {
            val c = currency ?: return false
            val b = baseCurrency ?: return false
            return !c.equals(b, ignoreCase = true)
        }

    val dayOfMonth: Int?
        get() {
            if (debitDay != null) return debitDay
            val sd = startDate ?: return null
            val parts = sd.split("-")
            if (parts.size >= 3) {
                return parts[2].take(2).toIntOrNull()
            }
            return null
        }
}

@Serializable
data class EMIItem(
    val accountId: String? = null,
    val accountName: String? = null,
    val emiAmount: Double? = null,
    val emiDay: Int? = null,
    val loanInterestRate: Double? = null,
    val loanTenureMonths: Int? = null
) {
    val id: String get() = accountId ?: java.util.UUID.randomUUID().toString()
}

@Serializable
data class ProjectionMonth(
    @SerialName("month") val monthIndex: Int? = null,
    val label: String? = null,
    val projectedIncome: Double? = null,
    val projectedExpense: Double? = null,
    val mandateExpense: Double? = null,
    val odInterest: Double? = null,
    val net: Double? = null,
    val runningBalance: Double? = null
) {
    val id: String get() = label ?: "${monthIndex ?: 0}"
    val month: String? get() = label
    val income: Double? get() = projectedIncome
    val expense: Double? get() = projectedExpense
    val mandates: Double? get() = mandateExpense
    val cumulativeNet: Double? get() = runningBalance
}

@Serializable
data class RecurringItem(
    val transactionId: String? = null,
    val description: String? = null,
    val amount: Double? = null,
    val frequency: String? = null,
    val recurringFrequency: String? = null,
    val recurrenceDate: Int? = null,
    val transactionType: String? = null,
    val monthlyAmount: Double? = null,
    val categoryId: String? = null,
    val accountId: String? = null,
    val isRecurring: Boolean? = null
) {
    val id: String get() = transactionId ?: description ?: java.util.UUID.randomUUID().toString()
    val effectiveFrequency: String? get() = frequency ?: recurringFrequency
    val type: String? get() = transactionType
}

@Serializable
data class ODInterestItem(
    val accountId: String? = null,
    val accountName: String? = null,
    val monthlyInterest: Double? = null,
    val balance: Double? = null,
    val rate: Double? = null,
    val interestChargeDay: Int? = null
) {
    val id: String get() = accountId ?: java.util.UUID.randomUUID().toString()
}

@Serializable
data class RecurringListResponse(
    val transactions: List<RecurringItem> = emptyList()
)

@Serializable
data class MandateListResponse(
    val mandates: List<Mandate> = emptyList()
)

@Serializable
data class UpcomingMandatesResponse(
    val upcoming: List<Mandate> = emptyList()
)

@Serializable
data class DetectMandatesResponse(
    val detected: List<DetectedMandatePattern>? = null,
    val total: Int? = null
)

@Serializable
data class DetectedMandatePattern(
    val merchant: String? = null,
    val amount: Double? = null,
    val frequency: String? = null,
    val occurrences: Int? = null,
    val lastDate: String? = null,
    val accountId: String? = null
)

@Serializable
data class MandateCreateBody(
    val merchant: String,
    val amount: Double,
    val frequency: String,
    val mandateType: String? = null
)

@Serializable
data class MandateUpdateBody(
    val merchant: String? = null,
    val amount: Double? = null,
    val status: String? = null,
    val frequency: String? = null,
    val mandateType: String? = null
)

@Serializable
data class ToggleRecurringBody(
    val isRecurring: Boolean,
    val recurringFrequency: String? = null
)
