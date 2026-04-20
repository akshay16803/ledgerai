import SwiftUI
import PhotosUI
import QuickLook

// MARK: - Mode

enum TransactionFormMode {
    case create
    case edit(Transaction)
    case approve(Transaction)
}

// MARK: - Unified Transaction Form

struct UnifiedTransactionForm: View {

    @Environment(\.dismiss) private var dismiss

    let mode: TransactionFormMode
    var onComplete: (() -> Void)?

    // MARK: - Form State

    @State private var transactionType: String = "expense"
    @State private var amount: String = ""
    @State private var date: Date = Date()
    @State private var accountId: String = ""
    @State private var toAccountId: String = ""
    @State private var categoryId: String = ""
    @State private var subcategoryId: String = ""
    @State private var descriptionText: String = ""
    @State private var paymentMethod: String = ""
    @State private var isRecurring: Bool = false
    @State private var recurringFrequency: String = "monthly"
    @State private var recurrenceDate: String = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var isSaving: Bool = false
    @State private var errorMessage: String?

    // Data
    @State private var accounts: [Account] = []
    @State private var categories: [Category] = []

    // Quick-create state
    @State private var showNewAccountAlert: Bool = false
    @State private var showNewCategorySheet: Bool = false
    @State private var showNewSubcategorySheet: Bool = false
    @State private var newAccountName: String = ""
    @State private var newAccountType: String = "savings"
    @State private var newCategoryName: String = ""
    @State private var newSubcategoryName: String = ""

    // Source document state (for edit/approve modes)
    @State private var sourceContent: SourceContent?
    @State private var isLoadingSource = false
    @State private var isSourceExpanded = false
    @State private var sourceError: String?

    // Archive / attachments state
    @State private var archiveRecord: RecordPreviewResponse?
    @State private var isLoadingArchive = false
    @State private var downloadingAttachmentIndex: Int?
    @State private var previewURL: URL?
    @State private var showPreview = false

    // Delete confirmation
    @State private var showDeleteConfirm: Bool = false

    // Guard against subcategoryId wipe during initial population
    @State private var hasPopulated: Bool = false

    // MARK: - Constants

    private let transactionTypes = ["income", "expense", "transfer"]
    private let paymentMethods = ["Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Net Banking", "Wallet", "Other"]
    private let frequencies = ["daily", "weekly", "monthly", "quarterly", "yearly"]
    private let frequencyLabels = ["daily": "Daily", "weekly": "Weekly", "monthly": "Monthly", "quarterly": "Quarterly", "yearly": "Yearly"]

    // MARK: - Repositories

    private let transactionRepo = TransactionRepository.shared
    private let emailSyncRepo = EmailSyncRepository.shared
    private let recordsRepo = RecordsRepository.shared

    // MARK: - Computed

    private var isCreateMode: Bool {
        if case .create = mode { return true }
        return false
    }

    private var isApproveMode: Bool {
        if case .approve = mode { return true }
        return false
    }

    private var existingTransaction: Transaction? {
        switch mode {
        case .create: return nil
        case .edit(let txn): return txn
        case .approve(let txn): return txn
        }
    }

    private var isTransfer: Bool { transactionType == "transfer" }
    private var isIncome: Bool { transactionType == "income" }

    private var navigationTitle: String {
        switch mode {
        case .create: return "New Transaction"
        case .edit: return "Edit Transaction"
        case .approve: return "Review Transaction"
        }
    }

    private var confirmButtonText: String {
        switch mode {
        case .create: return "Create"
        case .edit, .approve: return "Save"
        }
    }

    private var hasSourceDocument: Bool {
        existingTransaction?.sourceId != nil
    }

    private var filteredCategories: [Category] {
        categories.filter { cat in
            guard cat.parentId == nil else { return false }
            guard let catType = cat.categoryType?.lowercased() else { return true }
            if transactionType == "transfer" { return true }
            return catType == transactionType
        }
    }

    private var subcategories: [Category] {
        guard !categoryId.isEmpty else { return [] }
        return categories.filter { $0.parentId == categoryId }
    }

