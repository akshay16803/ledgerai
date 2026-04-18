import SwiftUI

@main
struct SpentyAIApp: App {
    @State private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            AppRouter(authManager: authManager)
                .environment(authManager)
                .task {
                    await authManager.checkSession()
                }
        }
    }
}
