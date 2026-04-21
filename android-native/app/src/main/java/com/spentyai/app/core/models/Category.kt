package com.spentyai.app.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Category(
    @SerialName("categoryId") val id: String = "",
    val name: String? = null,
    @SerialName("categoryType") val categoryType: String? = null,
    @SerialName("parentId") val parentId: String? = null,
    var children: List<Category>? = null
)

enum class CategoryType(val value: String) {
    INCOME("income"),
    EXPENSE("expense");

    companion object {
        fun fromString(value: String): CategoryType =
            entries.firstOrNull { it.value == value.lowercase() } ?: EXPENSE
    }
}

@Serializable
data class CreateCategoryRequest(
    val name: String,
    @SerialName("categoryType") val categoryType: String,
    @SerialName("parentId") val parentId: String? = null
)

@Serializable
data class UpdateCategoryRequest(
    val name: String
)

@Serializable
data class MergeCategoriesRequest(
    @SerialName("sourceId") val sourceId: String,
    @SerialName("targetId") val targetId: String
)

@Serializable
data class MergeCategoriesResponse(
    val success: Boolean = false,
    val message: String? = null
)