    private var typeAccentColor: Color {
        switch transactionType {
        case "income": return .spentySuccess
        case "expense": return .spentyError
        case "transfer": return .spentyInfo
        default: return .spentyPrimary
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        amountHero
                        detailsSection
                        categorySection
                        noteSection
                        recurringSection
                        attachmentSection

                        if hasSourceDocument && !isCreateMode {
                            sourceDocumentCard
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(SpentyFonts.footnote)
                                .foregroundColor(.spentyError)
                                .padding(.horizontal, 4)
                        }

                        // Approve / Reject buttons
                        if isApproveMode {
                            approveRejectButtons
                        }

                        // Delete button
                        if !isCreateMode {
                            deleteButton
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.spentyTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(confirmButtonText) {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.spentyPrimary)
                    .disabled(isSaving || amount.isEmpty || accountId.isEmpty || (!isTransfer && categoryId.isEmpty))
                }
            }
            .task {
                await loadData()
                populateFields()
                await loadSourceDocument()
                await loadArchiveRecord()
            }
            .alert("Delete Transaction", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task { await deleteTransaction() }
                }
            } message: {
                Text("Are you sure you want to delete this transaction? This action cannot be undone.")
            }
            .fullScreenCover(isPresented: $showPreview) {
                if let url = previewURL {
                    NavigationStack {
                        AttachmentPreviewView(url: url)
                            .navigationBarTitleDisplayMode(.inline)
                            .toolbar {
                                ToolbarItem(placement: .topBarLeading) {
                                    Button("Done") { showPreview = false }
                                        .font(SpentyFonts.headline)
                                        .foregroundColor(.spentyPrimary)
                                }
                                ToolbarItem(placement: .topBarTrailing) {
                                    ShareLink(item: url) {
                                        Image(systemName: "square.and.arrow.up")
                                            .foregroundColor(.spentyPrimary)
                                    }
                                }
                            }
                    }
                }
            }
        }
    }

    // MARK: - Section Label

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(.spentyTextSecondary)
            .tracking(0.8)
            .padding(.leading, 4)
    }

    // MARK: - Amount Hero

    private var amountHero: some View {
        VStack(spacing: 20) {
            // Type picker
            HStack(spacing: 0) {
                ForEach(transactionTypes, id: \.self) { type in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            transactionType = type
                            categoryId = ""
                            subcategoryId = ""
                        }
                    } label: {
                        Text(type.capitalized)
                            .font(.system(size: 14, weight: transactionType == type ? .semibold : .regular))
                            .foregroundColor(transactionType == type ? .white : .spentyTextSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                transactionType == type
                                    ? typeAccentColor
                                    : Color.clear
                            )
                            .cornerRadius(10)
                    }
                }
            }
            .padding(3)
            .background(Color.spentyBgSecondary)
            .cornerRadius(12)

            // Amount input
            VStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\u{20B9}")
                        .font(.system(size: 30, weight: .semibold, design: .rounded))
                        .foregroundColor(typeAccentColor)

                    TextField("0.00", text: $amount)
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(.spentyTextPrimary)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.5)
                }
                .frame(maxWidth: .infinity)

                Text(transactionType == "transfer" ? "Transfer amount" : transactionType == "income" ? "Money received" : "Money spent")
                    .font(.system(size: 13))
                    .foregroundColor(.spentyTextSecondary)
            }
            .padding(.vertical, 4)
        }
        .padding(20)
        .background(Color.spentyCardBg)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    // MARK: - Details Section

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Details")

            VStack(spacing: 0) {
                // Date row
                formRow(icon: "calendar", label: "Date") {
                    DatePicker("", selection: $date, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .labelsHidden()
                }

                formDivider

                // Account row
                HStack(alignment: .center, spacing: 8) {
                    Image(systemName: "building.columns")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 22)

                    Text(isTransfer ? "From" : "Account")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)

                    Spacer(minLength: 4)

                    Picker("", selection: $accountId) {
                        Text("Select").tag("")
                        ForEach(accounts) { account in
                            Text(account.name ?? "Unnamed").tag(account.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)

                    Button {
                        newAccountName = ""
                        newAccountType = "savings"
                        showNewAccountAlert = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.spentyPrimary.opacity(0.7))
                    }
                }
                .padding(.vertical, 12)

                if isTransfer {
                    formDivider

                    formRow(icon: "arrow.right.circle", label: "To") {
                        Picker("", selection: $toAccountId) {
                            Text("Select").tag("")
                            ForEach(accounts.filter { $0.id != accountId }) { account in
                                Text(account.name ?? "Unnamed").tag(account.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(.spentyTextPrimary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }

                formDivider

                // Payment method row
                formRow(icon: "creditcard", label: "Payment") {
                    Picker("", selection: $paymentMethod) {
                        Text("Select").tag("")
                        ForEach(paymentMethods, id: \.self) { method in
                            Text(method).tag(method)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
            .cardStyle()
        }
    }

    // MARK: - Category Section

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Category")

            VStack(spacing: 0) {
                // Category row
                HStack(alignment: .center, spacing: 8) {
                    Image(systemName: "tag")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 22)

                    Text("Category")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyTextPrimary)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)

                    Spacer(minLength: 4)

                    Picker("", selection: $categoryId) {
                        Text("Select").tag("")
                        ForEach(filteredCategories) { cat in
                            Text(cat.name ?? "Unnamed").tag(cat.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.spentyTextPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
                    .onChange(of: categoryId) { _, _ in
                        if hasPopulated { subcategoryId = "" }
                    }

                    Button {
                        newCategoryName = ""
                        showNewCategorySheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.spentyPrimary.opacity(0.7))
                    }
                }
                .padding(.vertical, 12)

                if !subcategories.isEmpty || !categoryId.isEmpty {
                    formDivider

                    // Subcategory row
                    HStack(alignment: .center, spacing: 8) {
                        Image(systemName: "tag.circle")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyPrimary.opacity(0.6))
                            .frame(width: 22)

                        Text("Subcategory")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)

                        Spacer(minLength: 4)

                        Picker("", selection: $subcategoryId) {
                            Text("None").tag("")
                            ForEach(subcategories) { sub in
                                Text(sub.name ?? "Unnamed").tag(sub.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(.spentyTextPrimary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .fixedSize(horizontal: false, vertical: true)

                        if !categoryId.isEmpty {
                            Button {
                                newSubcategoryName = ""
                                showNewSubcategorySheet = true
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(.spentyPrimary.opacity(0.7))
                            }
                        }
                    }
                    .padding(.vertical, 12)
                }
            }
            .cardStyle()
            .alert("New Account", isPresented: $showNewAccountAlert) {
                TextField("Account name", text: $newAccountName)
                Picker("Type", selection: $newAccountType) {
                    Text("Savings").tag("savings")
                    Text("Current").tag("current")
                    Text("Credit Card").tag("credit_card")
                    Text("Cash").tag("cash")
                    Text("Wallet").tag("wallet")
                    Text("Loan").tag("loan")
                    Text("Investment").tag("investment")
                }
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineAccount() }
                }
                .disabled(newAccountName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name and type for the new account.")
            }
            .alert("New Category", isPresented: $showNewCategorySheet) {
                TextField("Category name", text: $newCategoryName)
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineCategory() }
                }
                .disabled(newCategoryName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name for the new \(transactionType) category.")
            }
            .alert("New Subcategory", isPresented: $showNewSubcategorySheet) {
                TextField("Subcategory name", text: $newSubcategoryName)
                Button("Cancel", role: .cancel) { }
                Button("Create") {
                    Task { await createInlineSubcategory() }
                }
                .disabled(newSubcategoryName.trimmingCharacters(in: .whitespaces).isEmpty)
            } message: {
                Text("Enter a name for the new subcategory.")
            }
        }
    }

    // MARK: - Note Section

    private var noteSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Note")

            HStack(alignment: .center, spacing: 8) {
                Image(systemName: "text.alignleft")
                    .font(.system(size: 15))
                    .foregroundColor(.spentyPrimary)
                    .frame(width: 22)

                TextField("Add a note...", text: $descriptionText)
                    .font(.system(size: 15))
                    .foregroundColor(.spentyTextPrimary)
            }
            .padding(14)
            .background(Color.spentyCardBg)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.spentyBorder, lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
        }
    }

    // MARK: - Recurring Section

    private var recurringSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Recurring")

            VStack(spacing: 0) {
                // Toggle row
                HStack(alignment: .center, spacing: 10) {
                    Image(systemName: "repeat")
                        .font(.system(size: 15))
                        .foregroundColor(.spentyPrimary)
                        .frame(width: 22)

                    Toggle(isOn: $isRecurring) {
                        Text("Repeat")
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .lineLimit(1)
                    }
                    .tint(Color.spentyPrimary)
                }
                .padding(.vertical, 12)

                if isRecurring {
                    formDivider

                    // Frequency
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .center, spacing: 8) {
                            Image(systemName: "clock.arrow.2.circlepath")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyPrimary.opacity(0.6))
                                .frame(width: 22)

                            Text("Frequency")
                                .font(.system(size: 15))
                                .foregroundColor(.spentyTextPrimary)
                                .lineLimit(1)
                                .fixedSize(horizontal: true, vertical: false)
                        }
                        .padding(.top, 12)

                        HStack(spacing: 2) {
                            ForEach(frequencies, id: \.self) { freq in
                                Button {
                                    recurringFrequency = freq
                                } label: {
                                    Text(frequencyLabels[freq] ?? freq.capitalized)
                                        .font(.system(size: 12, weight: recurringFrequency == freq ? .semibold : .regular))
                                        .foregroundColor(recurringFrequency == freq ? .white : .spentyTextSecondary)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 9)
                                        .background(
                                            recurringFrequency == freq
                                                ? Color.spentyPrimary
                                                : Color.clear
                                        )
                                        .cornerRadius(10)
                                }
                            }
                        }
                        .padding(3)
                        .background(Color.spentyBgSecondary)
                        .cornerRadius(12)
                    }

                    formDivider

                    // Recurrence day
                    formRow(icon: "number", label: "Day") {
                        TextField("1-31", text: $recurrenceDate)
                            .keyboardType(.numberPad)
                            .font(.system(size: 15))
                            .foregroundColor(.spentyTextPrimary)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }
            .cardStyle()
        }
    }

    // MARK: - Attachment Section

    private var attachmentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Attachment")

            PhotosPicker(
                selection: $selectedPhoto,
                matching: .images
            ) {
                HStack(spacing: 12) {
                    // Icon with badge background
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.spentyPrimary.opacity(0.12))
                            .frame(width: 36, height: 36)

                        Image(systemName: "doc.viewfinder")
                            .font(.system(size: 16))
                            .foregroundColor(.spentyPrimary)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedPhoto == nil ? "Attach Receipt" : "Receipt Selected")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(selectedPhoto == nil ? .spentyTextPrimary : .spentySuccess)
                            .lineLimit(1)

                        Text("Photo or document")
                            .font(.system(size: 12))
                            .foregroundColor(.spentyTextSecondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    if selectedPhoto != nil {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundColor(.spentySuccess)
                    } else {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.spentyTextSecondary.opacity(0.5))
                    }
                }
                .padding(.vertical, 10)
            }
            .cardStyle()
        }
    }

    // MARK: - Source Document Card

    private var sourceDocumentCard: some View {
        VStack(spacing: 12) {
            // Header with expand/collapse
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    isSourceExpanded.toggle()
                }
            } label: {
                HStack {
                    Image(systemName: "envelope.open")
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyPrimary)
                    Text("Source Document")
                        .font(SpentyFonts.headline)
                        .foregroundColor(.spentyTextPrimary)
                    Spacer()
                    if isLoadingSource || isLoadingArchive {
                        ProgressView()
                            .tint(.spentyPrimary)
                    } else {
                        Image(systemName: isSourceExpanded ? "chevron.up" : "chevron.down")
                            .font(SpentyFonts.footnote)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
            }

            // Source badge
            if let source = existingTransaction?.source, !source.isEmpty {
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: source.lowercased() == "email" ? "envelope.fill" : "message.fill")
                            .font(.system(size: 10))
                        Text("Via \(source.capitalized)")
                            .font(SpentyFonts.caption1)
                    }
                    .foregroundColor(.spentyAccent3)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.spentyAccent3.opacity(0.12))
                    .cornerRadius(6)
                    Spacer()
                }
            }

            if isSourceExpanded {
                if let error = sourceError {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(SpentyFonts.footnote)
                        Text(error)
                            .font(SpentyFonts.footnote)
                    }
                    .foregroundColor(.spentyError)
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else if let content = sourceContent {
                    sourceContentView(content)
                } else if !isLoadingSource {
                    Text("No source content available")
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                }

                // Attachments section
                if let archive = archiveRecord, let attachments = archive.attachments, !attachments.isEmpty {
                    Divider().background(Color.spentyBorder)
                    attachmentsSection(attachments, archiveId: archive.id)
                }
            }
        }
        .cardStyle()
    }

    @ViewBuilder
    private func sourceContentView(_ content: SourceContent) -> some View {
        VStack(spacing: 8) {
            if content.type == "email" {
                if let subject = content.subject, !subject.isEmpty {
                    sourceRow(label: "Subject", value: subject)
                }
                if let from = content.from, !from.isEmpty {
                    sourceRow(label: "From", value: from)
                }
                if let date = content.date, !date.isEmpty {
                    sourceRow(label: "Date", value: date)
                }
                if let body = content.body, !body.isEmpty {
                    Divider().background(Color.spentyBorder)
                    Text(stripHTML(body))
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(20)
                }
            } else if content.type == "sms" {
                if let sender = content.sender, !sender.isEmpty {
                    sourceRow(label: "Sender", value: sender)
                }
                if let date = content.date, !date.isEmpty {
                    sourceRow(label: "Date", value: date)
                }
                if let body = content.body, !body.isEmpty {
                    Divider().background(Color.spentyBorder)
                    Text(body)
                        .font(SpentyFonts.footnote)
                        .foregroundColor(.spentyTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func sourceRow(label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)
                .frame(width: 60, alignment: .leading)
            Text(value)
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextPrimary)
                .textSelection(.enabled)
            Spacer()
        }
    }

    @ViewBuilder
    private func attachmentsSection(_ attachments: [RecordAttachment], archiveId: String) -> some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "paperclip")
                    .font(SpentyFonts.footnote)
                    .foregroundColor(.spentyTextSecondary)
                Text("Attachments (\(attachments.count))")
                    .font(SpentyFonts.subheadline)
                    .foregroundColor(.spentyTextPrimary)
                Spacer()
            }

            ForEach(attachments) { attachment in
                Button {
                    Task { await downloadAttachment(archiveId: archiveId, attachment: attachment) }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: attachmentIcon(for: attachment.mimeType))
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyPrimary)
                            .frame(width: 28)

                        VStack(alignment: .leading, spacing: 2) {
                            let attName: String = attachment.filename ?? "Attachment \(attachment.index + 1)"
                            Text(attName)
                                .font(SpentyFonts.subheadline)
                                .foregroundColor(.spentyTextPrimary)
                                .lineLimit(1)

                            if let size = attachment.size, size > 0 {
                                Text(formatFileSize(size))
                                    .font(SpentyFonts.caption1)
                                    .foregroundColor(.spentyTextSecondary)
                            }
                        }

                        Spacer()

                        if downloadingAttachmentIndex == attachment.index {
                            ProgressView()
                                .tint(.spentyPrimary)
                        } else {
                            Image(systemName: "eye.circle")
                                .font(SpentyFonts.body)
                                .foregroundColor(.spentyPrimary)
                        }
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .background(Color.spentyBgSecondary)
                    .cornerRadius(8)
                }
                .disabled(downloadingAttachmentIndex != nil)
            }
        }
    }

    // MARK: - Approve / Reject Buttons

    private var approveRejectButtons: some View {
        VStack(spacing: 12) {
            // Approve button (green)
            Button {
                Task { await approve() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                    Text("Approve Transaction")
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.spentySuccess)
                .cornerRadius(14)
            }
            .disabled(isSaving)

            // Reject button (red)
            Button {
                Task { await reject() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "xmark.circle.fill")
                    Text("Reject Transaction")
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.spentyError)
                .cornerRadius(14)
            }
            .disabled(isSaving)
        }
    }

    // MARK: - Delete Button

    private var deleteButton: some View {
        Button {
            showDeleteConfirm = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "trash")
                Text("Delete Transaction")
            }
            .destructiveButtonStyle()
        }
        .disabled(isSaving)
    }

    // MARK: - Shared Form Components

    private func formRow<Content: View>(
        icon: String,
        label: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(alignment: .center, spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 15))
                .foregroundColor(.spentyPrimary)
                .frame(width: 22)

            Text(label)
                .font(.system(size: 15))
                .foregroundColor(.spentyTextPrimary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)

            Spacer(minLength: 4)

            content()
        }
        .padding(.vertical, 12)
    }

    private var formDivider: some View {
        Divider()
            .padding(.leading, 40)
    }

    // MARK: - Load Data

    private func loadData() async {
        do {
            accounts = try await AccountRepository().fetchAccounts()
            categories = try await CategoryRepository.shared.getCategories()
        } catch {
            errorMessage = "Failed to load form data"
        }
    }

    // MARK: - Populate Fields

    private func populateFields() {
        guard let txn = existingTransaction else { return }
        transactionType = txn.transactionType ?? "expense"
        amount = txn.amount.map { String(format: "%.2f", $0) } ?? ""
        date = txn.date ?? Date()
        accountId = txn.accountId ?? ""
        toAccountId = txn.toAccountId ?? ""
        categoryId = txn.categoryId ?? ""
        subcategoryId = txn.subcategoryId ?? ""
        descriptionText = txn.description ?? ""
        paymentMethod = txn.paymentMethod ?? ""
        isRecurring = txn.isRecurring ?? false
        recurringFrequency = txn.recurringFrequency ?? "monthly"
        recurrenceDate = txn.recurrenceDate.map { String($0) } ?? ""
        hasPopulated = true
    }

    // MARK: - Load Source Document

    @MainActor
    private func loadSourceDocument() async {
        guard let sourceId = existingTransaction?.sourceId else { return }
        isLoadingSource = true
        defer { isLoadingSource = false }
        do {
            sourceContent = try await emailSyncRepo.sourceContent(id: sourceId)
            isSourceExpanded = true
        } catch {
            sourceError = "Could not load source document"
        }
    }

    // MARK: - Load Archive Record

    @MainActor
    private func loadArchiveRecord() async {
        guard let txnId = existingTransaction?.id,
              existingTransaction?.sourceEmailId != nil else { return }
        isLoadingArchive = true
        defer { isLoadingArchive = false }
        do {
            archiveRecord = try await recordsRepo.fetchRecordByTransaction(transactionId: txnId)
        } catch {
            // Archive may not exist yet — fail silently
        }
    }

    // MARK: - Download Attachment

    @MainActor
    private func downloadAttachment(archiveId: String, attachment: RecordAttachment) async {
        downloadingAttachmentIndex = attachment.index
        defer { downloadingAttachmentIndex = nil }
        do {
            let data = try await recordsRepo.downloadAttachment(id: archiveId, index: attachment.index)
            let filename = attachment.filename ?? "attachment_\(attachment.index)"
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            try data.write(to: tempURL)
            previewURL = tempURL
            showPreview = true
        } catch {
            sourceError = "Failed to download attachment"
        }
    }

    // MARK: - Inline Account Creation

    private func createInlineAccount() async {
        let trimmed = newAccountName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        do {
            let payload: [String: Any] = ["name": trimmed, "accountType": newAccountType]
            let created = try await AccountRepository().createAccount(payload)
            accounts = try await AccountRepository().fetchAccounts()
            accountId = created.id
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Inline Category Creation

    private func createInlineCategory() async {
        let trimmed = newCategoryName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        let catType: CategoryType = transactionType == "income" ? .income : .expense
        do {
            let created = try await CategoryRepository.shared.createCategory(name: trimmed, type: catType, parentId: nil)
            categories = try await CategoryRepository.shared.getCategories()
            categoryId = created.id
            subcategoryId = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func createInlineSubcategory() async {
        let trimmed = newSubcategoryName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !categoryId.isEmpty else { return }

        let catType: CategoryType = transactionType == "income" ? .income : .expense
        do {
            let created = try await CategoryRepository.shared.createCategory(name: trimmed, type: catType, parentId: categoryId)
            categories = try await CategoryRepository.shared.getCategories()
            subcategoryId = created.id
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Save

    private func save() async {
        guard await saveTransaction() else { return }
        onComplete?()
        dismiss()
    }

    /// Validates and saves the transaction. Returns true on success.
    @discardableResult
    private func saveTransaction() async -> Bool {
        guard let parsedAmount = Double(amount), parsedAmount > 0 else {
            errorMessage = "Please enter a valid amount."
            return false
        }

        guard !accountId.isEmpty else {
            errorMessage = "Please select an account."
            return false
        }

        if !isTransfer && categoryId.isEmpty {
            errorMessage = "Please select a category."
            return false
        }

        if isTransfer && toAccountId.isEmpty {
            errorMessage = "Please select a destination account."
            return false
        }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let txn = Transaction(
            id: existingTransaction?.id ?? "",
            transactionType: transactionType,
            amount: parsedAmount,
            date: date,
            accountId: accountId.isEmpty ? nil : accountId,
            toAccountId: isTransfer && !toAccountId.isEmpty ? toAccountId : nil,
            categoryId: categoryId.isEmpty ? nil : categoryId,
            subcategoryId: subcategoryId.isEmpty ? nil : subcategoryId,
            description: descriptionText.isEmpty ? nil : descriptionText,
            paymentMethod: paymentMethod.isEmpty ? nil : paymentMethod,
            status: existingTransaction?.status ?? "approved",
            isRecurring: isRecurring,
            recurringFrequency: isRecurring ? recurringFrequency : nil,
            recurrenceDate: isRecurring ? Int(recurrenceDate) : nil,
            source: existingTransaction?.source ?? "manual",
            receiptId: existingTransaction?.receiptId,
            originalCurrency: existingTransaction?.originalCurrency,
            originalAmount: existingTransaction?.originalAmount,
            exchangeRate: existingTransaction?.exchangeRate,
            isEstimatedRate: existingTransaction?.isEstimatedRate
        )

        do {
            if isCreateMode {
                _ = try await transactionRepo.createTransaction(txn)
            } else {
                _ = try await transactionRepo.updateTransaction(id: txn.id, txn)
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    // MARK: - Approve

    private func approve() async {
        // Save any edits first
        guard await saveTransaction() else { return }

        guard let txnId = existingTransaction?.id else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await transactionRepo.approveTransaction(id: txnId)
            onComplete?()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Reject

    private func reject() async {
        guard let txnId = existingTransaction?.id else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await transactionRepo.rejectTransaction(id: txnId)
            onComplete?()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Delete

    private func deleteTransaction() async {
        guard let txnId = existingTransaction?.id else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await transactionRepo.deleteTransaction(id: txnId)
            onComplete?()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func stripHTML(_ html: String) -> String {
        guard let data = html.data(using: .utf8),
              let attributed = try? NSAttributedString(
                data: data,
                options: [.documentType: NSAttributedString.DocumentType.html,
                          .characterEncoding: String.Encoding.utf8.rawValue],
                documentAttributes: nil
              ) else {
            return html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        }
        return attributed.string.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func attachmentIcon(for mimeType: String?) -> String {
        guard let mime = mimeType?.lowercased() else { return "doc" }
        if mime.contains("pdf") { return "doc.richtext" }
        if mime.contains("image") { return "photo" }
        if mime.contains("spreadsheet") || mime.contains("excel") || mime.contains("csv") { return "tablecells" }
        if mime.contains("word") || mime.contains("document") { return "doc.text" }
        if mime.contains("zip") || mime.contains("archive") { return "doc.zipper" }
        return "doc"
    }

    private func formatFileSize(_ bytes: Int) -> String {
        if bytes < 1024 { return "\(bytes) B" }
        let kb = Double(bytes) / 1024.0
        if kb < 1024 { return String(format: "%.1f KB", kb) }
        let mb = kb / 1024.0
        return String(format: "%.1f MB", mb)
    }
}

// MARK: - Preview

#Preview("Create") {
    UnifiedTransactionForm(mode: .create)
}

#Preview("Edit") {
    UnifiedTransactionForm(
        mode: .edit(Transaction(
            id: "preview-1",
            transactionType: "expense",
            amount: 1250.00,
            date: Date(),
            accountId: "acc-001",
            categoryId: "cat-food",
            description: "Lunch",
            paymentMethod: "UPI",
            status: "approved",
            isRecurring: false,
            source: "manual"
        ))
    )
}

#Preview("Approve") {
    UnifiedTransactionForm(
        mode: .approve(Transaction(
            id: "preview-2",
            transactionType: "expense",
            amount: 5000.00,
            date: Date(),
            accountId: "acc-001",
            categoryId: "cat-food",
            description: "Dinner",
            paymentMethod: "Credit Card",
            status: "pending",
            isRecurring: false,
            source: "email",
            sourceEmailId: "email-123"
        ))
    )
}
