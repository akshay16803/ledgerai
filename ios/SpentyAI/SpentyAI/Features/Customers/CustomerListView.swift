import SwiftUI

struct CustomerListView: View {

    // MARK: - Brand

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
        static let error = Color(red: 0x96 / 255, green: 0x45 / 255, blue: 0x3A / 255)
    }

    // MARK: - State

    @State private var viewModel = CustomersViewModel()

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()

                Group {
                    if viewModel.isLoading && viewModel.customers.isEmpty {
                        ProgressView()
                            .tint(Brand.primary)
                    } else if viewModel.filteredCustomers.isEmpty {
                        emptyState
                    } else {
                        customerList
                    }
                }
            }
            .navigationTitle("Customers")
            .searchable(text: $viewModel.searchText, prompt: "Search by name or email")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.startCreate()
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                            .foregroundStyle(Brand.primary)
                    }
                }
            }
            .refreshable {
                await viewModel.loadCustomers()
            }
            .sheet(isPresented: $viewModel.showForm) {
                CustomerFormView(viewModel: viewModel)
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .task {
                await viewModel.loadCustomers()
            }
        }
    }

    // MARK: - Sub-views

    private var customerList: some View {
        List {
            ForEach(viewModel.filteredCustomers) { customer in
                NavigationLink {
                    CustomerDetailView(customer: customer, viewModel: viewModel)
                } label: {
                    customerRow(customer)
                }
                .listRowBackground(Color.white)
            }
            .onDelete(perform: deleteCustomers)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func customerRow(_ customer: Customer) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(customer.name)
                .font(.body.weight(.semibold))
                .foregroundStyle(.primary)

            HStack(spacing: 16) {
                financialLabel("Invoiced", amount: customer.totalInvoiced)
                financialLabel("Paid", amount: customer.totalPaid)
                financialLabel("Due", amount: customer.outstanding, highlight: true)
            }
            .font(.caption)
        }
        .padding(.vertical, 4)
    }

    private func financialLabel(_ title: String, amount: Double?, highlight: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .foregroundStyle(.secondary)
            Text(formatCurrency(amount ?? 0))
                .foregroundStyle(highlight && (amount ?? 0) > 0 ? Brand.error : .primary)
                .fontWeight(highlight ? .semibold : .regular)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.2.slash")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .foregroundStyle(Brand.primary.opacity(0.4))

            Text("No Customers Yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Text(viewModel.searchText.isEmpty
                 ? "Tap the + button to add your first customer."
                 : "No customers match your search.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if viewModel.searchText.isEmpty {
                Button {
                    viewModel.startCreate()
                } label: {
                    Label("Add Customer", systemImage: "plus")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Brand.primary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
        .padding(32)
    }

    // MARK: - Helpers

    private func deleteCustomers(at offsets: IndexSet) {
        let targets = offsets.map { viewModel.filteredCustomers[$0] }
        for customer in targets {
            Task { await viewModel.deleteCustomer(id: customer.id) }
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
    CustomerListView()
}
