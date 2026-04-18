import SwiftUI
import PhotosUI

struct ReceiptUploadView: View {

    @Bindable var viewModel: RecordsViewModel
    @Binding var isPresented: Bool

    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var selectedImageData: Data?
    @State private var selectedImage: UIImage?
    @State private var filename: String = ""

    @State private var isUploading = false
    @State private var isParsing = false
    @State private var uploadedReceiptId: String?
    @State private var parsedReceipt: Receipt?
    @State private var errorMessage: String?

    @State private var showTransactionPicker = false
    @State private var linkedTransactionId: String = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        imagePickerSection
                        if selectedImage != nil {
                            imagePreviewSection
                        }
                        if let parsedReceipt, parsedReceipt.parsedData != nil {
                            parsedDataSection(parsedReceipt)
                        }
                        if uploadedReceiptId != nil && parsedReceipt != nil {
                            linkTransactionSection
                        }
                        actionButtons
                        if let error = errorMessage {
                            errorBanner(error)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Upload Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundColor(.spentyTextSecondary)
                }
            }
            .onChange(of: selectedPhotoItem) { _, newItem in
                Task { await loadPhoto(from: newItem) }
            }
        }
    }

    // MARK: - Image Picker

    private var imagePickerSection: some View {
        VStack(spacing: 12) {
            if selectedImage == nil {
                PhotosPicker(
                    selection: $selectedPhotoItem,
                    matching: .images
                ) {
                    VStack(spacing: 16) {
                        Image(systemName: "doc.text.viewfinder")
                            .font(.system(size: 48))
                            .foregroundColor(.spentyPrimary)

                        Text("Select Receipt Image")
                            .font(SpentyFonts.headline)
                            .foregroundColor(.spentyTextPrimary)

                        Text("Choose from your photo library")
                            .font(SpentyFonts.subheadline)
                            .foregroundColor(.spentyTextSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 200)
                    .background(Color.spentyCardBg)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.spentyBorder, style: StrokeStyle(lineWidth: 2, dash: [8]))
                    )
                }
            }
        }
    }

    // MARK: - Image Preview

    private var imagePreviewSection: some View {
        VStack(spacing: 12) {
            if let image = selectedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 300)
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
            }

            HStack {
                if !filename.isEmpty {
                    Text(filename)
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                }
                Spacer()
                PhotosPicker(
                    selection: $selectedPhotoItem,
                    matching: .images
                ) {
                    Text("Change")
                        .font(SpentyFonts.footnote)
                        .fontWeight(.medium)
                        .foregroundColor(.spentyPrimary)
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Parsed Data

    private func parsedDataSection(_ receipt: Receipt) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.spentyPrimary)
                Text("AI Parsed Data")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)
            }

            if let data = receipt.parsedData {
                VStack(spacing: 8) {
                    if let merchant = data.merchant {
                        parsedRow(label: "Merchant", value: merchant)
                    }
                    if let amount = data.amount {
                        parsedRow(label: "Amount", value: formatCurrency(amount))
                    }
                    if let total = data.total {
                        parsedRow(label: "Total", value: formatCurrency(total))
                    }
                    if let tax = data.tax {
                        parsedRow(label: "Tax", value: formatCurrency(tax))
                    }
                    if let date = data.date {
                        parsedRow(label: "Date", value: formatDate(date))
                    }

                    if let items = data.items, !items.isEmpty {
                        Divider()
                        Text("Items")
                            .font(SpentyFonts.footnote)
                            .fontWeight(.medium)
                            .foregroundColor(.spentyTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        ForEach(items) { item in
                            HStack {
                                Text(item.description ?? "Item")
                                    .font(SpentyFonts.subheadline)
                                    .foregroundColor(.spentyTextPrimary)
                                if let qty = item.quantity, qty > 1 {
                                    Text("x\(Int(qty))")
                                        .font(SpentyFonts.caption1)
                                        .foregroundColor(.spentyTextSecondary)
                                }
                                Spacer()
                                if let amt = item.amount {
                                    Text(formatCurrency(amt))
                                        .font(SpentyFonts.subheadline)
                                        .foregroundColor(.spentyTextPrimary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .cardStyle()
    }

    private func parsedRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.subheadline)
                .foregroundColor(.spentyTextSecondary)
            Spacer()
            Text(value)
                .font(SpentyFonts.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.spentyTextPrimary)
        }
    }

    // MARK: - Link Transaction

    private var linkTransactionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "link")
                    .foregroundColor(.spentyPrimary)
                Text("Link to Transaction")
                    .font(SpentyFonts.headline)
                    .foregroundColor(.spentyTextPrimary)
            }

            TextField("Transaction ID", text: $linkedTransactionId)
                .inputStyle()

            if !linkedTransactionId.isEmpty {
                Button {
                    Task {
                        guard let receiptId = uploadedReceiptId else { return }
                        await viewModel.linkReceiptToTransaction(
                            receiptId: receiptId,
                            transactionId: linkedTransactionId
                        )
                        isPresented = false
                    }
                } label: {
                    Text("Link Transaction")
                        .secondaryButtonStyle()
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: 12) {
            if selectedImage != nil && uploadedReceiptId == nil {
                Button {
                    Task { await uploadAndParse() }
                } label: {
                    HStack(spacing: 8) {
                        if isUploading || isParsing {
                            ProgressView()
                                .controlSize(.small)
                                .tint(.white)
                        }
                        Text(uploadButtonLabel)
                    }
                    .primaryButtonStyle()
                }
                .disabled(isUploading || isParsing)
            }

            if uploadedReceiptId != nil {
                Button {
                    isPresented = false
                } label: {
                    Text("Done")
                        .primaryButtonStyle()
                }
            }
        }
    }

    private var uploadButtonLabel: String {
        if isUploading { return "Uploading..." }
        if isParsing { return "Parsing with AI..." }
        return "Upload & Parse"
    }

    // MARK: - Error

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.spentyError)
            Text(message)
                .font(SpentyFonts.footnote)
                .foregroundColor(.spentyError)
            Spacer()
            Button {
                errorMessage = nil
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.spentyError.opacity(0.6))
            }
        }
        .padding(12)
        .background(Color.spentyError.opacity(0.1))
        .cornerRadius(10)
    }

    // MARK: - Actions

    private func loadPhoto(from item: PhotosPickerItem?) async {
        guard let item else { return }
        do {
            if let data = try await item.loadTransferable(type: Data.self) {
                await MainActor.run {
                    selectedImageData = data
                    selectedImage = UIImage(data: data)
                    filename = "receipt_\(Date().timeIntervalSince1970).jpg"
                    // Reset state for new selection
                    uploadedReceiptId = nil
                    parsedReceipt = nil
                    errorMessage = nil
                }
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to load image: \(error.localizedDescription)"
            }
        }
    }

    private func uploadAndParse() async {
        guard let imageData = selectedImageData else { return }

        errorMessage = nil

        // Upload
        isUploading = true
        let receiptId = await viewModel.uploadReceipt(
            imageData: imageData,
            filename: filename,
            mimeType: "image/jpeg"
        )
        isUploading = false

        guard let receiptId else {
            errorMessage = viewModel.errorMessage
            return
        }

        uploadedReceiptId = receiptId

        // Parse
        isParsing = true
        let parsed = await viewModel.parseReceipt(id: receiptId)
        isParsing = false

        if let parsed {
            parsedReceipt = parsed
        } else {
            errorMessage = viewModel.errorMessage ?? "Failed to parse receipt"
        }
    }

    // MARK: - Formatting Helpers

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

#Preview {
    ReceiptUploadView(
        viewModel: RecordsViewModel(),
        isPresented: .constant(true)
    )
}
