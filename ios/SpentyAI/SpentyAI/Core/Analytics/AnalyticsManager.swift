import Foundation

/// Thin analytics facade. Wraps PostHog + Sentry once their SDKs are added
/// to the project via Swift Package Manager (see SETUP_ANALYTICS.md).
///
/// While the SDKs are NOT installed, every call here is a silent no-op so
/// the rest of the app can call Analytics.shared.track(...) freely.
@MainActor
final class Analytics {

    static let shared = Analytics()

    private var enabled = false
    private var apiKey: String = ""
    private var host: String   = "https://us.i.posthog.com"

    private init() {}

    /// Call once from SpentyAIApp init AFTER PostHog + Sentry SDKs are added.
    func bootstrap(postHogKey: String, postHogHost: String? = nil, sentryDSN: String) {
        self.apiKey = postHogKey
        if let host = postHogHost { self.host = host }
        // TODO once PostHog SPM dep added:
        //   PostHogSDK.shared.setup(PostHogConfig(apiKey: postHogKey, host: self.host))
        // TODO once Sentry SPM dep added:
        //   SentrySDK.start { options in options.dsn = sentryDSN; options.tracesSampleRate = 0.2 }
        self.enabled = !postHogKey.isEmpty
    }

    func identify(userId: String, email: String? = nil, name: String? = nil) {
        guard enabled else { return }
        // TODO: PostHogSDK.shared.identify(userId, userProperties: [...])
        // TODO: SentrySDK.setUser(User(userId: userId)); user.email = email
        #if DEBUG
        print("[Analytics] identify userId=" + userId)
        #endif
    }

    func reset() {
        guard enabled else { return }
        // TODO: PostHogSDK.shared.reset()
        // TODO: SentrySDK.setUser(nil)
    }

    func track(_ event: String, properties: [String: Any] = [:]) {
        guard enabled else {
            #if DEBUG
            print("[Analytics] (disabled) " + event)
            #endif
            return
        }
        // TODO: PostHogSDK.shared.capture(event, properties: properties)
    }

    // Convenience event helpers (match src/lib/analytics.js + Android Analytics)
    func signedIn(method: String)                       { track("signed_in", properties: ["method": method]) }
    func signedOut()                                    { track("signed_out") }
    func viewedScreen(_ name: String)                   { track("screen_viewed", properties: ["screen": name]) }
    func premiumSheetShown(feature: String)             { track("premium_sheet_shown", properties: ["feature": feature]) }
    func premiumSheetTap(feature: String, action: String) {
        track("premium_sheet_tap", properties: ["feature": feature, "action": action])
    }
    func subscribeTapped(plan: String)                  { track("subscribe_tapped", properties: ["plan": plan]) }
    func subscribeSuccess(plan: String, amount: Double, provider: String) {
        track("subscribe_success", properties: ["plan": plan, "amount": amount, "provider": provider])
    }
    func subscribeFailed(plan: String, error: String)   {
        track("subscribe_failed", properties: ["plan": plan, "error": error])
    }
    func emailSyncConnected(provider: String)           { track("email_sync_connected", properties: ["provider": provider]) }
    func smsSyncStarted()                               { track("sms_sync_started") }
    func aiChatMessageSent()                            { track("ai_chat_message_sent") }
}
