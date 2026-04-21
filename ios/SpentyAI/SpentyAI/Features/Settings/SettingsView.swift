import SwiftUI
import PhotosUI

struct SettingsView: View {

    // MARK: - State

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
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .task {
            if !hasInitialized {
                viewModel = SettingsViewModel(authManager: authManager)
                hasInitialized = true
            }
            await viewModel.loadSettings()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK") { viewModel.dismissError() }
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
            Text("This action is permanent. All your data will be erased and cannot be recovered.")
        }
        // Step 1: Reset Data warning — explains what will happen
        .alert("Reset All Data?", isPresented: $viewModel.showResetWarning) {
            Button("I Understand, Continue", role: .destructive) {
                viewModel.showResetConfirmInput = true
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will erase all your transactions, accounts, invoices, bills, customers, vendors, receipts, and reports.\n\nYour account and settings will stay — but everything else goes back to zero, as if you just signed up.\n\nThis cannot be undone.")
        }
        // Step 2: Type RESET to confirm
        .alert("Type RESET to Confirm", isPresented: $viewModel.showResetConfirmInput) {
            TextField("Type RESET", text: $viewModel.resetConfirmText)
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
            Text("To make sure this isn't an accident, type RESET in the box above.")
        }
        // Success confirmation
        .alert("Data Reset Complete", isPresented: $viewModel.showResetSuccess) {
            Button("OK") {
                viewModel.showResetSuccess = false
                Task { await viewModel.loadSettings() }
            }
        } message: {
            Text("All your data has been cleared. Default accounts and categories have been set up for you — you're starting fresh!")
        }
    }

    // MARK: - Settings Form

    private var settingsForm: some View {
        Form {
            businessProfileSection
            currencyLocaleSection
            invoiceCustomizationSection
            accountSection
        }
        .scrollContentBackground(.hidden)
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
                        Text("Business Profile")
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
                        Text("Currency & Locale")
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
                Text("Upload Logo")
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
                Text("Upload Signature")
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

    // MARK: - Account Section

    private var accountSection: some View {
        Section {
            Button {
                Task { await authManager.logout() }
            } label: {
                HStack(spacing: 14) {
                    sectionIcon("rectangle.portrait.and.arrow.right", color: .spentyWarning)

                    Text("Sign Out")
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
                        Text("Reset Data")
                            .font(SpentyFonts.body)
                            .foregroundColor(.orange)
                        Text("Start fresh — removes all your data")
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

                    Text("Delete Account")
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
            Text("Reset Data wipes your transactions and records but keeps your account. Delete Account removes everything permanently.")
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
