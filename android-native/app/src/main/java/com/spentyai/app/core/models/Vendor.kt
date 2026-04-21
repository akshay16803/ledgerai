package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Vendor(
    @SerialName("vendor_id") val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val company: String? = null,
    val address: Address? = null,
    @SerialName("tax_id") val taxId: String? = null,
    val notes: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("total_billed") val totalBilled: Double = 0.0,
    @SerialName("total_paid") val totalPaid: Double = 0.0,
    @SerialName("outstanding_balance") val outstandingBalance: Double = 0.0,
    val currency: String = "USD",
    @SerialName("payment_terms") val paymentTerms: String? = null,
    @SerialName("default_category_id") val defaultCategoryId: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)
