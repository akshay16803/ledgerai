import SwiftUI

struct BusinessProfileView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

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
            Brand.background
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
                    .foregroundStyle(Brand.primary)
                    .frame(width: 24)
                TextField("Firm Name", text: binding(\.firmName))
                    .focused($focusedField, equals: .firmName)
                    .textContentType(.organizationName)
                    .autocorrectionDisabled()
            }
        } header: {
            Text("Firm Details")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
                .textCase(nil)
        }
    }

    // MARK: - Tax Identifiers

    private var taxSection: some View {
        Section {
            HStack(spacing: 12) {
                Image(systemName: "number")
                    .foregroundStyle(Brand.primary)
                    .frame(width: 24)
                TextField("GSTIN", text: binding(\.gstin))
                    .focused($focusedField, equals: .gstin)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }

            HStack(spacing: 12) {
                Image(systemName: "creditcard")
                    .foregroundStyle(Brand.primary)
                    .frame(width: 24)
                TextField("PAN", text: binding(\.pan))
                    .focused($focusedField, equals: .pan)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }
        } header: {
            Text("Tax Identifiers")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
                .textCase(nil)
        }
    }

    // MARK: - Location

    private var locationSection: some View {
        Section {
            // State Picker
            HStack(spacing: 12) {
                Image(systemName: "map")
                    .foregroundStyle(Brand.primary)
                    .frame(width: 24)

                Picker("State", selection: binding(\.state)) {
                    Text("Select State").tag("")
                    ForEach(Self.indianStates, id: \.self) { state in
                        Text(state).tag(state)
                    }
                }
                .tint(Brand.primary)
            }

            // Country Picker
            HStack(spacing: 12) {
                Image(systemName: "globe")
                    .foregroundStyle(Brand.primary)
                    .frame(width: 24)

                Picker("Country", selection: binding(\.businessCountry)) {
                    Text("Select Country").tag("")
                    ForEach(Self.countries, id: \.self) { country in
                        Text(country).tag(country)
                    }
                }
                .tint(Brand.primary)
            }

            // Address
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "location")
                    .foregroundStyle(Brand.primary)
                    .frame(width: 24)
                    .padding(.top, 8)

                TextField("Business Address", text: binding(\.address), axis: .vertical)
                    .focused($focusedField, equals: .address)
                    .lineLimit(3...6)
                    .textContentType(.fullStreetAddress)
            }
        } header: {
            Text("Location")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
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
                    .tint(Brand.primary)
            } else {
                Text("Save")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Brand.primary)
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
}

// MARK: - Preview

#Preview {
    NavigationStack {
        BusinessProfileView(viewModel: SettingsViewModel(authManager: AuthManager()))
    }
}
