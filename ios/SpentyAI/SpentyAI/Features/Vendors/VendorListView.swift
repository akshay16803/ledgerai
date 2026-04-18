import SwiftUI

struct VendorListView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary    = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

    // MARK: - State

    @State private var viewModel = VendorsViewModel()

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()

                Group {
                    if viewModel.isLoading && viewModel.vendors.isEmpty {
                        loadingView
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
                    .tint(Brand.primary)
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

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Brand.primary)
            Text("Loading vendors...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Vendors", systemImage: "building.2")
                .foregroundStyle(Brand.primary)
        } description: {
            if viewModel.searchText.isEmpty {
                Text("Add your first vendor to get started.")
            } else {
                Text("No vendors matching \"\(viewModel.searchText)\".")
            }
        } actions: {
            if viewModel.searchText.isEmpty {
                Button {
                    viewModel.startCreate()
                } label: {
                    Text("Add Vendor")
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 10)
                        .background(Brand.primary, in: Capsule())
                }
            }
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
                .listRowBackground(Color.white)
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
                .font(.body.weight(.semibold))
                .foregroundStyle(.primary)

            HStack(spacing: 16) {
                financialPill(label: "Billed", value: vendor.totalBilled, color: Brand.primary)
                financialPill(label: "Paid", value: vendor.totalPaid, color: .green)
                financialPill(label: "Due", value: vendor.outstanding, color: .orange)
            }
        }
        .padding(.vertical, 4)
    }

    private func financialPill(label: String, value: Double?, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(formatCurrency(value ?? 0))
                .font(.caption.weight(.medium).monospacedDigit())
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
