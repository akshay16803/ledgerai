import SwiftUI

@main
struct SpentyAIApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appState = AppState()
    @State private var subscriptionManager = SubscriptionManager()
    @State private var transactionListener: TransactionListener?

    var body: some Scene {
        WindowGroup {
            Group {
                if appState.isLoading && appState.user == nil {
                    launchScreen
                } else if appState.isAuthenticated {
                    SubscriptionGate {
                        MainTabView()
                    }
                } else {
                    LoginView()
                }
            }
            .environment(appState)
            .environment(subscriptionManager)
            .task {
                // Start StoreKit transaction listener
                let listener = TransactionListener(subscriptionManager: subscriptionManager)
                listener.startListening()
                transactionListener = listener

                // Load products in parallel with user check
                async let productsLoad: () = subscriptionManager.loadProducts()
                async let userLoad: () = appState.loadCurrentUser()
                _ = await (productsLoad, userLoad)
            }
        }
    }

    private var launchScreen: some View {
        ZStack {
            SpentyColors.brandPrimary
                .ignoresSafeArea()

            VStack(spacing: SpentySpacing.lg) {
                Text("SpentyAI")
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundStyle(.white)

                ProgressView()
                    .tint(.white)
                    .controlSize(.regular)
            }
        }
    }
}
