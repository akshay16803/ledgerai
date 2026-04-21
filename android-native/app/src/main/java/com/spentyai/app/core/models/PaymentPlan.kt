package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PaymentPlan(
    @SerialName("plan_id") val id: String,
    val name: String,
    val description: String? = null,
    @SerialName("total_amount") val totalAmount: Double = 0.0,
    @SerialName("amount_paid") val amountPaid: Double = 0.0,
    @SerialName("amount_remaining") val amountRemaining: Double = 0.0,
    val currency: String = "USD",
    @SerialName("installment_amount") val installmentAmount: Double = 0.0,
    val frequency: String? = null,
    @SerialName("num_installments") val numInstallments: Int = 0,
    @SerialName("installments_paid") val installmentsPaid: Int = 0,
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("end_date") val endDate: String? = null,
    @SerialName("next_payment_date") val nextPaymentDate: String? = null,
    val status: PaymentPlanStatus = PaymentPlanStatus.ACTIVE,
    @SerialName("customer_id") val customerId: String? = null,
    @SerialName("vendor_id") val vendorId: String? = null,
    @SerialName("invoice_id") val invoiceId: String? = null,
    @SerialName("bill_id") val billId: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
enum class PaymentPlanStatus {
    @SerialName("active") ACTIVE,
    @SerialName("completed") COMPLETED,
    @SerialName("paused") PAUSED,
    @SerialName("cancelled") CANCELLED,
    @SerialName("defaulted") DEFAULTED
}
