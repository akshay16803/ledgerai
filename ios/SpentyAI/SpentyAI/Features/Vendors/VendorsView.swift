import SwiftUI

struct VendorsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = VendorsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    tabBar
                        .padding(.horizontal, SpentySpacing.lg)
                        .padding(.vertical, SpentySpacing.sm)

                    if viewModel.isLoading && viewModel.vendors.isEmpty
                        && viewModel.creditors.isEmpty
                        && viewModel.billAging == nil
                        && viewModel.purchasesByVendor.isEmpty {
                        Spacer()
                        ProgressView()
                            .controlSize(.large)
                            .tint(SpentyColors.brandAccent)
                        Spacer()
                    } else if let error = viewModel.errorMessage,
                              viewModel.vendors.isEmpty {
                        EmptyState(
                            icon: "exclamationmark.triangle",
                            title: "Something Went Wrong",
                            message: error,
                            actionTitle: "Retry",
                            action: { Task { await viewModel.loadAll() } }
                        )
                    } else {
                        tabContent
                    }
                }
            }
            .navigationTitle("Vendors")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await viewModel.loadAll()
            }
            .refreshable {
                await viewModel.refresh()
            }
            .overlay(alignment: .bottomTrailing) {
                if viewModel.selectedTab == .vendors {
                    fabButton
                }
            }
            .sheet(isPresented: $viewModel.showAddVendor, onDismiss: {
                Task { await viewModel.refresh() }
            }) {
                VendorFormSheet(viewModel: viewModel, editing: nil)
            }
            .sheet(item: $viewModel.showEditVendor, onDismiss: {
                Task { await viewModel.refresh() }
            }) { vendor in
                VendorFormSheet(viewModel: viewModel, editing: vendor)
            }
            .alert("Delete Vendor", isPresented: .init(
                get: { viewModel.showDeleteConfirm != nil },
                set: { if !$0 { viewModel.showDeleteConfirm = nil } }
            )) {
                Button("Cancel", role: .cancel) {
                    viewModel.showDeleteConfirm = nil
                }
                Button("Delete", role: .destructive) {
                    if let vendor = viewModel.showDeleteConfirm {
                        Task {
                            _ = await viewModel.deleteVendor(vendor.vendorId)
                        }
                    }
                }
            } message: {
                Text("Are you sure you want to delete this vendor? This action cannot be undone.")
            }
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SpentySpacing.sm) {
                ForEach(VendorsViewModel.Tab.allCases, id: \.self) { tab in
                    FilterChip(tab.rawValue, isSelected: viewModel.selectedTab == tab) {
                        viewModel.selectedTab = tab
                    }
                }
            }
        }
    }

    // MARK: - Tab Content

    @ViewBuilder
    private var tabContent: some View {
        switch viewModel.selectedTab {
        case .vendors:
            vendorsTab
        case .creditors:
            creditorsTab
        case .aging:
            agingTab
        case .purchasesByVendor:
            purchasesByVendorTab
        }
    }

    // MARK: - Vendors Tab

    private var vendorsTab: some View {
        VStack(spacing: 0) {
            SearchBar(text: $viewModel.searchText, placeholder: "Search vendors...")
                .padding(.horizontal, SpentySpacing.lg)
                .padding(.bottom, SpentySpacing.sm)

            if viewModel.filteredVendors.isEmpty {
                EmptyState(
                    icon: "person.2",
                    title: "No Vendors Yet",
                    message: viewModel.searchText.isEmpty
                        ? "Add your first vendor to get started."
                        : "No vendors match your search.",
                    actionTitle: viewModel.searchText.isEmpty ? "Add Vendor" : nil,
                    action: viewModel.searchText.isEmpty ? { viewModel.showAddVendor = true } : nil
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: SpentySpacing.sm) {
                        ForEach(viewModel.filteredVendors) { vendor in
                            vendorRow(vendor)
                                .contextMenu {
                                    Button {
                                        viewModel.showEditVendor = vendor
                                    } label: {
                                        Label("Edit", systemImage: "pencil")
                                    }

                                    Divider()

                                    Button(role: .destructive) {
                                        viewModel.showDeleteConfirm = vendor
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        viewModel.showDeleteConfirm = vendor
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }

                                    Button {
                                        viewModel.showEditVendor = vendor
                                    } label: {
                                        Label("Edit", systemImage: "pencil")
                                    }
                                    .tint(SpentyColors.brandAccent)
                                }
                        }
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.bottom, 80)
                }
            }
        }
    }

    private func vendorRow(_ vendor: Vendor) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                Text(vendor.name)
                    .font(SpentyFonts.subheading)
                    .foregroundStyle(SpentyColors.textPrimary)

                if let gstin = vendor.gstin, !gstin.isEmpty {
                    HStack(spacing: SpentySpacing.xs) {
                        Image(systemName: "building.columns")
                            .font(.system(size: 12))
                            .foregroundStyle(SpentyColors.textMuted)
                        Text("GSTIN: \(gstin)")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }
                }

                HStack(spacing: SpentySpacing.lg) {
                    if let phone = vendor.phone, !phone.isEmpty {
                        HStack(spacing: SpentySpacing.xs) {
                            Image(systemName: "phone")
                                .font(.system(size: 12))
                                .foregroundStyle(SpentyColors.textMuted)
                            Text(phone)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)
                        }
                    }

                    if let email = vendor.email, !email.isEmpty {
                        HStack(spacing: SpentySpacing.xs) {
                            Image(systemName: "envelope")
                                .font(.system(size: 12))
                                .foregroundStyle(SpentyColors.textMuted)
                            Text(email)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Creditors Tab

    private var creditorsTab: some View {
        Group {
            if viewModel.creditors.isEmpty {
                EmptyState(
                    icon: "banknote",
                    title: "No Creditors",
                    message: "No outstanding amounts to any vendors."
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: SpentySpacing.sm) {
                        ForEach(viewModel.filteredCreditors) { creditor in
                            creditorRow(creditor)
                        }
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.bottom, SpentySpacing.xl)
                }
            }
        }
    }

    private func creditorRow(_ creditor: CreditorItem) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack(alignment: .top) {
                    Text(creditor.vendorName)
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Spacer()

                    MoneyText(
                        creditor.totalOutstanding,
                        currency: "INR",
                        size: SpentyFonts.subheading
                    )
                    .foregroundStyle(SpentyColors.danger)
                }

                HStack(spacing: SpentySpacing.lg) {
                    HStack(spacing: SpentySpacing.xs) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 12))
                            .foregroundStyle(SpentyColors.textMuted)
                        Text("\(creditor.billCount) bill\(creditor.billCount == 1 ? "" : "s")")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }

                    if let oldest = creditor.oldestDate {
                        HStack(spacing: SpentySpacing.xs) {
                            Image(systemName: "calendar")
                                .font(.system(size: 12))
                                .foregroundStyle(SpentyColors.textMuted)
                            Text("Oldest: \(formatDisplayDate(oldest))")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Aging Tab

    private var agingTab: some View {
        Group {
            if let aging = viewModel.billAging {
                ScrollView {
                    VStack(spacing: SpentySpacing.sm) {
                        agingBucketCard(
                            title: "Current",
                            icon: "clock",
                            iconColor: SpentyColors.success,
                            bucket: aging.current
                        )
                        agingBucketCard(
                            title: "1 - 30 Days",
                            icon: "clock.badge.exclamationmark",
                            iconColor: SpentyColors.info,
                            bucket: aging.period1_30
                        )
                        agingBucketCard(
                            title: "31 - 60 Days",
                            icon: "clock.badge.exclamationmark",
                            iconColor: SpentyColors.warning,
                            bucket: aging.period31_60
                        )
                        agingBucketCard(
                            title: "61 - 90 Days",
                            icon: "exclamationmark.circle",
                            iconColor: SpentyColors.danger,
                            bucket: aging.period61_90
                        )
                        agingBucketCard(
                            title: "90+ Days",
                            icon: "exclamationmark.triangle",
                            iconColor: SpentyColors.danger,
                            bucket: aging.period90Plus
                        )
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.bottom, SpentySpacing.xl)
                }
            } else {
                EmptyState(
                    icon: "chart.bar",
                    title: "No Aging Data",
                    message: "Bill aging data will appear once you have outstanding bills."
                )
            }
        }
    }

    private func agingBucketCard(title: String, icon: String, iconColor: Color, bucket: BillAgingBucket) -> some View {
        let formatter = NumberFormatter()
        let _ = { formatter.numberStyle = .currency; formatter.currencyCode = "INR"; formatter.locale = Locale(identifier: "en_IN") }()
        let formatted = formatter.string(from: NSNumber(value: bucket.amount)) ?? "\(bucket.amount)"

        return StatCard(
            title: title,
            value: formatted,
            subtitle: "\(bucket.count) bill\(bucket.count == 1 ? "" : "s")",
            icon: icon,
            iconColor: iconColor
        )
    }

    // MARK: - Purchases by Vendor Tab

    private var purchasesByVendorTab: some View {
        Group {
            if viewModel.purchasesByVendor.isEmpty {
                EmptyState(
                    icon: "cart",
                    title: "No Purchases",
                    message: "Purchase data by vendor will appear once you have bills."
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: SpentySpacing.sm) {
                        ForEach(viewModel.filteredPurchasesByVendor) { item in
                            purchasesByVendorRow(item)
                        }
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.bottom, SpentySpacing.xl)
                }
            }
        }
    }

    private func purchasesByVendorRow(_ item: PurchasesByVendorItem) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack(alignment: .top) {
                    Text(item.vendorName)
                        .font(SpentyFonts.subheading)
                        .foregroundStyle(SpentyColors.textPrimary)

                    Spacer()

                    MoneyText(
                        item.totalPurchases,
                        currency: "INR",
                        size: SpentyFonts.subheading
                    )
                }

                HStack(spacing: SpentySpacing.lg) {
                    HStack(spacing: SpentySpacing.xs) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 12))
                            .foregroundStyle(SpentyColors.textMuted)
                        Text("\(item.billCount) bill\(item.billCount == 1 ? "" : "s")")
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textSecondary)
                    }

                    if let lastDate = item.lastBillDate {
                        HStack(spacing: SpentySpacing.xs) {
                            Image(systemName: "calendar")
                                .font(.system(size: 12))
                                .foregroundStyle(SpentyColors.textMuted)
                            Text("Last: \(formatDisplayDate(lastDate))")
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textSecondary)
                        }
                    }
                }
            }
        }
    }

    // MARK: - FAB

    private var fabButton: some View {
        Button {
            viewModel.showAddVendor = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(SpentyColors.brandAccent)
                .clipShape(Circle())
                .shadow(color: SpentyColors.brandAccent.opacity(0.4), radius: 8, x: 0, y: 4)
        }
        .padding(.trailing, SpentySpacing.xl)
        .padding(.bottom, SpentySpacing.xl)
    }

    // MARK: - Helpers

    private func formatDisplayDate(_ isoString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var date = isoFormatter.date(from: isoString)
        if date == nil {
            isoFormatter.formatOptions = [.withInternetDateTime]
            date = isoFormatter.date(from: isoString)
        }
        if date == nil {
            let fallback = DateFormatter()
            fallback.dateFormat = "yyyy-MM-dd"
            date = fallback.date(from: isoString)
        }

        guard let parsed = date else { return isoString }
        let display = DateFormatter()
        display.dateStyle = .medium
        return display.string(from: parsed)
    }
}

