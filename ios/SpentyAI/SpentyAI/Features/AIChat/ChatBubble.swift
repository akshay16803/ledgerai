import SwiftUI

// MARK: - Chat Bubble

struct ChatBubble: View {

    let message: ChatMessage

    private var isUser: Bool { message.role == "user" }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if isUser { Spacer(minLength: 48) }

            if !isUser {
                aiAvatar
            }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 8) {
                bubbleContent

                // Inline entity cards
                if message.transactionPosted == true, let txn = message.transaction {
                    TransactionCard(transaction: txn)
                }
                if message.invoiceCreated == true, let inv = message.invoice {
                    InvoiceCard(invoice: inv)
                }
                if message.billCreated == true, let bill = message.bill {
                    BillCard(bill: bill)
                }
            }

            if !isUser { Spacer(minLength: 48) }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 3)
    }

    // MARK: - Bubble Content

    private var bubbleContent: some View {
        Group {
            if isUser {
                Text(message.content ?? "")
                    .font(SpentyFonts.body)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.spentyPrimary)
                    .clipShape(BubbleShape(isUser: true))
            } else {
                MarkdownText(message.content ?? "")
                    .font(SpentyFonts.body)
                    .foregroundStyle(Color.spentyTextPrimary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.spentyCardBg)
                    .clipShape(BubbleShape(isUser: false))
                    .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
            }
        }
    }

    // MARK: - AI Avatar

    private var aiAvatar: some View {
        ZStack {
            Circle()
                .fill(Color.spentyPrimary.opacity(0.12))
                .frame(width: 32, height: 32)

            Image(systemName: "sparkles")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.spentyPrimary)
        }
        .padding(.top, 2)
    }
}

// MARK: - Bubble Shape

struct BubbleShape: Shape {
    let isUser: Bool

    func path(in rect: CGRect) -> Path {
        let radius: CGFloat = 18
        let tailRadius: CGFloat = 6

        var path = Path()

        if isUser {
            // User bubble: rounded with small tail on bottom-right
            path.addRoundedRect(
                in: CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height),
                cornerRadii: RectangleCornerRadii(
                    topLeading: radius,
                    bottomLeading: radius,
                    bottomTrailing: tailRadius,
                    topTrailing: radius
                )
            )
        } else {
            // Assistant bubble: rounded with small tail on bottom-left
            path.addRoundedRect(
                in: CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height),
                cornerRadii: RectangleCornerRadii(
                    topLeading: radius,
                    bottomLeading: tailRadius,
                    bottomTrailing: radius,
                    topTrailing: radius
                )
            )
        }

        return path
    }
}

// MARK: - Markdown Text (basic: bold, italic, lists)

struct MarkdownText: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(attributedString)
            .textSelection(.enabled)
    }

    private var attributedString: AttributedString {
        do {
            return try AttributedString(
                markdown: text,
                options: AttributedString.MarkdownParsingOptions(
                    interpretedSyntax: .full
                )
            )
        } catch {
            return AttributedString(text)
        }
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @State private var phase = 0.0

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            ZStack {
                Circle()
                    .fill(Color.spentyPrimary.opacity(0.12))
                    .frame(width: 32, height: 32)

                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.spentyPrimary)
            }
            .padding(.top, 2)

            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color.spentyPrimary.opacity(0.6))
                        .frame(width: 8, height: 8)
                        .scaleEffect(dotScale(for: index))
                        .animation(
                            .easeInOut(duration: 0.5)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.15),
                            value: phase
                        )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color.spentyCardBg)
            .clipShape(BubbleShape(isUser: false))
            .shadow(color: .black.opacity(0.04), radius: 4, y: 2)

            Spacer(minLength: 48)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 3)
        .onAppear { phase = 1.0 }
    }

    private func dotScale(for index: Int) -> CGFloat {
        phase > 0 ? 1.3 : 0.7
    }
}

// MARK: - Entity Cards

struct TransactionCard: View {
    let transaction: Transaction

