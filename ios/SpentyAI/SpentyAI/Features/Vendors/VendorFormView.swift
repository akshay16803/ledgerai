import SwiftUI

struct VendorFormView: View {

    // MARK: - State


    @Environment(LocalizationManager.self) var lang
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
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    Section {
                        TextField(lang.s("vendor_name"), text: $name)
                            .textContentType(.organizationName)
                    } header: {
                        Text(lang.s("name") + " *")
                    }

                    Section(lang.s("contact")) {
                        TextField(lang.s("email"), text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .autocapitalization(.none)

                        TextField(lang.s("phone"), text: $phone)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                    }

                    Section(lang.s("business")) {
                        TextField(lang.s("gstin"), text: $gstin)
                            .autocapitalization(.allCharacters)

                        TextField(lang.s("address"), text: $billingAddress, axis: .vertical)
                            .lineLimit(3...6)
                            .textContentType(.fullStreetAddress)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(isEditing ? lang.s("edit_vendor") : lang.s("new_vendor"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(lang.s("cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text(lang.s("save"))
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                    .tint(Color.spentyPrimary)
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
