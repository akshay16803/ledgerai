import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .dashboard

    enum Tab: String, CaseIterable {
        case dashboard = "Dashboard"
        case transactions = "Transactions"
        case accounts = "Accounts"
        case reports = "Reports"
        case more = "More"

        var icon: String {
            switch self {
            case .dashboard: return "house.fill"
            case .transactions: return "arrow.left.arrow.right"
            case .accounts: return "building.columns.fill"
            case .reports: return "chart.pie.fill"
            case .more: return "ellipsis.circle.fill"
            }
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardView()
            }
            .tabItem {
                Label(Tab.dashboard.rawValue, systemImage: Tab.dashboard.icon)
            }
            .tag(Tab.dashboard)

            NavigationStack {
                TransactionListView()
            }
            .tabItem {
                Label(Tab.transactions.rawValue, systemImage: Tab.transactions.icon)
            }
            .tag(Tab.transactions)

            NavigationStack {
                AccountListView()
            }
            .tabItem {
                Label(Tab.accounts.rawValue, systemImage: Tab.accounts.icon)
            }
            .tag(Tab.accounts)

            NavigationStack {
                ReportsView()
            }
            .tabItem {
                Label(Tab.reports.rawValue, systemImage: Tab.reports.icon)
            }
            .tag(Tab.reports)

            NavigationStack {
                MoreMenuView()
            }
            .tabItem {
                Label(Tab.more.rawValue, systemImage: Tab.more.icon)
            }
            .tag(Tab.more)
        }
        .tint(Color.spentyPrimary)
    }
}

// MARK: - More Menu

struct MoreMenuView: View {
    @State private var showAIChat = false

    var body: some View {
        List {
            Section("Finance") {
                NavigationLink { CashFlowView() } label: {
                    MoreRow(title: "Cash Flow", icon: "chart.line.uptrend.xyaxis", color: .spentyPrimary)
                }
                NavigationLink { InvoiceListView() } label: {
                    MoreRow(title: "Invoices", icon: "doc.text.fill", color: .spentyInfo)
                }
                NavigationLink { PurchaseListView() } label: {
                    MoreRow(title: "Purchases", icon: "cart.fill", color: .spentyAccent1)
                }
                NavigationLink { CategoryListView() } label: {
                    MoreRow(title: "Categories", icon: "folder.fill", color: .spentyWarning)
                }
            }

            Section("People") {
                NavigationLink { CustomerListView() } label: {
                    MoreRow(title: "Customers", icon: "person.2.fill", color: .spentyInfo)
                }
                NavigationLink { VendorListView() } label: {
                    MoreRow(title: "Vendors", icon: "shippingbox.fill", color: .spentyAccent1)
                }
            }

            Section("Data") {
                NavigationLink { ReconciliationView() } label: {
                    MoreRow(title: "Reconciliation", icon: "checkmark.circle.fill", color: .spentySuccess)
                }
                NavigationLink { EmailSyncView() } label: {
                    MoreRow(title: "Email Sync", icon: "envelope.fill", color: .spentyInfo)
                }
                NavigationLink { SMSSyncView() } label: {
                    MoreRow(title: "SMS Sync", icon: "message.fill", color: .spentyAccent3)
                }
                NavigationLink { RecordsView() } label: {
                    MoreRow(title: "Records", icon: "archivebox.fill", color: .spentyTextSecondary)
                }
                NavigationLink { PastInsightsView() } label: {
                    MoreRow(title: "Past Insights", icon: "clock.fill", color: .spentyAccent3)
                }
            }

            Section("Tools") {
                Button {
                    showAIChat = true
                } label: {
                    MoreRow(title: "AI Chat", icon: "bubble.left.and.bubble.right.fill", color: .spentyPrimary)
                }
                NavigationLink { FeatureRequestsView() } label: {
                    MoreRow(title: "Feature Requests", icon: "lightbulb.fill", color: .spentyWarning)
                }
                NavigationLink { SupportView() } label: {
                    MoreRow(title: "Support", icon: "questionmark.circle.fill", color: .spentyInfo)
                }
            }

            Section("Account") {
                NavigationLink { SettingsView() } label: {
                    MoreRow(title: "Settings", icon: "gearshape.fill", color: .spentyTextSecondary)
                }
                NavigationLink { BillingView() } label: {
                    MoreRow(title: "Billing", icon: "creditcard.fill", color: .spentyPrimary)
                }
            }
        }
        .navigationTitle("More")
        .sheet(isPresented: $showAIChat) {
            AIChatView()
        }
    }
}

struct MoreRow: View {
    let title: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(color)
                .frame(width: 28)
            Text(title)
                .font(SpentyFonts.body)
                .foregroundColor(.spentyTextPrimary)
            Spacer()
        }
    }
}

#Preview {
    MainTabView()
}
