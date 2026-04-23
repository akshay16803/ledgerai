import SwiftUI

struct CustomerListView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
    @State private var viewModel = CustomersViewModel()

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary.ignoresSafeArea()

            Group {
                if viewModel.isLoading && viewModel.customers.isEmpty {
                    LoadingView(message: "Loading customers...")
                } else if viewModel.filteredCustomers.isEmpty {
                    emptyState
                } else {
                    customerList
                }
            }
        }
        .navigationTitle(lang.s("customers"))
        .searchable(text: $viewModel.searchText, prompt: lang.s("search_customers"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.startCreate()
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.spentyPrimary)
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
            Button(lang.s("ok")) { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .task {
            await viewModel.loadCustomers()
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
                .listRowBackground(Color.spentyCardBg)
            }
            .onDelete(perform: deleteCustomers)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func customerRow(_ customer: Customer) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(customer.name ?? "Unnamed")
                .font(SpentyFonts.body.weight(.semibold))
                .foregroundStyle(Color.spentyTextPrimary)

            HStack(spacing: 16) {
                financialLabel("Invoiced", amount: customer.totalInvoiced)
                financialLabel("Paid", amount: customer.totalPaid)
                financialLabel("Due", amount: customer.outstanding, highlight: true)
            }
            .font(SpentyFonts.caption1)
        }
        .padding(.vertical, 4)
    }

    private func financialLabel(_ title: String, amount: Double?, highlight: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .foregroundStyle(Color.spentyTextSecondary)
            Text(formatCurrency(amount ?? 0))
                .foregroundStyle(highlight && (amount ?? 0) > 0 ? Color.spentyError : Color.spentyTextPrimary)
                .fontWeight(highlight ? .semibold : .regular)
        }
    }

    private var emptyState: some View {
        EmptyStateView(
            icon: "person.2.slash",
            title: lang.s("no_customers"),
            subtitle: viewModel.searchText.isEmpty
                ? "Tap the + button to add your first customer."
                : "No customers match your search.",
            buttonTitle: viewModel.searchText.isEmpty ? "Add Customer" : nil
        ) {
            viewModel.startCreate()
        }
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
        formatter.locale = Locale(identifier: "en_IN")
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "₹0"
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CustomerListView()
    }
}
