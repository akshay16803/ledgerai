import SwiftUI

struct FeatureRequestsView: View {

    // MARK: - State

    @State private var viewModel = FeatureRequestsViewModel()

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary
                .ignoresSafeArea()

            Group {
                if viewModel.isLoading && viewModel.requests.isEmpty {
                    LoadingView(message: "Loading requests...")
                } else if viewModel.requests.isEmpty {
                    emptyState
                } else {
                    requestList
                }
            }
        }
        .navigationTitle("Feature Requests")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.showForm = true
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                }
                .tint(.spentyPrimary)
            }
        }
        .sheet(isPresented: $viewModel.showForm) {
            FeatureRequestFormView { title, description, category in
                await viewModel.submitRequest(
                    title: title,
                    description: description,
                    category: category
                )
            }
        }
        .alert("Error", isPresented: .init(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .task {
            await viewModel.loadRequests()
        }
    }

    // MARK: - Sub-views

    private var emptyState: some View {
        EmptyStateView(
            icon: "lightbulb",
            title: "No Requests Yet",
            subtitle: "Be the first to suggest a feature!",
            buttonTitle: "Submit a Request"
        ) {
            viewModel.showForm = true
        }
    }

    private var requestList: some View {
        List {
            ForEach(viewModel.requests) { request in
                requestRow(request)
                    .listRowBackground(Color.spentyCardBg)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.loadRequests()
        }
    }

    private func requestRow(_ request: FeatureRequest) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // Vote button
            voteButton(request)

            // Content
            VStack(alignment: .leading, spacing: 6) {
                Text(request.title ?? "Untitled")
                    .font(SpentyFonts.body)
                    .fontWeight(.semibold)
                    .foregroundColor(.spentyTextPrimary)

                if let description = request.description, !description.isEmpty {
                    Text(description)
                        .font(SpentyFonts.caption1)
                        .foregroundColor(.spentyTextSecondary)
                        .lineLimit(2)
                }

                HStack(spacing: 8) {
                    if let cat = FeatureRequestCategory(rawValue: request.category ?? "") {
                        categoryBadge(cat)
                    }
                    if let status = FeatureRequestStatus(rawValue: request.status ?? "") {
                        statusBadge(status)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func voteButton(_ request: FeatureRequest) -> some View {
        Button {
            Task { await viewModel.voteForRequest(id: request.id) }
        } label: {
            VStack(spacing: 2) {
                Image(systemName: "arrow.up")
                    .font(SpentyFonts.caption1)
                    .fontWeight(.bold)
                Text("\(request.votes ?? 0)")
                    .font(SpentyFonts.caption2)
                    .fontWeight(.semibold)
                    .monospacedDigit()
            }
            .foregroundStyle(Color.spentyPrimary)
            .frame(width: 44, height: 48)
            .background(Color.spentyPrimary.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func categoryBadge(_ category: FeatureRequestCategory) -> some View {
        Text(category.rawValue)
            .font(SpentyFonts.caption2)
            .fontWeight(.medium)
            .foregroundStyle(Color.spentyPrimary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.spentyPrimary.opacity(0.1))
            .clipShape(Capsule())
    }

    private func statusBadge(_ status: FeatureRequestStatus) -> some View {
        Text(status.displayName)
            .font(SpentyFonts.caption2)
            .fontWeight(.medium)
            .foregroundStyle(status.color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.color.opacity(0.12))
            .clipShape(Capsule())
    }
}

// MARK: - Status Helpers

extension FeatureRequestStatus {
    var displayName: String {
        switch self {
        case .submitted:  return "Submitted"
        case .pending:    return "Pending"
        case .inProgress: return "In Progress"
        case .completed:  return "Completed"
        }
    }

    var color: Color {
        switch self {
        case .submitted:  return .spentyWarning
        case .pending:    return .spentyWarning.opacity(0.9)
        case .inProgress: return .spentyInfo
        case .completed:  return .spentySuccess
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        FeatureRequestsView()
    }
}
