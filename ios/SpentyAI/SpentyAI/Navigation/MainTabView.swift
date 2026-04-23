import SwiftUI

struct MainTabView: View {
    @Environment(LocalizationManager.self) var lang
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

        func localizedLabel(_ lang: LocalizationManager) -> String {
            switch self {
            case .dashboard: return lang.s("dashboard")
            case .transactions: return lang.s("transactions")
            case .accounts: return lang.s("accounts")
            case .reports: return lang.s("reports")
            case .more: return lang.s("more")
            }
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Label(Tab.dashboard.localizedLabel(lang), systemImage: Tab.dashboard.icon)
                }
                .tag(Tab.dashboard)

            TransactionListView()
                .tabItem {
                    Label(Tab.transactions.localizedLabel(lang), systemImage: Tab.transactions.icon)
                }
                .tag(Tab.transactions)

            AccountListView()
                .tabItem {
                    Label(Tab.accounts.localizedLabel(lang), systemImage: Tab.accounts.icon)
                }
                .tag(Tab.accounts)

            ReportsView()
                .tabItem {
                    Label(Tab.reports.localizedLabel(lang), systemImage: Tab.reports.icon)
                }
                .tag(Tab.reports)

            MoreMenuView()
                .tabItem {
                    Label(Tab.more.localizedLabel(lang), systemImage: Tab.more.icon)
                }
                .tag(Tab.more)
        }
        .tint(Color.spentyPrimary)
    }
}

// MARK: - More Menu

struct MoreMenuView: View {
    @Environment(LocalizationManager.self) var lang
    @State private var showAIChat = false
    @State private var cashFlowViewModel = CashFlowViewModel()

    var body: some View {
        NavigationStack {
        List {
            Section(lang.s("finance")) {
                NavigationLink { CashFlowView() } label: {
                    MoreRow(title: lang.s("cash_flow"), icon: "chart.line.uptrend.xyaxis", color: .spentyPrimary)
                }
                NavigationLink { InvoiceListView() } label: {
                    MoreRow(title: lang.s("invoices"), icon: "doc.text.fill", color: .spentyInfo)
                }
                NavigationLink { PurchaseListView() } label: {
                    MoreRow(title: lang.s("purchases"), icon: "cart.fill", color: .spentyAccent1)
                }
                NavigationLink { CategoryListView() } label: {
                    MoreRow(title: lang.s("categories"), icon: "folder.fill", color: .spentyWarning)
                }
            }

            Section(lang.s("people")) {
                NavigationLink { CustomerListView() } label: {
                    MoreRow(title: lang.s("customers"), icon: "person.2.fill", color: .spentyInfo)
                }
                NavigationLink { VendorListView() } label: {
                    MoreRow(title: lang.s("vendors"), icon: "shippingbox.fill", color: .spentyAccent1)
                }
            }

            Section(lang.s("obligations")) {
                NavigationLink {
                    MandatesListView(viewModel: cashFlowViewModel)
                        .task { await cashFlowViewModel.loadAll() }
                } label: {
                    MoreRow(title: lang.s("mandates"), icon: "doc.plaintext.fill", color: .spentyWarning)
                }
            }

            Section(lang.s("data")) {
                NavigationLink { ReconciliationView() } label: {
                    MoreRow(title: lang.s("reconciliation"), icon: "checkmark.circle.fill", color: .spentySuccess)
                }
                NavigationLink { EmailSyncView() } label: {
                    MoreRow(title: lang.s("email_sync"), icon: "envelope.fill", color: .spentyInfo)
                }
                NavigationLink { SMSSyncView() } label: {
                    MoreRow(title: lang.s("sms_sync"), icon: "message.fill", color: .spentyAccent3)
                }
                NavigationLink { RecordsView() } label: {
                    MoreRow(title: lang.s("records"), icon: "archivebox.fill", color: .spentyTextSecondary)
                }
                NavigationLink { PastInsightsView() } label: {
                    MoreRow(title: lang.s("past_insights"), icon: "clock.fill", color: .spentyAccent3)
                }
            }

            Section(lang.s("tools")) {
                Button {
                    showAIChat = true
                } label: {
                    MoreRow(title: lang.s("ai_chat"), icon: "bubble.left.and.bubble.right.fill", color: .spentyPrimary)
                }
                NavigationLink { FeatureRequestsView() } label: {
                    MoreRow(title: lang.s("feature_requests"), icon: "lightbulb.fill", color: .spentyWarning)
                }
                NavigationLink { SupportView() } label: {
                    MoreRow(title: lang.s("support"), icon: "questionmark.circle.fill", color: .spentyInfo)
                }
            }

            Section(lang.s("account_section")) {
                NavigationLink { SettingsView() } label: {
                    MoreRow(title: lang.s("settings"), icon: "gearshape.fill", color: .spentyTextSecondary)
                }
                NavigationLink { BillingView() } label: {
                    MoreRow(title: lang.s("billing"), icon: "creditcard.fill", color: .spentyPrimary)
                }
            }
        }
        .navigationTitle(lang.s("more"))
        .sheet(isPresented: $showAIChat) {
            AIChatView()
        }
        } // NavigationStack
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
