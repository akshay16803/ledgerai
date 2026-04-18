import SwiftUI

struct MoreMenuView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                // Financial tools — always visible
                Section("Financial Tools") {
                    menuRow(icon: "folder.fill", title: "Categories") {
                        CategoriesView()
                    }
                    menuRow(icon: "chart.line.uptrend.xyaxis", title: "Cash Flow") {
                        CashFlowView()
                    }
                    menuRow(icon: "checkmark.rectangle.stack.fill", title: "Reconciliation") {
                        ReconciliationView()
                    }
                }

                // Sales — conditional on invoices
                if appState.hasInvoices {
                    Section("Sales") {
                        menuRow(icon: "doc.text.fill", title: "Sales Invoices") {
                            InvoicesView()
                        }
                        menuRow(icon: "person.2.fill", title: "Customers") {
                            CustomersView()
                        }
                    }
                }

                // Purchases — conditional on bills
                if appState.hasBills {
                    Section("Purchases") {
                        menuRow(icon: "doc.plaintext.fill", title: "Purchase Bills") {
                            PurchasesView()
                        }
                        menuRow(icon: "shippingbox.fill", title: "Vendors") {
                            VendorsView()
                        }
                    }
                }

                // Data sources
                Section("Data Sources") {
                    menuRow(icon: "envelope.fill", title: "Email & SMS") {
                        EmailSyncView()
                    }
                    menuRow(icon: "archivebox.fill", title: "Records") {
                        RecordsView()
                    }
                }

                // Insights & investments
                Section("Insights") {
                    menuRow(icon: "clock.arrow.circlepath", title: "Past Insights") {
                        PastInsightsView()
                    }
                    menuRow(icon: "chart.line.uptrend.xyaxis.circle.fill", title: "Demat / Trading") {
                        DematView()
                    }
                }

                // Help & Feedback
                Section("Help & Feedback") {
                    menuRow(icon: "lightbulb.fill", title: "Feature Requests") {
                        FeatureRequestsView()
                    }
                    menuRow(icon: "questionmark.circle.fill", title: "Support") {
                        SupportView()
                    }
                    menuRow(icon: "gearshape.fill", title: "Settings") {
                        SettingsView()
                    }
                }

                // Subscription
                Section("Account") {
                    menuRow(icon: "creditcard.fill", title: "Subscription") {
                        BillingView()
                    }
                }

                // Sign out
                Section {
                    Button(role: .destructive) {
                        Task { await appState.logout() }
                    } label: {
                        HStack(spacing: SpentySpacing.md) {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .font(.system(size: 16))
                                .foregroundStyle(SpentyColors.danger)
                                .frame(width: 28)

                            Text("Sign Out")
                                .font(SpentyFonts.body)
                                .foregroundStyle(SpentyColors.danger)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("More")
            .background(SpentyColors.bgPrimary.ignoresSafeArea())
        }
    }

    // MARK: - Row Builder

    private func menuRow<Destination: View>(
        icon: String,
        title: String,
        @ViewBuilder destination: @escaping () -> Destination
    ) -> some View {
        NavigationLink {
            destination()
        } label: {
            HStack(spacing: SpentySpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(SpentyColors.brandAccent)
                    .frame(width: 28)

                Text(title)
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textPrimary)
            }
        }
    }
}

#Preview {
    MoreMenuView()
        .environment(AppState())
}
