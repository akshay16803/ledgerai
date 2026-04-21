package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Invoice(
    @SerialName("invoice_id") val id: String,
    @SerialName("invoice_number") val invoiceNumber: String,
    @SerialName("customer_id") val customerId: String,
    @SerialName("customer_name") val customerName: String? = null,
    val status: InvoiceStatus = InvoiceStatus.DRAFT,
    @SerialName("issue_date") val issueDate: String,
    @SerialName("due_date") val dueDate: String,
    val subtotal: Double = 0.0,
    @SerialName("tax_amount") val taxAmount: Double = 0.0,
    @SerialName("discount_amount") val discountAmount: Double = 0.0,
    val total: Double = 0.0,
    @SerialName("amount_paid") val amountPaid: Double = 0.0,
    @SerialName("amount_due") val amountDue: Double = 0.0,
    val currency: String = "USD",
    val notes: String? = null,
    val terms: String? = null,
    @SerialName("line_items") val lineItems: List<InvoiceLineItem>? = null,
    @SerialName("payment_date") val paymentDate: String? = null,
    @SerialName("sent_date") val sentDate: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
enum class InvoiceStatus {
    @SerialName("draft") DRAFT,
    @SerialName("sent") SENT,
    @SerialName("viewed") VIEWED,
    @SerialName("paid") PAID,
    @SerialName("overdue") OVERDUE,
    @SerialName("cancelled") CANCELLED,
    @SerialName("partially_paid") PARTIALLY_PAID
}

@Serializable
data class InvoiceLineItem(
    val description: String,
    val quantity: Double = 1.0,
    @SerialName("unit_price") val unitPrice: Double = 0.0,
    val amount: Double = 0.0,
    @SerialName("tax_rate") val taxRate: Double? = null
)
