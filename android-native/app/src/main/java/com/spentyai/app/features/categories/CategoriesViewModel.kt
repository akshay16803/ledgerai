package com.spentyai.app.features.categories

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.*
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CategoriesUiState(
    val categories: List<Category> = emptyList(),
    val activeTab: CategoryType = CategoryType.EXPENSE,
    val isLoading: Boolean = false,
    val showForm: Boolean = false,
    val editingCategory: Category? = null,
    val selectedParent: Category? = null,
    val errorMessage: String = "",
    val showError: Boolean = false
)

class CategoriesViewModel(private val apiClient: ApiClient) : ViewModel() {

    private val repository = CategoryRepository(apiClient)

    private val _uiState = MutableStateFlow(CategoriesUiState())
    val uiState: StateFlow<CategoriesUiState> = _uiState.asStateFlow()

    // MARK: - Computed — Tree

    fun categoryTree(): List<Category> {
        val state = _uiState.value
        val filtered = state.categories.filter { it.categoryType == state.activeTab.value }
        val topLevel = filtered.filter { it.parentId == null }

        return topLevel.map { parent ->
            parent.copy(
                children = filtered.filter { it.parentId == parent.id }
            )
        }.sortedBy { it.name?.lowercase() }
    }

    fun topLevelCategories(): List<Category> {
        val state = _uiState.value
        return state.categories
            .filter { it.categoryType == state.activeTab.value && it.parentId == null }
            .sortedBy { it.name?.lowercase() }
    }

    // MARK: - State Updates

    fun setActiveTab(tab: CategoryType) {
        _uiState.update { it.copy(activeTab = tab) }
    }

    fun beginCreate(parent: Category? = null) {
        _uiState.update { it.copy(editingCategory = null, selectedParent = parent, showForm = true) }
    }

    fun beginEdit(category: Category) {
        val parent = _uiState.value.categories.firstOrNull { it.id == category.parentId }
        _uiState.update { it.copy(editingCategory = category, selectedParent = parent, showForm = true) }
    }

    fun hideForm() {
        _uiState.update { it.copy(showForm = false, editingCategory = null, selectedParent = null) }
    }

    fun dismissError() {
        _uiState.update { it.copy(showError = false, errorMessage = "") }
    }

    // MARK: - Actions

    fun loadCategories() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = repository.getCategories()) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(categories = result.data, isLoading = false)
                }
                is ApiResult.Failure -> {
                    handleError(result.error.message ?: "Failed to load categories")
                    _uiState.update { it.copy(isLoading = false) }
                }
            }
        }
    }

    fun createCategory(name: String, type: CategoryType, parentId: String?) {
        viewModelScope.launch {
            when (val result = repository.createCategory(name, type, parentId)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(categories = it.categories + result.data, showForm = false)
                }
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to create category")
            }
        }
    }

    fun updateCategory(id: String, name: String) {
        viewModelScope.launch {
            when (val result = repository.updateCategory(id, name)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(
                        categories = state.categories.map { if (it.id == id) result.data else it },
                        showForm = false,
                        editingCategory = null
                    )
                }
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to update category")
            }
        }
    }

    fun deleteCategory(id: String) {
        viewModelScope.launch {
            when (repository.deleteCategory(id)) {
                is ApiResult.Success -> _uiState.update { state ->
                    state.copy(categories = state.categories.filter { it.id != id })
                }
                is ApiResult.Failure -> handleError("Failed to delete category")
            }
        }
    }

    fun loadDefaults() {
        viewModelScope.launch {
            when (val result = repository.loadDefaults()) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(categories = result.data)
                }
                is ApiResult.Failure -> handleError(result.error.message ?: "Failed to load defaults")
            }
        }
    }

    fun mergeCategories(sourceId: String, targetId: String) {
        viewModelScope.launch {
            when (repository.mergeCategories(sourceId, targetId)) {
                is ApiResult.Success -> loadCategories()
                is ApiResult.Failure -> handleError("Failed to merge categories")
            }
        }
    }

    private fun handleError(message: String) {
        _uiState.update { it.copy(errorMessage = message, showError = true) }
    }
}
