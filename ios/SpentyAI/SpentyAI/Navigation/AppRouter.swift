import SwiftUI

struct AppRouter: View {
    var authManager: AuthManager

    var body: some View {
        Group {
            if authManager.isLoading {
                LoadingView(message: "Checking your session...")
            } else if !authManager.isAuthenticated {
                LoginView(authManager: authManager)
            } else if let user = authManager.user, !user.hasActiveSubscription {
                SubscriptionPaywall(onSubscribed: {
                    Task { await authManager.checkSession() }
                })
            } else {
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
        .animation(.easeInOut(duration: 0.3), value: authManager.isLoading)
    }
}
