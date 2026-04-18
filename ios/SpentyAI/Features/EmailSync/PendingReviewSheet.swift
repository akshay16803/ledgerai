import SwiftUI

struct PendingReviewSheet: View {
    let transaction: PendingTransaction
    let onAction: (ReviewAction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    @State private var editedAmount: String
    @State private var selectedType: TransactionType
    @State private var selectedCategory: String
    @State private var selectedAccount: String

    enum ReviewAction {
        case approved(amount: Double, type: String, category: String, account: String)
        case rejected
    }

    enum TransactionType: String, CaseIterable, Identifiable {
        case income
        case expense

        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .income: return "Income"
            case .expense: return "Expense"
            }
        }
    }

    init(transaction: PendingTransaction, onAction: @escaping (ReviewAction) -> Void) {
        self.transaction = transaction
        self.onAction = onAction
        _editedAmount = State(initialValue: transaction.amount.map { String(format: "%.2f", $0) } ?? "")
        _selectedType = State(initialValue: transaction.type == "income" ? .income : .expense)
        _selectedCategory = State(initialValue: transaction.suggestedCategory ?? "")
        _selectedAccount = State(initialValue: "")
    }

    private let categories = [
        "Food & Dining",
        "Shopping",
        "Transportation",
        "Bills & Utilities",
        "Entertainment",
        "Health & Fitness",
        "Travel",
        "Education",
        "Subscriptions",
        "Salary",
        "Freelance",
        "Investment",
        "Other"
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: SpentySpacing.xl) {
                    // Transaction Info
                    SpentyCard {
                        VStack(alignment: .leading, spacing: SpentySpacing.md) {
                            if let date = transaction.date {
                                HStack {
                                    Text("Date")
                                        .font(SpentyFonts.caption)
                                        .foregroundStyle(SpentyColors.textMuted)
                                    Spacer()
                                    Text(date)
                                        .font(SpentyFonts.body)
                                        .foregroundStyle(SpentyColors.textPrimary)
                                }
                            }

                            Divider()

                            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                Text("Description")
                                    .font(SpentyFonts.caption)
                                    .foregroundStyle(SpentyColors.textMuted)
                                Text(transaction.description ?? "Unknown Transaction")
                                    .font(SpentyFonts.body)
                                    .foregroundStyle(SpentyColors.textPrimary)
                            }
                        }
                    }

                    // Editable Fields
                    SpentyCard {
                        VStack(spacing: SpentySpacing.lg) {
                            FormField(label: "Amount") {
                                HStack {
                                    Text("$")
                                        .font(SpentyFonts.body)
                                        .foregroundStyle(SpentyColors.textSecondary)
                                    TextField("0.00", text: $editedAmount)
                                        .font(SpentyFonts.mono)
                                        .keyboardType(.decimalPad)
                                }
                                .padding(SpentySpacing.md)
                                .background(SpentyColors.bgSecondary)
                                .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: SpentyRadius.md)
                                        .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                                )
                            }

                            FormField(label: "Type") {
                                Picker("Type", selection: $selectedType) {
                                    ForEach(TransactionType.allCases) { type in
                                        Text(type.displayName).tag(type)
                                    }
                                }
                                .pickerStyle(.segmented)
                            }

                            FormField(label: "Category") {
                                Menu {
                                    ForEach(categories, id: \.self) { category in
                                        Button(category) {
                                            selectedCategory = category
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Text(selectedCategory.isEmpty ? "Select Category" : selectedCategory)
                                            .font(SpentyFonts.body)
                                            .foregroundStyle(
                                                selectedCategory.isEmpty
                                                    ? SpentyColors.textMuted
                                                    : SpentyColors.textPrimary
                                            )
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textMuted)
                                    }
                                    .padding(SpentySpacing.md)
                                    .background(SpentyColors.bgSecondary)
                                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                                    )
                                }
                            }

                            FormField(label: "Account") {
                                Menu {
                                    ForEach(appState.accounts, id: \.id) { account in
                                        Button(account.name) {
                                            selectedAccount = account.id
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Text(accountDisplayName)
                                            .font(SpentyFonts.body)
                                            .foregroundStyle(
                                                selectedAccount.isEmpty
                                                    ? SpentyColors.textMuted
                                                    : SpentyColors.textPrimary
                                            )
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .font(SpentyFonts.caption)
                                            .foregroundStyle(SpentyColors.textMuted)
                                    }
                                    .padding(SpentySpacing.md)
                                    .background(SpentyColors.bgSecondary)
                                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                                            .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                                    )
                                }
                            }
                        }
                    }

                    // Action Buttons
                    VStack(spacing: SpentySpacing.md) {
                        PrimaryButton("Approve") {
                            let amount = Double(editedAmount) ?? transaction.amount ?? 0
                            onAction(.approved(
                                amount: amount,
                                type: selectedType.rawValue,
                                category: selectedCategory,
                                account: selectedAccount
                            ))
                        }

                        SecondaryButton("Reject") {
                            onAction(.rejected)
                        }
                        .tint(SpentyColors.danger)
                    }
                    .padding(.top, SpentySpacing.sm)
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.vertical, SpentySpacing.md)
            }
            .background(SpentyColors.bgPrimary)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    SheetHeader(title: "Review Transaction")
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(SpentyColors.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var accountDisplayName: String {
        if selectedAccount.isEmpty {
            return "Select Account"
        }
        return appState.accounts.first(where: { $0.id == selectedAccount })?.name ?? selectedAccount
    }
}

#Preview {
    PendingReviewSheet(
        transaction: PendingTransaction(
            id: "1",
            date: "2026-04-15",
            description: "Amazon.com Purchase",
            amount: 49.99,
            type: "expense",
            suggestedCategory: "Shopping"
        )
    ) { action in
        print("Action: \(action)")
    }
    .environment(AppState())
}
