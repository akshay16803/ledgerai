import Foundation
import Speech
import AVFoundation

/// Manages speech-to-text (via SFSpeechRecognizer) and text-to-speech (via AVSpeechSynthesizer).
@Observable
final class SpeechManager: NSObject {

    // MARK: - Published State

    /// The live-transcribed text, updated as the user speaks.
    var transcribedText: String = ""

    /// Whether the recognizer is actively listening.
    var isListening: Bool = false

    /// Whether the synthesizer is currently speaking.
    var isSpeaking: Bool = false

    /// Whether the user has granted microphone permission.
    var hasMicrophonePermission: Bool = false

    /// Whether the user has granted speech recognition permission.
    var hasSpeechPermission: Bool = false

    /// Human-readable error, shown in the UI when something goes wrong.
    var errorMessage: String?

    // MARK: - Private

    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let synthesizer = AVSpeechSynthesizer()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    // MARK: - Init

    override init() {
        super.init()
        synthesizer.delegate = self
        checkPermissions()
    }

    // MARK: - Permissions

    func checkPermissions() {
        hasMicrophonePermission = AVAudioApplication.shared.recordPermission == .granted
        hasSpeechPermission = SFSpeechRecognizer.authorizationStatus() == .authorized
    }

    func requestPermissions() async {
        // Microphone
        if AVAudioApplication.shared.recordPermission != .granted {
            let micGranted = await withCheckedContinuation { continuation in
                AVAudioApplication.requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
            await MainActor.run { hasMicrophonePermission = micGranted }
        }

        // Speech Recognition
        if SFSpeechRecognizer.authorizationStatus() != .authorized {
            let speechGranted = await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { status in
                    continuation.resume(returning: status == .authorized)
                }
            }
            await MainActor.run { hasSpeechPermission = speechGranted }
        }
    }

    // MARK: - Speech-to-Text

    /// Start live transcription from the microphone.
    @MainActor
    func startListening() {
        guard let speechRecognizer, speechRecognizer.isAvailable else {
            errorMessage = "Speech recognition is not available on this device."
            return
        }

        guard hasMicrophonePermission && hasSpeechPermission else {
            errorMessage = "Microphone or speech recognition permission not granted."
            return
        }

        // Cancel any existing task
        stopListening()

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            errorMessage = "Could not configure audio session: \(error.localizedDescription)"
            return
        }

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest else { return }

        recognitionRequest.shouldReportPartialResults = true

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self else { return }

            if let result {
                Task { @MainActor in
                    self.transcribedText = result.bestTranscription.formattedString
                }
            }

            if let error {
                Task { @MainActor in
                    // Don't surface "cancelled" errors
                    if (error as NSError).code != 216 {
                        self.errorMessage = error.localizedDescription
                    }
                    self.stopListening()
                }
            }

            if result?.isFinal == true {
                Task { @MainActor in
                    self.stopListening()
                }
            }
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
            isListening = true
            errorMessage = nil
        } catch {
            errorMessage = "Could not start audio engine: \(error.localizedDescription)"
            stopListening()
        }
    }

    /// Stop listening and finalize transcription.
    @MainActor
    func stopListening() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        isListening = false
    }

    /// Reset transcription text.
    @MainActor
    func resetTranscription() {
        transcribedText = ""
    }

    // MARK: - Text-to-Speech

    /// Speak the given text aloud using system TTS.
    func speak(_ text: String) {
        // Strip markdown formatting for cleaner speech
        let cleanText = text
            .replacingOccurrences(of: "**", with: "")
            .replacingOccurrences(of: "__", with: "")
            .replacingOccurrences(of: "```", with: "")
            .replacingOccurrences(of: "`", with: "")
            .replacingOccurrences(of: "###", with: "")
            .replacingOccurrences(of: "##", with: "")
            .replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: "- ", with: "")

        let utterance = AVSpeechUtterance(string: cleanText)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0

        synthesizer.speak(utterance)
        Task { @MainActor in
            isSpeaking = true
        }
    }

    /// Stop any in-progress speech.
    func stopSpeaking() {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        Task { @MainActor in
            isSpeaking = false
        }
    }
}

// MARK: - AVSpeechSynthesizerDelegate

extension SpeechManager: AVSpeechSynthesizerDelegate {

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
        }
    }
}
