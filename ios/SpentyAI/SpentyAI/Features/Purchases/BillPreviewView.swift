import SwiftUI

struct BillPreviewView: View {
    @Environment(\.dismiss) private var dismiss

    let bill: Bill
    let settings: AppSettings?
    var onEdit: (() -> Void)?
    var onRecordPayment: (() -> Void)?

    private var currency: String { settings?.baseCurrency ?? "INR" }
    private var isIndia: Bool { CountryConfig.usesExistingForms(code: settings?.businessCountry ?? "") }

    private var countryConfig: CountryConfig? {
        CountryConfig.config(for: settings?.businessCountry ?? "IN")
    }

    private var firmState: String { settings?.firmState ?? "" }

    private var isInterState: Bool {
        guard isIndia else { return false }
        guard let vendorState = bill.vendorState, !vendorState.isEmpty, !firmState.isEmpty else { return false }
        return vendorState.lowercased() != firmState.lowercased()
    }

    private var isGST: Bool {
        bill.billType?.lowercased() == "gst"
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SheetHeader(
                    countryConfig?.billTitle ?? "Purchase Bill",
                    onClose: { dismiss() }
                )

                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        firmHeader
                        billTitle
                        billMeta
                        vendorBlock
                        lineItemsTable
                        taxBreakdown
                        totals

                        if hasBankDetails {
                            bankDetails
                        }

                        if let terms = bill.termsConditions, !terms.isEmpty {
                            termsSection(terms)
                        }

                        if let notes = bill.notes, !notes.isEmpty {
                            notesSection(notes)
                        }
                    }
                    .padding(SpentySpacing.lg)
                    .padding(.bottom, 80)
                }

                toolbar
            }
            .background(SpentyColors.bgPrimary)
        }
    }

    // MARK: - Firm Header

    private var firmHeader: some View {
        VStack(spacing: SpentySpacing.sm) {
            if let firmName = settings?.firmName, !firmName.isEmpty {
                Text(firmName)
                    .font(SpentyFonts.heading)
                    .foregroundStyle(SpentyColors.textPrimary)
            }

            VStack(spacing: SpentySpacing.xs) {
                if let addr = settings?.firmAddress, !addr.isEmpty {
                    Text(addr)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                let cityStatePin = [settings?.firmCity, settings?.firmState, settings?.firmPincode]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: ", ")

                if !cityStatePin.isEmpty {
                    Text(cityStatePin)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                if isIndia, let gstin = settings?.firmGstin, !gstin.isEmpty {
                    Text("GSTIN: \(gstin)")
                        .font(SpentyFonts.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Bill Title

    private var billTitle: some View {
        Text(countryConfig?.billTitle.uppercased() ?? "PURCHASE BILL")
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(SpentyColors.brandPrimary)
            .tracking(2)
            .frame(maxWidth: .infinity)
            .padding(.vertical, SpentySpacing.sm)
            .background(SpentyColors.bgSecondary)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.sm))
    }

    // MARK: - Bill Meta

    private var billMeta: some View {
        SpentyCard {
            VStack(spacing: SpentySpacing.sm) {
                if let billNumber = bill.billNumber {
                    metaRow("Bill No.", value: billNumber)
                }
                if let dateStr = bill.billDate {
                    metaRow("Bill Date", value: DateFormatting.shortDate(from: dateStr))
                }
                if let dueDateStr = bill.dueDate {
                    metaRow("Due Date", value: DateFormatting.shortDate(from: dueDateStr))
                }
                if let ref = bill.poNumber, !ref.isEmpty {
                    metaRow("Bill Reference", value: ref)
                }
                if isGST, let pos = bill.placeOfSupply, !pos.isEmpty {
                    metaRow("Place of Supply", value: pos)
                }

                HStack {
                    Text("Status")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                    Spacer()
                    StatusBadge(statusType)
                }
            }
        }
    }

    private func metaRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textSecondary)
            Spacer()
            Text(value)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textPrimary)
        }
    }

    // MARK: - Vendor Block

    private var vendorBlock: some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                Text("Bill From")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
                    .textCase(.uppercase)

                if let name = bill.vendorName {
                    Text(name)
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)
                }

                if isIndia, let gstin = bill.vendorGstin, !gstin.isEmpty {
                    Text("GSTIN: \(gstin)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                if let address = bill.vendorAddress, !address.isEmpty {
                    Text(address)
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }

                if let state = bill.vendorState, !state.isEmpty {
                    Text("State: \(state)")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Line Items Table

    private var lineItemsTable: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            SectionHeader("Line Items")

            if let items = bill.lineItems, !items.isEmpty {
                VStack(spacing: 0) {
                    // Header row
                    HStack(spacing: SpentySpacing.sm) {
                        Text("#")
                            .frame(width: 24, alignment: .leading)
                        Text("Description")
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("Qty")
                            .frame(width: 36, alignment: .trailing)
                        Text("Rate")
                            .frame(width: 60, alignment: .trailing)
                        Text("Amount")
                            .frame(width: 70, alignment: .trailing)
                    }
                    .font(SpentyFonts.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(SpentyColors.textSecondary)
                    .padding(.horizontal, SpentySpacing.md)
                    .padding(.vertical, SpentySpacing.sm)
                    .background(SpentyColors.bgSecondary)

                    ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                        HStack(spacing: SpentySpacing.sm) {
                            Text("\(index + 1)")
                                .frame(width: 24, alignment: .leading)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.description ?? "")
                                    .lineLimit(2)
                                if isGST, let hsn = item.hsnSac, !hsn.isEmpty {
                                    Text("HSN: \(hsn)")
                                        .font(SpentyFonts.caption)
                                        .foregroundStyle(SpentyColors.textMuted)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            Text("\(item.quantity, specifier: "%.0f")")
                                .frame(width: 36, alignment: .trailing)

                            Text("\(item.rate, specifier: "%.2f")")
                                .frame(width: 60, alignment: .trailing)

                            Text("\(item.amount ?? (item.quantity * item.rate), specifier: "%.2f")")
                                .frame(width: 70, alignment: .trailing)
                        }
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textPrimary)
                        .padding(.horizontal, SpentySpacing.md)
                        .padding(.vertical, SpentySpacing.sm)

                        if index < items.count - 1 {
                            Divider()
                                .padding(.horizontal, SpentySpacing.md)
                        }
                    }
                }
                .background(SpentyColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: SpentyRadius.card)
                        .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Tax Breakdown

    private var taxBreakdown: some View {
        Group {
            if isGST, let taxTotal = bill.taxTotal, taxTotal > 0 {
                SpentyCard {
                    VStack(spacing: SpentySpacing.sm) {
                        Text("Tax Breakdown")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                            .textCase(.uppercase)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        if isInterState {
                            taxRow("IGST", value: taxTotal)
                        } else {
                            taxRow("CGST", value: taxTotal / 2)
                            taxRow("SGST", value: taxTotal / 2)
                        }
                    }
                }
            }
        }
    }

    private func taxRow(_ label: String, value: Double) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
            Spacer()
            MoneyText(value, currency: currency)
        }
    }

    // MARK: - Totals

    private var totals: some View {
        SpentyCard {
            VStack(spacing: SpentySpacing.sm) {
                if let subtotal = bill.subtotal {
                    totalDisplayRow("Subtotal", value: subtotal)
                }
                if let taxTotal = bill.taxTotal, taxTotal > 0 {
                    totalDisplayRow("Tax", value: taxTotal)
                }

                Divider()

                HStack {
                    Text("Grand Total")
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)
                    Spacer()
                    MoneyText(bill.grandTotal ?? 0, currency: currency, size: SpentyFonts.heading)
                }

                if let amountPaid = bill.amountPaid, amountPaid > 0 {
                    totalDisplayRow("Amount Paid", value: amountPaid)

                    let balance = (bill.grandTotal ?? 0) - amountPaid
                    if balance > 0 {
                        HStack {
                            Text("Balance Due")
                                .font(SpentyFonts.body)
                                .fontWeight(.medium)
                                .foregroundStyle(SpentyColors.danger)
                            Spacer()
                            MoneyText(balance, currency: currency, size: SpentyFonts.subheading)
                        }
                    }
                }
            }
        }
    }

    private func totalDisplayRow(_ label: String, value: Double) -> some View {
        HStack {
            Text(label)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textSecondary)
            Spacer()
            MoneyText(value, currency: currency)
        }
    }

    // MARK: - Bank Details

    private var hasBankDetails: Bool {
        let s = settings
        return [s?.invoiceBankName, s?.invoiceBankAccountNumber, s?.invoiceBankIfsc, s?.invoiceBankUpi]
            .compactMap { $0 }
            .contains { !$0.isEmpty }
    }

    private var bankDetails: some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                Text("Bank Details")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
                    .textCase(.uppercase)

                if let bankName = settings?.invoiceBankName, !bankName.isEmpty {
                    detailRow("Bank", value: bankName)
                }
                if let accNo = settings?.invoiceBankAccountNumber, !accNo.isEmpty {
                    detailRow("Account No.", value: accNo)
                }
                if let ifsc = settings?.invoiceBankIfsc, !ifsc.isEmpty {
                    detailRow("IFSC", value: ifsc)
                }
                if let branch = settings?.invoiceBankBranch, !branch.isEmpty {
                    detailRow("Branch", value: branch)
                }
                if let upi = settings?.invoiceBankUpi, !upi.isEmpty {
                    detailRow("UPI", value: upi)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func detailRow(_ label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.textSecondary)
                .frame(width: 90, alignment: .leading)
            Text(value)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textPrimary)
        }
    }

    // MARK: - Terms & Notes

    private func termsSection(_ terms: String) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                Text("Terms & Conditions")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
                    .textCase(.uppercase)

                Text(terms)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func notesSection(_ notesText: String) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                Text("Notes")
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textMuted)
                    .textCase(.uppercase)

                Text(notesText)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        VStack(spacing: 0) {
            Divider()
                .overlay(SpentyColors.borderSubtle)

            HStack(spacing: SpentySpacing.lg) {
                Button {
                    sharePDF()
                } label: {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .font(SpentyFonts.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(SpentyColors.brandAccent)
                }
                .buttonStyle(.plain)

                Spacer()

                if let onEdit {
                    SecondaryButton("Edit", icon: "pencil") {
                        dismiss()
                        onEdit()
                    }
                }

                if bill.paymentStatus?.lowercased() != "paid", let onRecordPayment {
                    PrimaryButton("Pay", icon: "banknote") {
                        dismiss()
                        onRecordPayment()
                    }
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
            .background(SpentyColors.surface)
        }
    }

    // MARK: - Helpers

    private var statusType: StatusType {
        switch bill.paymentStatus?.lowercased() {
        case "paid": return .paid
        case "partial": return .partial
        default: return .unpaid
        }
    }

    private func sharePDF() {
        // PDF generation and sharing will be handled by a dedicated utility
        // This is a placeholder for the share action
    }
}

#Preview {
    let sampleBill = Bill(
        billId: "preview-1",
        userId: nil,
        billNumber: "BILL-001",
        billType: "gst",
        billDate: "2026-04-15",
        dueDate: "2026-05-15",
        vendorId: "v1",
        vendorName: "Acme Supplies Pvt Ltd",
        vendorGstin: "27AABCU9603R1ZM",
        vendorAddress: "123 Business Park, Mumbai",
        vendorState: "Maharashtra",
        placeOfSupply: "Maharashtra",
        lineItems: [
            LineItem(description: "Office Supplies", quantity: 10, rate: 500, discountPercent: 0, gstRate: 18, hsnSac: "4820", amount: 5000, taxAmount: 900)
        ],
        subtotal: 5000,
        taxTotal: 900,
        grandTotal: 5900,
        paymentStatus: "unpaid",
        amountPaid: 0,
        paymentAccountId: nil,
        paymentMethod: nil,
        paymentDate: nil,
        poNumber: "PO-2026-042",
        notes: "Monthly supplies order",
        termsConditions: "Payment due within 30 days",
        createdAt: "2026-04-15T10:00:00Z"
    )

    BillPreviewView(
        bill: sampleBill,
        settings: nil
    )
}
