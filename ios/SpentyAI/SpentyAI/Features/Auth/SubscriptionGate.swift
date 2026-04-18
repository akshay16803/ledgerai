import SwiftUI

/// Wraps content that requires an active subscription.
/// If the user does not have an active subscription, shows the BillingView instead.
struct SubscriptionGate<Content: View>: View {
    @Environment(AppState.self) private var appState
    @Environment(SubscriptionManager.self) private var subscriptionManager

    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        Group {
            if appState.isLoading && appState.user == nil {
                loadingState
            } else if appState.hasActiveSubscription {
                content
            } else {
                BillingView()
            }
        }
        .task {
            // Refresh subscription status when gate appears
            await appState.refreshSubscription()
        }
    }

    private var loadingState: some View {
        ZStack {
            SpentyColors.bgPrimary
                .ignoresSafeArea()

            VStack(spacing: SpentySpacing.lg) {
                ProgressView()
                    .controlSize(.large)
                    .tint(SpentyColors.brandAccent)

                Text("Loading your account...")
                    .font(SpentyFonts.body)
                    .foregroundStyle(SpentyColors.textSecondary)
            }
        }
    }
}

#Preview {
    SubscriptionGate {
        Text("Premium Content")
    }
    .environment(AppState())
    .environment(SubscriptionManager())
}
