import SwiftUI

struct AIChatView: View {

    // MARK: - State

    @State private var viewModel = AIChatViewModel()
    @State private var showClearConfirmation = false
    @FocusState private var isInputFocused: Bool
    @Environment(\.dismiss) private var dismiss

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    messageList
                    inputBar
                }
            }
            .navigationTitle("AI Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(Color.spentyPrimary)
                }
                ToolbarItem(placement: .topBarTrailing) {
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
                Text("This will permanently delete your entire conversation history with the AI assistant.")
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.dismissError() } }
            )) {
                Button("OK") { viewModel.dismissError() }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .task {
                await viewModel.loadSuggestions()
                await viewModel.loadHistory()
            }
        }
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
                Text("SpentyAI Assistant")
                    .font(SpentyFonts.title2)
                    .foregroundStyle(Color.spentyTextPrimary)

                Text("Ask me anything about your finances, or let me help you create transactions, invoices, and bills.")
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            // Suggestion chips
            VStack(spacing: 10) {
                ForEach(viewModel.suggestions, id: \.self) { suggestion in
                    Button {
                        Task { await viewModel.sendSuggestion(suggestion) }
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
                        Task { await viewModel.sendSuggestion(suggestion) }
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
            Divider()

            HStack(alignment: .bottom, spacing: 10) {
                TextField("Ask SpentyAI...", text: $viewModel.input, axis: .vertical)
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
                            Task { await viewModel.sendMessage() }
                        }
                    }

                Button {
                    Task { await viewModel.sendMessage() }
                } label: {
                    ZStack {
                        Circle()
                            .fill(viewModel.canSend ? Color.spentyPrimary : Color.spentyPrimary.opacity(0.3))
                            .frame(width: 40, height: 40)

                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
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
