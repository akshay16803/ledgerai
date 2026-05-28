import Foundation
import SwiftUI

@Observable
final class AIChatViewModel {

    // MARK: - State

    var messages: [ChatMessage] = []
    var input: String = ""
    var isSending = false
    var suggestions: [String] = []
    var errorMessage: String?
    var scrollToBottomTrigger = 0
    var scrollToLastMessageTopTrigger = 0

    // MARK: - Voice State

    /// Whether voice responses (text-to-speech) are enabled.
    var isVoiceResponseEnabled: Bool = false

    /// Whether fullscreen voice mode is active (continuous listen + auto-speak).
    var isVoiceModeActive: Bool = false

    /// The speech manager instance.
    let speechManager = SpeechManager()

    // MARK: - Dependencies

    private let repository: AIChatRepository

    // MARK: - Init

    init(repository: AIChatRepository = .shared) {
        self.repository = repository
    }

    // MARK: - Computed

    var canSend: Bool {
        // The button is sendable when there's text to send AND we're not
        // already mid-request. "Text to send" comes from either the visible
        // input field OR the live speech transcript — the latter covers the
        // race where the user taps Send before the .onChange live-mirror has
        // propagated the latest words into the input. sendMessage() then
        // rescues the transcript if input is still empty when it actually
        // reads it.
        let inputEmpty = input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let transcribedEmpty = speechManager.transcribedText
            .trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return !isSending && !(inputEmpty && transcribedEmpty)
    }

    // MARK: - Actions

    @MainActor
    func sendMessage() async {
        // Reentry guard: a fast double-tap on the Send button or a voice-mode
        // tap arriving while a previous request is still in flight would queue
        // two requests and double-fire. Protect at the source — `isSending`
        // is read by the UI to disable the button but UI redraw has a frame
        // of latency; guard here too.
        guard !isSending else {
            #if DEBUG
            print("⚠️ AIChat sendMessage ignored — already sending")
            #endif
            return
        }

        // If input is empty, try to rescue from the live speech transcript.
        // We may need to wait briefly for SFSpeech to deliver the final partial
        // — its callback fires on a background dispatch and the @MainActor write
        // can lag behind the tap by a frame or two.
        var inputTrimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if inputTrimmed.isEmpty {
            // First pass — read current transcription.
            var transcript = speechManager.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines)

            // If still nothing but the mic is on, give SFSpeech up to ~500ms to
            // deliver the partial it's holding. This is the real fix for the
            // "tap Send right after speaking → nothing happens" case.
            if transcript.isEmpty && speechManager.isListening {
                #if DEBUG
                print("ℹ️ AIChat sendMessage waiting up to 500ms for SFSpeech to flush partial transcript")
                #endif
                for _ in 0..<10 {                              // 10 × 50ms = 500ms max
                    try? await Task.sleep(for: .milliseconds(50))
                    transcript = speechManager.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !transcript.isEmpty { break }
                }
            }

            if !transcript.isEmpty {
                #if DEBUG
                print("ℹ️ AIChat sendMessage rescuing from transcribedText (input was empty): '\(transcript.prefix(40))'")
                #endif
                if speechManager.isListening { speechManager.stopListening() }
                input = transcript
                speechManager.resetTranscription()
                inputTrimmed = transcript
            } else if speechManager.isListening {
                // Mic was on but produced no transcript — stop it so the user
                // can retry without the audio session being stuck active.
                #if DEBUG
                print("⚠️ AIChat sendMessage — mic was listening but produced no transcript; stopping mic")
                #endif
                speechManager.stopListening()
            }
        }

        let text = inputTrimmed
        guard !text.isEmpty else {
            #if DEBUG
            print("⚠️ AIChat sendMessage ignored — input is empty after fallback (and any SFSpeech wait)")
            #endif
            errorMessage = "I didn't catch that. Tap the mic and try again."
            return
        }

        #if DEBUG
        print("📤 AIChat sendMessage start — \(text.prefix(60))")
        #endif

