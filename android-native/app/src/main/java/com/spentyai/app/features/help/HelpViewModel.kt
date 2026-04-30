package com.spentyai.app.features.help

import androidx.lifecycle.ViewModel
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class HelpUiState(
    val articles: List<HelpArticle> = emptyList(),
    val expandedId: String? = null,
    val errorMessage: String? = null
)

class HelpViewModel(
    private val repository: HelpRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HelpUiState())
    val uiState: StateFlow<HelpUiState> = _uiState.asStateFlow()

    init {
        // Article load is synchronous (in-memory) today. When the
        // backend ships /api/help/articles the call will move into a
        // viewModelScope.launch block - the rest of this view model
        // is already shaped for that.
        when (val result = repository.getArticles()) {
            is ApiResult.Success -> _uiState.update { it.copy(articles = result.data) }
            is ApiResult.Failure -> _uiState.update {
                it.copy(errorMessage = "Could not load help articles. Please try again later.")
            }
        }
    }

    fun toggleArticle(id: String) {
        _uiState.update {
            it.copy(expandedId = if (it.expandedId == id) null else id)
        }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
