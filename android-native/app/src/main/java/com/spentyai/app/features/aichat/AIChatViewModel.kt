package com.spentyai.app.features.aichat

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.ChatMessage
import com.spentyai.app.core.models.ChatRole
import com.spentyai.app.core.network.ApiResult
import com.spentyai.app.core.services.AndroidSpeechManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

data class AIChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val input: String = "",
    val isSending: Boolean = false,
    val suggestions: List<String> = emptyList(),
    val errorMessage: String? = null,
    val scrollToBottomTrigger: Int = 0,
    val showClearConfirmation: Boolean = false
)

class AIChatViewModel(
    private val repository: AIChatRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AIChatUiState())
    val uiState: StateFlow<AIChatUiState> = _uiState.asStateFlow()

    val canSend: Boolean
        get() = _uiState.value.input.isNotBlank() && !_uiState.value.isSending

    // ─── Voice ────────────────────────────────────────────────────────────────

    val speechManager = AndroidSpeechManager()

    private val _isVoiceResponseEnabled = MutableStateFlow(false)
    val isVoiceResponseEnabled: StateFlow<Boolean> = _isVoiceResponseEnabled.asStateFlow()

    private val _isVoiceModeActive = MutableStateFlow(false)
    val isVoiceModeActive: StateFlow<Boolean> = _isVoiceModeActive.asStateFlow()

    // ─── Chat ─────────────────────────────────────────────────────────────────

    fun loadSuggestions() {
        _uiState.update { it.copy(suggestions = repository.getDefaultSuggestions()) }
    }

    fun loadHistory() {
        viewModelScope.launch {
            when (val result = repository.loadHistory()) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            messages = result.data,
                            scrollToBottomTrigger = it.scrollToBottomTrigger + 1
                        )
                    }
                }
                is ApiResult.Failure -> {
                    // Loading history is OPPORTUNISTIC. If it fails (network blip,
                    // first-time user with no history yet, transient hiccup, etc.)
                    // the user can still send messages — surfacing a blocking
                    // alert here was over-aggressive and hid the chat UI.
                    // Log for debugging; leave messages empty.
                    android.util.Log.w("AIChat", "loadHistory failed: ${result.error}")
                }
            }
        }
    }

    fun onInputChange(text: String) {
        _uiState.update { it.copy(input = text) }
    }

    fun sendMessage(context: Context? = null) {
        // Reentry guard: a fast double-tap on Send or a voice-mode tap
        // arriving while a previous request is still in flight would queue
        // two requests and double-fire. Protect at the source — UI redraw
        // of the .disabled state has a frame of latency.
        if (_uiState.value.isSending) {
            android.util.Log.w("AIChat", "sendMessage ignored — already sending")
            return
        }

        // Belt-and-suspenders: if `input` is empty but the user is mid-
        // dictation (mic on with a transcript), fall through to the
        // transcribed text and also stop the mic. Catches a race where the
        // user taps Send before the live-mirror LaunchedEffect has
        // propagated the latest transcribedText into uiState.input.
        if (_uiState.value.input.trim().isEmpty()) {
            val fallback = speechManager.transcribedText.value.trim()
            if (fallback.isNotEmpty()) {
                android.util.Log.i("AIChat", "sendMessage rescuing from transcribedText (input was empty)")
                if (speechManager.isListening.value) {
                    speechManager.stopListening()
                }
                _uiState.update { it.copy(input = fallback) }
                speechManager.resetTranscription()
            }
        }

        val text = _uiState.value.input.trim()
        if (text.isEmpty()) {
            android.util.Log.w("AIChat", "sendMessage ignored — input is empty after fallback")
            return
        }

        android.util.Log.d("AIChat", "sendMessage start — ${text.take(60)}")

        val userMessage = ChatMessage(
            id = UUID.randomUUID().toString(),
            role = ChatRole.USER,
            content = text
        )

        _uiState.update {
            it.copy(
                messages = it.messages + userMessage,
                input = "",
                isSending = true,
                errorMessage = null,
                scrollToBottomTrigger = it.scrollToBottomTrigger + 1
            )
        }

        viewModelScope.launch {
            when (val result = repository.sendMessage(text, _uiState.value.messages, voiceMode = _isVoiceModeActive.value)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            messages = it.messages + result.data,
                            isSending = false,
                            scrollToBottomTrigger = it.scrollToBottomTrigger + 1
                        )
                    }
                    // If the AI just created a financial account, push a
                    // refresh event so any open AccountListScreen reloads
                    // without the user having to pull-to-refresh. Mirrors
                    // iOS's .accountsDidChange NotificationCenter post.
                    if (result.data.accountCreated == true) {
                        com.spentyai.app.core.events.AppEvents.notifyAccountsChanged()
                    }
                    // Speak the AI response if voice response or voice mode is active.
                    if (context != null && (_isVoiceResponseEnabled.value || _isVoiceModeActive.value)) {
                        val content = result.data.content
                        // In voice mode, after speaking restart listening.
                        if (_isVoiceModeActive.value) {
                            speechManager.onTtsFinished = {
                                if (_isVoiceModeActive.value) {
                                    speechManager.startListening(context)
                                }
                            }
                        }
                        speechManager.speak(content, context)
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isSending = false,
                            errorMessage = "Failed to get a response. Please try again."
                        )
                    }
                }
            }
        }
    }

    fun sendSuggestion(suggestion: String) {
        _uiState.update { it.copy(input = suggestion) }
        sendMessage()
    }

    fun clearHistory() {
        viewModelScope.launch {
            repository.clearHistory()
            _uiState.update {
                it.copy(
                    messages = emptyList(),
                    errorMessage = null,
                    showClearConfirmation = false
                )
            }
        }
    }

    fun showClearConfirmation() {
        _uiState.update { it.copy(showClearConfirmation = true) }
    }

    fun dismissClearConfirmation() {
        _uiState.update { it.copy(showClearConfirmation = false) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    // ─── Voice actions ────────────────────────────────────────────────────────

    /**
     * Toggle the microphone on/off.
     * If currently listening: stop and send the transcribed text if any.
     * If not listening: start listening (caller must have already obtained the permission).
     */
    suspend fun toggleMicrophone(context: Context) {
        if (speechManager.isListening.value) {
            speechManager.stopListening()
            // Finalize transcription into the input field but do NOT auto-send.
            // User reviews and taps Send themselves. Live-mirror in the screen
            // also keeps input in sync while listening.
            val transcribed = speechManager.transcribedText.value.trim()
            if (transcribed.isNotEmpty()) {
                _uiState.update { it.copy(input = transcribed) }
            }
            speechManager.resetTranscription()
        } else {
            speechManager.checkPermissions(context)
            if (speechManager.hasMicrophonePermission.value) {
                // Clear the field so live-mirror starts from a clean slate.
                _uiState.update { it.copy(input = "") }
                speechManager.resetTranscription()
                speechManager.startListening(context)
            }
        }
    }

    /** Toggle TTS for AI responses (voice response mode). */
    fun toggleVoiceResponse() {
        _isVoiceResponseEnabled.value = !_isVoiceResponseEnabled.value
    }

    /** Enter or exit voice mode. */
    suspend fun toggleVoiceMode(context: Context) {
        if (_isVoiceModeActive.value) {
            exitVoiceMode()
        } else {
            enterVoiceMode(context)
        }
    }

    /** Enter voice mode: check permissions, activate, start listening. */
    suspend fun enterVoiceMode(context: Context) {
        speechManager.checkPermissions(context)
        if (!speechManager.hasMicrophonePermission.value) {
            // Caller (Composable) is responsible for requesting the runtime permission.
            // We set a flag so the UI knows to show the permission rationale.
            return
        }
        _isVoiceModeActive.value = true
        speechManager.resetTranscription()
        speechManager.startListening(context)
    }

    /** Exit voice mode: stop all audio activity. */
    fun exitVoiceMode() {
        _isVoiceModeActive.value = false
        speechManager.stopListening()
        speechManager.stopSpeaking()
        speechManager.onTtsFinished = null
        speechManager.resetTranscription()
    }

    /**
     * Send the current voice input, or restart listening if the transcript is empty.
     * Used by the "Send" button inside the voice mode overlay.
     */
    suspend fun sendVoiceInput(context: Context) {
        speechManager.stopListening()
        val transcribed = speechManager.transcribedText.value.trim()
        if (transcribed.isNotEmpty()) {
            _uiState.update { it.copy(input = transcribed) }
            speechManager.resetTranscription()
            sendMessage(context)
        } else {
            // Nothing to send — restart listening.
            speechManager.startListening(context)
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    override fun onCleared() {
        super.onCleared()
        speechManager.destroy()
    }
}
