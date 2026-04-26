import AppIntents
import Foundation

/// Siri Intent: "Record income of [amount] from [description]"
struct RecordIncomeIntent: AppIntent {
    static var title: LocalizedStringResource = "Record Income"
    static var description = IntentDescription("Record a new income transaction in SpentyAI.")

    // MARK: - Parameters

    @Parameter(title: "Amount", description: "The income amount")
    var amount: Double

    @Parameter(title: "Description", description: "Where did the income come from?")
    var incomeDescription: String

    @Parameter(title: "Category", description: "Income category (e.g., Salary, Freelance)", default: nil)
    var category: String?

    @Parameter(title: "Account", description: "Which account to credit", default: nil)
    var account: String?

    // MARK: - Perform

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let body = SiriTransactionRequest(
            transactionType: "income",
            amount: amount,
            description: incomeDescription,
            category: category,
            account: account
        )

        do {
            let response: SiriTransactionResponse = try await APIClient.shared.post(
                APIEndpoints.transactions,
                body: body
            )

            let formattedAmount = String(format: "%.2f", amount)
            let confirmationText = "Recorded income of \(formattedAmount) from \"\(incomeDescription)\"."
            return .result(dialog: IntentDialog(stringLiteral: confirmationText))
        } catch {
            return .result(dialog: IntentDialog(stringLiteral: "Sorry, I could not record that income. Please try again in the app."))
        }
    }

    static var parameterSummary: some ParameterSummary {
        Summary("Record income of \(\.$amount) from \(\.$incomeDescription)")
    }
}
