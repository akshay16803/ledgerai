import SwiftUI

struct BusinessProfileView: View {

    // MARK: - Indian States

    private static let indianStates = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
        "Chhattisgarh", "Goa", "Gujarat", "Haryana",
        "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
        "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
        "Mizoram", "Nagaland", "Odisha", "Punjab",
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
        "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
        "Andaman and Nicobar Islands", "Chandigarh",
        "Dadra and Nagar Haveli and Daman and Diu",
        "Delhi", "Jammu and Kashmir", "Ladakh",
        "Lakshadweep", "Puducherry"
    ]

    private static let countries = [
        "India", "United States", "United Kingdom", "Canada",
        "Australia", "Germany", "France", "Singapore",
        "United Arab Emirates", "Japan", "Other"
    ]

    /// Maps ISO country codes to the display names used in the picker.
    private static let countryCodeToName: [String: String] = [
        "IN": "India",
        "US": "United States",
        "GB": "United Kingdom",
        "CA": "Canada",
        "AU": "Australia",
        "DE": "Germany",
        "FR": "France",
        "SG": "Singapore",
        "AE": "United Arab Emirates",
        "JP": "Japan"
    ]

    // MARK: - State

    @Bindable var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case firmName, gstin, pan, address
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary
                .ignoresSafeArea()

            Form {
                firmDetailsSection
                taxSection
                locationSection
            }
            .scrollContentBackground(.hidden)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { focusedField = nil }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    saveButton
                }
            }
        }
        .navigationTitle("Business Profile")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Saved", isPresented: $viewModel.showSaveSuccess) {
            Button("OK") { dismiss() }
        } message: {
            Text("Your business profile has been updated.")
        }
    }

    // MARK: - Firm Details

    private var firmDetailsSection: some View {
        Section {
            HStack(spacing: 12) {
                Image(systemName: "building.2")
                    .foregroundStyle(Color.spentyPrimary)
                    .frame(width: 24)
                TextField("Firm Name", text: binding(\.firmName))
                    .focused($focusedField, equals: .firmName)
                    .textContentType(.organizationName)
                    .autocorrectionDisabled()
            }
        } header: {
            Text("Firm Details")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.spentyPrimary)
                .textCase(nil)
        }
    }

    // MARK: - Tax Identifiers

    private var taxSection: some View {
        Section {
            HStack(spacing: 12) {
                Image(systemName: "number")
                    .foregroundStyle(Color.spentyPrimary)
                    .frame(width: 24)
                TextField("GSTIN", text: binding(\.firmGstin))
                    .focused($focusedField, equals: .gstin)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }

            HStack(spacing: 12) {
                Image(systemName: "creditcard")
                    .foregroundStyle(Color.spentyPrimary)
                    .frame(width: 24)
                TextField("PAN", text: binding(\.firmPan))
                    .focused($focusedField, equals: .pan)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }
        } header: {
            Text("Tax Identifiers")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.spentyPrimary)
                .textCase(nil)
        }
    }

    // MARK: - Location

    private var locationSection: some View {
        Section {
            // State Picker
            HStack(spacing: 12) {
                Image(systemName: "map")
                    .foregroundStyle(Color.spentyPrimary)
                    .frame(width: 24)

                Picker("State", selection: binding(\.firmState)) {
                    Text("Select State").tag("")
                    ForEach(Self.indianStates, id: \.self) { state in
                        Text(state).tag(state)
                    }
                }
                .tint(Color.spentyPrimary)
            }

            // Country Picker
            HStack(spacing: 12) {
                Image(systemName: "globe")
                    .foregroundStyle(Color.spentyPrimary)
                    .frame(width: 24)

                Picker("Country", selection: countryBinding) {
                    Text("Select Country").tag("")
                    ForEach(Self.countries, id: \.self) { country in
                        Text(country).tag(country)
                    }
                }
                .tint(Color.spentyPrimary)
            }

            // Address
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "location")
                    .foregroundStyle(Color.spentyPrimary)
                    .frame(width: 24)
                    .padding(.top, 8)

                TextField("Business Address", text: binding(\.firmAddress), axis: .vertical)
                    .focused($focusedField, equals: .address)
                    .lineLimit(3...6)
                    .textContentType(.fullStreetAddress)
            }
        } header: {
            Text("Location")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.spentyPrimary)
                .textCase(nil)
        }
    }

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            focusedField = nil
            Task { await viewModel.saveSettings() }
        } label: {
            if viewModel.isSaving {
                ProgressView()
                    .controlSize(.small)
                    .tint(Color.spentyPrimary)
            } else {
                Text("Save")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.spentyPrimary)
            }
        }
        .disabled(viewModel.isSaving)
    }

    // MARK: - Binding Helper

    /// Converts an optional String keypath on AppSettings into a non-optional Binding.
    private func binding(_ keyPath: WritableKeyPath<AppSettings, String?>) -> Binding<String> {
        Binding(
            get: { viewModel.settings[keyPath: keyPath] ?? "" },
            set: { viewModel.settings[keyPath: keyPath] = $0.isEmpty ? nil : $0 }
        )
    }

    /// Country binding that normalizes ISO codes (e.g. "IN") to display names (e.g. "India").
    private var countryBinding: Binding<String> {
        Binding(
            get: {
                let stored = viewModel.settings.businessCountry ?? ""
                // If stored value is an ISO code, map it to the display name
                if let mapped = Self.countryCodeToName[stored.uppercased()] {
                    return mapped
                }
                return stored
            },
            set: { viewModel.settings.businessCountry = $0.isEmpty ? nil : $0 }
        )
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        BusinessProfileView(viewModel: SettingsViewModel(authManager: AuthManager()))
    }
}
