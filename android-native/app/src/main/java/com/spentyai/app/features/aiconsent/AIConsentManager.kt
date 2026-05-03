package com.spentyai.app.features.aiconsent

import android.content.Context
import android.content.SharedPreferences

/**
 * Tracks the user's consent to send personal data (chat questions, transaction
 * summaries, email/SMS body text, receipt images) to SpentyAI's third-party AI
 * provider (OpenAI).
 *
 * Apple App Review Guideline 5.1.1(i) / 5.1.2(i) and Google Play's User Data
 * policy both require explicit, informed, opt-in consent before any personal
 * data is transmitted to a third-party AI service. The user must also be able
 * to revoke consent at any time — see Settings → Privacy.
 *
 * Mirrors the iOS [AIConsentManager] singleton word-for-word so the two
 * platforms behave identically. Storage is plain (un-encrypted)
 * `SharedPreferences` because the values are non-sensitive booleans/timestamps
 * — `EncryptedSharedPreferences` (used by `TokenStore`) is reserved for
 * session tokens and PII.
 */
object AIConsentManager {

    // ─── Storage ──────────────────────────────────────────────────────────────

    private const val PREFS_NAME = "ai_consent_v1"
    private const val KEY_GRANTED = "ai_consent_v1_granted"
    private const val KEY_DATE = "ai_consent_v1_date"

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // ─── Consent State ────────────────────────────────────────────────────────

    /**
     * Whether the user has actively opted in to AI processing. Survives
     * relaunches; safe to call from the main thread.
     */
    fun hasConsented(context: Context): Boolean =
        prefs(context).getBoolean(KEY_GRANTED, false)

    /**
     * The moment the user granted consent (epoch millis). Returns `null` if
     * never granted or if consent has been revoked.
     */
    fun consentDate(context: Context): Long? {
        val p = prefs(context)
        if (!p.contains(KEY_DATE)) return null
        val v = p.getLong(KEY_DATE, 0L)
        return if (v <= 0L) null else v
    }

    // ─── Mutators ─────────────────────────────────────────────────────────────

    /**
     * Record an explicit opt-in. Called from `AIConsentDialog` when the user
     * taps "Allow AI features", and from Settings → Privacy when the toggle
     * is flipped on after seeing the dialog.
     */
    fun grant(context: Context) {
        prefs(context).edit()
            .putBoolean(KEY_GRANTED, true)
            .putLong(KEY_DATE, System.currentTimeMillis())
            .apply()
    }

    /**
     * Revoke consent. Called from Settings → Privacy when the user toggles AI
     * processing off. Subsequent AI calls must re-prompt before sending data.
     */
    fun revoke(context: Context) {
        prefs(context).edit()
            .putBoolean(KEY_GRANTED, false)
            .remove(KEY_DATE)
            .apply()
    }
}
