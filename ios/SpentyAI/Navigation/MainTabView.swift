import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .dashboard

    enum Tab: String, CaseIterable {
        case dashboard
        case transactions
        case accounts
        case reports
        case more

        var title: String {
            switch self {
            case .dashboard: return "Dashboard"
            case .transactions: return "Transactions"
            case .accounts: return "Accounts"
            case .reports: return "Reports"
            case .more: return "More"
            }
        }

        var icon: String {
            switch self {
            case .dashboard: return "house.fill"
            case .transactions: return "arrow.left.arrow.right"
            case .accounts: return "building.columns"
            case .reports: return "chart.bar.fill"
            case .more: return "ellipsis"
            }
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(Tab.allCases, id: \.self) { tab in
                NavigationStack {
                    tabContent(for: tab)
                }
                .tabItem {
                    Label(tab.title, systemImage: tab.icon)
                }
                .tag(tab)
            }
        }
        .tint(SpentyColors.brandPrimary)
    }

    @ViewBuilder
    private func tabContent(for tab: Tab) -> some View {
        switch tab {
        case .dashboard:
            DashboardPlaceholder()
        case .transactions:
            TransactionsPlaceholder()
        case .accounts:
            AccountsPlaceholder()
        case .reports:
            ReportsPlaceholder()
        case .more:
            MoreMenuView()
        }
    }
}

// MARK: - Placeholder Views (replaced as feature screens are built)

private struct DashboardPlaceholder: View {
    var body: some View {
        EmptyState(
            icon: "house.fill",
            title: "Dashboard",
            message: "Your financial overview will appear here."
        )
        .background(SpentyColors.bgPrimary.ignoresSafeArea())
        .navigationTitle("Dashboard")
    }
}

private struct TransactionsPlaceholder: View {
    var body: some View {
        EmptyState(
            icon: "arrow.left.arrow.right",
            title: "Transactions",
            message: "Your transactions will appear here."
        )
        .background(SpentyColors.bgPrimary.ignoresSafeArea())
        .navigationTitle("Transactions")
    }
}

private struct AccountsPlaceholder: View {
    var body: some View {
        EmptyState(
            icon: "building.columns",
            title: "Accounts",
            message: "Your linked accounts will appear here."
        )
        .background(SpentyColors.bgPrimary.ignoresSafeArea())
        .navigationTitle("Accounts")
    }
}

private struct ReportsPlaceholder: View {
    var body: some View {
        EmptyState(
            icon: "chart.bar.fill",
            title: "Reports",
            message: "Financial reports and analytics will appear here."
        )
        .background(SpentyColors.bgPrimary.ignoresSafeArea())
        .navigationTitle("Reports")
    }
}

#Preview {
    MainTabView()
        .environment(AppState())
        .environment(SubscriptionManager())
}
