import SwiftUI

struct FeatureRequestsView: View {
    @State private var viewModel = FeatureRequestsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                ScrollView {
                    VStack(spacing: SpentySpacing.xl) {
                        requestsListSection
                    }
                    .padding(.horizontal, SpentySpacing.lg)
                    .padding(.vertical, SpentySpacing.md)
                    .padding(.bottom, 80)
                }
                .refreshable {
                    await viewModel.refresh()
                }
                .shimmer(isActive: viewModel.isLoading && viewModel.requests.isEmpty)

                // FAB to submit
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button {
                            viewModel.showSubmitForm = true
                        } label: {
                            Image(systemName: "plus")
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(.white)
                                .frame(width: 56, height: 56)
                                .background(SpentyColors.brandPrimary)
                                .clipShape(Circle())
                                .shadow(color: SpentyColors.brandPrimary.opacity(0.3), radius: 8, y: 4)
                        }
                        .padding(.trailing, SpentySpacing.lg)
                        .padding(.bottom, SpentySpacing.lg)
                    }
                }
            }
            .background(SpentyColors.bgPrimary)
            .navigationTitle("Feature Requests")
            .task {
                if viewModel.requests.isEmpty {
                    await viewModel.loadRequests()
                }
            }
            .sheet(isPresented: $viewModel.showSubmitForm) {
                submitFormSheet
            }
        }
    }

    // MARK: - Requests List

    @ViewBuilder
    private var requestsListSection: some View {
        if viewModel.requests.isEmpty && !viewModel.isLoading {
            EmptyState(
                icon: "lightbulb",
                title: "No Requests Yet",
                message: "Be the first to suggest a feature or improvement."
            )
        } else {
            ForEach(viewModel.requests) { request in
                SpentyCard {
                    VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                                Text(request.title)
                                    .font(SpentyFonts.subheading)
                                    .foregroundStyle(SpentyColors.textPrimary)

                                if let desc = request.description, !desc.isEmpty {
                                    Text(desc)
                                        .font(SpentyFonts.body)
                                        .foregroundStyle(SpentyColors.textSecondary)
                                        .lineLimit(2)
                                }
                            }
                            Spacer()

                            Button {
                                Task { await viewModel.voteForRequest(request.requestId) }
                            } label: {
                                Image(systemName: "heart")
                                    .font(.title3)
                                    .foregroundStyle(SpentyColors.brandAccent)
                            }
                            .buttonStyle(.plain)
                        }

                        HStack(spacing: SpentySpacing.sm) {
                            if let category = request.category {
                                StatusBadge(
                                    text: category.capitalized,
                                    color: categoryColor(category)
                                )
                            }

                            if let status = request.status {
                                StatusBadge(
                                    text: status.capitalized,
                                    color: statusColor(status)
                                )
                            }

                            Spacer()

                            if let date = request.createdAt {
                                Text(date)
                                    .font(SpentyFonts.caption)
                                    .foregroundStyle(SpentyColors.textMuted)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Submit Form Sheet

    private var submitFormSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: SpentySpacing.xl) {
                    SheetHeader("Submit a Request") {
                        viewModel.showSubmitForm = false
                    }

                    // Title
                    FormField(label: "Title", isRequired: true) {
                        TextField("What would you like to see?", text: $viewModel.title)
                            .font(SpentyFonts.body)
                            .padding(SpentySpacing.md)
                            .background(SpentyColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: SpentyRadius.md)
                                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                            )
                    }

                    // Description
                    FormField(label: "Description") {
                        TextEditor(text: $viewModel.description)
                            .font(SpentyFonts.body)
                            .frame(minHeight: 100)
                            .padding(SpentySpacing.sm)
                            .scrollContentBackground(.hidden)
                            .background(SpentyColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: SpentyRadius.md)
                                    .stroke(SpentyColors.borderSubtle, lineWidth: 1)
                            )
                    }

                    // Category Picker
                    FormField(label: "Category") {
                        Picker("Category", selection: $viewModel.category) {
                            ForEach(FeatureRequestsViewModel.categories, id: \.self) { cat in
                                Text(cat.capitalized).tag(cat)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    // Submit Button
                    PrimaryButton(
                        title: "Submit",
                        isLoading: viewModel.isSubmitting,
                        isDisabled: viewModel.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ) {
                        Task { await viewModel.submitRequest() }
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
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.showSubmitForm = false
                    }
                }
            }
        }
        .presentationDetents([.large])
    }

    // MARK: - Helpers

    private func categoryColor(_ category: String) -> Color {
        switch category.lowercased() {
        case "bug": return SpentyColors.danger
        case "feature": return SpentyColors.info
        case "improvement": return SpentyColors.warning
        default: return SpentyColors.textMuted
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "completed", "done": return SpentyColors.success
        case "in_progress", "in progress": return SpentyColors.warning
        case "pending", "open": return SpentyColors.info
        case "rejected", "closed": return SpentyColors.danger
        default: return SpentyColors.textMuted
        }
    }
}
