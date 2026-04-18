import SwiftUI

struct CustomerDetailView: View {

    // MARK: - Brand

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
        static let error = Color(red: 0x96 / 255, green: 0x45 / 255, blue: 0x3A / 255)
    }

    // MARK: - Properties

    let customer: Customer
    @Bindable var viewModel: CustomersViewModel

    // MARK: - Body

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    infoCard
                    financialSummary
                    invoicesSection
                }
                .padding()
            }
        }
        .navigationTitle(customer.name ?? "Customer")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") {
                    viewModel.startEdit(customer)
                }
                .foregroundStyle(Brand.primary)
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

            infoRow("Name", value: customer.name ?? "")
            if let email = customer.email, !email.isEmpty {
                infoRow("Email", value: email)
            }
            if let phone = customer.phone, !phone.isEmpty {
                infoRow("Phone", value: phone)
            }
            if let gstin = customer.gstin, !gstin.isEmpty {
                infoRow("GSTIN", value: gstin)
            }
            if let billing = customer.billingAddress, !billing.isEmpty {
                infoRow("Billing Address", value: billing)
            }
            if let shipping = customer.shippingAddress, !shipping.isEmpty {
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
                summaryTile("Invoiced", amount: customer.totalInvoiced ?? 0, color: Brand.primary)
                Divider().frame(height: 44)
                summaryTile("Paid", amount: customer.totalPaid ?? 0, color: .green)
                Divider().frame(height: 44)
                summaryTile("Outstanding", amount: customer.outstanding ?? 0, color: Brand.error)
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
                if let date = invoice.date {
                    Text(date, style: .date)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(invoice.total ?? 0))
                    .font(.subheadline.weight(.semibold))
                if let status = invoice.status {
                    statusBadge(status)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func statusBadge(_ status: String) -> some View {
        let color: Color = switch status.lowercased() {
        case "paid": .green
        case "overdue": Brand.error
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
            .foregroundStyle(Brand.primary)
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
