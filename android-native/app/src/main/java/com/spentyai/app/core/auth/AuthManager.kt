package com.spentyai.app.core.auth

import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

class AuthManager(
    private val tokenStore: TokenStore,
    private val apiClient: ApiClient
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _isSubscribed = MutableStateFlow(false)
    val isSubscribed: StateFlow<Boolean> = _isSubscribed.asStateFlow()

    fun checkSession() {
        val token = tokenStore.getToken()
        if (token == null) {
            _isAuthenticated.value = false
            return
        }

        scope.launch {
            _isLoading.value = true
            val result = apiClient.safeApiCall { apiClient.endpoints.checkSession() }
            when (result) {
                is ApiResult.Success -> {
                    _isAuthenticated.value = true
                    _isSubscribed.value = tokenStore.isSubscribed()
                }
                is ApiResult.Failure -> {
                    _isAuthenticated.value = false
                    tokenStore.clearToken()
                }
            }
            _isLoading.value = false
        }
    }

    fun signInWithGoogle(idToken: String) {
        scope.launch {
            _isLoading.value = true
            _error.value = null

            val body = JsonObject(
                mapOf(
                    "id_token" to JsonPrimitive(idToken),
                    "platform" to JsonPrimitive("android")
                )
            )

            val result = apiClient.safeApiCall { apiClient.endpoints.googleSignIn(body) }
            when (result) {
                is ApiResult.Success -> {
                    val data = result.data
                    val token = data["session_token"]?.jsonPrimitive?.content
                    val userId = data["user_id"]?.jsonPrimitive?.content
                    val email = data["email"]?.jsonPrimitive?.content
                    val subscription = data["subscription_status"]?.jsonPrimitive?.content

                    if (token != null) {
                        tokenStore.saveToken(token)
                        userId?.let { tokenStore.saveUserId(it) }
                        email?.let { tokenStore.saveUserEmail(it) }
                        subscription?.let { tokenStore.saveSubscriptionStatus(it) }
                        _isAuthenticated.value = true
                        _isSubscribed.value = tokenStore.isSubscribed()
                    } else {
                        _error.value = "Invalid server response"
                    }
                }
                is ApiResult.Failure -> {
                    _error.value = result.error.message
                }
            }
            _isLoading.value = false
        }
    }

    fun logout() {
        scope.launch {
            apiClient.safeApiCall { apiClient.endpoints.logout() }
            tokenStore.clearAll()
            _isAuthenticated.value = false
            _isSubscribed.value = false
        }
    }

    fun deleteAccount(onComplete: (Boolean) -> Unit) {
        scope.launch {
            val result = apiClient.safeApiCall { apiClient.endpoints.deleteAccount() }
            when (result) {
                is ApiResult.Success -> {
                    tokenStore.clearAll()
                    _isAuthenticated.value = false
                    _isSubscribed.value = false
                    onComplete(true)
                }
                is ApiResult.Failure -> {
                    _error.value = result.error.message
                    onComplete(false)
                }
            }
        }
    }

    fun setSignInError(message: String) {
        _isLoading.value = false
        _error.value = message
    }

    fun clearError() {
        _error.value = null
    }
}
