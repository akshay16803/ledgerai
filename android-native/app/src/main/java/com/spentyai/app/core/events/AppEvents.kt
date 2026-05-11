package com.spentyai.app.core.events

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Lightweight app-level event bus. Mirrors iOS's
 * `NotificationCenter.default.post(name: .accountsDidChange, ...)`
 * pattern so screens can react to server-side changes initiated from
 * another screen (today only AI chat creating accounts; can grow to
 * transactions / invoices / bills as needed).
 *
 * Use a `replay = 0` shared flow so events only fire forward — late
 * subscribers don't replay the last event when they appear, matching
 * NotificationCenter behaviour.
 */
object AppEvents {

    private val _accountsChanged = MutableSharedFlow<Unit>(replay = 0, extraBufferCapacity = 4)
    val accountsChanged = _accountsChanged.asSharedFlow()

    suspend fun notifyAccountsChanged() {
        _accountsChanged.emit(Unit)
    }
}
