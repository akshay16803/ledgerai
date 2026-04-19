import SwiftUI

struct FeatureRequestFormView: View {

    // MARK: - State

    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var description = ""
    @State private var category: FeatureRequestCategory = .feature
    @State private var isSubmitting = false

    var onSubmit: (String, String, FeatureRequestCategory) async -> Void

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.spentyBgPrimary
                    .ignoresSafeArea()

                Form {
                    Section {
                        TextField("Title", text: $title)
                            .inputStyle()
                    } header: {
                        Text("Title")
                    } footer: {
                        Text("A short, descriptive title for your request.")
                    }

                    Section("Description") {
                        TextEditor(text: $description)
                            .frame(minHeight: 120)
                            .scrollContentBackground(.hidden)
                            .padding(8)
                            .background(Color.spentyBgPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(Color.spentyBorder, lineWidth: 1)
                            )
                            .overlay(alignment: .topLeading) {
                                if description.isEmpty {
                                    Text("Describe what you'd like to see...")
                                        .foregroundStyle(.tertiary)
                                        .padding(.top, 16)
                                        .padding(.leading, 12)
                                        .allowsHitTesting(false)
                                }
                            }
                    }

                    Section("Category") {
                        Picker("Category", selection: $category) {
                            ForEach(FeatureRequestCategory.allCases, id: \.self) { cat in
                                Text(cat.rawValue).tag(cat)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(.spentyPrimary)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("New Request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        isSubmitting = true
                        Task {
                            await onSubmit(title, description, category)
                            isSubmitting = false
                        }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                                .tint(.spentyPrimary)
                        } else {
                            Text("Submit")
                                .fontWeight(.semibold)
                        }
                    }
                    .tint(.spentyPrimary)
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    FeatureRequestFormView { _, _, _ in }
}
