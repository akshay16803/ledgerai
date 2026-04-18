import SwiftUI
import PDFKit

struct PurchasePreviewView: View {

    // MARK: - State

    @Bindable var viewModel: PurchasesViewModel
    @Environment(\.dismiss) private var dismiss
    let billId: String

    @State private var isLoadingPDF = true

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                if isLoadingPDF && viewModel.pdfData == nil {
                    VStack(spacing: 12) {
                        ProgressView()
                            .tint(.spentyPrimary)
                        Text("Loading bill PDF...")
                            .font(SpentyFonts.subheadline)
                            .foregroundStyle(.spentyTextSecondary)
                    }
                } else if let data = viewModel.pdfData, let document = PDFDocument(data: data) {
                    PDFKitView(document: document)
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "doc.text.fill")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 48, height: 48)
                            .foregroundStyle(Color.spentyPrimary.opacity(0.4))

                        Text("Unable to load PDF")
                            .font(SpentyFonts.headline)
                            .foregroundStyle(.spentyTextPrimary)

                        Text("The bill preview could not be generated.")
                            .font(SpentyFonts.subheadline)
                            .foregroundStyle(.spentyTextSecondary)
                            .multilineTextAlignment(.center)

                        Button {
                            Task { await loadPDF() }
                        } label: {
                            Label("Retry", systemImage: "arrow.clockwise")
                                .font(SpentyFonts.headline)
                                .primaryButtonStyle()
                        }
                        .frame(width: 160)
                    }
                    .padding(32)
                }
            }
            .navigationTitle("Bill Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 16) {
                        if let data = viewModel.pdfData {
                            ShareLink(
                                item: PDFDataItem(data: data),
                                preview: SharePreview("Bill PDF", icon: "doc.fill")
                            ) {
                                Image(systemName: "square.and.arrow.up")
                                    .foregroundStyle(.spentyPrimary)
                            }
                        }

                        if viewModel.pdfData != nil {
                            Button {
                                printPDF()
                            } label: {
                                Image(systemName: "printer")
                                    .foregroundStyle(.spentyPrimary)
                            }
                        }
                    }
                }
            }
            .task {
                await loadPDF()
            }
        }
    }

    // MARK: - Actions

    private func loadPDF() async {
        isLoadingPDF = true
        await viewModel.loadBillPDF(id: billId)
        isLoadingPDF = false
    }

    private func printPDF() {
        guard let data = viewModel.pdfData else { return }
        let printController = UIPrintInteractionController.shared
        let printInfo = UIPrintInfo(dictionary: nil)
        printInfo.jobName = "Bill PDF"
        printInfo.outputType = .general
        printController.printInfo = printInfo
        printController.printingItem = data
        printController.present(animated: true)
    }
}

// MARK: - PDFKit UIViewRepresentable

struct PDFKitView: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.document = document
        pdfView.backgroundColor = UIColor(Color.spentyBgPrimary)
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        uiView.document = document
    }
}

// MARK: - ShareLink Data Item

struct PDFDataItem: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .pdf) { item in
            item.data
        }
    }
}

// MARK: - Preview

#Preview {
    PurchasePreviewView(viewModel: PurchasesViewModel(), billId: "test")
}
