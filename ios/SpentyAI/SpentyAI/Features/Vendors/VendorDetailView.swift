import SwiftUI

struct VendorDetailView: View {

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
            Color.spentyBgPrimary.ignoresSafeArea()

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
                .tint(Color.spentyPrimary)
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
                        .fill(Color.spentyPrimary.opacity(0.12))
                        .frame(width: 48, height: 48)

                    Text(String((displayVendor.name ?? "V").prefix(1)).uppercased())
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Color.spentyPrimary)
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
                if let address = displayVendor.billingAddress, !address.isEmpty {
                    infoRow(icon: "mappin.circle.fill", label: "Address", value: address)
                }

                if displayVendor.email == nil && displayVendor.phone == nil && displayVendor.billingAddress == nil {
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
                .foregroundStyle(Color.spentyPrimary)
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
                    color: Color.spentyPrimary,
                    icon: "doc.text.fill"
                )
                summaryTile(
                    title: "Total Paid",
                    value: displayVendor.totalPaid ?? 0,
                    color: .spentySuccess,
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
                        .tint(Color.spentyPrimary)
                    Spacer()
                }
                .padding(.vertical, 24)
            } else if viewModel.vendorBills.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "doc.plaintext")
                            .font(.largeTitle)
                            .foregroundStyle(Color.spentyPrimary.opacity(0.4))
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
        case "paid":      .spentySuccess
        case "partial":   .orange
        case "overdue":   .spentyError
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
                billingAddress: "123 Business Park, Mumbai",
                totalBilled: 150000,
                totalPaid: 120000,
                outstanding: 30000
            )
        )
    }
}
