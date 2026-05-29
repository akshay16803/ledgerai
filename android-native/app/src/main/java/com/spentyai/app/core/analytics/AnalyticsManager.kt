package com.spentyai.app.core.analytics

import android.content.Context
import android.util.Log
import com.posthog.PersonProfiles
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

/**
 * Thin analytics facade — wraps PostHog Android in ANONYMOUS mode.
 *
 * Design constraints (per project owner, 2026-05-29):
 *   • Never call `identify()`. PostHog uses an auto-generated, device-local
 *     anonymous UUID as the distinct_id for the lifetime of the install.
 *   • Never pass user_id, email, name, or any PII into event properties.
 *   • Person profiles are created only when explicitly identified — and we
 *     never identify, so PostHog will never store an identified person.
 *   • Session recordings are OFF.
 *
 * The PostHog API key is supplied at build time via local.properties:
 *   posthog.key=phc_xxxxxxxx
 * If empty, every call here is a silent no-op.
 */
object Analytics {

    private const val TAG = "Analytics"
    private var enabled: Boolean = false

    /**
     * Bootstrap PostHog in anonymous mode. Call from SpentyApp.onCreate.
     * Safe to call with an empty key — stays disabled.
     */
    fun bootstrap(context: Context, postHogKey: String, postHogHost: String = "https://us.i.posthog.com") {
        if (postHogKey.isEmpty()) {
            Log.d(TAG, "disabled — POSTHOG_KEY not configured in local.properties")
            return
        }
        val config = PostHogAndroidConfig(
            apiKey = postHogKey,
            host = postHogHost,
        ).apply {
            // Anonymous-only: no identified person will ever be created
            // unless identify() is called — and we never call it.
            personProfiles = PersonProfiles.IDENTIFIED_ONLY
            // No session recordings — privacy.
            sessionReplay = false
            // We track screens manually via the navigation layer.
            captureScreenViews = false
            // Lifecycle events (app opened / backgrounded) are fine — no PII.
            captureApplicationLifecycleEvents = true
            captureDeepLinks = false
        }
        PostHogAndroid.setup(context, config)
        enabled = true
        Log.d(TAG, "PostHog active (anonymous, recordings off)")
    }

    /**
     * Hard-disabled by design. Calling this is a no-op so old call sites
     * (if any) cannot accidentally de-anonymize users.
     */
    @Suppress("UNUSED_PARAMETER")
    fun identify(userId: String, email: String? = null, name: String? = null) {
        // Intentionally empty. See bootstrap() docstring.
    }

    /** Forget the anonymous distinct_id (e.g., on sign-out). */
    fun reset() {
        if (!enabled) return
        PostHog.reset()
    }

    fun track(event: String, properties: Map<String, Any?> = emptyMap()) {
        if (!enabled) {
            Log.d(TAG, "(disabled) $event")
            return
        }
        PostHog.capture(event, properties = properties.filterValues { it != null }.mapValues { it.value!! })
    }

    // ── Convenience helpers (anonymous-safe — no PII) ──────────────────────
    fun signedIn(method: String) = track("signed_in", mapOf("method" to method))
    fun signedOut() { track("signed_out"); reset() }
    fun viewedScreen(name: String) = track("screen_viewed", mapOf("screen" to name))
    fun premiumSheetShown(feature: String) = track("premium_sheet_shown", mapOf("feature" to feature))
    fun premiumSheetTap(feature: String, action: String) =
        track("premium_sheet_tap", mapOf("feature" to feature, "action" to action))
    fun subscribeTapped(plan: String) = track("subscribe_tapped", mapOf("plan" to plan))
    fun subscribeSuccess(plan: String, amount: Double, provider: String) =
        track("subscribe_success", mapOf("plan" to plan, "amount" to amount, "provider" to provider))
    fun subscribeFailed(plan: String, error: String) = track("subscribe_failed", mapOf("plan" to plan, "error" to error))
    fun emailSyncConnected(provider: String) = track("email_sync_connected", mapOf("provider" to provider))
    fun smsSyncStarted() = track("sms_sync_started")
    fun aiChatMessageSent() = track("ai_chat_message_sent")
    fun buttonTapped(name: String) = track("button_tapped", mapOf("button" to name))
}
