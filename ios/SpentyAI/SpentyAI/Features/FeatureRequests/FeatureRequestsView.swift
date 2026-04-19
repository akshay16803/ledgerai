import SwiftUI

struct FeatureRequestsView: View {

    // MARK: - Constants

    private enum Brand {
        static let primary = Color(red: 0x3A / 255, green: 0x5C / 255, blue: 0x4A / 255)
        static let background = Color(red: 0xF8 / 255, green: 0xF6 / 255, blue: 0xF3 / 255)
    }

    // MARK: - State

    @State private var viewModel = FeatureRequestsViewModel()

    // MARK: - Body

    var body: some View {
        ZStack {
            Brand.background
                .ignoresSafeArea()

            Group {
                if viewModel.isLoading && viewModel.requests.isEmpty {
                    ProgressView("Loading requests...")
                        .tint(Brand.primary)
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
                .tint(Brand.primary)
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
        ContentUnavailableView {
            Label("No Requests Yet", systemImage: "lightbulb")
                .foregroundStyle(Brand.primary)
        } description: {
            Text("Be the first to suggest a feature!")
        } actions: {
            Button("Submit a Request") {
                viewModel.showForm = true
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.primary)
        }
    }

    private var requestList: some View {
        List {
            ForEach(viewModel.requests) { request in
                requestRow(request)
                    .listRowBackground(Color.white)
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
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)

                if let description = request.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
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
                    .font(.caption.weight(.bold))
                Text("\(request.votes ?? 0)")
                    .font(.caption2.weight(.semibold))
                    .monospacedDigit()
            }
            .foregroundStyle(Brand.primary)
            .frame(width: 44, height: 48)
            .background(Brand.primary.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func categoryBadge(_ category: FeatureRequestCategory) -> some View {
        Text(category.rawValue)
            .font(.caption2.weight(.medium))
            .foregroundStyle(Brand.primary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Brand.primary.opacity(0.1))
            .clipShape(Capsule())
    }

    private func statusBadge(_ status: FeatureRequestStatus) -> some View {
        Text(status.displayName)
            .font(.caption2.weight(.medium))
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
        case .submitted:  return .orange
        case .pending:    return .yellow.opacity(0.9)
        case .inProgress: return .blue
        case .completed:  return .green
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        FeatureRequestsView()
    }
}
