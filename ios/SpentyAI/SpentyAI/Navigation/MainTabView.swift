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
                tabContent(for: tab)
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
            DashboardView()
        case .transactions:
            TransactionsView()
        case .accounts:
            AccountsView()
        case .reports:
            ReportsView()
        case .more:
            MoreMenuView()
        }
    }
}

#Preview {
    MainTabView()
        .environment(AppState())
        .environment(SubscriptionManager())
}
