package com.spentyai.app.features.categories

import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult

class CategoryRepository(private val apiClient: ApiClient) {

    suspend fun getCategories(): ApiResult<List<Category>> {
        return apiClient.safeApiCall { apiClient.endpoints.getCategories() }
    }

    suspend fun createCategory(name: String, type: CategoryType, parentId: String?): ApiResult<Category> {
        val request = CreateCategoryRequest(
            name = name,
            categoryType = type.value,
            parentId = parentId
        )
        return apiClient.safeApiCall { apiClient.endpoints.createCategory(request) }
    }

    suspend fun updateCategory(id: String, name: String): ApiResult<Category> {
        val request = UpdateCategoryRequest(name = name)
        return apiClient.safeApiCall { apiClient.endpoints.updateCategory(id, request) }
    }

    suspend fun deleteCategory(id: String): ApiResult<kotlinx.serialization.json.JsonObject> {
        return apiClient.safeApiCall { apiClient.endpoints.deleteCategory(id) }
    }

    suspend fun loadDefaults(): ApiResult<List<Category>> {
        return apiClient.safeApiCall { apiClient.endpoints.getCategoryDefaults() }
    }

    suspend fun mergeCategories(sourceId: String, targetId: String): ApiResult<MergeCategoriesResponse> {
        val request = MergeCategoriesRequest(sourceId = sourceId, targetId = targetId)
        return apiClient.safeApiCall { apiClient.endpoints.mergeCategories(request) }
    }
}
