package com.spentyai.app.features.featurerequests

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.FeatureRequest
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class FeatureRequestsUiState(
    val requests: List<FeatureRequest> = emptyList(),
    val isLoading: Boolean = false,
    val showForm: Boolean = false,
    val errorMessage: String? = null
)

class FeatureRequestsViewModel(
    private val repository: FeatureRequestsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(FeatureRequestsUiState())
    val uiState: StateFlow<FeatureRequestsUiState> = _uiState.asStateFlow()

    fun loadRequests() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = repository.getAll()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(requests = result.data, isLoading = false) }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.error.message ?: "Failed to load feature requests."
                        )
                    }
                }
            }
        }
    }

    fun submitRequest(title: String, description: String, category: FeatureRequestCategory) {
        viewModelScope.launch {
            _uiState.update { it.copy(errorMessage = null) }
            when (val result = repository.create(title, description, category.value)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            requests = listOf(result.data) + it.requests,
                            showForm = false
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(errorMessage = result.error.message ?: "Failed to submit your request.")
                    }
                }
            }
        }
    }

    fun voteForRequest(id: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(errorMessage = null) }
            when (val result = repository.vote(id)) {
                is ApiResult.Success -> {
                    _uiState.update { state ->
                        state.copy(
                            requests = state.requests.map { req ->
                                if (req.id == id) result.data else req
                            }
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(errorMessage = result.error.message ?: "Failed to register your vote.")
                    }
                }
            }
        }
    }

    fun showForm() {
        _uiState.update { it.copy(showForm = true) }
    }

    fun hideForm() {
        _uiState.update { it.copy(showForm = false) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
