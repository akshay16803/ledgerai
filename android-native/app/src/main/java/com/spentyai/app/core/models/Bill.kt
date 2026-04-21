package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Bill(
    @SerialName("bill_id") val id: String,
    @SerialName("bill_number") val billNumber: String? = null,
    @SerialName("vendor_id") val vendorId: String,
    @SerialName("vendor_name") val vendorName: String? = null,
    val status: BillStatus = BillStatus.UNPAID,
    @SerialName("issue_date") val issueDate: String,
    @SerialName("due_date") val dueDate: String,
    val subtotal: Double = 0.0,
    @SerialName("tax_amount") val taxAmount: Double = 0.0,
    val total: Double = 0.0,
    @SerialName("amount_paid") val amountPaid: Double = 0.0,
    @SerialName("amount_due") val amountDue: Double = 0.0,
    val currency: String = "USD",
    val notes: String? = null,
    @SerialName("line_items") val lineItems: List<BillLineItem>? = null,
    @SerialName("payment_date") val paymentDate: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("is_recurring") val isRecurring: Boolean = false,
    @SerialName("recurrence_pattern") val recurrencePattern: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
enum class BillStatus {
    @SerialName("unpaid") UNPAID,
    @SerialName("paid") PAID,
    @SerialName("overdue") OVERDUE,
    @SerialName("partially_paid") PARTIALLY_PAID,
    @SerialName("cancelled") CANCELLED
}

@Serializable
data class BillLineItem(
    val description: String,
    val quantity: Double = 1.0,
    @SerialName("unit_price") val unitPrice: Double = 0.0,
    val amount: Double = 0.0,
    @SerialName("tax_rate") val taxRate: Double? = null
)
