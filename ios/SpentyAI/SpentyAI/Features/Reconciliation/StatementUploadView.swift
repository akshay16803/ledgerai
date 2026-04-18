import SwiftUI
import UniformTypeIdentifiers

struct StatementUploadView: View {

    @Bindable var viewModel: ReconciliationViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var showFilePicker = false
    @State private var selectedFileData: Data?
    @State private var selectedFileName: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        subTypePicker
                        accountPicker
                        periodSection
                        filePicker
                        uploadButton
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Upload Statement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.spentyPrimary)
                }
            }
            .fileImporter(
                isPresented: $showFilePicker,
                allowedContentTypes: [.pdf, .commaSeparatedText],
                allowsMultipleSelection: false
            ) { result in
                handleFileSelection(result)
            }
            .overlay {
                if let error = viewModel.errorMessage {
                    ErrorBanner(message: error) {
                        viewModel.errorMessage = nil
                    }
                }
            }
        }
    }

    // MARK: - Sub-Type Picker

    private var subTypePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Account Sub-Type")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)

            Menu {
                Button("All Types") {
                    viewModel.selectedSubType = ""
                    viewModel.selectedAccountId = ""
                }
                ForEach(viewModel.accountSubTypes) { subType in
                    Button(subType.name ?? "Unnamed") {
                        viewModel.selectedSubType = subType.name ?? ""
                        viewModel.selectedAccountId = ""
                    }
                }
            } label: {
                HStack {
                    Text(viewModel.selectedSubType.isEmpty ? "Select sub-type" : viewModel.selectedSubType)
                        .foregroundColor(viewModel.selectedSubType.isEmpty ? .spentyTextSecondary : .spentyTextPrimary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyTextSecondary)
                }
                .font(SpentyFonts.body)
                .padding(12)
                .background(Color.spentyCardBg)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.spentyBorder, lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Account Picker

    private var accountPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Account")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)

            Menu {
                ForEach(viewModel.filteredAccounts) { account in
                    Button(account.name ?? "Unnamed") {
                        viewModel.selectedAccountId = account.id
                    }
                }
            } label: {
                HStack {
                    Text(selectedAccountLabel)
                        .foregroundColor(viewModel.selectedAccountId.isEmpty ? .spentyTextSecondary : .spentyTextPrimary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyTextSecondary)
                }
                .font(SpentyFonts.body)
                .padding(12)
                .background(Color.spentyCardBg)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.spentyBorder, lineWidth: 1)
                )
            }
        }
    }

    private var selectedAccountLabel: String {
        if viewModel.selectedAccountId.isEmpty { return "Select account" }
        return viewModel.accountName(for: viewModel.selectedAccountId)
    }

    // MARK: - Period Section

    private var periodSection: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Period From")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)

                DatePicker(
                    "Period From",
                    selection: $viewModel.periodFrom,
                    displayedComponents: .date
                )
                .labelsHidden()
                .tint(Color.spentyPrimary)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Period To")
                    .font(SpentyFonts.caption1)
                    .foregroundColor(.spentyTextSecondary)

                DatePicker(
                    "Period To",
                    selection: $viewModel.periodTo,
                    displayedComponents: .date
                )
                .labelsHidden()
                .tint(Color.spentyPrimary)
            }
        }
    }

    // MARK: - File Picker

    private var filePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Statement File")
                .font(SpentyFonts.caption1)
                .foregroundColor(.spentyTextSecondary)

            Button {
                showFilePicker = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: selectedFileName != nil ? "doc.fill" : "doc.badge.plus")
                        .font(.system(size: 24))
                        .foregroundColor(.spentyPrimary)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedFileName ?? "Choose PDF or CSV")
                            .font(SpentyFonts.subheadline)
                            .foregroundColor(selectedFileName != nil ? .spentyTextPrimary : .spentyTextSecondary)

                        Text("Supported: PDF, CSV")
                            .font(SpentyFonts.caption2)
                            .foregroundColor(.spentyTextSecondary.opacity(0.7))
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                        .foregroundColor(.spentyTextSecondary)
                }
                .padding(16)
                .background(Color.spentyCardBg)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            selectedFileName != nil ? Color.spentyPrimary.opacity(0.3) : Color.spentyBorder,
                            lineWidth: 1
                        )
                )
            }
        }
    }

    // MARK: - Upload Button

    private var uploadButton: some View {
        Button {
            guard let data = selectedFileData, let name = selectedFileName else {
                viewModel.errorMessage = "Please select a file."
                return
            }
            Task {
                await viewModel.uploadStatement(fileData: data, filename: name)
            }
        } label: {
            HStack(spacing: 8) {
                if viewModel.isUploading {
                    ProgressView()
                        .tint(.white)
                }
                Text(viewModel.isUploading ? "Uploading..." : "Upload Statement")
            }
            .primaryButtonStyle()
        }
        .disabled(viewModel.isUploading || selectedFileData == nil || viewModel.selectedAccountId.isEmpty)
        .opacity(canUpload ? 1 : 0.6)
        .padding(.top, 8)
    }

    private var canUpload: Bool {
        !viewModel.isUploading && selectedFileData != nil && !viewModel.selectedAccountId.isEmpty
    }

    // MARK: - File Handling

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else {
                viewModel.errorMessage = "Could not access the selected file."
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            do {
                selectedFileData = try Data(contentsOf: url)
                selectedFileName = url.lastPathComponent
            } catch {
                viewModel.errorMessage = "Failed to read file: \(error.localizedDescription)"
            }

        case .failure(let error):
            viewModel.errorMessage = "File selection failed: \(error.localizedDescription)"
        }
    }
}

#Preview {
    StatementUploadView(viewModel: ReconciliationViewModel())
}