// MARK: - Vendor Form Sheet

struct VendorFormSheet: View {
    let viewModel: VendorsViewModel
    let editing: Vendor?

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var gstin = ""
    @State private var pan = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var billingAddress = ""
    @State private var city = ""
    @State private var state = ""
    @State private var pincode = ""
    @State private var notes = ""
    @State private var isSaving = false

    private var isEditing: Bool { editing != nil }

    var body: some View {
        NavigationStack {
            ZStack {
                SpentyColors.bgPrimary.ignoresSafeArea()

                Form {
                    Section("Basic Info") {
                        TextField("Vendor Name *", text: $name)
                        TextField("GSTIN", text: $gstin)
                            .textInputAutocapitalization(.characters)
                        TextField("PAN", text: $pan)
                            .textInputAutocapitalization(.characters)
                    }

                    Section("Contact") {
                        TextField("Phone", text: $phone)
                            .keyboardType(.phonePad)
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                    }

                    Section("Address") {
                        TextField("Billing Address", text: $billingAddress)
                        TextField("City", text: $city)
                        TextField("State", text: $state)
                        TextField("Pincode", text: $pincode)
                            .keyboardType(.numberPad)
                    }

                    Section("Notes") {
                        TextField("Notes", text: $notes, axis: .vertical)
                            .lineLimit(3...6)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(isEditing ? "Edit Vendor" : "New Vendor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Add") {
                        Task { await save() }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                if let vendor = editing {
                    name = vendor.name
                    gstin = vendor.gstin ?? ""
                    pan = vendor.pan ?? ""
                    phone = vendor.phone ?? ""
                    email = vendor.email ?? ""
                    billingAddress = vendor.billingAddress ?? ""
                    city = vendor.city ?? ""
                    state = vendor.state ?? ""
                    pincode = vendor.pincode ?? ""
                    notes = vendor.notes ?? ""
                }
            }
            .overlay {
                if isSaving {
                    LoadingOverlay(isPresented: .constant(true))
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            isSaving = false
            return
        }

        let vendorData = VendorCreate(
            name: trimmed,
            gstin: gstin.isEmpty ? nil : gstin,
            pan: pan.isEmpty ? nil : pan,
            phone: phone.isEmpty ? nil : phone,
            email: email.isEmpty ? nil : email,
            billingAddress: billingAddress.isEmpty ? nil : billingAddress,
            city: city.isEmpty ? nil : city,
            state: state.isEmpty ? nil : state,
            pincode: pincode.isEmpty ? nil : pincode,
            notes: notes.isEmpty ? nil : notes
        )

        let success: Bool
        if let vendor = editing {
            success = await viewModel.updateVendor(vendor.vendorId, vendorData)
        } else {
            success = await viewModel.createVendor(vendorData)
        }

        isSaving = false
        if success {
            dismiss()
        }
    }
}