    private var amountFormatted: String {
        guard let amount = transaction.amount else { return "--" }
        return String(format: "%.2f", amount)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.spentySuccess)
                    .font(.system(size: 16))
                Text("Transaction Created")
                    .font(SpentyFonts.subheadline.weight(.semibold))
                    .foregroundStyle(Color.spentySuccess)
            }

            Divider()

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(transaction.description ?? "Transaction")
                        .font(SpentyFonts.subheadline.weight(.medium))
                        .foregroundStyle(Color.spentyTextPrimary)
                    if let type = transaction.transactionType {
                        Text(type.capitalized)
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                }
                Spacer()
                Text(amountFormatted)
                    .font(SpentyFonts.amountSmall)
                    .foregroundStyle(Color.spentyTextPrimary)
            }

            if let status = transaction.status, status.lowercased() != "approved" {
                HStack(spacing: 4) {
                    Circle()
                        .fill(statusColor(status))
                        .frame(width: 6, height: 6)
                    Text(status.capitalized)
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(Color.spentyTextSecondary)
                }
            }
        }
        .padding(12)
        .background(Color.spentySuccess.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.spentySuccess.opacity(0.2), lineWidth: 1)
        )
    }

    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "approved": return .spentySuccess
        case "pending": return .spentyWarning
        case "rejected": return .spentyError
        default: return .spentyTextSecondary
        }
    }
}

struct InvoiceCard: View {
    let invoice: Invoice

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.spentyInfo)
                    .font(.system(size: 16))
                Text("Invoice Created")
                    .font(SpentyFonts.subheadline.weight(.semibold))
                    .foregroundStyle(Color.spentyInfo)
            }

            Divider()

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    if let number = invoice.invoiceNumber {
                        Text("#\(number)")
                            .font(SpentyFonts.subheadline.weight(.medium))
                            .foregroundStyle(Color.spentyTextPrimary)
                    }
                    if let customer = invoice.customerName {
                        Text(customer)
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                }
                Spacer()
                if let total = invoice.grandTotal {
                    Text(String(format: "%.2f", total))
                        .font(SpentyFonts.amountSmall)
                        .foregroundStyle(Color.spentyTextPrimary)
                }
            }

            if let status = invoice.paymentStatus {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.spentyWarning)
                        .frame(width: 6, height: 6)
                    Text(status.capitalized)
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(Color.spentyTextSecondary)
                }
            }
        }
        .padding(12)
        .background(Color.spentyInfo.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.spentyInfo.opacity(0.2), lineWidth: 1)
        )
    }
}

struct BillCard: View {
    let bill: Bill

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.spentyAccent1)
                    .font(.system(size: 16))
                Text("Bill Created")
                    .font(SpentyFonts.subheadline.weight(.semibold))
                    .foregroundStyle(Color.spentyAccent1)
            }

            Divider()

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    if let number = bill.billNumber {
                        Text("#\(number)")
                            .font(SpentyFonts.subheadline.weight(.medium))
                            .foregroundStyle(Color.spentyTextPrimary)
                    }
                    if let vendor = bill.vendorName {
                        Text(vendor)
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(Color.spentyTextSecondary)
                    }
                }
                Spacer()
                if let total = bill.grandTotal {
                    Text(String(format: "%.2f", total))
                        .font(SpentyFonts.amountSmall)
                        .foregroundStyle(Color.spentyTextPrimary)
                }
            }

            if let status = bill.paymentStatus {
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.spentyWarning)
                        .frame(width: 6, height: 6)
                    Text(status.capitalized)
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(Color.spentyTextSecondary)
                }
            }
        }
        .padding(12)
        .background(Color.spentyAccent1.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.spentyAccent1.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Previews

#Preview("User Bubble") {
    ChatBubble(message: ChatMessage(
        id: "1", role: "user", content: "What did I spend this month?",
        transactionPosted: nil, transaction: nil,
        invoiceCreated: nil, invoice: nil,
        billCreated: nil, bill: nil
    ))
    .background(Color.spentyBgPrimary)
}

#Preview("Assistant Bubble") {
    ChatBubble(message: ChatMessage(
        id: "2", role: "assistant",
        content: "You spent **$3,245.67** this month. Your top categories were:\n\n- **Food & Dining**: $892.30\n- **Transportation**: $456.12\n- **Utilities**: $234.50",
        transactionPosted: nil, transaction: nil,
        invoiceCreated: nil, invoice: nil,
        billCreated: nil, bill: nil
    ))
    .background(Color.spentyBgPrimary)
}

#Preview("Typing") {
    TypingIndicator()
        .background(Color.spentyBgPrimary)
}
