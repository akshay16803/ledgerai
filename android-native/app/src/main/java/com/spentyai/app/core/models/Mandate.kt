package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Mandate(
    @SerialName("mandateId") val id: String = "",
    val merchant: String? = null,
    val mandateType: String? = null,
    val amount: Double? = null,
    val frequency: String? = null,
    val startDate: String? = null,
    val status: String? = null,
    val source: String? = null,
    val sourceEmailId: String? = null,
    val sourceEmailSubject: String? = null
)
