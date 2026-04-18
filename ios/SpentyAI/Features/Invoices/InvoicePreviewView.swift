import SwiftUI
import UIKit

struct InvoicePreviewView: View {
    let invoice: Invoice
    let settings: AppSettings?
    var onEdit: ((Invoice) -> Void)?
    var onRecordPayment: ((Invoice) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var isGeneratingPDF = false

    // MARK: - Country Config

    private var countryConfig: CountryConfig? {
        guard let code = settings?.businessCountry else { return nil }
        return CountryConfig.config(for: code)
    }

    private var isIndia: Bool {
        CountryConfig.usesExistingForms(code: settings?.businessCountry ?? "")
    }

    private var isGST: Bool {
        invoice.invoiceType?.lowercased() == "gst"
    }

    private var currency: String {
        countryConfig?.currency ?? settings?.baseCurrency ?? "INR"
    }

    private var firmState: String {
        settings?.firmState ?? ""
    }

    private var isSameState: Bool {
        let supply = invoice.placeOfSupply ?? invoice.customerState ?? ""
        guard !supply.isEmpty, !firmState.isEmpty else { return true }
        return supply.lowercased() == firmState.lowercased()
    }

    private var invoiceTitle: String {
        if isIndia && isGST {
            return "TAX INVOICE"
        }
        return countryConfig?.invoiceTitle.uppercased() ?? "INVOICE"
    }

    private var statusType: StatusType {
        switch invoice.paymentStatus?.lowercased() {
        case "paid": return .paid
        case "partial": return .partial
        default: return .unpaid
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                invoiceCard
                    .padding(SpentySpacing.lg)
            }
            .background(SpentyColors.bgSecondary)
            .safeAreaInset(edge: .top) {
                SheetHeader(
                    invoice.invoiceNumber ?? "Invoice",
                    onClose: { dismiss() }
                )
                .background(SpentyColors.surface)
            }
            .safeAreaInset(edge: .bottom) {
                toolbarButtons
            }
        }
    }

    // MARK: - Invoice Card (A4 Style)

