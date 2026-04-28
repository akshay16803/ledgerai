import AppIntents
import Foundation

/// Siri Intent: "Record an expense of [amount] for [description]"
struct RecordExpenseIntent: AppIntent {

    static var title: LocalizedStringResource = "Record Expense"
    static var description = IntentDescription("Record a new expense transaction in SpentyAI.")

    // MARK: - Parameters

    @Parameter(title: "Amount", description: "The expense amount")
    var amount: Double

    @Parameter(title: "Description", description: "What was the expense for?")
    var expenseDescription: String

    @Parameter(title: "Category", description: "Expense category (e.g., Food, Transport)", default: nil)
    var category: String?

    @Parameter(title: "Account", description: "Which account to charge", default: nil)
    var account: String?

    // MARK: - Perform

    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Auth check — if not logged in, prompt user to open the app
        guard KeychainHelper.read(key: KeychainHelper.sessionTokenKey) != nil else {
            return .result(dialog: "Please open SpentyAI and sign in first, then try again.")
        }
        let body = SiriTransactionRequest(
            transactionType: "expense",
            amount: amount,
            description: expenseDescription,
            category: category,
            account: account
        )

        do {
            let response: SiriTransactionResponse = try await APIClient.shared.post(
                APIEndpoints.transactions,
                body: body
            )

            let formattedAmount = String(format: "%.2f", amount)
            let confirmationText = "Recorded expense of \(formattedAmount) for \"\(expenseDescription)\"."
            return .result(dialog: IntentDialog(stringLiteral: confirmationText))
        } catch {
            return .result(dialog: IntentDialog(stringLiteral: "Sorry, I could not record that expense. Please try again in the app."))
        }
    }

    static var parameterSummary: some ParameterSummary {
        Summary("Record expense of \(\.$amount) for \(\.$expenseDescription)")
    }
}

// MARK: - Shared DTOs for Siri Intents

struct SiriTransactionRequest: Codable {
    let transactionType: String
    let amount: Double
    let description: String
    let category: String?
    let account: String?
}

struct SiriTransactionResponse: Codable {
    let transactionId: String?
    let message: String?
}