        // Add user message immediately
        let userMessage = ChatMessage(
            id: UUID().uuidString,
            role: "user",
            content: text,
            transactionPosted: nil,
            transaction: nil,
            invoiceCreated: nil,
            invoice: nil,
            billCreated: nil,
            bill: nil
        )
        messages.append(userMessage)
        input = ""
        isSending = true
        errorMessage = nil
        scrollToBottom()

        do {
            let response = try await repository.sendMessage(text, conversation: messages)
            messages.append(response)
            scrollToLastMessageTop()

            // If the AI just created an account, fire a refresh notification
            // so any open AccountListView (and dashboard balance widgets) pick
            // it up without the user having to pull-to-refresh. Mirrors the
            // pattern used for AI-posted transactions.
            if response.accountCreated == true {
                NotificationCenter.default.post(name: .accountsDidChange, object: nil)
            }

            // Speak the response if voice responses are enabled or voice mode is active
            if (isVoiceResponseEnabled || isVoiceModeActive), let content = response.content, !content.isEmpty {
                speechManager.speak(content)
            }

            // In voice mode, restart listening after the AI finishes responding
            if isVoiceModeActive {
                // Wait briefly for TTS to finish before re-listening
                Task { @MainActor in
                    // Give TTS a moment to start, then wait for it to finish
                    try? await Task.sleep(for: .milliseconds(500))
                    while speechManager.isSpeaking {
                        try? await Task.sleep(for: .milliseconds(200))
                    }
                    // Guard: user may have exited voice mode while we were
                    // waiting for TTS — don't restart listening if so.
                    guard isVoiceModeActive else {
                        #if DEBUG
                        print("ℹ️ AIChat voice-mode auto-restart aborted (user exited)")
                        #endif
                        return
                    }
                    speechManager.resetTranscription()
                    speechManager.startListening()
                }
            }
            #if DEBUG
            print("✅ AIChat sendMessage success")
            #endif
        } catch let error as APIError {
            #if DEBUG
            print("❌ AIChat sendMessage APIError: \(error.localizedDescription)")
            #endif
            errorMessage = error.localizedDescription
        } catch {
            #if DEBUG
            print("❌ AIChat sendMessage error: \(error.localizedDescription)")
            #endif
            errorMessage = "Failed to get a response. Please try again."
        }

