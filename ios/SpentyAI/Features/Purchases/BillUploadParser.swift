import SwiftUI
import PhotosUI

struct BillUploadParser: View {
    @State private var uploadData: Data?
    @State private var uploadFileName: String?
    @State private var uploadMimeType: String?
    @State private var isUploading = false
    @State private var isParsing = false
    @State private var parseSuccess = false
    @State private var errorMessage: String?

    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var showFileImporter = false

    var onParsed: (BillParseResult) -> Void

    private let billRepo = BillRepository()

    var body: some View {
        VStack(spacing: SpentySpacing.md) {
            if let fileName = uploadFileName {
                // File selected / parsing / success state
                filePreview(fileName)
            } else {
                // Drop zone
                dropZone
            }

            if let error = errorMessage {
                Text(error)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.danger)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .fileImporter(
            isPresented: $showFileImporter,
            allowedContentTypes: [.pdf, .image],
            allowsMultipleSelection: false
        ) { result in
            handleFileImport(result)
        }
        .onChange(of: selectedPhotoItem) { _, newItem in
            guard let newItem else { return }
            Task { await handlePhotoSelection(newItem) }
        }
    }

    // MARK: - Drop Zone

    private var dropZone: some View {
        VStack(spacing: SpentySpacing.md) {
            Image(systemName: "doc.text.viewfinder")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(SpentyColors.brandAccent)

            Text("Upload bill image or PDF for AI auto-fill")
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
                .multilineTextAlignment(.center)

            HStack(spacing: SpentySpacing.md) {
                PhotosPicker(
                    selection: $selectedPhotoItem,
                    matching: .images
                ) {
                    Label("Photo", systemImage: "photo")
                        .font(SpentyFonts.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(SpentyColors.brandAccent)
                        .padding(.horizontal, SpentySpacing.md)
                        .padding(.vertical, SpentySpacing.sm)
                        .background(SpentyColors.brandAccent.opacity(0.1))
                        .clipShape(Capsule())
                }

                Button {
                    showFileImporter = true
                } label: {
                    Label("File", systemImage: "doc")
                        .font(SpentyFonts.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(SpentyColors.brandAccent)
                        .padding(.horizontal, SpentySpacing.md)
                        .padding(.vertical, SpentySpacing.sm)
                        .background(SpentyColors.brandAccent.opacity(0.1))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(SpentySpacing.xl)
        .background(SpentyColors.bgSecondary.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: SpentyRadius.lg)
                .strokeBorder(
                    SpentyColors.brandAccent.opacity(0.3),
                    style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])
                )
        )
    }

    // MARK: - File Preview

    private func filePreview(_ fileName: String) -> some View {
        HStack(spacing: SpentySpacing.md) {
            if isParsing {
                ProgressView()
                    .controlSize(.small)
                    .tint(SpentyColors.brandAccent)
            } else if parseSuccess {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(SpentyColors.success)
                    .font(.system(size: 20))
            } else {
                Image(systemName: "doc.fill")
                    .foregroundStyle(SpentyColors.brandAccent)
                    .font(.system(size: 20))
            }

            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Text(fileName)
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textPrimary)
                    .lineLimit(1)

                if isParsing {
                    Text("Parsing with AI...")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.brandAccent)
                } else if parseSuccess {
                    Text("Parsed successfully")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.success)
                }
            }

            Spacer()

            if !isParsing {
                Button {
                    removeFile()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(SpentyColors.textMuted)
                        .font(.system(size: 18))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(SpentySpacing.md)
        .background(SpentyColors.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: SpentyRadius.md)
                .stroke(
                    parseSuccess ? SpentyColors.success.opacity(0.3) : SpentyColors.borderSubtle,
                    lineWidth: 1
                )
        )
    }

    // MARK: - Actions

    private func handlePhotoSelection(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            errorMessage = "Failed to load selected photo."
            return
        }

        let fileName = "bill_photo.jpg"
        let mimeType = "image/jpeg"

        uploadData = data
        uploadFileName = fileName
        uploadMimeType = mimeType
        errorMessage = nil
        selectedPhotoItem = nil

        await parseUploadedFile(data: data, fileName: fileName, mimeType: mimeType)
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else {
                errorMessage = "Unable to access the selected file."
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            do {
                let data = try Data(contentsOf: url)
                let fileName = url.lastPathComponent
                let mimeType = url.pathExtension.lowercased() == "pdf"
                    ? "application/pdf"
                    : "image/\(url.pathExtension.lowercased())"

                uploadData = data
                uploadFileName = fileName
                uploadMimeType = mimeType
                errorMessage = nil

                Task {
                    await parseUploadedFile(data: data, fileName: fileName, mimeType: mimeType)
                }
            } catch {
                errorMessage = "Failed to read file: \(error.localizedDescription)"
            }

        case .failure(let error):
            errorMessage = "File selection failed: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func parseUploadedFile(data: Data, fileName: String, mimeType: String) async {
        isParsing = true
        parseSuccess = false
        errorMessage = nil

        do {
            let result = try await billRepo.parseBillUpload(
                fileData: data,
                fileName: fileName,
                mimeType: mimeType
            )
            parseSuccess = true
            onParsed(result)
        } catch {
            errorMessage = "AI parsing failed: \(error.localizedDescription)"
            parseSuccess = false
        }

        isParsing = false
    }

    private func removeFile() {
        uploadData = nil
        uploadFileName = nil
        uploadMimeType = nil
        parseSuccess = false
        errorMessage = nil
    }

    // MARK: - Public State

    var isProcessing: Bool {
        isUploading || isParsing
    }
}
