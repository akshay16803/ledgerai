import SwiftUI

struct AppRouter: View {
    var authManager: AuthManager

    @State private var onboardingDone = OnboardingManager.shared.hasSeenOnboarding

    var body: some View {
        Group {
            if authManager.isLoading {
                LoadingView(message: "Checking your session...")
            } else if !onboardingDone {
                // Show feature slides BEFORE sign-in so new users understand
                // what they're signing up for.
                OnboardingSliderView(onComplete: {
                    OnboardingManager.shared.markSeen()
                    onboardingDone = true
                })
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
        .animation(.easeInOut(duration: 0.3), value: onboardingDone)
    }
}
