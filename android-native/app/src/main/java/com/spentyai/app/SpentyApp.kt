package com.spentyai.app

import android.app.Application
import com.spentyai.app.core.analytics.Analytics
import com.spentyai.app.core.auth.AuthManager
import com.spentyai.app.core.auth.TokenStore
import com.spentyai.app.core.network.ApiClient

class SpentyApp : Application() {

    lateinit var tokenStore: TokenStore
        private set

    lateinit var apiClient: ApiClient
        private set

    lateinit var authManager: AuthManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        tokenStore = TokenStore(this)
        apiClient = ApiClient(tokenStore)
        authManager = AuthManager(tokenStore, apiClient)

        // Anonymous product analytics (PostHog). Key is read from
        // local.properties → BuildConfig at compile time. Empty key
        // leaves the SDK disabled.
        Analytics.bootstrap(
            context = this,
            postHogKey = BuildConfig.POSTHOG_KEY,
            postHogHost = BuildConfig.POSTHOG_HOST,
        )
    }

    companion object {
        lateinit var instance: SpentyApp
            private set
    }
}
