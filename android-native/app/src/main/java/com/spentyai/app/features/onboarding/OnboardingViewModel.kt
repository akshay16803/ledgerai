package com.spentyai.app.features.onboarding

import androidx.lifecycle.ViewModel
import com.spentyai.app.core.onboarding.OnboardingPrefs
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Tracks whether the first-run onboarding slider has been completed.
 * Mirrors iOS's `OnboardingManager` — exposes a single boolean state
 * (`hasSeenOnboarding`) plus a `markSeen()` action.
 *
 * Created at app start in [com.spentyai.app.MainActivity] so the routing
 * decision (onboarding vs login vs main) can be made synchronously on the
 * first composition.
 */
class OnboardingViewModel(
    private val prefs: OnboardingPrefs
) : ViewModel() {

    private val _hasSeenOnboarding = MutableStateFlow(prefs.hasSeenOnboarding())
    val hasSeenOnboarding: StateFlow<Boolean> = _hasSeenOnboarding.asStateFlow()

    fun markSeen() {
        prefs.markSeen()
        _hasSeenOnboarding.value = true
    }

    /** Reset the flag — used for QA / debug builds. */
    fun reset() {
        prefs.reset()
        _hasSeenOnboarding.value = false
    }
}
