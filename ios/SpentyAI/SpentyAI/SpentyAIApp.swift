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
