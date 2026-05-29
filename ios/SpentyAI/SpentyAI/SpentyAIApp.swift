import SwiftUI

@main
struct SpentyAIApp: App {
    @State private var authManager = AuthManager()

    init() {
        // Single process-lifetime listener for Apple background events
        // (auto-renew, refund, family-share grant, restore on new device).
        // Must live outside any per-screen view model so the listener
        // survives paywall + billing-settings dismissals.
        AppleTransactionObserver.shared.start()

        // Bootstrap anonymous product analytics (PostHog). No-ops if the
        // POSTHOG_KEY Info.plist entry is empty or the SPM package isn't
        // installed yet — safe to call regardless.
        Analytics.shared.bootstrap()
    }

    var body: some Scene {
        WindowGroup {
            AppRouter(authManager: authManager)
                .environment(authManager)
                .environment(LocalizationManager.shared)
                .task {
                    await authManager.checkSession()
                }
        }
    }
}
