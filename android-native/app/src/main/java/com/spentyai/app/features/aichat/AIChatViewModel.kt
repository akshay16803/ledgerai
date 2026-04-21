package com.spentyai.app.features.aichat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.ChatMessage
import com.spentyai.app.core.models.ChatRole
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

data class AIChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val input: String = "",
    val isSending: Boolean = false,
    val suggestions: List<String> = emptyList(),
    val errorMessage: String? = null,
    val scrollToBottomTrigger: Int = 0,
    val showClearConfirmation: Boolean = false
)

class AIChatViewModel(
    private val repository: AIChatRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AIChatUiState())
    val uiState: StateFlow<AIChatUiState> = _uiState.asStateFlow()

    val canSend: Boolean
        get() = _uiState.value.input.isNotBlank() && !_uiState.value.isSending

    fun loadSuggestions() {
        _uiState.update { it.copy(suggestions = repository.getDefaultSuggestions()) }
    }

    fun loadHistory() {
        viewModelScope.launch {
            when (val result = repository.loadHistory()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            messages = result.data,
                            scrollToBottomTrigger = it.scrollToBottomTrigger + 1
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = "Could not load chat history.") }
                }
            }
        }
    }

    fun onInputChange(text: String) {
        _uiState.update { it.copy(input = text) }
    }

    fun sendMessage() {
        val text = _uiState.value.input.trim()
        if (text.isEmpty()) return

        val userMessage = ChatMessage(
            id = UUID.randomUUID().toString(),
            role = ChatRole.USER,
            content = text
        )

        _uiState.update {
            it.copy(
                messages = it.messages + userMessage,
                input = "",
                isSending = true,
                errorMessage = null,
                scrollToBottomTrigger = it.scrollToBottomTrigger + 1
            )
        }

        viewModelScope.launch {
            when (val result = repository.sendMessage(text, _uiState.value.messages)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            messages = it.messages + result.data,
                            isSending = false,
                            scrollToBottomTrigger = it.scrollToBottomTrigger + 1
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isSending = false,
                            errorMessage = "Failed to get a response. Please try again."
                        )
                    }
                }
            }
        }
    }

    fun sendSuggestion(suggestion: String) {
        _uiState.update { it.copy(input = suggestion) }
        sendMessage()
    }

    fun clearHistory() {
        viewModelScope.launch {
            repository.clearHistory()
            _uiState.update {
                it.copy(
                    messages = emptyList(),
                    errorMessage = null,
                    showClearConfirmation = false
                )
            }
        }
    }

    fun showClearConfirmation() {
        _uiState.update { it.copy(showClearConfirmation = true) }
    }

    fun dismissClearConfirmation() {
        _uiState.update { it.copy(showClearConfirmation = false) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
