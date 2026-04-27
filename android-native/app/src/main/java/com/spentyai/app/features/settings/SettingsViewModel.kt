package com.spentyai.app.features.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.auth.AuthManager
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val settings: AppSettings = AppSettings(),
    val currencies: List<CurrencyOption> = emptyList(),
    val dateFormats: List<DateFormatOption> = emptyList(),
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isResetting: Boolean = false,
    val showError: Boolean = false,
    val errorMessage: String = "",
    val showSaveSuccess: Boolean = false,
    val showSignOutConfirm: Boolean = false,
    val showDeleteConfirm: Boolean = false,
    val showResetWarning: Boolean = false,
    val showResetConfirmInput: Boolean = false,
    val resetConfirmText: String = "",
    val showResetSuccess: Boolean = false,
    val isUploadingLogo: Boolean = false,
    val isUploadingSignature: Boolean = false,
    val isDeletingLogo: Boolean = false,
    val isDeletingSignature: Boolean = false
)

class SettingsViewModel(
    private val repository: SettingsRepository,
    private val authManager: AuthManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    fun loadSettings() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, showError = false) }
            when (val result = repository.getSettings()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(settings = result.data, isLoading = false) }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            showError = true,
                            errorMessage = result.error.message ?: "Failed to load settings"
                        )
                    }
                }
            }
        }
    }

    fun saveSettings() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, showError = false) }
            when (val result = repository.updateSettings(_uiState.value.settings)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(settings = result.data, isSaving = false, showSaveSuccess = true)
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isSaving = false,
                            showError = true,
                            errorMessage = result.error.message ?: "Failed to save settings"
                        )
                    }
                }
            }
        }
    }

    fun loadCurrencies() {
        viewModelScope.launch {
            when (val result = repository.getCurrencies()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(currencies = result.data) }
                }
                is ApiResult.Failure -> { /* silently fail */ }
            }
        }
    }

    fun loadDateFormats() {
        viewModelScope.launch {
            when (val result = repository.getDateFormats()) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(dateFormats = result.data) }
                }
                is ApiResult.Failure -> { /* silently fail */ }
            }
        }
    }

    fun updateField(update: (AppSettings) -> AppSettings) {
        _uiState.update { it.copy(settings = update(it.settings)) }
    }

    fun showResetWarning() {
        _uiState.update { it.copy(showResetWarning = true) }
    }

    fun onResetWarningConfirm() {
        _uiState.update { it.copy(showResetWarning = false, showResetConfirmInput = true) }
    }

    fun onResetConfirmTextChanged(text: String) {
        _uiState.update { it.copy(resetConfirmText = text) }
    }

    fun resetData() {
        if (_uiState.value.resetConfirmText != "RESET") return
        viewModelScope.launch {
            _uiState.update { it.copy(isResetting = true, showResetConfirmInput = false) }
            when (repository.resetData()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isResetting = false,
                            showResetSuccess = true,
                            resetConfirmText = ""
                        )
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isResetting = false,
                            showError = true,
                            errorMessage = "Failed to reset data"
                        )
                    }
                }
            }
        }
    }

    fun showSignOutConfirm() {
        _uiState.update { it.copy(showSignOutConfirm = true) }
    }

    fun dismissSignOutConfirm() {
        _uiState.update { it.copy(showSignOutConfirm = false) }
    }

    fun showDeleteConfirm() {
        _uiState.update { it.copy(showDeleteConfirm = true) }
    }

    fun deleteAccount() {
        authManager.deleteAccount { success ->
            if (!success) {
                _uiState.update {
                    it.copy(showError = true, errorMessage = "Failed to delete account")
                }
            }
        }
    }

    fun signOut() {
        authManager.logout()
    }

    fun dismissError() {
        _uiState.update { it.copy(showError = false, errorMessage = "") }
    }

    fun dismissSaveSuccess() {
        _uiState.update { it.copy(showSaveSuccess = false) }
    }

    fun dismissResetWarning() {
        _uiState.update { it.copy(showResetWarning = false) }
    }

    fun dismissResetConfirmInput() {
        _uiState.update { it.copy(showResetConfirmInput = false, resetConfirmText = "") }
    }

    fun dismissResetSuccess() {
        _uiState.update { it.copy(showResetSuccess = false) }
        loadSettings()
    }

    fun dismissDeleteConfirm() {
        _uiState.update { it.copy(showDeleteConfirm = false) }
    }
}
