package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Statement(
    // Backend statements endpoint returns camelCase JSON keys.
    @SerialName("statementId") val id: String = "",
    @SerialName("filename") val filename: String? = null,
    @SerialName("accountId") val accountId: String? = null,
    @SerialName("accountName") val accountName: String? = null,
    @SerialName("statementType") val statementType: String? = null,
    @SerialName("status") val status: String? = null,
    @SerialName("entryCount") val entryCount: Int? = null,
    @SerialName("periodFrom") val periodFrom: String? = null,
    @SerialName("periodTo") val periodTo: String? = null,
    @SerialName("uploadedAt") val uploadedAt: String? = null,
    @SerialName("parsedEntries") val parsedEntries: List<ParsedEntry>? = null,
    @SerialName("reconciliation") val reconciliation: ReconciliationResult? = null,
    @SerialName("auditStatus") val auditStatus: String? = null,
    @SerialName("processingProgress") val processingProgress: Double? = null,
    @SerialName("processingStageLabel") val processingStageLabel: String? = null
)

@Serializable
data class ParsedEntry(
    @SerialName("date") val date: String? = null,
    @SerialName("description") val description: String? = null,
    @SerialName("amount") val amount: Double? = null,
    @SerialName("type") val type: String? = null,
    @SerialName("transactionType") val transactionType: String? = null,
    @SerialName("balance") val balance: Double? = null,
    @SerialName("categoryId") val categoryId: String? = null,
    @SerialName("categoryName") val categoryName: String? = null,
    @SerialName("matched") val matched: Boolean? = null,
    @SerialName("matchedTransactionId") val matchedTransactionId: String? = null
) {
    val id: String
        get() = if (!matchedTransactionId.isNullOrEmpty()) matchedTransactionId
        else "$date-$amount-$description-$balance"
    val effectiveType: String? get() = transactionType ?: type
}

@Serializable
data class ReconciliationSummary(
    val totalStatementEntries: Int? = null,
    val matched: Int? = null,
    val missingFromLedger: Int? = null,
    val missingFromStatement: Int? = null,
    val conflicts: Int? = null
)

@Serializable
data class MatchedEntry(
    val statementEntry: ReconciliationEntry? = null,
    val ledgerTransaction: ReconciliationEntry? = null,
    val matchScore: Double? = null
) {
    val id: String
        get() = "${statementEntry?.description ?: ""}-${statementEntry?.amount ?: 0}-${matchScore ?: 0}"
}

@Serializable
data class ReconciliationEntry(
    val date: String? = null,
    val description: String? = null,
    val amount: Double? = null,
    val transactionType: String? = null
) {
    val id: String get() = "$date-$description-$amount"
}

@Serializable
data class ConflictEntry(
    val statementEntry: ReconciliationEntry? = null,
    val ledgerTransaction: ReconciliationEntry? = null,
    val amountDifference: Double? = null
) {
    val id: String
        get() = "${statementEntry?.description ?: ""}-${amountDifference ?: 0}"
}

@Serializable
data class ReconciliationResult(
    val totalEntries: Int? = null,
    val unmatched: Int? = null,
    val missing: Int? = null,
    val openingBalance: Double? = null,
    val closingBalance: Double? = null,
    val computedClosing: Double? = null,
    val difference: Double? = null,
    val summary: ReconciliationSummary? = null,
    val matched: List<MatchedEntry>? = null,
    val missingFromLedger: List<ReconciliationEntry>? = null,
    val missingFromStatement: List<ReconciliationEntry>? = null,
    val conflicts: List<ConflictEntry>? = null
) {
    val matchedCount: Int get() = summary?.matched ?: matched?.size ?: 0
    val missingFromLedgerCount: Int get() = summary?.missingFromLedger ?: missingFromLedger?.size ?: missing ?: 0
    val missingFromStatementCount: Int get() = summary?.missingFromStatement ?: missingFromStatement?.size ?: 0
    val conflictsCount: Int get() = summary?.conflicts ?: conflicts?.size ?: unmatched ?: 0
    val totalCount: Int get() = summary?.totalStatementEntries ?: totalEntries ?: 0
}

@Serializable
data class StatementListResponse(
    val statements: List<Statement> = emptyList()
)

@Serializable
data class StatementUploadResponse(
    val statementId: String? = null,
    val message: String? = null,
    val filename: String? = null
)

@Serializable
data class ReconcileResponse(
    val summary: ReconciliationSummary? = null,
    val matched: List<MatchedEntry>? = null,
    val missingFromLedger: List<ReconciliationEntry>? = null,
    val missingFromStatement: List<ReconciliationEntry>? = null,
    val conflicts: List<ConflictEntry>? = null
)

@Serializable
data class ReauditResponse(
    val statementId: String? = null,
    val status: String? = null,
    val message: String? = null
)

@Serializable
data class ApproveResponse(
    val message: String? = null,
    val transactionsCreated: Int? = null
)

@Serializable
data class EntriesResponse(
    val entries: List<ParsedEntry> = emptyList(),
    val total: Int? = null,
    val statementId: String? = null
)

@Serializable
data class EntryUpdateResponse(
    val entryIndex: Int? = null,
    val entry: ParsedEntry? = null
)

@Serializable
data class BulkCategorizeResponse(
    val updated: Int? = null,
    val total: Int? = null
)

@Serializable
data class AddMissingResponse(
    val message: String? = null,
    val added: Int? = null
)

@Serializable
data class AddMissingBody(
    val entryIndices: List<Int>
)

@Serializable
data class UnlockBody(
    val password: String
)

@Serializable
data class EntryUpdateBody(
    val categoryId: String? = null,
    val categoryName: String? = null
)

@Serializable
data class BulkCategorizeEntry(
    val entryIndex: Int,
    val categoryId: String,
    val subcategoryId: String? = null
)

@Serializable
data class BulkCategorizeBody(
    val updates: List<BulkCategorizeEntry>
)