    private var invoiceCard: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xl) {
            firmHeader
            invoiceMeta
            billToSection
            lineItemsTable
            taxBreakdown
            totalsSection
            bankDetailsSection
            termsSection
            paymentStatusSection
        }
        .padding(SpentySpacing.xl)
        .background(SpentyColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.lg))
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }

    // MARK: - Firm Header

    private var firmHeader: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            Text(settings?.firmName ?? "Your Business")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(SpentyColors.brandPrimary)

            VStack(alignment: .leading, spacing: 2) {
                if let addr = settings?.firmAddress, !addr.isEmpty {
                    Text(addr)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                let cityLine = [settings?.firmCity, settings?.firmState, settings?.firmPincode]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: ", ")
                if !cityLine.isEmpty {
                    Text(cityLine)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                if isIndia {
                    if let gstin = settings?.firmGstin, !gstin.isEmpty {
                        Text("GSTIN: \(gstin)")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }
                    if let pan = settings?.firmPan, !pan.isEmpty {
                        Text("PAN: \(pan)")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }
                }

                if let phone = settings?.firmPhone, !phone.isEmpty {
                    Text("Phone: \(phone)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                if let email = settings?.firmEmail, !email.isEmpty {
                    Text("Email: \(email)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
            }

            Divider()

            Text(invoiceTitle)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(SpentyColors.textPrimary)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    // MARK: - Invoice Meta

    private var invoiceMeta: some View {
        HStack(alignment: .top) {
            Spacer()
            VStack(alignment: .trailing, spacing: SpentySpacing.xs) {
                metaRow(label: "Invoice #", value: invoice.invoiceNumber ?? "-")
                metaRow(label: "Date", value: formatDate(invoice.invoiceDate))
                metaRow(label: "Due Date", value: formatDate(invoice.dueDate))
                if isGST, let pos = invoice.placeOfSupply, !pos.isEmpty {
                    metaRow(label: "Place of Supply", value: pos)
                }
            }
        }
    }

    private func metaRow(label: String, value: String) -> some View {
        HStack(spacing: SpentySpacing.sm) {
            Text(label + ":")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textMuted)
            Text(value)
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textPrimary)
                .fontWeight(.medium)
        }
    }

    // MARK: - Bill To

    private var billToSection: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            Text("Bill To")
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textMuted)
                .textCase(.uppercase)

            Text(invoice.customerName ?? "Customer")
                .font(SpentyFonts.subheading)
                .foregroundStyle(SpentyColors.textPrimary)

            if isIndia, let gstin = invoice.customerGstin, !gstin.isEmpty {
                Text("GSTIN: \(gstin)")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
            } else if !isIndia, let taxId = invoice.customerGstin, !taxId.isEmpty {
                Text("\(countryConfig?.taxIdLabel ?? "Tax ID"): \(taxId)")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
            }

            if let addr = invoice.customerAddress, !addr.isEmpty {
                Text(addr)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
            }

            if let state = invoice.customerState, !state.isEmpty {
                Text(state)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
            }
        }
        .padding(SpentySpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SpentyColors.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
    }

    // MARK: - Line Items Table

    private var lineItemsTable: some View {
        VStack(spacing: 0) {
            // Header row
            HStack(spacing: SpentySpacing.xs) {
                Text("#")
                    .frame(width: 20, alignment: .leading)
                Text("Description")
                    .frame(maxWidth: .infinity, alignment: .leading)
                if isGST {
                    Text("HSN")
                        .frame(width: 50, alignment: .trailing)
                }
                Text("Qty")
                    .frame(width: 35, alignment: .trailing)
                Text("Rate")
                    .frame(width: 60, alignment: .trailing)
                if hasDiscount {
                    Text("Disc%")
                        .frame(width: 40, alignment: .trailing)
                }
                if hasTax {
                    Text("Tax%")
                        .frame(width: 40, alignment: .trailing)
                }
                Text("Amount")
                    .frame(width: 70, alignment: .trailing)
            }
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(SpentyColors.textMuted)
            .padding(.vertical, SpentySpacing.sm)
            .padding(.horizontal, SpentySpacing.xs)
            .background(SpentyColors.bgSecondary)

            // Item rows
            if let items = invoice.lineItems {
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    HStack(spacing: SpentySpacing.xs) {
                        Text("\(index + 1)")
                            .frame(width: 20, alignment: .leading)
                        Text(item.description ?? "-")
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .lineLimit(2)
                        if isGST {
                            Text(item.hsnSac ?? "-")
                                .frame(width: 50, alignment: .trailing)
                        }
                        Text(String(format: "%g", item.quantity))
                            .frame(width: 35, alignment: .trailing)
                        Text(String(format: "%.0f", item.rate))
                            .frame(width: 60, alignment: .trailing)
                        if hasDiscount {
                            Text(item.discountPercent.map { String(format: "%g%%", $0) } ?? "-")
                                .frame(width: 40, alignment: .trailing)
                        }
                        if hasTax {
                            Text(item.gstRate.map { String(format: "%g%%", $0 * 100) } ?? "-")
                                .frame(width: 40, alignment: .trailing)
                        }
                        Text(String(format: "%.0f", item.amount ?? 0))
                            .frame(width: 70, alignment: .trailing)
                    }
                    .font(.system(size: 10))
                    .foregroundStyle(SpentyColors.textPrimary)
                    .padding(.vertical, SpentySpacing.sm)
                    .padding(.horizontal, SpentySpacing.xs)

                    if index < items.count - 1 {
                        Divider()
                    }
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: SpentyRadius.md)
                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
        )
    }

    private var hasDiscount: Bool {
        invoice.lineItems?.contains(where: { ($0.discountPercent ?? 0) > 0 }) ?? false
    }

    private var hasTax: Bool {
        invoice.lineItems?.contains(where: { ($0.gstRate ?? 0) > 0 }) ?? false
    }

    // MARK: - Tax Breakdown

    @ViewBuilder
    private var taxBreakdown: some View {
        let taxAmt = invoice.taxTotal ?? 0
        if taxAmt > 0 {
            VStack(spacing: SpentySpacing.xs) {
                if isIndia && isGST {
                    if isSameState {
                        taxRow(label: "CGST", amount: taxAmt / 2)
                        taxRow(label: "SGST", amount: taxAmt / 2)
                    } else {
                        taxRow(label: "IGST", amount: taxAmt)
                    }
                } else {
                    taxRow(
                        label: countryConfig?.taxName ?? "Tax",
                        amount: taxAmt
                    )
                }
            }
        }
    }

    private func taxRow(label: String, amount: Double) -> some View {
        HStack {
            Spacer()
            Text(label)
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textSecondary)
            MoneyText(amount, currency: currency, size: SpentyFonts.caption)
                .frame(width: 100, alignment: .trailing)
        }
    }

    // MARK: - Totals

    private var totalsSection: some View {
        VStack(spacing: SpentySpacing.sm) {
            Divider()

            HStack {
                Spacer()
                VStack(alignment: .trailing, spacing: SpentySpacing.xs) {
                    HStack(spacing: SpentySpacing.lg) {
                        Text("Subtotal")
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textSecondary)
                        MoneyText(invoice.subtotal ?? 0, currency: currency)
                            .frame(width: 100, alignment: .trailing)
                    }

                    if (invoice.taxTotal ?? 0) > 0 {
                        HStack(spacing: SpentySpacing.lg) {
                            Text("Tax Total")
                                .font(SpentyFonts.body)
                                .foregroundStyle(SpentyColors.textSecondary)
                            MoneyText(invoice.taxTotal ?? 0, currency: currency)
                                .frame(width: 100, alignment: .trailing)
                        }
                    }

                    HStack(spacing: SpentySpacing.lg) {
                        Text("Grand Total")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(SpentyColors.textPrimary)
                        MoneyText(
                            invoice.grandTotal ?? 0,
                            currency: currency,
                            size: .system(size: 16, weight: .bold)
                        )
                        .frame(width: 100, alignment: .trailing)
                    }
                }
            }
        }
    }

    // MARK: - Bank Details

    @ViewBuilder
    private var bankDetailsSection: some View {
        let bankName = settings?.invoiceBankName ?? ""
        let accountNo = settings?.invoiceBankAccountNumber ?? ""
        let ifsc = settings?.invoiceBankIfsc ?? ""
        let branch = settings?.invoiceBankBranch ?? ""
        let upi = settings?.invoiceBankUpi ?? ""

        let hasBankDetails = !bankName.isEmpty || !accountNo.isEmpty

        if hasBankDetails {
            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Divider()
                Text("Bank Details")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
                    .textCase(.uppercase)

                if !bankName.isEmpty {
                    Text("Bank: \(bankName)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
                if !accountNo.isEmpty {
                    Text("Account No: \(accountNo)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
                if !ifsc.isEmpty {
                    Text("IFSC: \(ifsc)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
                if !branch.isEmpty {
                    Text("Branch: \(branch)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
                if !upi.isEmpty {
                    Text("UPI: \(upi)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
            }
        }
    }

    // MARK: - Terms

    @ViewBuilder
    private var termsSection: some View {
        let terms = invoice.termsConditions ?? settings?.invoiceTerms ?? ""
        if !terms.isEmpty {
            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                Divider()
                Text("Terms & Conditions")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
                    .textCase(.uppercase)

                Text(terms)
                    .font(.system(size: 10))
                    .foregroundStyle(SpentyColors.textSecondary)
            }
        }
    }

    // MARK: - Payment Status

    private var paymentStatusSection: some View {
        HStack {
            Spacer()
            VStack(alignment: .trailing, spacing: SpentySpacing.xs) {
                StatusBadge(statusType)

                if let paid = invoice.amountPaid, paid > 0, statusType != .paid {
                    Text("Paid: \(String(format: "%.2f", paid)) / \(String(format: "%.2f", invoice.grandTotal ?? 0))")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
            }
        }
    }

    // MARK: - Toolbar

    private var toolbarButtons: some View {
        HStack(spacing: SpentySpacing.md) {
            SecondaryButton("Share", icon: "square.and.arrow.up") {
                sharePDF()
            }

            if let onEdit {
                SecondaryButton("Edit", icon: "pencil") {
                    onEdit(invoice)
                }
            }

            if invoice.paymentStatus?.lowercased() != "paid", let onRecordPayment {
                PrimaryButton("Record Payment", icon: "creditcard") {
                    onRecordPayment(invoice)
                }
            }
        }
        .padding(.horizontal, SpentySpacing.lg)
        .padding(.vertical, SpentySpacing.md)
        .background(SpentyColors.surface)
        .overlay(alignment: .top) { Divider() }
    }

    // MARK: - PDF Share

    private func sharePDF() {
        isGeneratingPDF = true

        let renderer = ImageRenderer(content: invoiceCard.frame(width: 595))
        renderer.scale = 2.0

        if let image = renderer.uiImage {
            let pdfRenderer = UIGraphicsPDFRenderer(
                bounds: CGRect(x: 0, y: 0, width: 595, height: image.size.height / 2 + 40)
            )

            let pdfData = pdfRenderer.pdfData { context in
                context.beginPage()
                image.draw(in: CGRect(
                    x: 0, y: 20,
                    width: 595,
                    height: image.size.height / 2
                ))
            }

            let filename = "Invoice_\(invoice.invoiceNumber ?? "draft").pdf"
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

            do {
                try pdfData.write(to: tempURL)

                guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                      let window = scene.windows.first,
                      let rootVC = window.rootViewController else {
                    isGeneratingPDF = false
                    return
                }

                let topVC = getTopViewController(from: rootVC)
                let activityVC = UIActivityViewController(
                    activityItems: [tempURL],
                    applicationActivities: nil
                )

                if let popover = activityVC.popoverPresentationController {
                    popover.sourceView = topVC.view
                    popover.sourceRect = CGRect(
                        x: topVC.view.bounds.midX,
                        y: topVC.view.bounds.midY,
                        width: 0, height: 0
                    )
                }

                topVC.present(activityVC, animated: true)
            } catch {
                // PDF write failed
            }
        }

        isGeneratingPDF = false
    }

    private func getTopViewController(from vc: UIViewController) -> UIViewController {
        if let presented = vc.presentedViewController {
            return getTopViewController(from: presented)
        }
        if let nav = vc as? UINavigationController, let visible = nav.visibleViewController {
            return getTopViewController(from: visible)
        }
        if let tab = vc as? UITabBarController, let selected = tab.selectedViewController {
            return getTopViewController(from: selected)
        }
        return vc
    }

    // MARK: - Helpers

    private func formatDate(_ isoString: String?) -> String {
        guard let isoString, !isoString.isEmpty else { return "-" }

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = iso.date(from: isoString)
        if date == nil {
            iso.formatOptions = [.withInternetDateTime]
            date = iso.date(from: isoString)
        }
        if date == nil {
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            date = f.date(from: isoString)
        }

        guard let parsed = date else { return isoString }
        let display = DateFormatter()
        display.dateStyle = .medium
        return display.string(from: parsed)
    }
}
