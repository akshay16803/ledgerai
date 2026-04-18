import SwiftUI

struct VendorDetailView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary    = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let primaryDark = Color(red: 0x2C / 255, green: 0x46 / 255, blue: 0x38 / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

    // MARK: - State

    @Bindable var viewModel: VendorsViewModel
    let vendor: Vendor

    @Environment(\.dismiss) private var dismiss

    private var displayVendor: Vendor {
        viewModel.vendors.first(where: { $0.id == vendor.id }) ?? vendor
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    infoCard
                    financialSummary
                    billsSection
                }
                .padding()
            }
        }
        .navigationTitle(displayVendor.name ?? "Vendor")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.startEdit(displayVendor)
                } label: {
                    Text("Edit")
                        .fontWeight(.medium)
                }
                .tint(Brand.primary)
            }
        }
        .sheet(isPresented: $viewModel.showForm) {
            VendorFormView(viewModel: viewModel)
        }
        .task {
            await viewModel.loadVendorBills(vendorId: vendor.id)
        }
    }

    // MARK: - Info Card

    private var infoCard: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                ZStack {
                    Circle()
                        .fill(Brand.primary.opacity(0.12))
                        .frame(width: 48, height: 48)

                    Text(String((displayVendor.name ?? "V").prefix(1)).uppercased())
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Brand.primary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(displayVendor.name ?? "Unnamed")
                        .font(.headline)
                    if let gstin = displayVendor.gstin, !gstin.isEmpty {
                        Text("GSTIN: \(gstin)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()
            }
            .padding()

            Divider().padding(.horizontal)

            // Contact details
            VStack(spacing: 0) {
                if let email = displayVendor.email, !email.isEmpty {
                    infoRow(icon: "envelope.fill", label: "Email", value: email)
                }
                if let phone = displayVendor.phone, !phone.isEmpty {
                    infoRow(icon: "phone.fill", label: "Phone", value: phone)
                }
                if let address = displayVendor.address, !address.isEmpty {
                    infoRow(icon: "mappin.circle.fill", label: "Address", value: address)
                }

                if displayVendor.email == nil && displayVendor.phone == nil && displayVendor.address == nil {
                    HStack {
                        Text("No contact details added.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding()
                }
            }
        }
        .background(.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
    }

    private func infoRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(Brand.primary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline)
            }

            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }

    // MARK: - Financial Summary

    private var financialSummary: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Financial Summary")
                .font(.headline)
                .padding(.horizontal, 4)

            HStack(spacing: 12) {
                summaryTile(
                    title: "Total Billed",
                    value: displayVendor.totalBilled ?? 0,
                    color: Brand.primary,
                    icon: "doc.text.fill"
                )
                summaryTile(
                    title: "Total Paid",
                    value: displayVendor.totalPaid ?? 0,
                    color: .green,
                    icon: "checkmark.circle.fill"
                )
                summaryTile(
                    title: "Outstanding",
                    value: displayVendor.outstanding ?? 0,
                    color: .orange,
                    icon: "exclamationmark.circle.fill"
                )
            }
        }
    }

    private func summaryTile(title: String, value: Double, color: Color, icon: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            Text(formatCurrency(value))
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.primary)

            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
    }

    // MARK: - Bills

    private var billsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Bills")
                .font(.headline)
                .padding(.horizontal, 4)

            if viewModel.isLoadingBills {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Brand.primary)
                    Spacer()
                }
                .padding(.vertical, 24)
            } else if viewModel.vendorBills.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "doc.plaintext")
                            .font(.largeTitle)
                            .foregroundStyle(Brand.primary.opacity(0.4))
                        Text("No bills found")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 24)
                .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(viewModel.vendorBills.enumerated()), id: \.element.id) { index, bill in
                        billRow(bill)

                        if index < viewModel.vendorBills.count - 1 {
                            Divider().padding(.horizontal)
                        }
                    }
                }
                .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
            }
        }
    }

    private func billRow(_ bill: VendorBill) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(bill.billNumber ?? "Bill")
                    .font(.subheadline.weight(.medium))

                if let date = bill.date {
                    Text(date)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(bill.total ?? 0))
                    .font(.subheadline.weight(.semibold).monospacedDigit())

                if let status = bill.status {
                    statusBadge(status)
                }
            }
        }
        .padding()
    }

    private func statusBadge(_ status: String) -> some View {
        let color: Color = switch status.lowercased() {
        case "paid":      .green
        case "partial":   .orange
        case "overdue":   .red
        default:          .secondary
        }

        return Text(status.capitalized)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.12), in: Capsule())
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        VendorDetailView(
            viewModel: VendorsViewModel(),
            vendor: Vendor(
                id: "1",
                name: "Acme Corp",
                email: "billing@acme.com",
                phone: "+91 98765 43210",
                gstin: "29ABCDE1234F1Z5",
                address: "123 Business Park, Mumbai",
                totalBilled: 150000,
                totalPaid: 120000,
                outstanding: 30000
            )
        )
    }
}
