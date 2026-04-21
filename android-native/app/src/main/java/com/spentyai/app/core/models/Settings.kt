package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Settings(
    val currency: String = "USD",
    @SerialName("date_format") val dateFormat: String = "MM/dd/yyyy",
    @SerialName("fiscal_year_start") val fiscalYearStart: Int = 1,
    @SerialName("tax_rate") val taxRate: Double = 0.0,
    @SerialName("business_name") val businessName: String? = null,
    @SerialName("business_address") val businessAddress: String? = null,
    @SerialName("business_phone") val businessPhone: String? = null,
    @SerialName("business_email") val businessEmail: String? = null,
    @SerialName("business_website") val businessWebsite: String? = null,
    @SerialName("business_tax_id") val businessTaxId: String? = null,
    @SerialName("invoice_prefix") val invoicePrefix: String = "INV-",
    @SerialName("invoice_next_number") val invoiceNextNumber: Int = 1,
    @SerialName("invoice_terms") val invoiceTerms: String? = null,
    @SerialName("invoice_notes") val invoiceNotes: String? = null,
    @SerialName("payment_instructions") val paymentInstructions: String? = null,
    @SerialName("notifications_enabled") val notificationsEnabled: Boolean = true,
    @SerialName("email_sync_enabled") val emailSyncEnabled: Boolean = false,
    @SerialName("auto_categorize") val autoCategorize: Boolean = true,
    val theme: String = "system"
)
