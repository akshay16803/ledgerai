import AppIntents
import Foundation

/// Siri Intent: "What's my account balance?"
struct CheckBalanceIntent: AppIntent {

    static var title: LocalizedStringResource = "Check Balance"
    static var description = IntentDescription("Check your account balance in SpentyAI.")

    // MARK: - Parameters

    @Parameter(title: "Account", description: "Which account to check (leave blank for all)", default: nil)
    var account: String?

    // MARK: - Perform

    func perform() async throws -> some IntentResult & ProvidesDialog {
        do {
            let summary: SiriDashboardSummary = try await APIClient.shared.get(
                APIEndpoints.dashboardSummary
            )

            var responseText: String

            if let totalBalance = summary.totalBalance {
                let formatted = String(format: "%.2f", totalBalance)
                responseText = "Your total balance across all accounts is \(formatted)."
            } else {
                responseText = "I could not retrieve your balance right now. Please check the app."
            }

            if let income = summary.totalIncome, let expense = summary.totalExpense {
                let incomeFormatted = String(format: "%.2f", income)
                let expenseFormatted = String(format: "%.2f", expense)
                responseText += " This month: income \(incomeFormatted), expenses \(expenseFormatted)."
            }

            return .result(dialog: IntentDialog(stringLiteral: responseText))
        } catch {
            return .result(dialog: IntentDialog(stringLiteral: "Sorry, I could not check your balance. Please open SpentyAI to view your accounts."))
        }
    }

    static var parameterSummary: some ParameterSummary {
        Summary("Check balance for \(\.$account)")
    }
}

// MARK: - Response DTO

struct SiriDashboardSummary: Codable {
    let totalBalance: Double?
    let totalIncome: Double?
    let totalExpense: Double?
    let netWorth: Double?
}
