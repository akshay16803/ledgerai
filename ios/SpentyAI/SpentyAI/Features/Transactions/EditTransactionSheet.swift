import SwiftUI
import PhotosUI

struct EditTransactionSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let transaction: Transaction?
    let onSaved: () -> Void

    @State private var viewModel = EditTransactionViewModel()
    @State private var showPhotoPicker = false
    @State private var showFilePicker = false
    @State private var selectedPhotoItem: PhotosPickerItem?

    private var currency: String {
        appState.user?.settings?.baseCurrency ?? "INR"
    }

    private var sheetTitle: String {
        viewModel.isEdit ? "Edit Transaction" : "New Transaction"
    }

    private var isPendingReview: Bool {
        viewModel.existingTransaction?.status == .pendingReview
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        typeSelector
                        switchButtons
                        amountSection
                        dateSection
                        accountSection
                        categorySection
                        descriptionSection
                        paymentMethodSection
                        recurringSection

                        if viewModel.transactionType == .expense {
                            receiptSection
                        }

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.danger)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        actionButtons
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.vertical, SpentySpacing.lg)
                    .padding(.bottom, SpentySpacing.xxl)
                }
                .background(SpentyColors.bgPrimary.ignoresSafeArea())

                if viewModel.isParsing {
                    LoadingOverlay(isPresented: .constant(true))
                }
            }
            .safeAreaInset(edge: .top) {
                SheetHeader(sheetTitle, onClose: { dismiss() })
                    .background(SpentyColors.surface)
            }
            .navigationBarHidden(true)
        }
        .task {
            await viewModel.loadPickerData()
            if let transaction {
                viewModel.populateFromExisting(transaction)
            }
        }
        .photosPicker(
            isPresented: $showPhotoPicker,
            selection: $selectedPhotoItem,
            matching: .images
        )
        .onChange(of: selectedPhotoItem) { _, newItem in
            guard let newItem else { return }
            Task {
                if let data = try? await newItem.loadTransferable(type: Data.self) {
                    await viewModel.uploadReceipt(
                        data: data,
                        fileName: "receipt.jpg",
                        mimeType: "image/jpeg"
                    )
                }
            }
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.image, .pdf],
            allowsMultipleSelection: false
        ) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else { return }
            defer { url.stopAccessingSecurityScopedResource() }

            if let data = try? Data(contentsOf: url) {
                let fileName = url.lastPathComponent
                let ext = url.pathExtension.lowercased()
                let mimeType = ext == "pdf" ? "application/pdf" : "image/\(ext)"
                Task {
                    await viewModel.uploadReceipt(
                        data: data,
                        fileName: fileName,
                        mimeType: mimeType
                    )
                }
            }
        }
    }

    // MARK: - Type Selector

    private var typeSelector: some View {
        Picker("Type", selection: $viewModel.transactionType) {
            Text("Income").tag(TransactionType.income)
            Text("Expense").tag(TransactionType.expense)
            Text("Transfer").tag(TransactionType.transfer)
        }
        .pickerStyle(.segmented)
        .onChange(of: viewModel.transactionType) { _, _ in
            viewModel.categoryId = nil
            viewModel.subcategoryId = nil
        }
    }

    // MARK: - Switch Buttons

    private var switchButtons: some View {
        HStack(spacing: SpentySpacing.lg) {
            if viewModel.transactionType == .income && appState.hasInvoices {
                Button {
                    dismiss()
                } label: {
                    Label("Switch to Sales Invoice", systemImage: "doc.text")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.brandAccent)
                }
                .buttonStyle(.plain)
            }

            if viewModel.transactionType == .expense && appState.hasBills {
                Button {
                    dismiss()
                } label: {
                    Label("Switch to Purchase Bill", systemImage: "doc.text")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.brandAccent)
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Amount

    private var amountSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            HStack(spacing: 2) {
                Text("Amount")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
                Text("*")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.danger)
            }

            HStack(spacing: SpentySpacing.sm) {
                Text(currencySymbol)
                    .font(SpentyFonts.heading)
                    .foregroundStyle(SpentyColors.textSecondary)

                TextField("0.00", text: $viewModel.amount)
                    .font(.system(size: 32, weight: .bold, design: .monospaced))
                    .foregroundStyle(SpentyColors.textPrimary)
                    .keyboardType(.decimalPad)
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
            .background(SpentyColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.md)
                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
            )
        }
    }

    private var currencySymbol: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.currencySymbol ?? currency
    }

    // MARK: - Date

    private var dateSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            HStack(spacing: 2) {
                Text("Date")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
                Text("*")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.danger)
            }

            DatePicker(
                "Date",
                selection: $viewModel.date,
                displayedComponents: .date
            )
            .datePickerStyle(.compact)
            .labelsHidden()
            .padding(.horizontal, SpentySpacing.md)
            .padding(.vertical, SpentySpacing.sm)
            .background(SpentyColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.md)
                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
            )
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        VStack(spacing: SpentySpacing.md) {
            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                HStack(spacing: 2) {
                    Text("Account")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Text("*")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.danger)
                }

                pickerField(
                    selection: $viewModel.accountId,
                    placeholder: "Select Account",
                    options: viewModel.accounts.map { ($0.accountId, $0.name) }
                )
            }

            if viewModel.transactionType == .transfer {
                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    HStack(spacing: 2) {
                        Text("To Account")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                        Text("*")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.danger)
                    }

                    pickerField(
                        selection: $viewModel.toAccountId,
                        placeholder: "Select Destination",
                        options: viewModel.accounts
                            .filter { $0.accountId != viewModel.accountId }
                            .map { ($0.accountId, $0.name) }
                    )
                }
            }
        }
    }

    // MARK: - Category

    private var categorySection: some View {
        VStack(spacing: SpentySpacing.md) {
            if viewModel.transactionType != .transfer {
                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("Category")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)

                    pickerField(
                        selection: $viewModel.categoryId,
                        placeholder: "Select Category",
                        options: viewModel.filteredCategories.map { ($0.categoryId, $0.name) }
                    )
                }

                if !viewModel.subcategories.isEmpty {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("Subcategory")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        pickerField(
                            selection: $viewModel.subcategoryId,
                            placeholder: "Select Subcategory",
                            options: viewModel.subcategories.map { ($0.categoryId, $0.name) }
                        )
                    }
                }
            }
        }
        .onChange(of: viewModel.categoryId) { _, _ in
            viewModel.subcategoryId = nil
        }
    }

    // MARK: - Description

    private var descriptionSection: some View {
        FormField(
            "Description",
            text: $viewModel.description,
            placeholder: "What is this transaction for?"
        )
    }

    // MARK: - Payment Method

    private var paymentMethodSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            Text("Payment Method")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textSecondary)

            Picker("Payment Method", selection: $viewModel.paymentMethod) {
                ForEach(EditTransactionViewModel.paymentMethods, id: \.self) { method in
                    Text(method).tag(method)
                }
            }
            .pickerStyle(.menu)
            .font(SpentyFonts.body)
            .foregroundStyle(SpentyColors.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, SpentySpacing.md)
            .padding(.vertical, SpentySpacing.sm + 2)
            .background(SpentyColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.md)
                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
            )
        }
    }

    // MARK: - Recurring

    private var recurringSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            Toggle(isOn: $viewModel.isRecurring) {
                Text("Recurring Transaction")
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textPrimary)
            }
            .tint(SpentyColors.brandAccent)

            if viewModel.isRecurring {
                VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                    Text("Frequency")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)

                    Picker("Frequency", selection: $viewModel.recurringFrequency) {
                        ForEach(EditTransactionViewModel.recurringFrequencies, id: \.self) { freq in
                            Text(freq).tag(freq)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
        }
        .padding(SpentySpacing.lg)
        .background(SpentyColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: SpentyRadius.md)
                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
        )
    }

    // MARK: - Receipt

    private var receiptSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            Text("Receipt")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textSecondary)

            if let fileName = viewModel.receiptFileName {
                HStack(spacing: SpentySpacing.md) {
                    Image(systemName: "doc.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(SpentyColors.brandAccent)

                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text(fileName)
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textPrimary)
                            .lineLimit(1)

                        if viewModel.isParsing {
                            HStack(spacing: SpentySpacing.xs) {
                                ProgressView()
                                    .controlSize(.mini)
                                Text("AI is parsing receipt...")
                                    .font(SpentyFonts.caption)
                                    .foregroundStyle(SpentyColors.textMuted)
                            }
                        } else {
                            Text("Uploaded")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.success)
                        }
                    }

                    Spacer()

                    Button {
                        viewModel.removeReceipt()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(SpentyColors.textMuted)
                    }
                    .buttonStyle(.plain)
                }
                .padding(SpentySpacing.md)
                .background(SpentyColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: SpentyRadius.md)
                        .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                )
            } else if viewModel.receiptId != nil {
                HStack(spacing: SpentySpacing.md) {
                    Image(systemName: "doc.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(SpentyColors.brandAccent)

                    Text("Receipt attached")
                        .font(SpentyFonts.body)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Spacer()

                    Button {
                        viewModel.removeReceipt()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(SpentyColors.textMuted)
                    }
                    .buttonStyle(.plain)
                }
                .padding(SpentySpacing.md)
                .background(SpentyColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: SpentyRadius.md)
                        .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                )
            } else {
                Menu {
                    Button {
                        showPhotoPicker = true
                    } label: {
                        Label("Photo Library", systemImage: "photo")
                    }

                    Button {
                        showFilePicker = true
                    } label: {
                        Label("Choose File", systemImage: "folder")
                    }
                } label: {
                    HStack(spacing: SpentySpacing.sm) {
                        Image(systemName: "paperclip")
                            .font(.system(size: 16, weight: .medium))
                        Text(viewModel.isUploading ? "Uploading..." : "Attach Receipt")
                            .font(SpentyFonts.body)
                    }
                    .foregroundStyle(SpentyColors.brandAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, SpentySpacing.md)
                    .background(SpentyColors.brandAccent.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpentyRadius.md)
                            .stroke(SpentyColors.brandAccent.opacity(0.3), lineWidth: 1)
                    )
                }
                .disabled(viewModel.isUploading)
            }
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: SpentySpacing.md) {
            PrimaryButton(
                viewModel.isEdit ? "Update" : "Save",
                icon: viewModel.isEdit ? "checkmark" : "plus",
                isLoading: viewModel.isSaving,
                isDisabled: !viewModel.isValid,
                isFullWidth: true
            ) {
                Task {
                    do {
                        try await viewModel.save()
                        onSaved()
                        dismiss()
                    } catch {
                        // Error is set on viewModel
                    }
                }
            }

            if isPendingReview {
                SecondaryButton(
                    "Approve",
                    icon: "checkmark.seal",
                    isLoading: viewModel.isSaving,
                    isFullWidth: true
                ) {
                    Task {
                        do {
                            try await viewModel.approve()
                            onSaved()
                            dismiss()
                        } catch {
                            // Error is set on viewModel
                        }
                    }
                }
            }
        }
    }

    // MARK: - Picker Helper

    private func pickerField(
        selection: Binding<String?>,
        placeholder: String,
        options: [(id: String, name: String)]
    ) -> some View {
        Menu {
            Button(placeholder) {
                selection.wrappedValue = nil
            }
            ForEach(options, id: \.id) { option in
                Button(option.name) {
                    selection.wrappedValue = option.id
                }
            }
        } label: {
            HStack {
                Text(
                    options.first(where: { $0.id == selection.wrappedValue })?.name ?? placeholder
                )
                .font(SpentyFonts.body)
                .foregroundStyle(
                    selection.wrappedValue != nil
                        ? SpentyColors.textPrimary
                        : SpentyColors.textMuted
                )

                Spacer()

                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 12))
                    .foregroundStyle(SpentyColors.textMuted)
            }
            .padding(.horizontal, SpentySpacing.md)
            .padding(.vertical, SpentySpacing.sm + 2)
            .background(SpentyColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.md)
                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
            )
        }
    }
}

#Preview {
    EditTransactionSheet(transaction: nil, onSaved: {})
        .environment(AppState())
}
