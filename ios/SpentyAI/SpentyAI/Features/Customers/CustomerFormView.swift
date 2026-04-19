import SwiftUI

struct CustomerFormView: View {

    // MARK: - State

    @Bindable var viewModel: CustomersViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var gstin = ""
    @State private var billingAddress = ""
    @State private var shippingAddress = ""
    @State private var showValidation = false
    @State private var isSaving = false

    private var isEditing: Bool { viewModel.editingCustomer != nil }

    private var isNameValid: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary.ignoresSafeArea()

                Form {
                    Section {
                        TextField("Customer Name *", text: $name)
                            .textContentType(.organizationName)
                        if showValidation && !isNameValid {
                            Text("Name is required.")
                                .font(.caption)
                                .foregroundStyle(Color.spentyError)
                        }
                    } header: {
                        Text("Required")
                    }

                    Section {
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .autocapitalization(.none)

                        TextField("Phone", text: $phone)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)

                        TextField("GSTIN", text: $gstin)
                            .autocapitalization(.allCharacters)
                    } header: {
                        Text("Contact")
                    }

                    Section {
                        TextField("Billing Address", text: $billingAddress, axis: .vertical)
                            .lineLimit(2...4)
                            .textContentType(.fullStreetAddress)

                        TextField("Shipping Address", text: $shippingAddress, axis: .vertical)
                            .lineLimit(2...4)
                            .textContentType(.fullStreetAddress)
                    } header: {
                        Text("Addresses")
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(isEditing ? "Edit Customer" : "New Customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.spentyPrimary)
                    .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .onAppear(perform: populateFields)
        }
    }

    // MARK: - Actions

    private func save() async {
        showValidation = true
        guard isNameValid else { return }

        isSaving = true

        let payload = CustomerPayload(
            name: name.trimmingCharacters(in: .whitespaces),
            email: email.isEmpty ? nil : email.trimmingCharacters(in: .whitespaces),
            phone: phone.isEmpty ? nil : phone.trimmingCharacters(in: .whitespaces),
            gstin: gstin.isEmpty ? nil : gstin.trimmingCharacters(in: .whitespaces),
            billingAddress: billingAddress.isEmpty ? nil : billingAddress.trimmingCharacters(in: .whitespaces),
            shippingAddress: shippingAddress.isEmpty ? nil : shippingAddress.trimmingCharacters(in: .whitespaces)
        )

        var success = false
        if let existing = viewModel.editingCustomer {
            success = await viewModel.updateCustomer(id: existing.id, payload)
        } else {
            success = await viewModel.createCustomer(payload)
        }

        isSaving = false
        if success { dismiss() }
    }

    private func populateFields() {
        guard let customer = viewModel.editingCustomer else { return }
        name = customer.name ?? ""
        email = customer.email ?? ""
        phone = customer.phone ?? ""
        gstin = customer.gstin ?? ""
        billingAddress = customer.billingAddress ?? ""
        shippingAddress = customer.shippingAddress ?? ""
    }
}

// MARK: - Preview

#Preview {
    CustomerFormView(viewModel: CustomersViewModel())
}
