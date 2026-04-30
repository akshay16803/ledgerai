package com.spentyai.app.features.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.auth.AuthManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val authManager: AuthManager
) : ViewModel() {

    val isLoading: StateFlow<Boolean> = authManager.isLoading
    val isAuthenticated: StateFlow<Boolean> = authManager.isAuthenticated

    private val _errorMessage = MutableStateFlow("")
    val errorMessage: StateFlow<String> = _errorMessage.asStateFlow()

    private val _showError = MutableStateFlow(false)
    val showError: StateFlow<Boolean> = _showError.asStateFlow()

    init {
        // Observe errors from AuthManager and forward to UI state
        viewModelScope.launch {
            authManager.error.collect { error ->
                if (error != null) {
                    _errorMessage.value = error
                    _showError.value = true
                }
            }
        }
    }

    fun signInWithGoogle(idToken: String) {
        _showError.value = false
        _errorMessage.value = ""
        authManager.signInWithGoogle(idToken)
    }

    fun onSignInError(message: String) {
        _errorMessage.value = message
        _showError.value = true
    }

    fun dismissError() {
        _showError.value = false
        _errorMessage.value = ""
        authManager.clearError()
    }

    /**
     * Demo Account login — required for Google Play store reviewer flow.
     * Calls POST /api/auth/demo-login under the hood; signs the user in as
     * spentyai6@gmail.com with full subscription access.
     */
    fun signInWithDemo() {
        _showError.value = false
        _errorMessage.value = ""
        authManager.signInWithDemo()
    }

    /** Debug bypass — only call from debug builds. */
    fun devSignIn() {
        _showError.value = false
        _errorMessage.value = ""
        authManager.signInWithDevBypass()
    }
}
