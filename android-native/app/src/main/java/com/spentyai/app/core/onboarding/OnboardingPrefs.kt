package com.spentyai.app.core.onboarding

import android.content.Context
import android.content.SharedPreferences

/**
 * Persists whether the user has completed the first-run onboarding slider.
 * Mirrors iOS's `OnboardingManager` (which writes to UserDefaults under
 * `spenty_onboarding_slider_seen_v1`).
 *
 * Plain (non-encrypted) SharedPreferences is fine here — the flag is not
 * security-sensitive and survives reinstall via Auto Backup.
 */
class OnboardingPrefs(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun hasSeenOnboarding(): Boolean {
        return prefs.getBoolean(KEY_SEEN, false)
    }

    fun markSeen() {
        prefs.edit().putBoolean(KEY_SEEN, true).apply()
    }

    fun reset() {
        prefs.edit().remove(KEY_SEEN).apply()
    }

    companion object {
        private const val PREFS_NAME = "spenty_onboarding_prefs"
        private const val KEY_SEEN = "spenty_onboarding_slider_seen_v1"
    }
}