        isSending = false
    }

    @MainActor
    func sendSuggestion(_ suggestion: String) async {
        input = suggestion
        await sendMessage()
    }

    @MainActor
    func loadHistory() async {
        do {
            messages = try await repository.loadHistory()
            scrollToBottom()
        } catch {
            // Loading history is OPPORTUNISTIC. If it fails (network blip,
            // first-time user with no history yet, transient decoding hiccup,
            // anything) the user can still send messages — surfacing a
            // blocking alert here was over-aggressive and hid the chat UI.
            // Log for debugging; leave messages empty.
            #if DEBUG
            print("⚠️ AIChat loadHistory failed: \(error.localizedDescription)")
            #endif
        }
    }

    @MainActor
    func clearHistory() async {
        do {
            try await repository.clearHistory()
            messages.removeAll()
            errorMessage = nil
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Could not clear history. Please try again."
        }
    }

    @MainActor
    func loadSuggestions() async {
        do {
            suggestions = try await repository.loadSuggestions()
        } catch {
            // Use defaults if API fails
            suggestions = [
                "What did I spend this month?",
                "Show my top expenses",
                "What's my net worth?",
                "Create an invoice for..."
            ]
        }
    }

    // MARK: - Voice Actions

    /// Toggle the microphone on/off for speech-to-text.
    ///
    /// Behavior intentionally separates LISTEN from SEND so the user can
    /// review and edit before sending:
    ///   - Tap to START listening → clears the input field, starts capture.
    ///     The AIChatView mirrors `speechManager.transcribedText` into
    ///     `input` live (.onChange), so the TextField shows words as the
    ///     user speaks and the Send button activates naturally.
    ///   - Tap to STOP listening → leaves the final transcription in
    ///     `input`. Does NOT auto-send. User taps the Send arrow themselves.
    @MainActor
    func toggleMicrophone() async {
        if speechManager.isListening {
            speechManager.stopListening()
            // Make sure the final transcription is in `input` (the live mirror
            // .onChange in the view already does this, but be defensive).
            let final = speechManager.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines)
            if !final.isEmpty {
                input = final
            }
            speechManager.resetTranscription()
        } else {
            // Request permissions if needed
            if !speechManager.hasMicrophonePermission || !speechManager.hasSpeechPermission {
                await speechManager.requestPermissions()
            }
            // Clear the field so the live mirror starts from a clean slate.
            input = ""
            speechManager.resetTranscription()
            speechManager.startListening()
        }
    }

    /// Toggle voice response (text-to-speech) on/off.
    @MainActor
    func toggleVoiceResponse() {
        isVoiceResponseEnabled.toggle()
        if !isVoiceResponseEnabled {
            speechManager.stopSpeaking()
        }
    }

    /// Enter or exit fullscreen voice mode.
    @MainActor
    func toggleVoiceMode() async {
        if isVoiceModeActive {
            exitVoiceMode()
        } else {
            await enterVoiceMode()
        }
    }

    /// Enter voice mode: enable TTS, start listening.
    @MainActor
    func enterVoiceMode() async {
        // Request permissions if needed
        if !speechManager.hasMicrophonePermission || !speechManager.hasSpeechPermission {
            await speechManager.requestPermissions()
        }

        guard speechManager.hasMicrophonePermission && speechManager.hasSpeechPermission else {
            errorMessage = "Microphone and speech recognition permissions are required for voice mode."
            return
        }

        isVoiceModeActive = true
        isVoiceResponseEnabled = true
        speechManager.resetTranscription()
        speechManager.startListening()
    }

    /// Exit voice mode: stop listening, stop speaking.
    @MainActor
    func exitVoiceMode() {
        isVoiceModeActive = false
        speechManager.stopListening()
        speechManager.stopSpeaking()
        speechManager.resetTranscription()
    }

    /// In voice mode, send the current transcription and re-listen.
    @MainActor
    func sendVoiceInput() async {
        #if DEBUG
        print("🎙️ AIChat sendVoiceInput tapped — transcribed='\(speechManager.transcribedText.prefix(60))', isListening=\(speechManager.isListening), isSending=\(isSending)")
        #endif

        // Reentry guard mirrors sendMessage's — protects against double-tap
        // while a previous voice send is still in flight.
        guard !isSending else {
            #if DEBUG
            print("⚠️ AIChat sendVoiceInput ignored — already sending")
            #endif
            return
        }

        // Stop the mic immediately so the recognizer flushes its final partial.
        if speechManager.isListening {
            speechManager.stopListening()
        }

        var text = speechManager.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines)

        // If the transcript is empty, wait up to 500ms for SFSpeech to deliver
        // the last partial it was holding before we gave up. The recognition
        // callback fires on a background dispatch and the @MainActor write
        // can lag the user's Send tap by a frame or two.
        if text.isEmpty {
            #if DEBUG
            print("ℹ️ AIChat sendVoiceInput — empty transcript, waiting up to 500ms for SFSpeech flush")
            #endif
            for _ in 0..<10 {                                  // 10 × 50ms = 500ms max
                try? await Task.sleep(for: .milliseconds(50))
                text = speechManager.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty { break }
            }
        }

        guard !text.isEmpty else {
            #if DEBUG
            print("⚠️ AIChat sendVoiceInput — still no transcript after wait; restarting mic")
            #endif
            // Surface a hint to the user and restart listening so they can retry.
            errorMessage = "I didn't catch that. Try speaking a bit louder, or tap the mic and start over."
            speechManager.resetTranscription()
            speechManager.startListening()
            return
        }

        #if DEBUG
        print("📤 AIChat sendVoiceInput sending — '\(text.prefix(60))'")
        #endif
        input = text
        speechManager.resetTranscription()
        await sendMessage()
    }

    // MARK: - Helpers

    func dismissError() {
        errorMessage = nil
    }

    private func scrollToBottom() {
        scrollToBottomTrigger += 1
    }

    private func scrollToLastMessageTop() {
        scrollToLastMessageTopTrigger += 1
    }
}
