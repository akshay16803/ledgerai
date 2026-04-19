import SwiftUI

struct VendorFormView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary    = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

    // MARK: - State

    @Bindable var viewModel: VendorsViewModel

    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var gstin = ""
    @State private var billingAddress = ""
    @State private var isSaving = false

    @Environment(\.dismiss) private var dismiss

    private var isEditing: Bool { viewModel.editingVendor != nil }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.background.ignoresSafeArea()

                Form {
                    Section {
                        TextField("Vendor Name", text: $name)
                            .textContentType(.organizationName)
                    } header: {
                        Text("Name *")
                    }

                    Section("Contact") {
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .autocapitalization(.none)

                        TextField("Phone", text: $phone)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                    }

                    Section("Business") {
                        TextField("GSTIN", text: $gstin)
                            .autocapitalization(.allCharacters)

                        TextField("Address", text: $billingAddress, axis: .vertical)
                            .lineLimit(3...6)
                            .textContentType(.fullStreetAddress)
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
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                    .tint(Brand.primary)
                }
            }
            .onAppear(perform: populateIfEditing)
        }
    }

    // MARK: - Actions

    private func populateIfEditing() {
        guard let vendor = viewModel.editingVendor else { return }
        name    = vendor.name ?? ""
        email   = vendor.email ?? ""
        phone   = vendor.phone ?? ""
        gstin   = vendor.gstin ?? ""
        billingAddress = vendor.billingAddress ?? ""
    }

    private func save() async {
        isSaving = true
        if let vendor = viewModel.editingVendor {
            await viewModel.updateVendor(
                id: vendor.id, name: name,
                email: email, phone: phone,
                gstin: gstin, billingAddress: billingAddress
            )
        } else {
            await viewModel.createVendor(
                name: name, email: email,
                phone: phone, gstin: gstin,
                billingAddress: billingAddress
            )
        }
        isSaving = false
        if !viewModel.showError {
            dismiss()
        }
    }
}

// MARK: - Preview

#Preview {
    VendorFormView(viewModel: VendorsViewModel())
}
