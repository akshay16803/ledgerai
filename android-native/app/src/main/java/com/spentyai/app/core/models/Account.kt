package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Account(
    @SerialName("accountId") val id: String = "",
    val name: String? = null,
    @SerialName("accountType") val accountType: String? = null,
    @SerialName("subType") val subType: String? = null,
    @SerialName("accountNumber") val accountNumber: String? = null,
    @SerialName("openingBalance") val openingBalance: Double? = null,
    @SerialName("balanceAsOfDate") val balanceAsOfDate: String? = null,
    val balance: Double? = null,
    val currency: String? = "INR",
    val description: String? = null,
    @SerialName("loanInterestRate") val loanInterestRate: Double? = null,
    @SerialName("loanTenureMonths") val loanTenureMonths: Int? = null,
    @SerialName("loanEmiAmount") val loanEmiAmount: Double? = null,
    @SerialName("loanEmiDay") val loanEmiDay: Int? = null,
    @SerialName("loanSanctionedAmount") val loanSanctionedAmount: Double? = null,
    @SerialName("brokerName") val brokerName: String? = null
)

@Serializable
data class AccountSubType(
    @SerialName("subTypeId") val id: String = "",
    val name: String? = null,
    @SerialName("accountType") val accountType: String? = null,
    val icon: String? = null
)

@Serializable
data class AccountListResponse(
    val accounts: List<Account> = emptyList()
)

@Serializable
data class AccountResponse(
    val account: Account
)

@Serializable
data class AmortizationEntry(
    val month: Int,
    val emi: Double = 0.0,
    val principal: Double = 0.0,
    val interest: Double = 0.0,
    val outstanding: Double = 0.0
)

@Serializable
data class AmortizationResponse(
    val schedule: List<AmortizationEntry> = emptyList(),
    @SerialName("totalInterest") val totalInterest: Double? = null,
    @SerialName("totalPayment") val totalPayment: Double? = null
)

@Serializable
data class ODInterestResponse(
    @SerialName("totalInterest") val totalInterest: Double = 0.0,
    @SerialName("dailyBreakdown") val dailyBreakdown: List<ODDailyEntry>? = null,
    @SerialName("closingOutstanding") val closingOutstanding: Double? = null,
    @SerialName("interestRate") val interestRate: Double? = null
) {
    val interest: Double get() = totalInterest
    val days: Int get() = dailyBreakdown?.size ?: 0
    val averageBalance: Double? get() {
        val breakdown = dailyBreakdown ?: return null
        if (breakdown.isEmpty()) return null
        return breakdown.sumOf { it.outstanding } / breakdown.size
    }
    val rate: Double? get() = interestRate
}

@Serializable
data class ODDailyEntry(
    val date: String = "",
    val outstanding: Double = 0.0,
    val interest: Double = 0.0
)

@Serializable
data class AccountTransactionsResponse(
    val transactions: List<Transaction> = emptyList(),
    val total: Int? = null,
    @SerialName("accountName") val accountName: String? = null
)

@Serializable
data class DematStatement(
    @SerialName("statementId") val id: String = "",
    val filename: String? = null,
    @SerialName("createdAt") val createdAt: String? = null,
    val status: String? = null,
    @SerialName("transactionIds") val transactionIds: List<String>? = null
) {
    val transactionsCount: Int? get() {
        val ids = transactionIds ?: return null
        return if (ids.isEmpty()) null else ids.size
    }

    val isPendingApproval: Boolean get() {
        val s = status?.lowercase() ?: return false
        return s == "pending_approval" || s == "pending"
    }
}

@Serializable
data class DematStatementsResponse(
    val statements: List<DematStatement> = emptyList()
)

@Serializable
data class DematUploadResponse(
    val message: String? = null,
    @SerialName("statementId") val statementId: String? = null
)

@Serializable
data class DematActionResponse(
    val message: String? = null
)

@Serializable
data class SubTypeListResponse(
    @SerialName("subTypes") val subTypes: List<AccountSubType> = emptyList()
)

@Serializable
data class SubTypeResponse(
    @SerialName("subType") val subType: AccountSubType
)

@Serializable
data class MessageResponse(
    val message: String? = null,
    val success: Boolean? = null
)
