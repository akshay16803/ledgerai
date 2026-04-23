import SwiftUI

struct CurrencySettingsView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @Bindable var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var isLoadingOptions = true

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary
                .ignoresSafeArea()

            if isLoadingOptions && viewModel.currencies.isEmpty {
                ProgressView("Loading options...")
                    .tint(Color.spentyPrimary)
            } else {
                formContent
            }
        }
        .navigationTitle(lang.s("currency_locale"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                saveButton
            }
        }
        .task { await loadOptions() }
        .alert("Saved", isPresented: $viewModel.showSaveSuccess) {
            Button(lang.s("ok")) { dismiss() }
        } message: {
            Text(lang.s("currency_updated"))
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
                Text(lang.s("select_currency")).tag("")
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
            .tint(Color.spentyPrimary)
        } header: {
            Label("Default Currency", systemImage: "coloncurrencysign.circle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.spentyPrimary)
                .textCase(nil)
        } footer: {
            Text(lang.s("currency_info"))
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var pickerLabel: some View {
        HStack(spacing: 12) {
            Image(systemName: "banknote")
                .foregroundStyle(Color.spentyPrimary)
                .frame(width: 24)
            Text(lang.s("currency"))
        }
    }

    private var currencyBinding: Binding<String> {
        Binding(
            get: { viewModel.settings.baseCurrency ?? "" },
            set: { viewModel.settings.baseCurrency = $0.isEmpty ? nil : $0 }
        )
    }

    // MARK: - Date Format Section

    private var dateFormatSection: some View {
        Section {
            Picker(selection: dateFormatBinding, label: datePickerLabel) {
                Text(lang.s("select_format")).tag("")
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
            .tint(Color.spentyPrimary)
        } header: {
            Label("Date Format", systemImage: "calendar")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.spentyPrimary)
                .textCase(nil)
        } footer: {
            Text(lang.s("date_format_info"))
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var datePickerLabel: some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.clock")
                .foregroundStyle(Color.spentyPrimary)
                .frame(width: 24)
            Text(lang.s("date_format"))
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
                    .tint(Color.spentyPrimary)
            } else {
                Text(lang.s("save"))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.spentyPrimary)
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
