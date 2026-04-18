import SwiftUI

struct CurrencySettingsView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

    // MARK: - State

    @Bindable var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var isLoadingOptions = true

    // MARK: - Body

    var body: some View {
        ZStack {
            Brand.background
                .ignoresSafeArea()

            if isLoadingOptions && viewModel.currencies.isEmpty {
                ProgressView("Loading options...")
                    .tint(Brand.primary)
            } else {
                formContent
            }
        }
        .navigationTitle("Currency & Locale")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                saveButton
            }
        }
        .task { await loadOptions() }
        .alert("Saved", isPresented: $viewModel.showSaveSuccess) {
            Button("OK") { dismiss() }
        } message: {
            Text("Currency and locale settings have been updated.")
        }
    }

    // MARK: - Form

    private var formContent: some View {
        Form {
            currencySection
            dateFormatSection
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - Currency Section

    private var currencySection: some View {
        Section {
            Picker(selection: currencyBinding, label: pickerLabel) {
                Text("Select Currency").tag("")
                ForEach(viewModel.currencies) { currency in
                    HStack {
                        Text(currency.code)
                            .font(.body.weight(.medium))
                        if let symbol = currency.symbol {
                            Text("(\(symbol))")
                                .foregroundStyle(.secondary)
                        }
                        Text("- \(currency.name)")
                            .foregroundStyle(.secondary)
                    }
                    .tag(currency.code)
                }
            }
            .pickerStyle(.navigationLink)
            .tint(Brand.primary)
        } header: {
            Label("Default Currency", systemImage: "coloncurrencysign.circle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
                .textCase(nil)
        } footer: {
            Text("This currency will be used as the default for new invoices and transactions.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var pickerLabel: some View {
        HStack(spacing: 12) {
            Image(systemName: "banknote")
                .foregroundStyle(Brand.primary)
                .frame(width: 24)
            Text("Currency")
        }
    }

    private var currencyBinding: Binding<String> {
        Binding(
            get: { viewModel.settings.defaultCurrency ?? "" },
            set: { viewModel.settings.defaultCurrency = $0.isEmpty ? nil : $0 }
        )
    }

    // MARK: - Date Format Section

    private var dateFormatSection: some View {
        Section {
            Picker(selection: dateFormatBinding, label: datePickerLabel) {
                Text("Select Format").tag("")
                ForEach(viewModel.dateFormats) { fmt in
                    HStack {
                        Text(fmt.format)
                            .font(.body.weight(.medium))
                        if let example = fmt.example {
                            Spacer()
                            Text(example)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .tag(fmt.format)
                }
            }
            .pickerStyle(.navigationLink)
            .tint(Brand.primary)
        } header: {
            Label("Date Format", systemImage: "calendar")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
                .textCase(nil)
        } footer: {
            Text("Dates on invoices and reports will use this format.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var datePickerLabel: some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.clock")
                .foregroundStyle(Brand.primary)
                .frame(width: 24)
            Text("Date Format")
        }
    }

    private var dateFormatBinding: Binding<String> {
        Binding(
            get: { viewModel.settings.dateFormat ?? "" },
            set: { viewModel.settings.dateFormat = $0.isEmpty ? nil : $0 }
        )
    }

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            Task { await viewModel.saveSettings() }
        } label: {
            if viewModel.isSaving {
                ProgressView()
                    .controlSize(.small)
                    .tint(Brand.primary)
            } else {
                Text("Save")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Brand.primary)
            }
        }
        .disabled(viewModel.isSaving)
    }

    // MARK: - Load

    private func loadOptions() async {
        isLoadingOptions = true

        async let currTask: () = viewModel.loadCurrencies()
        async let dateTask: () = viewModel.loadDateFormats()
        _ = await (currTask, dateTask)

        isLoadingOptions = false
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CurrencySettingsView(viewModel: SettingsViewModel(authManager: AuthManager()))
    }
}
