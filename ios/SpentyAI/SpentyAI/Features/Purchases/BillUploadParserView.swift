import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct BillUploadParserView: View {

    // MARK: - State

    @Bindable var viewModel: PurchasesViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var showFileImporter = false
    @State private var uploadedFileName: String?
    @State private var showCreateConfirm = false
    @State private var isCreating = false

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        if viewModel.isUploading {
                            uploadingState
                        } else if let parsed = viewModel.parsedBill {
                            parsedResultView(parsed)
                        } else {
                            uploadPrompt
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Upload Bill")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .fileImporter(
                isPresented: $showFileImporter,
                allowedContentTypes: [.pdf, .png, .jpeg],
                allowsMultipleSelection: false
            ) { result in
                handleFileImport(result)
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil && !viewModel.isUploading },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    // MARK: - Upload Prompt

    private var uploadPrompt: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.text.viewfinder")
                .resizable()
                .scaledToFit()
                .frame(width: 72, height: 72)
                .foregroundStyle(Color.spentyPrimary.opacity(0.5))

            Text("Upload a Bill")
                .font(SpentyFonts.title3)
                .foregroundStyle(.spentyTextPrimary)

            Text("Upload a photo or PDF of a purchase bill. AI will extract the vendor, items, and amounts automatically.")
                .font(SpentyFonts.subheadline)
                .foregroundStyle(.spentyTextSecondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 12) {
                PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                    Label("Choose Photo", systemImage: "photo")
                        .primaryButtonStyle()
                }
                .onChange(of: selectedPhotoItem) { _, newItem in
                    guard let newItem else { return }
                    Task { await handlePhotoSelection(newItem) }
                }

                Button {
                    showFileImporter = true
                } label: {
                    Label("Choose File", systemImage: "doc")
                        .secondaryButtonStyle()
                }
            }
            .padding(.top, 8)
        }
        .cardStyle()
    }

    // MARK: - Uploading State

    private var uploadingState: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.3)
                .tint(.spentyPrimary)

            Text("Parsing bill...")
                .font(SpentyFonts.headline)
                .foregroundStyle(.spentyTextPrimary)

            Text("AI is extracting data from your bill. This may take a moment.")
                .font(SpentyFonts.subheadline)
                .foregroundStyle(.spentyTextSecondary)
                .multilineTextAlignment(.center)

            if let name = uploadedFileName {
                Text(name)
                    .font(SpentyFonts.caption1)
                    .foregroundStyle(.spentyTextSecondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Color.spentyBorder.opacity(0.5))
                    .clipShape(Capsule())
            }
        }
        .cardStyle()
    }

    // MARK: - Parsed Result

    private func parsedResultView(_ parsed: BillParseResponse) -> some View {
        VStack(spacing: 16) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.spentySuccess)
                    .font(.title2)

                Text("Bill Parsed Successfully")
                    .font(SpentyFonts.headline)
                    .foregroundStyle(.spentyTextPrimary)
            }

            VStack(spacing: 0) {
                parsedRow(label: "Vendor", value: parsed.vendorName)
                Divider()
                parsedRow(label: "Bill Number", value: parsed.billNumber)
                Divider()
                parsedRow(label: "Date", value: parsed.date)
                Divider()
                parsedRow(label: "Due Date", value: parsed.dueDate)
                Divider()
                parsedRow(label: "Subtotal", value: formatCurrency(parsed.subtotal ?? 0))
                Divider()
                parsedRow(label: "Tax", value: formatCurrency(parsed.taxAmount ?? 0))
                Divider()
                parsedRow(label: "Grand Total", value: formatCurrency(parsed.grandTotal ?? 0), highlight: true)
            }
            .background(Color.spentyCardBg)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.spentyBorder, lineWidth: 1)
            )

            if let items = parsed.lineItems, !items.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Line Items (\(items.count))")
                        .font(SpentyFonts.headline)
                        .foregroundStyle(.spentyTextPrimary)

                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.description ?? "Item")
                                    .font(SpentyFonts.subheadline)
                                    .foregroundStyle(.spentyTextPrimary)

                                if let hsnSac = item.hsnSac, !hsnSac.isEmpty {
                                    Text("HSN/SAC: \(hsnSac)")
                                        .font(SpentyFonts.caption1)
                                        .foregroundStyle(.spentyTextSecondary)
                                }

                                Text("\(formatNumber(item.quantity ?? 1)) x \(formatCurrency(item.rate ?? 0))")
                                    .font(SpentyFonts.caption1)
                                    .foregroundStyle(.spentyTextSecondary)
                            }

                            Spacer()

                            Text(formatCurrency(item.amount ?? 0))
                                .font(SpentyFonts.subheadline)
                                .fontWeight(.medium)
                                .foregroundStyle(.spentyTextPrimary)
                        }
                        .padding(.vertical, 6)

                        if items.last?.description != item.description {
                            Divider()
                        }
                    }
                }
                .cardStyle()
            }

            VStack(spacing: 12) {
                Button {
                    createBillFromParsed(parsed)
                } label: {
                    if isCreating {
                        ProgressView()
                            .tint(.white)
                            .primaryButtonStyle()
                    } else {
                        Label("Create Bill", systemImage: "checkmark")
                            .primaryButtonStyle()
                    }
                }
                .disabled(isCreating)

                Button {
                    viewModel.parsedBill = nil
                } label: {
                    Text("Upload Another")
                        .secondaryButtonStyle()
                }
            }
            .padding(.top, 8)
        }
    }

    private func parsedRow(label: String, value: String?, highlight: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(highlight ? SpentyFonts.headline : SpentyFonts.subheadline)
                .foregroundStyle(.spentyTextSecondary)

            Spacer()

            Text(value ?? "--")
                .font(highlight ? SpentyFonts.amountSmall : SpentyFonts.subheadline)
                .fontWeight(highlight ? .semibold : .regular)
                .foregroundStyle(highlight ? .spentyPrimary : .spentyTextPrimary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: - Actions

    private func handlePhotoSelection(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        uploadedFileName = "photo.jpg"
        await viewModel.uploadAndParseBill(data: data, filename: "bill.jpg", mimeType: "image/jpeg")
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else { return }
            defer { url.stopAccessingSecurityScopedResource() }

            guard let data = try? Data(contentsOf: url) else { return }

            let filename = url.lastPathComponent
            uploadedFileName = filename

            let mimeType: String
            if url.pathExtension.lowercased() == "pdf" {
                mimeType = "application/pdf"
            } else if url.pathExtension.lowercased() == "png" {
                mimeType = "image/png"
            } else {
                mimeType = "image/jpeg"
            }

            Task {
                await viewModel.uploadAndParseBill(data: data, filename: filename, mimeType: mimeType)
            }

        case .failure:
            viewModel.errorMessage = "Failed to select file."
        }
    }

    private func createBillFromParsed(_ parsed: BillParseResponse) {
        isCreating = true

        let items = parsed.lineItems?.map { item in
            BillLineItemPayload(
                description: item.description,
                hsnSac: item.hsnSac,
                quantity: item.quantity ?? 1,
                rate: item.rate ?? 0,
                taxRate: item.taxRate ?? 0,
                amount: item.amount ?? 0
            )
        }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let payload = BillPayload(
            billNumber: parsed.billNumber,
            vendorName: parsed.vendorName,
            date: parsed.date.flatMap { dateFormatter.date(from: $0) },
            dueDate: parsed.dueDate.flatMap { dateFormatter.date(from: $0) },
            lineItems: items,
            subtotal: parsed.subtotal,
            taxAmount: parsed.taxAmount,
            grandTotal: parsed.grandTotal,
            notes: parsed.notes
        )

        Task {
            let success = await viewModel.createBill(payload)
            isCreating = false
            if success { dismiss() }
        }
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\u{20B9}0"
    }

    private func formatNumber(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "1"
    }
}

// MARK: - Preview

#Preview {
    BillUploadParserView(viewModel: PurchasesViewModel())
}
