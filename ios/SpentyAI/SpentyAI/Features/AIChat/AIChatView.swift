import SwiftUI

struct AIChatView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @State private var viewModel = AIChatViewModel()
    @State private var showClearConfirmation = false
    @FocusState private var isInputFocused: Bool
    @Environment(\.dismiss) private var dismiss

    // AI Processing Consent — required by Apple guideline 5.1.1(i)/5.1.2(i) before
    // user data may be sent to OpenAI. The pending action is invoked once consent is granted.
    @State private var showConsentSheet = false
    @State private var pendingAIAction: (() -> Void)?

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary
                    .ignoresSafeArea()

                if viewModel.isVoiceModeActive {
                    voiceModeView
                } else {
                    VStack(spacing: 0) {
                        messageList
                        inputBar
                    }
                }
            }
            .navigationTitle(lang.s("ai_assistant"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(lang.s("close")) { dismiss() }
                        .foregroundStyle(Color.spentyPrimary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        // Voice mode button
                        Button {
                            // Voice mode streams transcribed audio to the AI on each utterance,
                            // so consent is required before entering it. Exiting voice mode
                            // sends nothing — bypass the gate when already active.
                            if viewModel.isVoiceModeActive {
                                Task { await viewModel.toggleVoiceMode() }
                            } else {
                                gateAI { Task { await viewModel.toggleVoiceMode() } }
                            }
                        } label: {
                            Image(systemName: viewModel.isVoiceModeActive ? "waveform.circle.fill" : "waveform.circle")
                                .font(.system(size: 20))
                                .foregroundStyle(viewModel.isVoiceModeActive ? Color.spentyPrimary : Color.spentyTextSecondary)
                        }

                        // Speaker toggle
                        Button {
                            viewModel.toggleVoiceResponse()
                        } label: {
                            Image(systemName: viewModel.isVoiceResponseEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                                .font(.system(size: 18))
                                .foregroundStyle(viewModel.isVoiceResponseEnabled ? Color.spentyPrimary : Color.spentyTextSecondary)
                        }

                        Menu {
                            Button(role: .destructive) {
                                showClearConfirmation = true
                            } label: {
                                Label("Clear History", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .foregroundStyle(Color.spentyPrimary)
                        }
                    }
                }
            }
            .confirmationDialog(
                "Clear chat history?",
                isPresented: $showClearConfirmation,
                titleVisibility: .visible
            ) {
                Button("Clear History", role: .destructive) {
                    Task { await viewModel.clearHistory() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(lang.s("delete_history_confirm"))
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.dismissError() } }
            )) {
                Button(lang.s("ok")) { viewModel.dismissError() }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .task {
                // Parallelize so a slow/hung suggestions endpoint cannot block
                // history (or vice versa) — symptom that looked like a "screen
                // hang" when the AI tab was opened.
                async let _: () = viewModel.loadSuggestions()
                async let _: () = viewModel.loadHistory()
            }
            // Live-mirror the in-app voice transcription into the TextField so
            // (a) the user sees their words appear as they speak, and (b) the
            // Send button (which checks `viewModel.input`) activates naturally.
            // Without this the transcription lived in a separate state, so
            // tapping Send did nothing after speaking.
            .onChange(of: viewModel.speechManager.transcribedText) { _, newValue in
                if viewModel.speechManager.isListening && !viewModel.isVoiceModeActive {
                    viewModel.input = newValue
                }
            }
            .sheet(isPresented: $showConsentSheet) {
                AIConsentSheet {
                    // User granted consent — run the action that triggered the sheet.
                    pendingAIAction?()
                    pendingAIAction = nil
                }
            }
        }
    }

    // MARK: - AI Consent Gate

    /// Run `action` immediately if the user has already consented to AI processing,
    /// otherwise stash it in `pendingAIAction` and present `AIConsentSheet`. The action
    /// will fire after the user taps "Allow AI features".
    private func gateAI(_ action: @escaping () -> Void) {
        if AIConsentManager.hasConsented {
            action()
        } else {
            pendingAIAction = action
            showConsentSheet = true
        }
    }

    // MARK: - Voice Mode View

    private var voiceModeView: some View {
        VStack(spacing: 32) {
            Spacer()

            // Pulsing microphone animation
            ZStack {
                // Outer pulsing rings
                if viewModel.speechManager.isListening {
                    Circle()
                        .fill(Color.spentyPrimary.opacity(0.08))
                        .frame(width: 200, height: 200)
                        .scaleEffect(voicePulseScale)
                        .animation(
                            .easeInOut(duration: 1.2).repeatForever(autoreverses: true),
                            value: voicePulseScale
                        )

                    Circle()
                        .fill(Color.spentyPrimary.opacity(0.12))
                        .frame(width: 150, height: 150)
                        .scaleEffect(voicePulseScale)
                        .animation(
                            .easeInOut(duration: 1.0).repeatForever(autoreverses: true),
                            value: voicePulseScale
                        )
                }

                Circle()
                    .fill(
                        viewModel.speechManager.isListening
                            ? Color.spentyPrimary
                            : Color.spentyPrimary.opacity(0.3)
                    )
                    .frame(width: 100, height: 100)
                    .shadow(
                        color: viewModel.speechManager.isListening
                            ? Color.spentyPrimary.opacity(0.4)
                            : .clear,
                        radius: 20
                    )

                Image(systemName: "mic.fill")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .onAppear { voicePulsePhase = true }

            // Status text
            VStack(spacing: 8) {
                if viewModel.speechManager.isSpeaking {
                    Text(lang.s("speaking"))
                        .font(SpentyFonts.title3)
                        .foregroundStyle(Color.spentyPrimary)
                } else if viewModel.speechManager.isListening {
                    Text(lang.s("listening"))
                        .font(SpentyFonts.title3)
                        .foregroundStyle(Color.spentyPrimary)
                } else if viewModel.isSending {
                    Text(lang.s("thinking"))
                        .font(SpentyFonts.title3)
                        .foregroundStyle(Color.spentyTextSecondary)
                } else {
                    Text(lang.s("tap_to_speak"))
                        .font(SpentyFonts.title3)
                        .foregroundStyle(Color.spentyTextSecondary)
                }

                // Show live transcription
                if !viewModel.speechManager.transcribedText.isEmpty {
                    Text(viewModel.speechManager.transcribedText)
                        .font(SpentyFonts.body)
                        .foregroundStyle(Color.spentyTextPrimary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .padding(.top, 8)
                }

                // Show last AI response — scrollable, markdown-rendered, no line limit
                if let lastAssistant = viewModel.messages.last(where: { $0.role == "assistant" }),
                   let content = lastAssistant.content, !content.isEmpty {
                    ScrollView {
                        MarkdownText(content)
                            .font(SpentyFonts.subheadline)
                            .foregroundStyle(Color.spentyTextSecondary)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 8)
                    }
                    .frame(maxHeight: 260)
                    .padding(.top, 4)
                }
            }

            Spacer()

            // Voice mode controls
            HStack(spacing: 40) {
                // Send button (stop listening and send)
                Button {
                    gateAI { Task { await viewModel.sendVoiceInput() } }
                } label: {
                    VStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(Color.spentyPrimary.opacity(0.12))
                                .frame(width: 56, height: 56)
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(Color.spentyPrimary)
                        }
                        Text(lang.s("send"))
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                }
                .disabled(viewModel.speechManager.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                // Mic toggle
                Button {
                    if viewModel.speechManager.isListening {
                        viewModel.speechManager.stopListening()
                    } else {
                        viewModel.speechManager.resetTranscription()
                        viewModel.speechManager.startListening()
                    }
                } label: {
                    VStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(viewModel.speechManager.isListening ? Color.spentyError.opacity(0.12) : Color.spentyPrimary.opacity(0.12))
                                .frame(width: 56, height: 56)
                            Image(systemName: viewModel.speechManager.isListening ? "mic.slash.fill" : "mic.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(viewModel.speechManager.isListening ? Color.spentyError : Color.spentyPrimary)
                        }
                        Text(viewModel.speechManager.isListening ? "Mute" : "Unmute")
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                }

                // Exit voice mode
                Button {
                    viewModel.exitVoiceMode()
                } label: {
                    VStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(Color.spentyError.opacity(0.12))
                                .frame(width: 56, height: 56)
                            Image(systemName: "xmark")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(Color.spentyError)
                        }
                        Text(lang.s("exit"))
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                }
            }
            .padding(.bottom, 40)
        }
    }

    @State private var voicePulsePhase = false

    private var voicePulseScale: CGFloat {
        voicePulsePhase ? 1.15 : 0.85
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    // Welcome / Suggestions when empty
                    if viewModel.messages.isEmpty && !viewModel.isSending {
                        welcomeSection
                    }

                    // Quick prompt chips (shown when messages exist too)
                    if !viewModel.messages.isEmpty {
                        suggestionsStrip
                            .padding(.top, 8)
                    }

                    // Messages
                    ForEach(viewModel.messages) { message in
                        ChatBubble(message: message)
                            .id(message.id)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }

                    // Typing indicator
                    if viewModel.isSending {
                        TypingIndicator()
                            .id("typing-indicator")
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }

                    // Bottom anchor
                    Color.clear
                        .frame(height: 1)
                        .id("bottom-anchor")
                }
                .padding(.vertical, 8)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: viewModel.scrollToBottomTrigger) {
                withAnimation(.easeOut(duration: 0.3)) {
                    proxy.scrollTo("bottom-anchor", anchor: .bottom)
                }
            }
            .onChange(of: viewModel.scrollToLastMessageTopTrigger) {
                guard let lastId = viewModel.messages.last?.id else { return }
                // Scroll so the TOP of the newest assistant bubble is visible,
                // with a little breathing room from the top edge.
                withAnimation(.easeOut(duration: 0.3)) {
                    proxy.scrollTo(lastId, anchor: .top)
                }
            }
        }
    }

    // MARK: - Welcome Section

    private var welcomeSection: some View {
        VStack(spacing: 24) {
            Spacer()
                .frame(height: 40)

            ZStack {
                Circle()
                    .fill(Color.spentyPrimary.opacity(0.1))
                    .frame(width: 80, height: 80)

                Image(systemName: "sparkles")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(Color.spentyPrimary)
            }

            VStack(spacing: 8) {
                Text(lang.s("spentyai_assistant"))
                    .font(SpentyFonts.title2)
                    .foregroundStyle(Color.spentyTextPrimary)

                Text(lang.s("ask_anything"))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            // Suggestion chips
            VStack(spacing: 10) {
                ForEach(viewModel.suggestions, id: \.self) { suggestion in
                    Button {
                        gateAI { Task { await viewModel.sendSuggestion(suggestion) } }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: iconForSuggestion(suggestion))
                                .font(.system(size: 14))
                                .foregroundStyle(Color.spentyPrimary)

                            Text(suggestion)
                                .font(SpentyFonts.subheadline)
                                .foregroundStyle(Color.spentyTextPrimary)
                                .lineLimit(1)

                            Spacer()

                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.spentyTextSecondary)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.spentyCardBg)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)

            Spacer()
                .frame(height: 20)
        }
    }

    // MARK: - Inline Suggestions Strip

    private var suggestionsStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(viewModel.suggestions, id: \.self) { suggestion in
                    Button {
                        gateAI { Task { await viewModel.sendSuggestion(suggestion) } }
                    } label: {
                        Text(suggestion)
                            .font(SpentyFonts.caption1.weight(.medium))
                            .foregroundStyle(Color.spentyPrimary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(Color.spentyPrimary.opacity(0.08))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        VStack(spacing: 0) {
            // Tap-to-speak hint — shown only when not listening so users
            // discover the mic. Live transcription is no longer rendered here;
            // it streams directly into the TextField via .onChange in body.
            if !viewModel.speechManager.isListening && viewModel.input.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.spentyPrimary)
                    Text("Tap the mic to speak — your words appear in the box.")
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(Color.spentyTextSecondary)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .background(Color.spentyPrimary.opacity(0.04))
            } else if viewModel.speechManager.isListening {
                HStack(spacing: 6) {
                    Image(systemName: "waveform")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.spentyError)
                        .symbolEffect(.variableColor.iterative.dimInactiveLayers)
                    Text("Listening… tap the mic again to stop.")
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(Color.spentyError)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .background(Color.spentyError.opacity(0.06))
            }

            Divider()

            HStack(alignment: .bottom, spacing: 10) {
                // Microphone button — labeled so users discover voice input.
                Button {
                    // Tap to START: live mirror writes the transcription into
                    // the TextField. Tap to STOP: finalizes the text — user
                    // still has to tap Send to actually send.
                    gateAI { Task { await viewModel.toggleMicrophone() } }
                } label: {
                    VStack(spacing: 2) {
                        ZStack {
                            Circle()
                                .fill(
                                    viewModel.speechManager.isListening
                                        ? Color.spentyError.opacity(0.18)
                                        : Color.spentyPrimary.opacity(0.12)
                                )
                                .frame(width: 40, height: 40)

                            Image(systemName: viewModel.speechManager.isListening ? "stop.circle.fill" : "mic.fill")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(
                                    viewModel.speechManager.isListening
                                        ? Color.spentyError
                                        : Color.spentyPrimary
                                )
                        }
                        Text(viewModel.speechManager.isListening ? "Stop" : "Speak")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(
                                viewModel.speechManager.isListening
                                    ? Color.spentyError
                                    : Color.spentyPrimary
                            )
                    }
                }
                .accessibilityLabel(viewModel.speechManager.isListening ? "Stop listening" : "Speak to AI")
                .accessibilityHint("Records your voice and types it into the message box. Tap Send when ready.")
                .disabled(viewModel.isSending)

                TextField(lang.s("ask_spentyai"), text: $viewModel.input, axis: .vertical)
                    .font(SpentyFonts.body)
                    .lineLimit(1...5)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.spentyCardBg)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .strokeBorder(Color.spentyBorder, lineWidth: 1)
                    )
                    .focused($isInputFocused)
                    .onSubmit {
                        if viewModel.canSend {
                            gateAI { Task { await viewModel.sendMessage() } }
                        }
                    }

                Button {
                    gateAI { Task { await viewModel.sendMessage() } }
                } label: {
                    VStack(spacing: 2) {
                        ZStack {
                            Circle()
                                .fill(viewModel.canSend ? Color.spentyPrimary : Color.spentyPrimary.opacity(0.3))
                                .frame(width: 40, height: 40)

                            Image(systemName: "arrow.up")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        Text("Send")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(viewModel.canSend ? Color.spentyPrimary : Color.spentyTextSecondary)
                    }
                }
                .accessibilityLabel("Send message")
                .disabled(!viewModel.canSend)
                .animation(.easeInOut(duration: 0.15), value: viewModel.canSend)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
        }
    }

    // MARK: - Helpers

    private func iconForSuggestion(_ text: String) -> String {
        let lower = text.lowercased()
        if lower.contains("spend") || lower.contains("expense") {
            return "chart.bar.fill"
        } else if lower.contains("net worth") || lower.contains("balance") {
            return "banknote.fill"
        } else if lower.contains("invoice") {
            return "doc.text.fill"
        } else if lower.contains("bill") {
            return "receipt"
        } else if lower.contains("top") || lower.contains("most") {
            return "arrow.up.right"
        } else {
            return "sparkle"
        }
    }
}

// MARK: - Preview

#Preview {
    AIChatView()
}
