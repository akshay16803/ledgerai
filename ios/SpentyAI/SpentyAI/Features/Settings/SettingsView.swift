import SwiftUI
import PhotosUI

struct SettingsView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @Environment(AuthManager.self) private var authManager
    @State private var viewModel = SettingsViewModel(authManager: AuthManager())
    @State private var hasInitialized = false

    // Photo pickers
    @State private var logoPickerItem: PhotosPickerItem?
    @State private var signaturePickerItem: PhotosPickerItem?

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.settings.firmName == nil {
                LoadingView(message: "Loading settings...")
            } else {
                settingsForm
            }
        }
        .trackScreen("Settings")
        .navigationTitle(lang.s("settings"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            if !hasInitialized {
                viewModel = SettingsViewModel(authManager: authManager)
                hasInitialized = true
            }
            await viewModel.loadSettings()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button(lang.s("ok")) { viewModel.dismissError() }
        } message: {
            Text(viewModel.errorMessage)
        }
        .confirmationDialog(
            "Delete Account",
            isPresented: $viewModel.showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete My Account", role: .destructive) {
                Task { await viewModel.deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(lang.s("reset_warning"))
        }
        // Step 1: Reset Data warning — explains what will happen
        .alert(lang.s("reset_all_data"), isPresented: $viewModel.showResetWarning) {
            Button("I Understand, Continue", role: .destructive) {
                viewModel.showResetConfirmInput = true
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will erase all your transactions, accounts, invoices, bills, customers, vendors, receipts, and reports.\n\nAny connected email accounts (Gmail, Outlook) will be disconnected and all synced data removed.\n\nYour account and settings will stay — but everything else goes back to zero, as if you just signed up.\n\nThis cannot be undone.")
        }
        // Step 2: Type RESET to confirm
        .alert(lang.s("type_reset_confirm"), isPresented: $viewModel.showResetConfirmInput) {
            TextField(lang.s("type_reset"), text: $viewModel.resetConfirmText)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
            Button("Reset My Data", role: .destructive) {
                Task { await viewModel.resetData() }
            }
            .disabled(viewModel.resetConfirmText != "RESET")
            Button("Cancel", role: .cancel) {
                viewModel.resetConfirmText = ""
            }
        } message: {
            Text(lang.s("type_reset_instruction"))
        }
        // Success confirmation
        .alert(lang.s("data_reset_complete"), isPresented: $viewModel.showResetSuccess) {
            Button(lang.s("ok")) {
                viewModel.showResetSuccess = false
                Task { await viewModel.loadSettings() }
            }
        } message: {
            Text(lang.s("data_cleared"))
        }
    }

    // MARK: - Settings Form

    private var settingsForm: some View {
        Form {
            businessProfileSection
            currencyLocaleSection
            invoiceCustomizationSection
            webAppSection
            privacySection
            legalSupportSection
            accountSection
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - Web App Section

    /// Promotes the companion web app at spentyai.com. Many SpentyAI users
    /// keep the iPhone app for capture-on-the-go and prefer the larger
    /// desktop UI for reconciliation, multi-line invoice editing, and bulk
    /// imports. Surfacing the link here means they don't have to discover
    /// it via the marketing site. Slots between Invoice Customization and
    /// Privacy so the existing "do more with SpentyAI" sections stay
    /// grouped together; never above Business Profile so first-run users
    /// still see the onboarding sections first.
    private var webAppSection: some View {
        Section {
            Button {
                if let url = URL(string: "https://www.spentyai.com") {
                    UIApplication.shared.open(url)
                }
            } label: {
                HStack(spacing: 14) {
                    sectionIcon("laptopcomputer", color: .spentyPrimary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Use SpentyAI on the web")
                            .font(SpentyFonts.body)
                            .foregroundStyle(.primary)
                        Text("Bigger screen for reconciliation, invoices and reports — same account, fully synced.")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.spentyTextSecondary)
                }
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
        } header: {
            Label("Also on the web", systemImage: "globe")
                .font(SpentyFonts.caption1)
                .fontWeight(.semibold)
                .foregroundColor(.spentyPrimary)
                .textCase(nil)
        } footer: {
            Text("Open www.spentyai.com in any browser and sign in with the same Google or Apple account.")
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary)
        }
    }

    // MARK: - Privacy Section

    /// Lets the user revoke the AI processing consent recorded by `AIConsentManager`.
    /// Required by Apple guideline 5.1.1(i): users must be able to withdraw consent
    /// to AI data processing at any time.
    private var privacySection: some View {
        Section {
            HStack(spacing: 14) {
                sectionIcon("sparkles", color: .spentyPrimary)

                VStack(alignment: .leading, spacing: 2) {
                    Text("AI processing consent")
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyTextPrimary)
                    Text(viewModel.aiConsentEnabled
                         ? "AI features may send your data to OpenAI."
                         : "AI features will not send any data until re-enabled.")
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                        .lineLimit(2)
                }

                Spacer()

                Toggle("", isOn: Binding(
                    get: { viewModel.aiConsentEnabled },
                    set: { newValue in
                        if newValue {
                            AIConsentManager.grant()
                        } else {
                            AIConsentManager.revoke()
                        }
                        viewModel.aiConsentEnabled = newValue
                    }
                ))
                .labelsHidden()
                .tint(.spentyPrimary)
            }
            .padding(.vertical, 4)
        } header: {
            Label("Privacy", systemImage: "lock.shield.fill")
                .font(SpentyFonts.caption1)
                .fontWeight(.semibold)
                .foregroundColor(.spentyPrimary)
                .textCase(nil)
        } footer: {
            Text("Turn this off to stop sending your data to our AI provider (OpenAI). You can turn it back on any time.")
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary)
        }
    }

    // MARK: - Business Profile Section

    private var businessProfileSection: some View {
        Section {
            NavigationLink {
                BusinessProfileView(viewModel: viewModel)
            } label: {
                HStack(spacing: 14) {
                    sectionIcon("building.2.fill", color: .spentyPrimary)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(lang.s("business_profile"))
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyTextPrimary)
                        Text(viewModel.settings.firmName ?? "Set up your business details")
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                            .lineLimit(1)
                    }
                }
                .padding(.vertical, 4)
            }
        } header: {
            Label("Business", systemImage: "briefcase.fill")
                .font(SpentyFonts.caption1)
                .fontWeight(.semibold)
                .foregroundColor(.spentyPrimary)
                .textCase(nil)
        }
    }

    // MARK: - Currency & Locale Section

    private var currencyLocaleSection: some View {
        Section {
            NavigationLink {
                CurrencySettingsView(viewModel: viewModel)
            } label: {
                HStack(spacing: 14) {
                    sectionIcon("coloncurrencysign.circle.fill", color: .spentyWarning)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(lang.s("currency_locale"))
                            .font(SpentyFonts.body)
                            .foregroundColor(.spentyTextPrimary)
                        Text(currencySubtitle)
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                            .lineLimit(1)
                    }
                }
                .padding(.vertical, 4)
            }
        } header: {
            Label("Regional", systemImage: "globe")
                .font(SpentyFonts.caption1)
                .fontWeight(.semibold)
                .foregroundColor(.spentyPrimary)
                .textCase(nil)
        }
    }

    private var currencySubtitle: String {
        let parts = [viewModel.settings.baseCurrency, viewModel.settings.dateFormat].compactMap { $0 }
        return parts.isEmpty ? "Set currency and date format" : parts.joined(separator: " / ")
    }

    // MARK: - Invoice Customization Section

    private var invoiceCustomizationSection: some View {
        Section {
            // Logo upload
            VStack(alignment: .leading, spacing: 10) {
                Label("Business Logo", systemImage: "photo.badge.plus")
                    .font(SpentyFonts.subheadline)
                    .fontWeight(.medium)

                if let logoUrl = viewModel.settings.logoUrl, !logoUrl.isEmpty {
                    logoPreview(url: logoUrl)
                } else {
                    logoPlaceholder
                }
            }
            .padding(.vertical, 4)

            // Signature upload
            VStack(alignment: .leading, spacing: 10) {
                Label("Signature", systemImage: "signature")
                    .font(SpentyFonts.subheadline)
                    .fontWeight(.medium)

                if let sigUrl = viewModel.settings.signatureUrl, !sigUrl.isEmpty {
                    signaturePreview(url: sigUrl)
                } else {
                    signaturePlaceholder
                }
            }
            .padding(.vertical, 4)
        } header: {
            Label("Invoice Customization", systemImage: "doc.richtext")
                .font(SpentyFonts.caption1)
                .fontWeight(.semibold)
                .foregroundColor(.spentyPrimary)
                .textCase(nil)
        }
    }

    // MARK: - Logo Views

    private func logoPreview(url: String) -> some View {
        VStack(spacing: 8) {
            AsyncImage(url: URL(string: url)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 80)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                case .failure:
                    imageFallback(icon: "photo.fill")
                case .empty:
                    ProgressView()
                        .frame(height: 60)
                @unknown default:
                    EmptyView()
                }
            }

            HStack(spacing: 12) {
                PhotosPicker(selection: $logoPickerItem, matching: .images) {
                    Label("Replace", systemImage: "arrow.triangle.2.circlepath")
                        .font(SpentyFonts.caption1)
                        .fontWeight(.medium)
                }
                .tint(.spentyPrimary)

                Button(role: .destructive) {
                    Task { await viewModel.deleteLogo() }
                } label: {
                    Label("Remove", systemImage: "trash")
                        .font(SpentyFonts.caption1)
                        .fontWeight(.medium)
                }
                .disabled(viewModel.isDeletingLogo)

                if viewModel.isUploadingLogo || viewModel.isDeletingLogo {
                    ProgressView()
                        .controlSize(.small)
                }
            }
        }
        .onChange(of: logoPickerItem) { _, newItem in
            handleLogoPick(newItem)
        }
    }

    private var logoPlaceholder: some View {
        PhotosPicker(selection: $logoPickerItem, matching: .images) {
            HStack(spacing: 10) {
                Image(systemName: "plus.circle.fill")
                    .font(.title3)
                    .foregroundStyle(Color.spentyPrimary)
                Text(lang.s("upload_logo"))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyPrimary)

                if viewModel.isUploadingLogo {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Color.spentyPrimary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .onChange(of: logoPickerItem) { _, newItem in
            handleLogoPick(newItem)
        }
    }

    // MARK: - Signature Views

    private func signaturePreview(url: String) -> some View {
        VStack(spacing: 8) {
            AsyncImage(url: URL(string: url)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 60)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                case .failure:
                    imageFallback(icon: "signature")
                case .empty:
                    ProgressView()
                        .frame(height: 40)
                @unknown default:
                    EmptyView()
                }
            }

            HStack(spacing: 12) {
                PhotosPicker(selection: $signaturePickerItem, matching: .images) {
                    Label("Replace", systemImage: "arrow.triangle.2.circlepath")
                        .font(SpentyFonts.caption1)
                        .fontWeight(.medium)
                }
                .tint(.spentyPrimary)

                Button(role: .destructive) {
                    Task { await viewModel.deleteSignature() }
                } label: {
                    Label("Remove", systemImage: "trash")
                        .font(SpentyFonts.caption1)
                        .fontWeight(.medium)
                }
                .disabled(viewModel.isDeletingSignature)

                if viewModel.isUploadingSignature || viewModel.isDeletingSignature {
                    ProgressView()
                        .controlSize(.small)
                }
            }
        }
        .onChange(of: signaturePickerItem) { _, newItem in
            handleSignaturePick(newItem)
        }
    }

    private var signaturePlaceholder: some View {
        PhotosPicker(selection: $signaturePickerItem, matching: .images) {
            HStack(spacing: 10) {
                Image(systemName: "plus.circle.fill")
                    .font(.title3)
                    .foregroundStyle(Color.spentyPrimary)
                Text(lang.s("upload_signature"))
                    .font(SpentyFonts.subheadline)
                    .foregroundStyle(Color.spentyPrimary)

                if viewModel.isUploadingSignature {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Color.spentyPrimary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .onChange(of: signaturePickerItem) { _, newItem in
            handleSignaturePick(newItem)
        }
    }

    // MARK: - Legal & Support Section

    private var legalSupportSection: some View {
        Section {
            legalRow(
                icon: "info.circle.fill",
                color: .spentyPrimary,
                title: lang.s("about_spentyai"),
                subtitle: nil,
                url: "https://www.spentyai.com/"
            )

            legalRow(
                icon: "questionmark.circle.fill",
                color: .spentyPrimary,
                title: lang.s("help_center"),
                subtitle: nil,
                url: "https://www.spentyai.com/help"
            )

            legalRow(
                icon: "envelope.fill",
                color: .spentyPrimary,
                title: lang.s("contact_support"),
                subtitle: "support@spentyai.com",
                url: "mailto:support@spentyai.com"
            )

            legalRow(
                icon: "hand.raised.fill",
                color: .spentyPrimary,
                title: lang.s("privacy_policy"),
                subtitle: nil,
                url: "https://www.spentyai.com/privacy.html"
            )

            legalRow(
                icon: "doc.text.fill",
                color: .spentyPrimary,
                title: lang.s("terms_of_service"),
                subtitle: nil,
                url: "https://www.spentyai.com/terms.html"
            )

            legalRow(
                icon: "arrow.uturn.backward.circle.fill",
                color: .spentyPrimary,
                title: lang.s("refund_policy"),
                subtitle: nil,
                url: "https://www.spentyai.com/refund-policy"
            )

            HStack(spacing: 14) {
                sectionIcon("number.circle.fill", color: .spentyTextSecondary)
                Text(lang.s("app_version"))
                    .font(SpentyFonts.body)
                    .foregroundColor(.spentyTextPrimary)
                Spacer()
                Text(appVersionString)
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }
            .padding(.vertical, 4)
        } header: {
            Label(lang.s("legal_support"), systemImage: "shield.lefthalf.filled")
                .font(SpentyFonts.caption1)
                .fontWeight(.semibold)
                .foregroundColor(.spentyPrimary)
                .textCase(nil)
        }
    }

    private func legalRow(icon: String, color: Color, title: String, subtitle: String?, url: String) -> some View {
        Button {
            if let link = URL(string: url) {
                UIApplication.shared.open(link)
            }
        } label: {
            HStack(spacing: 14) {
                sectionIcon(icon, color: color)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyTextPrimary)
                    if let subtitle {
                        Text(subtitle)
                            .font(SpentyFonts.caption1)
                            .foregroundColor(.spentyTextSecondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                Image(systemName: "arrow.up.right.square")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    private var appVersionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    // MARK: - Account Section

    private var accountSection: some View {
        Section {
            Button {
                Task { await authManager.logout() }
            } label: {
                HStack(spacing: 14) {
                    sectionIcon("rectangle.portrait.and.arrow.right", color: .spentyWarning)

                    Text(lang.s("sign_out"))
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyTextPrimary)
                }
                .padding(.vertical, 4)
            }

            // Reset Data — escalating severity between Sign Out and Delete
            Button(role: .destructive) {
                viewModel.showResetWarning = true
            } label: {
                HStack(spacing: 14) {
                    sectionIcon("arrow.counterclockwise.circle.fill", color: .orange)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(lang.s("reset_data"))
                            .font(SpentyFonts.body)
                            .foregroundColor(.orange)
                        Text(lang.s("reset_data_subtitle"))
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary)
                    }
                }
                .padding(.vertical, 4)
            }
            .disabled(viewModel.isResetting)

            Button(role: .destructive) {
                viewModel.showDeleteConfirm = true
            } label: {
                HStack(spacing: 14) {
                    sectionIcon("person.crop.circle.badge.xmark", color: .spentyError)

                    Text(lang.s("delete_account"))
                        .font(SpentyFonts.body)
                        .foregroundColor(.spentyError)
                }
                .padding(.vertical, 4)
            }
        } header: {
            Label("Account", systemImage: "person.circle")
                .font(SpentyFonts.caption1)
                .fontWeight(.semibold)
                .foregroundColor(.spentyPrimary)
                .textCase(nil)
        } footer: {
            Text(lang.s("reset_vs_delete"))
                .font(SpentyFonts.caption2)
                .foregroundColor(.spentyTextSecondary)
        }
    }

    // MARK: - Helper Views

    private func sectionIcon(_ systemName: String, color: Color) -> some View {
        Image(systemName: systemName)
            .font(SpentyFonts.body)
            .foregroundStyle(.white)
            .frame(width: 32, height: 32)
            .background(color, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
    }

    private func imageFallback(icon: String) -> some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(Color.gray.opacity(0.12))
            .frame(height: 60)
            .overlay {
                Image(systemName: icon)
                    .foregroundColor(.spentyTextSecondary)
            }
    }

    // MARK: - Photo Handling

    private func handleLogoPick(_ item: PhotosPickerItem?) {
        guard let item else { return }
        Task {
            if let data = try? await item.loadTransferable(type: Data.self) {
                await viewModel.uploadLogo(imageData: data)
            }
            logoPickerItem = nil
        }
    }

    private func handleSignaturePick(_ item: PhotosPickerItem?) {
        guard let item else { return }
        Task {
            if let data = try? await item.loadTransferable(type: Data.self) {
                await viewModel.uploadSignature(imageData: data)
            }
            signaturePickerItem = nil
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        SettingsView()
    }
    .environment(AuthManager())
}
