package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Record(
    @SerialName("archiveId") val id: String = "",
    val subject: String? = null,
    val fromEmail: String? = null,
    val archivedAt: String? = null,
    val date: String? = null,
    val source: String? = null,
    val transactionAmount: Double? = null,
    val transactionType: String? = null,
    val hasAttachments: Boolean? = null,
    val attachments: List<RecordAttachmentRef>? = null
) {
    val sender: String? get() = fromEmail
    val amount: Double? get() = transactionAmount
    val attachmentCount: Int? get() = attachments?.size
}

@Serializable
data class RecordAttachmentRef(
    val filename: String? = null,
    val mimeType: String? = null,
    val size: Int? = null
)

@Serializable
data class Receipt(
    @SerialName("receiptId") val id: String = "",
    val filename: String? = null,
    val mimeType: String? = null,
    val uploadedAt: String? = null,
    val parsedData: ReceiptParsedData? = null,
    val transactionId: String? = null,
    val fileSize: Int? = null
)

@Serializable
data class ReceiptParsedData(
    val vendor: String? = null,
    val amount: Double? = null,
    val date: String? = null,
    val items: List<ReceiptItem>? = null,
    val tax: Double? = null,
    val total: Double? = null,
    val categoryName: String? = null,
    val description: String? = null,
    val paymentMethod: String? = null
) {
    val merchant: String? get() = vendor
}

@Serializable
data class ReceiptItem(
    val item: String? = null,
    val amount: Double? = null,
    val qty: Double? = null
) {
    val id: String get() = item ?: java.util.UUID.randomUUID().toString()
    val description: String? get() = item
    val quantity: Double? get() = qty
}

@Serializable
data class RecordListResponse(
    val records: List<Record> = emptyList(),
    val total: Int = 0
)

@Serializable
data class RecordSearchResponse(
    val items: List<Record> = emptyList(),
    val total: Int = 0
)

@Serializable
data class ReceiptListResponse(
    val receipts: List<Receipt> = emptyList(),
    val total: Int = 0
)

@Serializable
data class RecordPreviewResponse(
    @SerialName("archiveId") val id: String = "",
    val subject: String? = null,
    val fromEmail: String? = null,
    val archivedAt: String? = null,
    val source: String? = null,
    val body: String? = null,
    val bodyHtml: String? = null,
    val attachments: List<RecordAttachment>? = null,
    val transactionId: String? = null
) {
    val sender: String? get() = fromEmail
}

@Serializable
data class RecordAttachment(
    val index: Int = 0,
    val filename: String? = null,
    val mimeType: String? = null,
    val size: Int? = null
) {
    val id: String get() = "$index-${filename ?: "unknown"}"
}

@Serializable
data class ReceiptUploadResponse(
    @SerialName("receiptId") val id: String = "",
    val filename: String? = null,
    val fileSize: Int? = null,
    val mimeType: String? = null
)

@Serializable
data class ReceiptParseResponse(
    val receiptId: String = "",
    val parsedData: ReceiptParsedData? = null,
    val error: String? = null
)

@Serializable
data class ReceiptLinkBody(
    val transactionId: String
)

@Serializable
data class ReceiptLinkResponse(
    val message: String? = null,
    val receiptId: String? = null,
    val transactionId: String? = null
)

@Serializable
data class DownloadZipBody(
    val archiveIds: List<String>
)
