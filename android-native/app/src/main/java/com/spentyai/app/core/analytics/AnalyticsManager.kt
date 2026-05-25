package com.spentyai.app.core.analytics

import android.content.Context
import android.util.Log

/**
 * Thin analytics facade — mirrors iOS Analytics.shared and web
 * src/lib/analytics.js.
 *
 * Until the PostHog Android SDK + Sentry Android SDK are added as gradle
 * dependencies (see SETUP_ANALYTICS.md), every call here is a silent no-op
 * so call sites can sprinkle Analytics.track(...) freely.
 *
 * To activate:
 *   1. Add to app/build.gradle.kts dependencies:
 *        implementation("com.posthog:posthog-android:3.+")
 *        implementation("io.sentry:sentry-android:7.+")
 *   2. Call Analytics.bootstrap(...) from MainActivity.onCreate.
 *   3. Replace the TODO bodies below with the real SDK calls.
 */
object Analytics {

    private const val TAG = "Analytics"
    private var enabled: Boolean = false
    private var apiKey: String = ""
    private var host: String = "https://us.i.posthog.com"

    fun bootstrap(context: Context, postHogKey: String, postHogHost: String? = null, sentryDSN: String) {
        this.apiKey = postHogKey
        postHogHost?.let { this.host = it }
        // TODO: PostHogAndroid.setup(context, PostHogAndroidConfig(apiKey = postHogKey, host = host))
        // TODO: SentryAndroid.init(context) { it.dsn = sentryDSN; it.tracesSampleRate = 0.2 }
        this.enabled = postHogKey.isNotEmpty()
    }

    fun identify(userId: String, email: String? = null, name: String? = null) {
        if (!enabled) return
        // TODO: PostHog.identify(userId, properties = mapOf("email" to email, "name" to name))
        // TODO: Sentry.setUser(io.sentry.protocol.User().apply { id = userId; this.email = email })
        Log.d(TAG, "identify " + userId)
    }

    fun reset() {
        if (!enabled) return
        // TODO: PostHog.reset()
        // TODO: Sentry.setUser(null)
    }

    fun track(event: String, properties: Map<String, Any?> = emptyMap()) {
        if (!enabled) {
            Log.d(TAG, "(disabled) " + event)
            return
        }
        // TODO: PostHog.capture(event, properties = properties)
    }

    fun signedIn(method: String)                            = track("signed_in", mapOf("method" to method))
    fun signedOut()                                         = track("signed_out")
    fun viewedScreen(name: String)                          = track("screen_viewed", mapOf("screen" to name))
    fun premiumSheetShown(feature: String)                  = track("premium_sheet_shown", mapOf("feature" to feature))
    fun premiumSheetTap(feature: String, action: String)    = track("premium_sheet_tap", mapOf("feature" to feature, "action" to action))
    fun subscribeTapped(plan: String)                       = track("subscribe_tapped", mapOf("plan" to plan))
    fun subscribeSuccess(plan: String, amount: Double, provider: String) =
        track("subscribe_success", mapOf("plan" to plan, "amount" to amount, "provider" to provider))
    fun subscribeFailed(plan: String, error: String)        = track("subscribe_failed", mapOf("plan" to plan, "error" to error))
    fun emailSyncConnected(provider: String)                = track("email_sync_connected", mapOf("provider" to provider))
    fun smsSyncStarted()                                    = track("sms_sync_started")
    fun aiChatMessageSent()                                 = track("ai_chat_message_sent")
}
