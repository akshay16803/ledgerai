package com.spentyai.app.features.support

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class TicketCategory(val displayName: String, val value: String) {
    BUG("Bug Report", "bug"),
    FEATURE("Feature Request", "feature"),
    BILLING("Billing", "billing"),
    ACCOUNT("Account", "account"),
    DATA("Data", "data"),
    GENERAL("General", "general")
}

enum class TicketPriority(val displayName: String, val value: String) {
    LOW("Low", "low"),
    MEDIUM("Medium", "medium"),
    HIGH("High", "high")
}

data class SupportUiState(
    val subject: String = "",
    val category: TicketCategory = TicketCategory.GENERAL,
    val priority: TicketPriority = TicketPriority.MEDIUM,
    val message: String = "",
    val isSubmitting: Boolean = false,
    val isSubmitted: Boolean = false,
    val faqItems: List<FAQItem> = emptyList(),
    val isLoadingFAQ: Boolean = false,
    val errorMessage: String? = null,
    val expandedFaqId: String? = null
) {
    val isFormValid: Boolean
        get() = subject.isNotBlank() && message.isNotBlank()
}

class SupportViewModel(
    private val repository: SupportRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SupportUiState())
    val uiState: StateFlow<SupportUiState> = _uiState.asStateFlow()

    fun loadFAQ() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingFAQ = true) }
            when (val result = repository.getFAQ()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(faqItems = result.data, isLoadingFAQ = false) }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoadingFAQ = false,
                            errorMessage = "Could not load FAQ. Please try again later."
                        )
                    }
                }
            }
        }
    }

    fun onSubjectChange(value: String) {
        _uiState.update { it.copy(subject = value) }
    }

    fun onCategoryChange(category: TicketCategory) {
        _uiState.update { it.copy(category = category) }
    }

    fun onPriorityChange(priority: TicketPriority) {
        _uiState.update { it.copy(priority = priority) }
    }

    fun onMessageChange(value: String) {
        _uiState.update { it.copy(message = value) }
    }

    fun toggleFaq(id: String) {
        _uiState.update {
            it.copy(expandedFaqId = if (it.expandedFaqId == id) null else id)
        }
    }

    fun submitTicket() {
        val state = _uiState.value
        if (!state.isFormValid) {
            _uiState.update { it.copy(errorMessage = "Please fill in both subject and message.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            when (repository.submitTicket(
                subject = state.subject.trim(),
                category = state.category.value,
                priority = state.priority.value,
                message = state.message.trim()
            )) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            isSubmitted = true,
                            subject = "",
                            category = TicketCategory.GENERAL,
                            priority = TicketPriority.MEDIUM,
                            message = ""
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = "Something went wrong. Please try again."
                        )
                    }
                }
            }
        }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun dismissSuccess() {
        _uiState.update { it.copy(isSubmitted = false) }
    }
}
