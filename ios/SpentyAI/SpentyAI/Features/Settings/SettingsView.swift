import SwiftUI
import PhotosUI

struct SettingsView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

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
            Brand.background
                .ignoresSafeArea()

            if viewModel.isLoading && viewModel.settings.firmName == nil {
                ProgressView("Loading settings...")
                    .tint(Brand.primary)
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
                    sectionIcon("building.2.fill", color: Brand.primary)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Business Profile")
                            .font(.body.weight(.medium))
                            .foregroundStyle(.primary)
                        Text(viewModel.settings.firmName ?? "Set up your business details")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .padding(.vertical, 4)
            }
        } header: {
            Label("Business", systemImage: "briefcase.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
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
                    sectionIcon("coloncurrencysign.circle.fill", color: .orange)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Currency & Locale")
                            .font(.body.weight(.medium))
                            .foregroundStyle(.primary)
                        Text(currencySubtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .padding(.vertical, 4)
            }
        } header: {
            Label("Regional", systemImage: "globe")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
                .textCase(nil)
        }
    }

    private var currencySubtitle: String {
        let parts = [viewModel.settings.defaultCurrency, viewModel.settings.dateFormat].compactMap { $0 }
        return parts.isEmpty ? "Set currency and date format" : parts.joined(separator: " / ")
    }

    // MARK: - Invoice Customization Section

    private var invoiceCustomizationSection: some View {
        Section {
            // Logo upload
            VStack(alignment: .leading, spacing: 10) {
                Label("Business Logo", systemImage: "photo.badge.plus")
                    .font(.subheadline.weight(.medium))

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
                    .font(.subheadline.weight(.medium))

                if let sigUrl = viewModel.settings.signatureUrl, !sigUrl.isEmpty {
                    signaturePreview(url: sigUrl)
                } else {
                    signaturePlaceholder
                }
            }
            .padding(.vertical, 4)
        } header: {
            Label("Invoice Customization", systemImage: "doc.richtext")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
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
                        .font(.caption.weight(.medium))
                }
                .tint(Brand.primary)

                Button(role: .destructive) {
                    Task { await viewModel.deleteLogo() }
                } label: {
                    Label("Remove", systemImage: "trash")
                        .font(.caption.weight(.medium))
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
                    .foregroundStyle(Brand.primary)
                Text("Upload Logo")
                    .font(.subheadline)
                    .foregroundStyle(Brand.primary)

                if viewModel.isUploadingLogo {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Brand.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
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
                        .font(.caption.weight(.medium))
                }
                .tint(Brand.primary)

                Button(role: .destructive) {
                    Task { await viewModel.deleteSignature() }
                } label: {
                    Label("Remove", systemImage: "trash")
                        .font(.caption.weight(.medium))
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
                    .foregroundStyle(Brand.primary)
                Text("Upload Signature")
                    .font(.subheadline)
                    .foregroundStyle(Brand.primary)

                if viewModel.isUploadingSignature {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Brand.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .onChange(of: signaturePickerItem) { _, newItem in
            handleSignaturePick(newItem)
        }
    }

    // MARK: - Account Section

    private var accountSection: some View {
        Section {
            Button(role: .destructive) {
                viewModel.showDeleteConfirm = true
            } label: {
                HStack(spacing: 14) {
                    sectionIcon("person.crop.circle.badge.xmark", color: .red)

                    Text("Delete Account")
                        .font(.body.weight(.medium))
                        .foregroundStyle(.red)
                }
                .padding(.vertical, 4)
            }
        } header: {
            Label("Account", systemImage: "person.circle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.primary)
                .textCase(nil)
        } footer: {
            Text("Permanently deletes your account and all associated data.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Helper Views

    private func sectionIcon(_ systemName: String, color: Color) -> some View {
        Image(systemName: systemName)
            .font(.body)
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
                    .foregroundStyle(.secondary)
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
