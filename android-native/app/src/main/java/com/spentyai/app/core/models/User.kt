package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    @SerialName("user_id") val id: String,
    val email: String,
    val name: String? = null,
    @SerialName("first_name") val firstName: String? = null,
    @SerialName("last_name") val lastName: String? = null,
    @SerialName("profile_image_url") val profileImageUrl: String? = null,
    @SerialName("auth_provider") val authProvider: String? = null,
    @SerialName("subscription_status") val subscriptionStatus: String? = null,
    @SerialName("subscription_plan") val subscriptionPlan: String? = null,
    @SerialName("subscription_expires_at") val subscriptionExpiresAt: String? = null,
    @SerialName("trial_ends_at") val trialEndsAt: String? = null,
    @SerialName("is_onboarded") val isOnboarded: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    val timezone: String? = null,
    val locale: String? = null
)
