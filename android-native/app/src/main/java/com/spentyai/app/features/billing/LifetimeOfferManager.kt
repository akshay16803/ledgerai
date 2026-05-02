package com.spentyai.app.features.billing

import android.content.Context
import android.content.SharedPreferences

/**
 * Lifetime Offer Manager — Android port of iOS LifetimeOfferManager.swift.
 *
 * Tracks whether the 1-hour timed offer window is still open. The clock starts
 * the first time the offer sheet is shown to a non-subscriber. Existing
 * subscribers bypass this and always see the offer via the upgrade banner
 * (showTimer = false on the sheet).
 *
 * Semantics intentionally mirror iOS exactly so behavior is identical across
 * platforms (single first-shown timestamp, 3600 s window, never reset).
 */
class LifetimeOfferManager private constructor(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** True if the timed offer window is still open (never started or within 1 hour). */
    val isOfferActive: Boolean
        get() {
            val firstSeen = prefs.getLong(KEY_FIRST_SEEN, 0L)
            if (firstSeen == 0L) return true // Never shown yet — offer is open
            return System.currentTimeMillis() - firstSeen < OFFER_DURATION_MS
        }

    /** Remaining milliseconds in the offer window (0 if expired or never started). */
    val timeRemainingMs: Long
        get() {
            val firstSeen = prefs.getLong(KEY_FIRST_SEEN, 0L)
            if (firstSeen == 0L) return OFFER_DURATION_MS
            val elapsed = System.currentTimeMillis() - firstSeen
            return (OFFER_DURATION_MS - elapsed).coerceAtLeast(0L)
        }

    /** Call once when the offer sheet is first shown to start the 1-hour clock. */
    fun recordFirstShown() {
        if (prefs.contains(KEY_FIRST_SEEN)) return
        prefs.edit().putLong(KEY_FIRST_SEEN, System.currentTimeMillis()).apply()
    }

    /** Formats remaining time as "MM:SS" — matches iOS formattedTimeRemaining(). */
    fun formattedTimeRemaining(): String {
        val totalSeconds = (timeRemainingMs / 1000L).toInt()
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return String.format("%02d:%02d", minutes, seconds)
    }

    companion object {
        private const val PREFS_NAME = "spenty_lifetime_offer"
        // Mirror iOS key name so QA / support docs match across platforms.
        private const val KEY_FIRST_SEEN = "spenty_lifetime_offer_first_seen_v1"
        private const val OFFER_DURATION_MS = 3_600_000L // 1 hour, matches iOS

        @Volatile
        private var instance: LifetimeOfferManager? = null

        fun shared(context: Context): LifetimeOfferManager =
            instance ?: synchronized(this) {
                instance ?: LifetimeOfferManager(context).also { instance = it }
            }
    }
}
