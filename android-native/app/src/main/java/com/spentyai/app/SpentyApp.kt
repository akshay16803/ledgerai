package com.spentyai.app

import android.app.Application
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
    }

    companion object {
        lateinit var instance: SpentyApp
            private set
    }
}
