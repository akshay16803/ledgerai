import SwiftUI

struct SupportView: View {
    @State private var viewModel = SupportViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        // Subject
                        FormField(label: "Subject", isRequired: true) {
                            TextField("Brief summary of your issue", text: $viewModel.subject)
                                .font(SpentyFonts.body)
                                .padding(SpentySpacing.md)
                                .background(SpentyColors.surface)
                                .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: SpentyRadius.md)
                                        .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                                )
                        }

                        // Category Picker
                        FormField(label: "Category") {
                            Picker("Category", selection: $viewModel.selectedCategory) {
                                ForEach(SupportViewModel.categories, id: \.self) { cat in
                                    Text(SupportViewModel.categoryLabels[cat] ?? cat.capitalized)
                                        .tag(cat)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        // Priority Picker
                        FormField(label: "Priority") {
                            Picker("Priority", selection: $viewModel.selectedPriority) {
                                ForEach(SupportViewModel.priorities, id: \.self) { priority in
                                    Text(SupportViewModel.priorityLabels[priority] ?? priority.capitalized)
                                        .tag(priority)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        // Message
                        FormField(label: "Message", isRequired: true) {
                            TextEditor(text: $viewModel.message)
                                .font(SpentyFonts.body)
                                .frame(minHeight: 120)
                                .padding(SpentySpacing.sm)
                                .scrollContentBackground(.hidden)
                                .background(SpentyColors.surface)
                                .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: SpentyRadius.md)
                                        .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                                )
                        }

                        // Submit Button
                        PrimaryButton(
                            title: "Submit Ticket",
                            isLoading: viewModel.isSubmitting,
                            isDisabled: viewModel.subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                || viewModel.message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ) {
                            Task { await viewModel.submitTicket() }
                        }

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.danger)
                                .multilineTextAlignment(.center)
                        }
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.vertical, SpentySpacing.md)
                }
                .background(SpentyColors.bgPrimary)

                // Loading overlay
                LoadingOverlay(isPresented: .constant(viewModel.isSubmitting))
            }
            .navigationTitle("Support")
            .alert("Ticket Submitted", isPresented: $viewModel.showSuccess) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Ticket submitted! We'll get back to you via email.")
            }
        }
    }
}
