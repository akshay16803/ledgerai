import SwiftUI

struct PurchaseListView: View {

    // MARK: - State

    @State private var viewModel = PurchasesViewModel()
    @State private var showDeleteConfirm = false
    @State private var billToDelete: Bill?

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Group {
                    if viewModel.isLoading && viewModel.bills.isEmpty {
                        ProgressView()
                            .tint(.spentyPrimary)
                    } else if viewModel.filteredBills.isEmpty {
                        emptyState
                    } else {
                        billsList
                    }
                }
            }
            .navigationTitle("Purchases")
            .searchable(text: $viewModel.searchText, prompt: "Search bills...")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        Button {
                            viewModel.startUpload()
                        } label: {
                            Image(systemName: "doc.text.viewfinder")
                                .foregroundStyle(.spentyPrimary)
                        }

                        Button {
                            viewModel.startCreate()
                        } label: {
                            Image(systemName: "plus")
                                .fontWeight(.semibold)
                                .foregroundStyle(.spentyPrimary)
                        }
                    }
                }
            }
            .refreshable {
                await viewModel.loadAll()
            }
            .sheet(isPresented: $viewModel.showForm) {
                PurchaseFormView(viewModel: viewModel)
            }
            .sheet(isPresented: $viewModel.showPaymentSheet) {
                if let bill = viewModel.paymentBill {
                    RecordBillPaymentView(viewModel: viewModel, bill: bill)
                }
            }
            .sheet(isPresented: $viewModel.showPreview) {
                if let id = viewModel.previewBillId {
                    PurchasePreviewView(viewModel: viewModel, billId: id)
                }
            }
            .sheet(isPresented: $viewModel.showUploadParser) {
                BillUploadParserView(viewModel: viewModel)
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .alert("Delete Bill", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) { billToDelete = nil }
                Button("Delete", role: .destructive) {
                    if let bill = billToDelete {
                        Task { await viewModel.deleteBill(id: bill.id) }
                    }
                    billToDelete = nil
                }
            } message: {
                Text("Are you sure you want to delete this bill? This cannot be undone.")
            }
            .task {
                await viewModel.loadAll()
            }
        }
    }

    // MARK: - Bills List

    private var billsList: some View {
        List {
            statsSection

            filterSection

            billsSection

            if !viewModel.creditors.isEmpty {
                creditorsSection
            }

            if !viewModel.aging.isEmpty {
                agingSection
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Stats Cards

    private var statsSection: some View {
        Section {
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                StatCard(
                    label: "Total Billed",
                    value: formatCurrency(viewModel.stats?.totalBilled ?? 0),
                    icon: "doc.text.fill",
                    color: .spentyPrimary
                )
                StatCard(
                    label: "Paid",
                    value: formatCurrency(viewModel.stats?.totalPaid ?? 0),
                    icon: "checkmark.circle.fill",
                    color: .spentySuccess
                )
                StatCard(
                    label: "Outstanding",
                    value: formatCurrency(viewModel.stats?.totalOutstanding ?? 0),
                    icon: "clock.fill",
                    color: .spentyWarning
                )
                StatCard(
                    label: "Overdue",
                    value: formatCurrency(viewModel.stats?.totalOverdue ?? 0),
                    icon: "exclamationmark.triangle.fill",
                    color: .spentyError
                )
            }
            .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            .listRowBackground(Color.clear)
        }
    }

    // MARK: - Filter

    private var filterSection: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(PurchasesViewModel.statusOptions, id: \.self) { option in
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                viewModel.statusFilter = option
                            }
                        } label: {
                            Text(option.capitalized)
                                .font(SpentyFonts.caption1)
                                .fontWeight(.medium)
                                .foregroundStyle(viewModel.statusFilter == option ? .white : .spentyTextPrimary)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 7)
                                .background(
                                    viewModel.statusFilter == option
                                        ? Color.spentyPrimary
                                        : Color.spentyCardBg
                                )
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(Color.spentyBorder, lineWidth: viewModel.statusFilter == option ? 0 : 1)
                                )
                        }
                    }
                }
                .padding(.vertical, 4)
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
        }
    }

    // MARK: - Bills Rows

    private var billsSection: some View {
        Section {
            ForEach(viewModel.filteredBills) { bill in
                billRow(bill)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            billToDelete = bill
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }

                        Button {
                            viewModel.startEdit(bill)
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        .tint(.spentyInfo)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        if bill.paymentStatus?.lowercased() != "paid" {
                            Button {
                                Task { await viewModel.markPaid(id: bill.id) }
                            } label: {
                                Label("Mark Paid", systemImage: "checkmark.circle")
                            }
                            .tint(.spentySuccess)
                        }

                        Button {
                            Task { await viewModel.duplicateBill(id: bill.id) }
                        } label: {
                            Label("Duplicate", systemImage: "doc.on.doc")
                        }
                        .tint(.spentyWarning)
                    }
                    .listRowBackground(Color.spentyCardBg)
            }
        } header: {
            Text("Bills (\(viewModel.filteredBills.count))")
        }
    }

    private func billRow(_ bill: Bill) -> some View {
        Button {
            viewModel.startPreview(bill)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(bill.billNumber ?? "Draft")
                            .font(SpentyFonts.headline)
                            .foregroundStyle(.spentyTextPrimary)

                        Text(bill.vendorName ?? "Unknown Vendor")
                            .font(SpentyFonts.subheadline)
                            .foregroundStyle(.spentyTextSecondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 3) {
                        Text(formatCurrency(bill.grandTotal ?? 0))
                            .font(SpentyFonts.amountSmall)
                            .foregroundStyle(.spentyTextPrimary)

                        StatusBadge(status: bill.paymentStatus ?? "unpaid")
                    }
                }

                HStack(spacing: 16) {
                    Label(formatDate(bill.date), systemImage: "calendar")
                        .font(SpentyFonts.caption1)
                        .foregroundStyle(.spentyTextSecondary)

                    if let dueDate = bill.dueDate {
                        Label("Due: \(formatDate(dueDate))", systemImage: "clock")
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(isDueSoon(dueDate) ? .spentyError : .spentyTextSecondary)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    // MARK: - Creditors Section

    private var creditorsSection: some View {
        Section {
            ForEach(viewModel.creditors) { creditor in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(creditor.vendorName ?? "Unknown")
                            .font(SpentyFonts.subheadline)
                            .foregroundStyle(.spentyTextPrimary)

                        Text("Owed: \(formatCurrency(creditor.outstanding ?? 0))")
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(.spentyError)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 3) {
                        Text(formatCurrency(creditor.totalOwed ?? 0))
                            .font(SpentyFonts.footnote)
                            .foregroundStyle(.spentyTextSecondary)

                        Text("Paid: \(formatCurrency(creditor.totalPaid ?? 0))")
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(.spentySuccess)
                    }
                }
                .padding(.vertical, 2)
                .listRowBackground(Color.spentyCardBg)
            }
        } header: {
            Text("Creditors")
        }
    }

    // MARK: - Aging Section

    private var agingSection: some View {
        Section {
            ForEach(viewModel.aging) { bucket in
                HStack {
                    Text(bucket.bucket ?? "N/A")
                        .font(SpentyFonts.subheadline)
                        .foregroundStyle(.spentyTextPrimary)

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(formatCurrency(bucket.amount ?? 0))
                            .font(SpentyFonts.amountSmall)
                            .foregroundStyle(.spentyTextPrimary)

                        Text("\(bucket.count ?? 0) bills")
                            .font(SpentyFonts.caption1)
                            .foregroundStyle(.spentyTextSecondary)
                    }
                }
                .padding(.vertical, 2)
                .listRowBackground(Color.spentyCardBg)
            }
        } header: {
            Text("Aging Analysis")
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text.magnifyingglass")
                .resizable()
                .scaledToFit()
                .frame(width: 64, height: 64)
                .foregroundStyle(Color.spentyPrimary.opacity(0.4))

            Text("No Bills Yet")
                .font(SpentyFonts.title3)
                .foregroundStyle(.spentyTextPrimary)

            Text(viewModel.searchText.isEmpty
                 ? "Tap + to create your first purchase bill, or upload one to parse."
                 : "No bills match your search.")
                .font(SpentyFonts.subheadline)
                .foregroundStyle(.spentyTextSecondary)
                .multilineTextAlignment(.center)

            if viewModel.searchText.isEmpty {
                HStack(spacing: 12) {
                    Button {
                        viewModel.startCreate()
                    } label: {
                        Label("New Bill", systemImage: "plus")
                            .font(SpentyFonts.headline)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .background(Color.spentyPrimary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    Button {
                        viewModel.startUpload()
                    } label: {
                        Label("Upload", systemImage: "doc.text.viewfinder")
                            .font(SpentyFonts.headline)
                            .foregroundStyle(.spentyPrimary)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .background(Color.spentyPrimary.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color.spentyPrimary, lineWidth: 1)
                            )
                    }
                }
            }
        }
        .padding(32)
    }

    // MARK: - Helpers

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\u{20B9}0"
    }

    private func formatDate(_ date: Date?) -> String {
        guard let date else { return "--" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private func isDueSoon(_ date: Date) -> Bool {
        date < Date()
    }
}

// MARK: - Preview

#Preview {
    PurchaseListView()
}
