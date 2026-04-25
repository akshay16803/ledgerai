package com.spentyai.app.core.services

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import java.util.UUID

class AndroidSpeechManager {

    // ─── State ────────────────────────────────────────────────────────────────

    private val _transcribedText = MutableStateFlow("")
    val transcribedText: StateFlow<String> = _transcribedText.asStateFlow()

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _hasMicrophonePermission = MutableStateFlow(false)
    val hasMicrophonePermission: StateFlow<Boolean> = _hasMicrophonePermission.asStateFlow()

    // On Android, RECORD_AUDIO covers both mic and speech recognition access.
    private val _hasSpeechPermission = MutableStateFlow(false)
    val hasSpeechPermission: StateFlow<Boolean> = _hasSpeechPermission.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // ─── Internal ─────────────────────────────────────────────────────────────

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    // Callback fired after TTS finishes an utterance — used by voice-mode loop.
    var onTtsFinished: (() -> Unit)? = null

    // ─── Permissions ──────────────────────────────────────────────────────────

    fun checkPermissions(context: Context) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        _hasMicrophonePermission.value = granted
        _hasSpeechPermission.value = granted
    }

    // ─── Speech-to-Text ───────────────────────────────────────────────────────

    fun startListening(context: Context) {
        checkPermissions(context)
        if (!_hasMicrophonePermission.value) {
            _errorMessage.value = "Microphone permission is required to use voice input."
            return
        }

        // Destroy any previous recognizer instance.
        speechRecognizer?.destroy()
        speechRecognizer = null

        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            _errorMessage.value = "Speech recognition is not available on this device."
            return
        }

        val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
        speechRecognizer = recognizer

        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                _isListening.value = true
                _errorMessage.value = null
            }

            override fun onBeginningOfSpeech() {
                _isListening.value = true
            }

            override fun onRmsChanged(rmsdB: Float) { /* no-op */ }

            override fun onBufferReceived(buffer: ByteArray?) { /* no-op */ }

            override fun onEndOfSpeech() {
                _isListening.value = false
            }

            override fun onError(error: Int) {
                _isListening.value = false
                val msg = when (error) {
                    SpeechRecognizer.ERROR_AUDIO -> "Audio recording error."
                    SpeechRecognizer.ERROR_CLIENT -> null // client-side cancel, not an error
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission denied."
                    SpeechRecognizer.ERROR_NETWORK -> "Network error during recognition."
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout during recognition."
                    SpeechRecognizer.ERROR_NO_MATCH -> null // silence or unrecognised — not a hard error
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy."
                    SpeechRecognizer.ERROR_SERVER -> "Server error during recognition."
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> null // user did not speak
                    else -> "Speech recognition error ($error)."
                }
                if (msg != null) _errorMessage.value = msg
            }

            override fun onResults(results: Bundle?) {
                _isListening.value = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    _transcribedText.value = matches[0]
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val partial = partialResults
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!partial.isNullOrEmpty() && partial[0].isNotBlank()) {
                    _transcribedText.value = partial[0]
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) { /* no-op */ }
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 3000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
        }

        recognizer.startListening(intent)
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
        speechRecognizer?.destroy()
        speechRecognizer = null
        _isListening.value = false
    }

    fun resetTranscription() {
        _transcribedText.value = ""
    }

    // ─── Text-to-Speech ───────────────────────────────────────────────────────

    fun speak(text: String, context: Context) {
        val cleaned = stripMarkdown(text)
        if (cleaned.isBlank()) return

        val locale = if (containsDevanagari(cleaned)) Locale("hi", "IN") else Locale("en", "IN")

        if (tts == null) {
            tts = TextToSpeech(context) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    ttsReady = true
                    configureTtsAndSpeak(cleaned, locale)
                } else {
                    _errorMessage.value = "Text-to-speech initialization failed."
                }
            }
        } else if (ttsReady) {
            configureTtsAndSpeak(cleaned, locale)
        }
    }

    private fun configureTtsAndSpeak(text: String, locale: Locale) {
        val engine = tts ?: return
        val result = engine.setLanguage(locale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            // Fall back to default locale
            engine.setLanguage(Locale.getDefault())
        }

        val utteranceId = UUID.randomUUID().toString()
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                _isSpeaking.value = true
            }
            override fun onDone(utteranceId: String?) {
                _isSpeaking.value = false
                onTtsFinished?.invoke()
            }
            @Deprecated("Deprecated in API 21", ReplaceWith("onError(utteranceId, errorCode)"))
            override fun onError(utteranceId: String?) {
                _isSpeaking.value = false
            }
            override fun onError(utteranceId: String?, errorCode: Int) {
                _isSpeaking.value = false
            }
        })

        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
    }

    fun stopSpeaking() {
        tts?.stop()
        _isSpeaking.value = false
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Strips common markdown symbols so TTS doesn't read them aloud.
     * Mirrors the iOS SpeechManager stripping logic.
     */
    private fun stripMarkdown(text: String): String {
        return text
            .replace(Regex("```[\\s\\S]*?```"), "") // fenced code blocks
            .replace(Regex("`[^`]*`"), "")          // inline code
            .replace(Regex("\\*\\*([^*]*)\\*\\*"), "$1") // bold **text**
            .replace(Regex("__([^_]*)__"), "$1")    // bold __text__
            .replace(Regex("\\*([^*]*)\\*"), "$1")  // italic *text*
            .replace(Regex("_([^_]*)_"), "$1")      // italic _text_
            .replace(Regex("#+\\s"), "")            // headings
            .replace(Regex("^-\\s", RegexOption.MULTILINE), "") // list dashes
            .replace(Regex("\\[([^]]+)]\\([^)]+\\)"), "$1") // links [label](url)
            .trim()
    }

    /** Returns true if the string contains any Devanagari Unicode characters (U+0900–U+097F). */
    private fun containsDevanagari(text: String): Boolean {
        return text.any { it.code in 0x0900..0x097F }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    fun destroy() {
        stopListening()
        tts?.stop()
        tts?.shutdown()
        tts = null
        ttsReady = false
    }
}
