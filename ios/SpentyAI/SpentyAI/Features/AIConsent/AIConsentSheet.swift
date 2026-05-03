import SwiftUI

/// A modal sheet presented before the user's first AI request, explaining exactly what
/// data will be sent to OpenAI and offering an explicit opt-in. Required by Apple App
/// Review Guidelines 5.1.1(i) and 5.1.2(i).
///
/// The caller passes an `onGrant` closure that is invoked AFTER consent has been recorded.
/// The sheet dismisses itself on either action.
struct AIConsentSheet: View {

    @Environment(\.dismiss) private var dismiss

    /// Invoked after the user grants consent. Use this to immediately proceed with
    /// the AI request that triggered the sheet (e.g. send the chat message the user just composed).
    var onGrant: () -> Void = {}

    // MARK: - Brand Colors

    private let brandPrimary = Color.spentyPrimary
    private let brandBg      = Color.spentyBgPrimary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header

                section(
                    title: "Where your data goes",
                    body: "SpentyAI uses OpenAI (a third-party AI provider based in the USA) to power AI features. Your data is sent over a TLS-encrypted connection to api.openai.com. Per OpenAI's API terms, data sent through the API is not retained for training and is not used to improve their models."
                )

                section(
                    title: "What is sent",
                    body: """
                    • AI Chat — your typed question plus a summary of your accounts, transactions, categories, and invoices so the assistant can answer you.
                    • Email and SMS parsing — the body text of transaction-related messages from accounts you have connected.
                    • Receipt scanner — the receipt image you photograph or upload.
                    """
                )

                section(
                    title: "What is NEVER sent",
                    body: """
                    • Account passwords or sign-in credentials.
                    • Full bank account numbers or card numbers.
                    • Aadhaar, PAN, or other government identification numbers.
                    """
                )

                section(
                    title: "You stay in control",
                    body: "You can revoke this consent at any time in Settings → Privacy → AI processing consent. Once revoked, AI features will stop sending data until you opt in again."
                )

                actionButtons

                Spacer(minLength: 8)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .background(brandBg.ignoresSafeArea())
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .center, spacing: 12) {
            ZStack {
                Circle()
                    .fill(brandPrimary.opacity(0.12))
                    .frame(width: 64, height: 64)
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(brandPrimary)
            }

            Text("AI Processing Consent")
                .font(.title2.weight(.bold))
                .multilineTextAlignment(.center)

            Text("Before SpentyAI sends any of your data to our AI provider, please review and confirm.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Section

    private func section(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.spentyTextPrimary)

            Text(body)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.spentyCardBg)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Buttons

    private var actionButtons: some View {
        VStack(spacing: 10) {
            Button {
                AIConsentManager.grant()
                onGrant()
                dismiss()
            } label: {
                Text("Allow AI features")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(brandPrimary, in: RoundedRectangle(cornerRadius: 14))
            }

            Button {
                dismiss()
            } label: {
                Text("Don't allow")
                    .font(.headline)
                    .foregroundStyle(brandPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
        }
        .padding(.top, 4)
    }
}

#Preview {
    AIConsentSheet()
}
