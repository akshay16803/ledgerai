import SwiftUI

struct SupportView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary    = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255) // #3A5C4A
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255) // #F8F6F3
        static let primaryDark = Color(red: 0x2C / 255, green: 0x46 / 255, blue: 0x38 / 255)
    }

    // MARK: - State

    @State private var viewModel = SupportViewModel()
    @State private var expandedFAQ: String?

    // MARK: - Body

    var body: some View {
        ZStack {
            Brand.background
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    headerSection
                    ticketFormSection
                    faqSection
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
        }
        .navigationTitle("Support")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await viewModel.loadFAQ()
        }
        .alert("Error", isPresented: .init(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.dismissError() } }
        )) {
            Button("OK") { viewModel.dismissError() }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .alert("Ticket Submitted", isPresented: $viewModel.isSubmitted) {
            Button("OK") { viewModel.dismissSuccess() }
        } message: {
            Text("We've received your support request and will get back to you shortly.")
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(Brand.primary.opacity(0.12))
                    .frame(width: 64, height: 64)

                Image(systemName: "headphones.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 36, height: 36)
                    .foregroundStyle(Brand.primary)
            }

            Text("How can we help?")
                .font(.title2.weight(.bold))
                .foregroundStyle(Brand.primaryDark)

            Text("Submit a ticket or browse our FAQ below.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    // MARK: - Ticket Form

    private var ticketFormSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionLabel("Submit a Ticket", icon: "envelope.fill")

            // Subject
            VStack(alignment: .leading, spacing: 6) {
                Text("Subject")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Brand.primaryDark)

                TextField("Brief description of your issue", text: $viewModel.subject)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(Color(.systemGray4), lineWidth: 1)
                    )
            }

            // Category Picker
            VStack(alignment: .leading, spacing: 6) {
                Text("Category")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Brand.primaryDark)

                Menu {
                    ForEach(TicketCategory.allCases) { cat in
                        Button {
                            viewModel.category = cat
                        } label: {
                            Label(cat.displayName, systemImage: cat.icon)
                        }
                    }
                } label: {
                    HStack {
                        Label(viewModel.category.displayName, systemImage: viewModel.category.icon)
                            .foregroundStyle(Brand.primaryDark)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(Color(.systemGray4), lineWidth: 1)
                    )
                }
            }

            // Priority Picker
            VStack(alignment: .leading, spacing: 6) {
                Text("Priority")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Brand.primaryDark)

                HStack(spacing: 10) {
                    ForEach(TicketPriority.allCases) { p in
                        Button {
                            viewModel.priority = p
                        } label: {
                            Text(p.displayName)
                                .font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity, minHeight: 40)
                                .foregroundStyle(viewModel.priority == p ? .white : Brand.primaryDark)
                                .background(
                                    viewModel.priority == p
                                        ? AnyShapeStyle(Brand.primary)
                                        : AnyShapeStyle(Color.white)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .strokeBorder(
                                            viewModel.priority == p ? Brand.primary : Color(.systemGray4),
                                            lineWidth: 1
                                        )
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            // Message
            VStack(alignment: .leading, spacing: 6) {
                Text("Message")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Brand.primaryDark)

                TextEditor(text: $viewModel.message)
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .frame(minHeight: 120)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(Color(.systemGray4), lineWidth: 1)
                    )
                    .overlay(alignment: .topLeading) {
                        if viewModel.message.isEmpty {
                            Text("Describe your issue in detail...")
                                .foregroundStyle(Color(.placeholderText))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 16)
                                .allowsHitTesting(false)
                        }
                    }
            }

            // Submit Button
            Button {
                Task { await viewModel.submitTicket() }
            } label: {
                HStack(spacing: 8) {
                    if viewModel.isSubmitting {
                        ProgressView()
                            .tint(.white)
                    }
                    Text(viewModel.isSubmitting ? "Submitting..." : "Submit Ticket")
                        .font(.body.weight(.semibold))
                }
                .frame(maxWidth: .infinity, minHeight: 50)
                .foregroundStyle(.white)
                .background(viewModel.isFormValid ? Brand.primary : Brand.primary.opacity(0.4))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(color: Brand.primary.opacity(0.25), radius: 8, y: 4)
            }
            .disabled(!viewModel.isFormValid || viewModel.isSubmitting)
            .animation(.easeInOut(duration: 0.2), value: viewModel.isFormValid)
            .animation(.easeInOut(duration: 0.2), value: viewModel.isSubmitting)
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Brand.background)
                .shadow(color: .black.opacity(0.06), radius: 12, y: 4)
        )
    }

    // MARK: - FAQ Section

    private var faqSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionLabel("Frequently Asked Questions", icon: "questionmark.circle.fill")

            if viewModel.isLoadingFAQ {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Brand.primary)
                    Spacer()
                }
                .padding(.vertical, 20)
            } else if viewModel.faqItems.isEmpty {
                Text("No FAQ items available.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else {
                VStack(spacing: 0) {
                    ForEach(viewModel.faqItems) { item in
                        faqRow(item)

                        if item.id != viewModel.faqItems.last?.id {
                            Divider()
                                .padding(.horizontal, 16)
                        }
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color.white)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color(.systemGray5), lineWidth: 1)
                )
            }
        }
        .padding(.bottom, 24)
    }

    // MARK: - FAQ Row

    private func faqRow(_ item: FAQItem) -> some View {
        let isExpanded = expandedFAQ == item.id

        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    expandedFAQ = isExpanded ? nil : item.id
                }
            } label: {
                HStack {
                    Text(item.question)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Brand.primaryDark)
                        .multilineTextAlignment(.leading)

                    Spacer()

                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                .padding(16)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                Text(item.answer)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // MARK: - Helpers

    private func sectionLabel(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.headline.weight(.semibold))
            .foregroundStyle(Brand.primary)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        SupportView()
    }
}
