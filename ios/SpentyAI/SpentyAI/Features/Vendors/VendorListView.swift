import SwiftUI

struct VendorListView: View {

    // MARK: - State

    @State private var viewModel = VendorsViewModel()

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Group {
                    if viewModel.isLoading && viewModel.vendors.isEmpty {
                        LoadingView(message: "Loading vendors...")
                    } else if viewModel.filteredVendors.isEmpty && !viewModel.isLoading {
                        emptyState
                    } else {
                        vendorList
                    }
                }
            }
            .navigationTitle("Vendors")
            .searchable(text: $viewModel.searchText, prompt: "Search vendors")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        viewModel.startCreate()
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                    .tint(Color.spentyPrimary)
                }
            }
            .sheet(isPresented: $viewModel.showForm) {
                VendorFormView(viewModel: viewModel)
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK") { viewModel.dismissError() }
            } message: {
                Text(viewModel.errorMessage)
            }
            .task {
                await viewModel.loadVendors()
            }
        }
    }

    // MARK: - Sub-views

    private var emptyState: some View {
        EmptyStateView(
            icon: "building.2",
            title: "No Vendors",
            subtitle: viewModel.searchText.isEmpty
                ? "Add your first vendor to get started."
                : "No vendors matching \"\(viewModel.searchText)\".",
            buttonTitle: viewModel.searchText.isEmpty ? "Add Vendor" : nil
        ) {
            viewModel.startCreate()
        }
    }

    private var vendorList: some View {
        List {
            ForEach(viewModel.filteredVendors) { vendor in
                NavigationLink {
                    VendorDetailView(viewModel: viewModel, vendor: vendor)
                } label: {
                    vendorRow(vendor)
                }
                .listRowBackground(Color.spentyCardBg)
            }
            .onDelete { offsets in
                Task { await viewModel.deleteVendor(at: offsets) }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.loadVendors()
        }
    }

    private func vendorRow(_ vendor: Vendor) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(vendor.name ?? "Unnamed")
                .font(SpentyFonts.body.weight(.semibold))
                .foregroundStyle(Color.spentyTextPrimary)

            HStack(spacing: 16) {
                financialPill(label: "Billed", value: vendor.totalBilled, color: .spentyPrimary)
                financialPill(label: "Paid", value: vendor.totalPaid, color: .spentySuccess)
                financialPill(label: "Due", value: vendor.outstanding, color: .spentyWarning)
            }
        }
        .padding(.vertical, 4)
    }

    private func financialPill(label: String, value: Double?, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(SpentyFonts.caption2)
                .foregroundStyle(Color.spentyTextSecondary)
            Text(formatCurrency(value ?? 0))
                .font(SpentyFonts.caption1.weight(.medium).monospacedDigit())
                .foregroundStyle(color)
        }
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
    VendorListView()
}
