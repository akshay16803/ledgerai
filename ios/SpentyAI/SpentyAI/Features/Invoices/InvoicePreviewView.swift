import SwiftUI
import PDFKit

struct InvoicePreviewView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @Bindable var viewModel: InvoicesViewModel
    let invoice: Invoice

    @State private var pdfData: Data?
    @State private var isLoadingPDF = false
    @State private var pdfError: String?
    @State private var showShareSheet = false
    @State private var showDeleteConfirmation = false
    @Environment(\.dismiss) private var dismiss

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            Group {
                if isLoadingPDF {
                    VStack(spacing: 12) {
                        ProgressView()
                            .tint(Color.spentyPrimary)
                        Text(lang.s("loading_invoice_pdf"))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else if let pdfData, let document = PDFDocument(data: pdfData) {
                    PDFKitView(document: document)
                        .ignoresSafeArea(edges: .bottom)
                } else if let pdfError {
                    errorView(pdfError)
                } else {
                    invoiceFallbackView
                }
            }
        }
        .navigationTitle(invoice.invoiceNumber ?? "Invoice")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if pdfData != nil {
                    Button {
                        showShareSheet = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundStyle(Color.spentyPrimary)
                    }

                    if UIPrintInteractionController.isPrintingAvailable {
                        Button {
                            printPDF()
                        } label: {
                            Image(systemName: "printer")
                                .foregroundStyle(Color.spentyPrimary)
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let pdfData {
                InvoiceShareSheet(items: [pdfData])
            }
        }
        .sheet(isPresented: $viewModel.showForm) {
            InvoiceFormView(viewModel: viewModel)
        }
        .task {
            await loadPDF()
        }
    }

    // MARK: - Fallback Detail View

    private var invoiceFallbackView: some View {
        List {
            Section {
                row("Invoice #", value: invoice.invoiceNumber)
                row("Customer", value: invoice.customerName)
                row("Date", value: formatDate(invoice.date))
                row("Due Date", value: formatDate(invoice.dueDate))
            } header: {
                Text(lang.s("details"))
            }

            if let items = invoice.lineItems, !items.isEmpty {
                Section {
                    ForEach(items) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.description ?? "—")
                                .font(.body)
                            HStack {
                                Text("Qty: \(formattedNumber(item.quantity ?? 0))")
                                Text("Rate: \(formatCurrency(item.rate ?? 0))")
                                Spacer()
                                Text(formatCurrency(item.lineTotal))
                                    .fontWeight(.semibold)
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 2)
                    }
                } header: {
                    Text(lang.s("line_items"))
                }
            }

            Section {
                row("Subtotal", value: formatCurrency(invoice.subtotal ?? 0))
                row("Tax", value: formatCurrency(invoice.taxAmount ?? 0))
                HStack {
                    Text(lang.s("grand_total"))
                        .fontWeight(.bold)
                    Spacer()
                    Text(formatCurrency(invoice.grandTotal ?? 0))
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Color.spentyPrimary)
                }
            } header: {
                Text(lang.s("totals"))
            }

            if let notes = invoice.notes, !notes.isEmpty {
                Section {
                    Text(notes)
                        .font(.body)
                } header: {
                    Text(lang.s("notes"))
                }
            }

            // Action buttons
            Section {
                if (invoice.paymentStatus ?? "").lowercased() != "paid" {
                    Button {
                        Task { await viewModel.markPaid(id: invoice.id) }
                    } label: {
                        Label("Mark as Paid", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(Color.spentySuccess)
                    }
                }

                Button {
                    viewModel.startEdit(invoice)
                } label: {
                    Label("Edit Invoice", systemImage: "pencil")
                        .foregroundStyle(Color.spentyPrimary)
                }

                Button {
                    Task { await viewModel.duplicateInvoice(id: invoice.id) }
                } label: {
                    Label("Duplicate", systemImage: "doc.on.doc")
                        .foregroundStyle(Color.spentyWarning)
                }

                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    Label("Delete Invoice", systemImage: "trash")
                        .foregroundStyle(Color.spentyError)
                }
            } header: {
                Text(lang.s("actions"))
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .confirmationDialog("Delete Invoice", isPresented: $showDeleteConfirmation, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deleteInvoice(id: invoice.id)
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(lang.s("delete_invoice_confirm"))
        }
    }

    private func row(_ label: String, value: String?) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value ?? "—")
        }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(Color.spentyError.opacity(0.6))

            Text(lang.s("could_not_load_pdf"))
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button(lang.s("retry")) {
                Task { await loadPDF() }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.spentyPrimary)
        }
        .padding(32)
    }

    // MARK: - Actions

    private func loadPDF() async {
        isLoadingPDF = true
        pdfError = nil
        do {
            pdfData = try await viewModel.loadInvoicePDF(id: invoice.id)
        } catch {
            pdfError = error.localizedDescription
        }
        isLoadingPDF = false
    }

    private func printPDF() {
        guard let data = pdfData else { return }
        let controller = UIPrintInteractionController.shared
        let info = UIPrintInfo.printInfo()
        info.outputType = .general
        info.jobName = invoice.invoiceNumber ?? "Invoice"
        controller.printInfo = info
        controller.printingItem = data
        controller.present(animated: true)
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

    private func formatDate(_ date: Date?) -> String {
        guard let date else { return "—" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    private func formattedNumber(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "0"
    }
}

// MARK: - PDFKit Wrapper

struct PDFKitView: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.document = document
        view.backgroundColor = UIColor(Color.spentyBgPrimary)
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {
        view.document = document
    }
}

// MARK: - Share Sheet

private struct InvoiceShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

#Preview {
    NavigationStack {
        InvoicePreviewView(
            viewModel: InvoicesViewModel(),
            invoice: {
                let json = #"{"invoiceId":"1","invoiceNumber":"INV-001","customerName":"Test"}"#
                let decoder = JSONDecoder()
                return try! decoder.decode(Invoice.self, from: Data(json.utf8))
            }()
        )
    }
}
