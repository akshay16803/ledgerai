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

    /**
     * Demo Login — calls POST /api/auth/demo-login to sign in as the pre-seeded
     * demo account (spentyai6@gmail.com). Required for the Google Play store
     * reviewer flow so reviewers can access the full app without a real Google
     * account. The demo account always has subscription_status = "active".
     *
     * Backend response shape:
     *   {
     *     "session_token": "...",
     *     "user": {
     *       "user_id": "...",
     *       "email": "...",
     *       "subscription_status": "active",
     *       ...
     *     }
     *   }
     */
    fun signInWithDemo() {
        scope.launch {
            _isLoading.value = true
            _error.value = null

            val body = JsonObject(
                mapOf(
                    "platform" to JsonPrimitive("android")
                )
            )

            // Debug builds opt into the fresh / non-subscribed demo state so QA
            // can exercise the Monthly-intercept and onboarding-paywall flows.
            // Release builds always get the active-subscription demo path.
            val freshMode: Boolean? = if (com.spentyai.app.BuildConfig.DEBUG) true else null
            val result = apiClient.safeApiCall { apiClient.endpoints.demoLogin(body, freshMode) }
            when (result) {
                is ApiResult.Success -> {
                    val data = result.data
                    val token = data["session_token"]?.jsonPrimitive?.content
                    val userObj = data["user"] as? JsonObject
                    val userId = userObj?.get("user_id")?.jsonPrimitive?.content
                    val email = userObj?.get("email")?.jsonPrimitive?.content
                    val subscription = userObj?.get("subscription_status")?.jsonPrimitive?.content

                    if (token != null) {
                        tokenStore.saveToken(token)
                        userId?.let { tokenStore.saveUserId(it) }
                        email?.let { tokenStore.saveUserEmail(it) }
                        // Demo account always has active subscription on backend.
                        tokenStore.saveSubscriptionStatus(subscription ?: "active")
                        _isAuthenticated.value = true
                        _isSubscribed.value = tokenStore.isSubscribed()
                        android.util.Log.d("AuthManager", "[DemoLogin] success — userId=$userId email=$email")
                    } else {
                        _error.value = "Demo login unavailable. Please use Google sign-in."
                    }
                }
                is ApiResult.Failure -> {
                    android.util.Log.w("AuthManager", "[DemoLogin] failed: ${result.error.message}")
                    _error.value = "Demo login unavailable. Please use Google sign-in."
                }
            }
            _isLoading.value = false
        }
    }

    /**
     * DEBUG ONLY — bypass Google Sign-In using the dev simulator login endpoint.
     * Mirrors the iOS simulatorAutoLogin() flow exactly.
     * Falls back to an offline token if the backend returns 503/404.
     */
    fun signInWithDevBypass(email: String = "akshaychouhan16803@gmail.com") {
        scope.launch {
            _isLoading.value = true
            _error.value = null

            val body = JsonObject(
                mapOf(
                    "email" to JsonPrimitive(email),
                    "devSecret" to JsonPrimitive("spenty-sim-bypass-2026")
                )
            )

            val result = apiClient.safeApiCall { apiClient.endpoints.devSimulatorLogin(body) }
            when (result) {
                is ApiResult.Success -> {
                    val data = result.data
                    val token = data["session_token"]?.jsonPrimitive?.content
                    val userId = data["user_id"]?.jsonPrimitive?.content
                    val userEmail = data["email"]?.jsonPrimitive?.content
                    val subscription = data["subscription_status"]?.jsonPrimitive?.content

                    if (token != null) {
                        tokenStore.saveToken(token)
                        userId?.let { tokenStore.saveUserId(it) }
                        (userEmail ?: email).let { tokenStore.saveUserEmail(it) }
                        subscription?.let { tokenStore.saveSubscriptionStatus(it) }
                        _isAuthenticated.value = true
                        _isSubscribed.value = tokenStore.isSubscribed()
                        android.util.Log.d("AuthManager", "[DevBypass] API login successful")
                    } else {
                        // Fallback: offline token so UI can be tested
                        _useOfflineDevBypass(email)
                    }
                }
                is ApiResult.Failure -> {
                    android.util.Log.w("AuthManager", "[DevBypass] API failed: ${result.error.message}. Using offline bypass.")
                    _useOfflineDevBypass(email)
                }
            }
            _isLoading.value = false
        }
    }

    private fun _useOfflineDevBypass(email: String) {
        val offlineToken = "sim-offline-token-${java.util.UUID.randomUUID()}"
        tokenStore.saveToken(offlineToken)
        tokenStore.saveUserId("user_simulator_offline")
        tokenStore.saveUserEmail(email)
        tokenStore.saveSubscriptionStatus("active")
        _isAuthenticated.value = true
        _isSubscribed.value = true
        android.util.Log.d("AuthManager", "[DevBypass] Offline fallback login for $email")
    }

    fun setSignInError(message: String) {
        _isLoading.value = false
        _error.value = message
    }

    fun clearError() {
        _error.value = null
    }
}
