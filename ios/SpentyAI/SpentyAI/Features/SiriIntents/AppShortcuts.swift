import AppIntents

/// Registers SpentyAI Siri phrases and App Shortcuts.
struct SpentyAIShortcuts: AppShortcutsProvider {

    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: RecordExpenseIntent(),
            phrases: [
                "Record expense in \(.applicationName)",
                "Add expense in \(.applicationName)",
                "Log expense in \(.applicationName)",
                "Record a new expense in \(.applicationName)"
            ],
            shortTitle: "Record Expense",
            systemImageName: "minus.circle.fill"
        )

        AppShortcut(
            intent: RecordIncomeIntent(),
            phrases: [
                "Add income to \(.applicationName)",
                "Record income in \(.applicationName)",
                "Log income in \(.applicationName)",
                "Record a new income in \(.applicationName)"
            ],
            shortTitle: "Record Income",
            systemImageName: "plus.circle.fill"
        )

        AppShortcut(
            intent: CheckBalanceIntent(),
            phrases: [
                "Check my balance in \(.applicationName)",
                "What's my balance in \(.applicationName)",
                "Show my balance in \(.applicationName)",
                "How much money do I have in \(.applicationName)"
            ],
            shortTitle: "Check Balance",
            systemImageName: "banknote.fill"
        )
    }
}
