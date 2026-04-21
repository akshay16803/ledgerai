package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Customer(
    @SerialName("customer_id") val id: String,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val company: String? = null,
    @SerialName("billing_address") val billingAddress: Address? = null,
    @SerialName("shipping_address") val shippingAddress: Address? = null,
    @SerialName("tax_id") val taxId: String? = null,
    val notes: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("total_invoiced") val totalInvoiced: Double = 0.0,
    @SerialName("total_paid") val totalPaid: Double = 0.0,
    @SerialName("outstanding_balance") val outstandingBalance: Double = 0.0,
    val currency: String = "USD",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class Address(
    val street: String? = null,
    val city: String? = null,
    val state: String? = null,
    @SerialName("postal_code") val postalCode: String? = null,
    val country: String? = null
)
