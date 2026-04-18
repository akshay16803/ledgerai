import SwiftUI

struct SettingsView: View {

    @State private var viewModel = SettingsViewModel()
    @Environment(AppState.self) private var appState

    // MARK: - Constants

    private static let currencies = [
        "INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD", "JPY",
        "KRW", "CNY", "HKD", "MYR", "NZD", "ZAR", "BRL", "MXN", "CHF",
        "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "THB", "IDR",
        "PHP", "VND", "TWD", "BDT", "PKR", "LKR", "NPR", "NGN", "KES",
        "EGP", "ARS", "CLP", "COP", "PEN", "RON", "RUB", "ILS", "SAR",
        "QAR", "KWD", "BHD", "OMR"
    ]

    private static let dateFormats = [
        "dd/MM/yyyy",
        "MM/dd/yyyy",
        "yyyy-MM-dd",
        "dd-MMM-yyyy",
        "MMM dd, yyyy"
    ]

    private static let indianStates = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
        "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
        "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
        "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
        "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
        "Jammu & Kashmir", "Ladakh", "Puducherry", "Chandigarh",
        "Dadra & Nagar Haveli and Daman & Diu", "Lakshadweep",
        "Andaman & Nicobar Islands"
    ]

    private var sortedCountries: [(code: String, name: String)] {
        CountryConfig.all.values
            .sorted { $0.name < $1.name }
            .map { (code: $0.code, name: $0.name) }
    }

    var body: some View {
        ZStack {
            SpentyColors.bgPrimary.ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .controlSize(.large)
            } else {
                settingsForm
            }

            // Saved banner
            if viewModel.showSaved {
                VStack {
                    savedBanner
                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .animation(.easeInOut(duration: 0.3), value: viewModel.showSaved)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadSettings()
        }
    }

    // MARK: - Settings Form

    private var settingsForm: some View {
        ScrollView {
            VStack(spacing: SpentySpacing.xl) {
                // Error message
                if let error = viewModel.errorMessage {
                    errorBanner(error)
                }

                // Setup mode warning
                if let mode = viewModel.setupMode, !viewModel.requiredFieldsMissing.isEmpty {
                    setupWarning(mode: mode)
                }

                generalSection
                businessProfileSection
                invoiceSettingsSection
                billSettingsSection

                // Save button
                PrimaryButton(
                    "Save Settings",
                    icon: "checkmark",
                    isLoading: viewModel.isSaving,
                    isFullWidth: true
                ) {
                    Task { await viewModel.saveSettings() }
                }
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.bottom, SpentySpacing.xxl)
            }
            .padding(.top, SpentySpacing.md)
        }
    }

    // MARK: - General Section

    private var generalSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("General")
                .padding(.horizontal, SpentySpacing.lg)

            SpentyCard {
                VStack(spacing: SpentySpacing.lg) {
                    // Base Currency
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("Base Currency")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker("Currency", selection: $viewModel.baseCurrency) {
                            Text("Select Currency").tag("")
                            ForEach(Self.currencies, id: \.self) { code in
                                Text("\(code) - \(CurrencyFormatter.symbol(for: code))")
                                    .tag(code)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(SpentyColors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Divider()

                    // Date Format
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("Date Format")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker("Date Format", selection: $viewModel.dateFormat) {
                            Text("Select Format").tag("")
                            ForEach(Self.dateFormats, id: \.self) { format in
                                Text(format).tag(format)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(SpentyColors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Divider()

                    // Business Country
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("Business Country")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        Picker("Country", selection: $viewModel.businessCountry) {
                            Text("Select Country").tag("")
                            ForEach(sortedCountries, id: \.code) { country in
                                Text("\(flag(for: country.code)) \(country.name)")
                                    .tag(country.code)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(SpentyColors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
        }
    }

    // MARK: - Business Profile Section

    private var businessProfileSection: some View {
        let isSetupHighlighted = viewModel.setupMode == "invoice" || viewModel.setupMode == "gst"

        return VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Business Profile")
                .padding(.horizontal, SpentySpacing.lg)

            SpentyCard {
                VStack(spacing: SpentySpacing.lg) {
                    FormField(
                        "Firm Name",
                        text: $viewModel.firmName,
                        placeholder: "Your business name",
                        isRequired: viewModel.setupMode != nil,
                        errorMessage: isSetupHighlighted && viewModel.firmName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? "Required for setup"
                            : nil
                    )

                    FormField(
                        "Address",
                        text: $viewModel.firmAddress,
                        placeholder: "Street address"
                    )

                    FormField(
                        "City",
                        text: $viewModel.firmCity,
                        placeholder: "City"
                    )

                    // State - picker for India, text field otherwise
                    if viewModel.isIndianBusiness {
                        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                            Text("State")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)

                            Picker("State", selection: $viewModel.firmState) {
                                Text("Select State").tag("")
                                ForEach(Self.indianStates, id: \.self) { state in
                                    Text(state).tag(state)
                                }
                            }
                            .pickerStyle(.menu)
                            .tint(SpentyColors.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    } else {
                        FormField(
                            "State / Province",
                            text: $viewModel.firmState,
                            placeholder: "State or province"
                        )
                    }

                    FormField(
                        "Pincode / ZIP",
                        text: $viewModel.firmPincode,
                        placeholder: "Postal code",
                        keyboardType: .numberPad
                    )

                    if viewModel.isIndianBusiness {
                        FormField(
                            "GSTIN",
                            text: $viewModel.firmGstin,
                            placeholder: "22AAAAA0000A1Z5"
                        )

                        FormField(
                            "PAN",
                            text: $viewModel.firmPan,
                            placeholder: "AAAAA0000A"
                        )
                    }

                    FormField(
                        "Phone",
                        text: $viewModel.firmPhone,
                        placeholder: "Business phone",
                        keyboardType: .phonePad
                    )

                    FormField(
                        "Email",
                        text: $viewModel.firmEmail,
                        placeholder: "business@example.com",
                        keyboardType: .emailAddress
                    )
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .overlay(
                isSetupHighlighted
                    ? RoundedRectangle(cornerRadius: SpentyRadius.card)
                        .stroke(SpentyColors.warning, lineWidth: 2)
                        .padding(.horizontal, SpentySpacing.lg)
                    : nil
            )
        }
    }

    // MARK: - Invoice Settings Section

    private var invoiceSettingsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Invoice Settings")
                .padding(.horizontal, SpentySpacing.lg)

            SpentyCard {
                VStack(spacing: SpentySpacing.lg) {
                    FormField(
                        "Bank Name",
                        text: $viewModel.invoiceBankName,
                        placeholder: "Bank name"
                    )

                    FormField(
                        "Account Number",
                        text: $viewModel.invoiceBankAccountNo,
                        placeholder: "Account number",
                        keyboardType: .numberPad
                    )

                    if viewModel.isIndianBusiness {
                        FormField(
                            "IFSC Code",
                            text: $viewModel.invoiceBankIfsc,
                            placeholder: "IFSC code"
                        )
                    }

                    FormField(
                        "Branch",
                        text: $viewModel.invoiceBankBranch,
                        placeholder: "Branch name"
                    )

                    FormField(
                        "Invoice Prefix",
                        text: $viewModel.invoicePrefix,
                        placeholder: "INV-"
                    )

                    // Invoice Terms (multiline)
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("Invoice Terms")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        TextEditor(text: $viewModel.invoiceTerms)
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textPrimary)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 80)
                            .padding(SpentySpacing.sm)
                            .background(SpentyColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: SpentyRadius.md)
                                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                            )
                    }
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
        }
    }

    // MARK: - Bill Settings Section

    private var billSettingsSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            SectionHeader("Bill Settings")
                .padding(.horizontal, SpentySpacing.lg)

            SpentyCard {
                VStack(spacing: SpentySpacing.lg) {
                    FormField(
                        "Bill Prefix",
                        text: $viewModel.billPrefix,
                        placeholder: "BILL-"
                    )

                    // Bill Terms (multiline)
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("Bill Terms")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)

                        TextEditor(text: $viewModel.billTerms)
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textPrimary)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 80)
                            .padding(SpentySpacing.sm)
                            .background(SpentyColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: SpentyRadius.md)
                                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                            )
                    }
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
        }
    }

    // MARK: - Banners

    private var savedBanner: some View {
        HStack(spacing: SpentySpacing.sm) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(SpentyColors.success)
            Text("Saved!")
                .font(SpentyFonts.subheading)
                .foregroundStyle(SpentyColors.success)
        }
        .padding(.horizontal, SpentySpacing.xl)
        .padding(.vertical, SpentySpacing.md)
        .background(SpentyColors.success.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        .padding(.top, SpentySpacing.sm)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: SpentySpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(SpentyColors.danger)
            Text(message)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.danger)
        }
        .padding(SpentySpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SpentyColors.danger.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        .padding(.horizontal, SpentySpacing.lg)
    }

    private func setupWarning(mode: String) -> some View {
        HStack(spacing: SpentySpacing.sm) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(SpentyColors.warning)
            Text("Complete the highlighted fields to continue with \(mode) setup.")
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
        }
        .padding(SpentySpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SpentyColors.warning.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        .padding(.horizontal, SpentySpacing.lg)
    }

    // MARK: - Helpers

    private func flag(for countryCode: String) -> String {
        let base: UInt32 = 127397
        return String(countryCode.uppercased().unicodeScalars.compactMap {
            UnicodeScalar(base + $0.value)
        }.map { Character($0) })
    }
}

#Preview {
    NavigationStack {
        SettingsView()
            .environment(AppState())
    }
}
