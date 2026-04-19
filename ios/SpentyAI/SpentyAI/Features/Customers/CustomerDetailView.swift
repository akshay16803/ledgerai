import SwiftUI

struct CustomerDetailView: View {

    // MARK: - Properties

    let customer: Customer
    @Bindable var viewModel: CustomersViewModel

    private var displayCustomer: Customer {
        viewModel.customers.first(where: { $0.id == customer.id }) ?? customer
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    infoCard
                    financialSummary
                    invoicesSection
                }
                .padding()
            }
        }
        .navigationTitle(displayCustomer.name ?? "Customer")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") {
                    viewModel.startEdit(displayCustomer)
                }
                .foregroundStyle(Color.spentyPrimary)
                .fontWeight(.semibold)
            }
        }
        .sheet(isPresented: $viewModel.showForm) {
            CustomerFormView(viewModel: viewModel)
        }
        .task {
            await viewModel.loadCustomerInvoices(id: customer.id)
        }
    }

    // MARK: - Info Card

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            cardHeader("Customer Details", icon: "person.text.rectangle")

            infoRow("Name", value: displayCustomer.name ?? "")
            if let email = displayCustomer.email, !email.isEmpty {
                infoRow("Email", value: email)
            }
            if let phone = displayCustomer.phone, !phone.isEmpty {
                infoRow("Phone", value: phone)
            }
            if let gstin = displayCustomer.gstin, !gstin.isEmpty {
                infoRow("GSTIN", value: gstin)
            }
            if let billing = displayCustomer.billingAddress, !billing.isEmpty {
                infoRow("Billing Address", value: billing)
            }
            if let shipping = displayCustomer.shippingAddress, !shipping.isEmpty {
                infoRow("Shipping Address", value: shipping)
            }
        }
        .padding(16)
        .background(.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
    }

    // MARK: - Financial Summary

    private var financialSummary: some View {
        VStack(alignment: .leading, spacing: 12) {
            cardHeader("Financial Summary", icon: "indianrupeesign.circle")

            HStack(spacing: 0) {
                summaryTile("Invoiced", amount: displayCustomer.totalInvoiced ?? 0, color: Color.spentyPrimary)
                Divider().frame(height: 44)
                summaryTile("Paid", amount: displayCustomer.totalPaid ?? 0, color: .green)
                Divider().frame(height: 44)
                summaryTile("Outstanding", amount: displayCustomer.outstanding ?? 0, color: Color.spentyError)
            }
        }
        .padding(16)
        .background(.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
    }

    private func summaryTile(_ title: String, amount: Double, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(formatCurrency(amount))
                .font(.subheadline.weight(.bold))
                .foregroundStyle(color)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Invoices

    private var invoicesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            cardHeader("Invoices", icon: "doc.text")

            if viewModel.customerInvoices.isEmpty {
                Text("No invoices found for this customer.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 16)
            } else {
                ForEach(viewModel.customerInvoices) { invoice in
                    invoiceRow(invoice)
                    if invoice.id != viewModel.customerInvoices.last?.id {
                        Divider()
                    }
                }
            }
        }
        .padding(16)
        .background(.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
    }

    private func invoiceRow(_ invoice: CustomerInvoice) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(invoice.invoiceNumber ?? "Invoice")
                    .font(.subheadline.weight(.semibold))
                if let date = invoice.invoiceDate, !date.isEmpty {
                    Text(formatDateString(date))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(invoice.grandTotal ?? 0))
                    .font(.subheadline.weight(.semibold))
                if let status = invoice.paymentStatus {
                    statusBadge(status)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func statusBadge(_ status: String) -> some View {
        let color: Color = switch status.lowercased() {
        case "paid": .green
        case "overdue": Color.spentyError
        case "sent", "pending": .orange
        default: .secondary
        }

        return Text(status.capitalized)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: Capsule())
    }

    // MARK: - Shared Helpers

    private func cardHeader(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.headline)
            .foregroundStyle(Color.spentyPrimary)
    }

    private func infoRow(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\u{20B9}0"
    }

    private func formatDateString(_ dateString: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        if let date = parser.date(from: dateString) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .none
            return display.string(from: date)
        }
        return dateString
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CustomerDetailView(
            customer: Customer(
                id: "1",
                name: "Acme Corp",
                email: "billing@acme.com",
                phone: "+91 98765 43210",
                gstin: "29ABCDE1234F1Z5",
                billingAddress: "123 MG Road, Bangalore",
                shippingAddress: "456 Outer Ring Rd, Bangalore",
                totalInvoiced: 150000,
                totalPaid: 100000,
                outstanding: 50000
            ),
            viewModel: CustomersViewModel()
        )
    }
}
