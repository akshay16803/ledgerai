import SwiftUI

struct MoreMenuView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        List {
            // Financial tools — always visible
            Section("Financial Tools") {
                menuRow(icon: "folder.fill", title: "Categories", destination: FeaturePlaceholderView(title: "Categories"))
                menuRow(icon: "chart.line.uptrend.xyaxis", title: "Cash Flow", destination: FeaturePlaceholderView(title: "Cash Flow"))
                menuRow(icon: "checkmark.rectangle.stack.fill", title: "Reconciliation", destination: FeaturePlaceholderView(title: "Reconciliation"))
            }

            // Sales — conditional on invoices
            if appState.hasInvoices {
                Section("Sales") {
                    menuRow(icon: "doc.text.fill", title: "Sales Invoices", destination: FeaturePlaceholderView(title: "Sales Invoices"))
                    menuRow(icon: "person.2.fill", title: "Customers", destination: FeaturePlaceholderView(title: "Customers"))
                }
            }

            // Purchases — conditional on bills
            if appState.hasBills {
                Section("Purchases") {
                    menuRow(icon: "doc.plaintext.fill", title: "Purchase Bills", destination: FeaturePlaceholderView(title: "Purchase Bills"))
                    menuRow(icon: "shippingbox.fill", title: "Vendors", destination: FeaturePlaceholderView(title: "Vendors"))
                }
            }

            // Data sources
            Section("Data Sources") {
                menuRow(icon: "envelope.fill", title: "Email & SMS", destination: FeaturePlaceholderView(title: "Email & SMS"))
                menuRow(icon: "archivebox.fill", title: "Records", destination: FeaturePlaceholderView(title: "Records"))
            }

            // Insights & investments
            Section("Insights") {
                menuRow(icon: "clock.arrow.circlepath", title: "Past Insights", destination: FeaturePlaceholderView(title: "Past Insights"))
                menuRow(icon: "chart.line.uptrend.xyaxis.circle.fill", title: "Demat / Trading", destination: FeaturePlaceholderView(title: "Demat / Trading"))
            }

            // Support
            Section("Help & Feedback") {
                menuRow(icon: "lightbulb.fill", title: "Feature Requests", destination: FeaturePlaceholderView(title: "Feature Requests"))
                menuRow(icon: "questionmark.circle.fill", title: "Support", destination: FeaturePlaceholderView(title: "Support"))
                menuRow(icon: "gearshape.fill", title: "Settings", destination: FeaturePlaceholderView(title: "Settings"))
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

    // MARK: - Row Builder

    private func menuRow<Destination: View>(
        icon: String,
        title: String,
        destination: Destination
    ) -> some View {
        NavigationLink {
            destination
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

// MARK: - Generic Placeholder (replaced as each feature screen is built)

struct FeaturePlaceholderView: View {
    let title: String

    var body: some View {
        EmptyState(
            icon: "hammer.fill",
            title: title,
            message: "This feature is coming soon."
        )
        .background(SpentyColors.bgPrimary.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        MoreMenuView()
    }
    .environment(AppState())
}
