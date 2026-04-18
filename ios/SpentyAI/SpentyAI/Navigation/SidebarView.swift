import SwiftUI

struct SidebarView: View {
    @State private var selection: SidebarItem? = .dashboard
    @State private var showAIChat = false

    enum SidebarItem: String, CaseIterable, Identifiable {
        case dashboard = "Dashboard"
        case transactions = "Transactions"
        case accounts = "Accounts"
        case reports = "Reports"
        case cashFlow = "Cash Flow"
        case invoices = "Invoices"
        case purchases = "Purchases"
        case categories = "Categories"
        case customers = "Customers"
        case vendors = "Vendors"
        case reconciliation = "Reconciliation"
        case emailSync = "Email Sync"
        case smsSync = "SMS Sync"
        case records = "Records"
        case pastInsights = "Past Insights"
        case aiChat = "AI Chat"
        case featureRequests = "Feature Requests"
        case support = "Support"
        case settings = "Settings"
        case billing = "Billing"

        var id: String { rawValue }

        var icon: String {
            switch self {
            case .dashboard: return "house.fill"
            case .transactions: return "arrow.left.arrow.right"
            case .accounts: return "building.columns.fill"
            case .reports: return "chart.pie.fill"
            case .cashFlow: return "chart.line.uptrend.xyaxis"
            case .invoices: return "doc.text.fill"
            case .purchases: return "cart.fill"
            case .categories: return "folder.fill"
            case .customers: return "person.2.fill"
            case .vendors: return "shippingbox.fill"
            case .reconciliation: return "checkmark.circle.fill"
            case .emailSync: return "envelope.fill"
            case .smsSync: return "message.fill"
            case .records: return "archivebox.fill"
            case .pastInsights: return "clock.fill"
            case .aiChat: return "bubble.left.and.bubble.right.fill"
            case .featureRequests: return "lightbulb.fill"
            case .support: return "questionmark.circle.fill"
            case .settings: return "gearshape.fill"
            case .billing: return "creditcard.fill"
            }
        }

        static let mainItems: [SidebarItem] = [.dashboard, .transactions, .accounts, .reports]
        static let financeItems: [SidebarItem] = [.cashFlow, .invoices, .purchases, .categories]
        static let peopleItems: [SidebarItem] = [.customers, .vendors]
        static let dataItems: [SidebarItem] = [.reconciliation, .emailSync, .smsSync, .records, .pastInsights]
        static let toolItems: [SidebarItem] = [.aiChat, .featureRequests, .support]
        static let accountItems: [SidebarItem] = [.settings, .billing]
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section("Main") {
                    ForEach(SidebarItem.mainItems) { item in
                        sidebarLabel(item)
                    }
                }

                Section("Finance") {
                    ForEach(SidebarItem.financeItems) { item in
                        sidebarLabel(item)
                    }
                }

                Section("People") {
                    ForEach(SidebarItem.peopleItems) { item in
                        sidebarLabel(item)
                    }
                }

                Section("Data") {
                    ForEach(SidebarItem.dataItems) { item in
                        sidebarLabel(item)
                    }
                }

                Section("Tools") {
                    ForEach(SidebarItem.toolItems) { item in
                        if item == .aiChat {
                            Button {
                                showAIChat = true
                            } label: {
                                Label(item.rawValue, systemImage: item.icon)
                            }
                        } else {
                            sidebarLabel(item)
                        }
                    }
                }

                Section("Account") {
                    ForEach(SidebarItem.accountItems) { item in
                        sidebarLabel(item)
                    }
                }
            }
            .navigationTitle("SpentyAI")
            .listStyle(.sidebar)
        } detail: {
            if let selection {
                detailView(for: selection)
            } else {
                EmptyStateView(icon: "sidebar.left", title: "Select an item", subtitle: "Choose a section from the sidebar.")
            }
        }
        .tint(Color.spentyPrimary)
        .sheet(isPresented: $showAIChat) {
            AIChatView()
        }
    }

    @ViewBuilder
    private func sidebarLabel(_ item: SidebarItem) -> some View {
        Label(item.rawValue, systemImage: item.icon)
            .tag(item)
    }

    @ViewBuilder
    private func detailView(for item: SidebarItem) -> some View {
        NavigationStack {
            switch item {
            case .dashboard:
                DashboardView()
            case .transactions:
                TransactionListView()
            case .accounts:
                AccountListView()
            case .reports:
                ReportsView()
            case .cashFlow:
                CashFlowView()
            case .invoices:
                InvoiceListView()
            case .purchases:
                PurchaseListView()
            case .categories:
                CategoryListView()
            case .customers:
                CustomerListView()
            case .vendors:
                VendorListView()
            case .reconciliation:
                ReconciliationView()
            case .emailSync:
                EmailSyncView()
            case .smsSync:
                SMSSyncView()
            case .records:
                RecordsView()
            case .pastInsights:
                PastInsightsView()
            case .aiChat:
                AIChatView()
            case .featureRequests:
                FeatureRequestsView()
            case .support:
                SupportView()
            case .settings:
                SettingsView()
            case .billing:
                BillingView()
            }
        }
    }
}

#Preview {
    SidebarView()
}
