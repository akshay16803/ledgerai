import SwiftUI

struct FeatureRequestFormView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

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
                Brand.background
                    .ignoresSafeArea()

                Form {
                    Section {
                        TextField("Title", text: $title)
                    } header: {
                        Text("Title")
                    } footer: {
                        Text("A short, descriptive title for your request.")
                    }

                    Section("Description") {
                        TextEditor(text: $description)
                            .frame(minHeight: 120)
                            .overlay(alignment: .topLeading) {
                                if description.isEmpty {
                                    Text("Describe what you'd like to see...")
                                        .foregroundStyle(.tertiary)
                                        .padding(.top, 8)
                                        .padding(.leading, 4)
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
                        .tint(Brand.primary)
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
                                .tint(Brand.primary)
                        } else {
                            Text("Submit")
                                .fontWeight(.semibold)
                        }
                    }
                    .tint(Brand.primary)
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
