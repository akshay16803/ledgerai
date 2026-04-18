import SwiftUI
import os

// MARK: - Chat Models

struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let role: ChatRole
    let content: String
    var actionCard: ActionCard?

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }
}

enum ChatRole: String, Codable {
    case user
    case assistant
}

struct ActionCard: Equatable {
    let type: ActionType
    let title: String
    let detail: String

    enum ActionType: String, Equatable {
        case transactionPosted = "transaction_posted"
        case invoiceCreated = "invoice_created"
        case billCreated = "bill_created"
    }
}

// MARK: - AI Chat Sheet

struct AIChatSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isSending = false

    private let quickPrompts = [
        "Add expense",
        "Show balance",
        "Create invoice",
        "Summary this month"
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                chatContent
                inputBar
            }
            .background(SpentyColors.bgPrimary)
            .navigationTitle("AI Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(SpentyColors.textSecondary)
                }
            }
        }
    }

    // MARK: - Chat Content

    @ViewBuilder
    private var chatContent: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: SpentySpacing.md) {
                    if messages.isEmpty {
                        welcomeSection
                    }

                    ForEach(messages) { message in
                        messageBubble(message)
                            .id(message.id)
                    }

                    if isSending {
                        typingIndicator
                    }
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
            .onChange(of: messages.count) {
                if let lastMessage = messages.last {
                    withAnimation {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Welcome & Quick Prompts

    @ViewBuilder
    private var welcomeSection: some View {
        VStack(spacing: SpentySpacing.xl) {
            Spacer()
                .frame(height: SpentySpacing.xxl)

            Image(systemName: "sparkles")
                .font(.system(size: 40, weight: .medium))
                .foregroundStyle(SpentyColors.brandAccent)

            VStack(spacing: SpentySpacing.sm) {
                Text("How can I help?")
                    .font(SpentyFonts.heading)
                    .foregroundStyle(SpentyColors.textPrimary)

                Text("Ask me anything about your finances.")
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textSecondary)
            }

            quickPromptsGrid
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var quickPromptsGrid: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: SpentySpacing.sm),
                GridItem(.flexible(), spacing: SpentySpacing.sm)
            ],
            spacing: SpentySpacing.sm
        ) {
            ForEach(quickPrompts, id: \.self) { prompt in
                Button {
                    sendMessage(prompt)
                } label: {
                    Text(prompt)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.brandAccent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, SpentySpacing.md)
                        .padding(.horizontal, SpentySpacing.sm)
                        .background(SpentyColors.brandAccent.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: SpentyRadius.md)
                                .stroke(SpentyColors.brandAccent.opacity(0.2), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, SpentySpacing.lg)
    }

    // MARK: - Message Bubble

    @ViewBuilder
    private func messageBubble(_ message: ChatMessage) -> some View {
        VStack(spacing: SpentySpacing.sm) {
            HStack {
                if message.role == .user {
                    Spacer(minLength: 60)
                }

                VStack(alignment: message.role == .user ? .trailing : .leading, spacing: SpentySpacing.sm) {
                    Text(message.content)
                        .font(SpentyFonts.body)
                        .foregroundStyle(message.role == .user ? .white : SpentyColors.textPrimary)
                        .padding(.horizontal, SpentySpacing.lg)
                        .padding(.vertical, SpentySpacing.md)
                        .background(
                            message.role == .user
                                ? SpentyColors.brandAccent
                                : SpentyColors.bgSecondary
                        )
                        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.lg))

                    if let actionCard = message.actionCard {
                        actionCardView(actionCard)
                    }
                }

                if message.role == .assistant {
                    Spacer(minLength: 60)
                }
            }
        }
    }

    // MARK: - Action Card

    @ViewBuilder
    private func actionCardView(_ card: ActionCard) -> some View {
        SpentyCard {
            HStack(spacing: SpentySpacing.md) {
                Circle()
                    .fill(SpentyColors.success.opacity(0.15))
                    .frame(width: 36, height: 36)
                    .overlay(
                        Image(systemName: actionCardIcon(card.type))
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(SpentyColors.success)
                    )

                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text(card.title)
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Text(card.detail)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                Spacer()

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(SpentyColors.success)
            }
        }
    }

    private func actionCardIcon(_ type: ActionCard.ActionType) -> String {
        switch type {
        case .transactionPosted: "arrow.left.arrow.right"
        case .invoiceCreated: "doc.text.fill"
        case .billCreated: "doc.plaintext.fill"
        }
    }

    // MARK: - Typing Indicator

    @ViewBuilder
    private var typingIndicator: some View {
        HStack {
            HStack(spacing: SpentySpacing.xs) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(SpentyColors.textMuted)
                        .frame(width: 6, height: 6)
                        .opacity(0.5)
                        .animation(
                            .easeInOut(duration: 0.6)
                                .repeatForever()
                                .delay(Double(index) * 0.2),
                            value: isSending
                        )
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
            .background(SpentyColors.bgSecondary)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.lg))

            Spacer()
        }
    }

    // MARK: - Input Bar

    @ViewBuilder
    private var inputBar: some View {
        VStack(spacing: 0) {
            Divider()
                .foregroundStyle(SpentyColors.borderSubtle)

            HStack(spacing: SpentySpacing.md) {
                TextField("Ask anything...", text: $inputText, axis: .vertical)
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textPrimary)
                    .lineLimit(1...4)
                    .textFieldStyle(.plain)
                    .onSubmit {
                        sendMessage(inputText)
                    }

                Button {
                    sendMessage(inputText)
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(
                            canSend ? SpentyColors.brandAccent : SpentyColors.textMuted
                        )
                }
                .disabled(!canSend)
                .buttonStyle(.plain)
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
            .background(SpentyColors.surface)
        }
    }

    // MARK: - Logic

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    private func sendMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }

        let userMessage = ChatMessage(role: .user, content: trimmed)
        messages.append(userMessage)
        inputText = ""
        isSending = true

        Task {
            await performSend(trimmed)
        }
    }

    @MainActor
    private func performSend(_ text: String) async {
        do {
            let history = messages.map { msg in
                ["role": msg.role.rawValue, "content": msg.content]
            }
            let repo = AIChatRepository()
            let response = try await repo.sendMessage(message: text, conversation: history)

            let replyText = response.reply ?? "Done."
            var assistantMessage = ChatMessage(role: .assistant, content: replyText)

            if response.transactionPosted == true {
                assistantMessage.actionCard = ActionCard(
                    type: .transactionPosted,
                    title: "Transaction Posted",
                    detail: response.transaction?.description ?? ""
                )
            } else if response.invoiceCreated == true {
                assistantMessage.actionCard = ActionCard(
                    type: .invoiceCreated,
                    title: "Invoice Created",
                    detail: response.invoice?.invoiceNumber ?? ""
                )
            } else if response.billCreated == true {
                assistantMessage.actionCard = ActionCard(
                    type: .billCreated,
                    title: "Bill Created",
                    detail: ""
                )
            }

            messages.append(assistantMessage)
        } catch {
            let errorMessage = ChatMessage(
                role: .assistant,
                content: "Sorry, I couldn't process that request. Please try again."
            )
            messages.append(errorMessage)
        }

        isSending = false
    }
}

#Preview {
    AIChatSheet()
}
