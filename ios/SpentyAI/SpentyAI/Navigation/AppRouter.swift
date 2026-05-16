import SwiftUI
import UIKit

struct AppRouter: View {
    var authManager: AuthManager

    @State private var onboardingDone = OnboardingManager.shared.hasSeenOnboarding

    /// Apple App Review (May 2026) flagged the iPad as showing iPhone-stretched
    /// UI with poor typography. We already have a `SidebarView` built around
    /// `NavigationSplitView` — this just routes iPad users to it instead of the
    /// iPhone tab bar. iPhone keeps the existing `MainTabView`.
    private var isPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

    var body: some View {
        Group {
            if authManager.isLoading {
                LoadingView(message: "Checking your session...")
            } else if !onboardingDone {
                // Show feature slides BEFORE sign-in so new users understand
                // what they're signing up for.
                OnboardingSliderView(onComplete: {
                    OnboardingManager.shared.markSeen()
                    Task {
                        await authManager.checkSession()
                        onboardingDone = true
                    }
                })
            } else if !authManager.isAuthenticated {
                LoginView(authManager: authManager)
            } else if isPad {
                // Pivot 2026-05-13: SpentyAI is free for every signed-in
                // user. The full-app SubscriptionPaywall is no longer
                // shown after sign-in. Email Sync and SMS Auto-detection
                // each present their own PremiumFeatureSheet on entry,
                // and BillingView is still reachable from Settings for
                // anyone who wants to manage or start a subscription.
                SidebarView()
            } else {
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
        .animation(.easeInOut(duration: 0.3), value: authManager.isLoading)
        .animation(.easeInOut(duration: 0.3), value: onboardingDone)
    }
}
