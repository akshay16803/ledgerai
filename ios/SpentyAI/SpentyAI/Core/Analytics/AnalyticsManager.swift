import Foundation
import SwiftUI
#if canImport(PostHog)
import PostHog
#endif

/// Thin analytics facade — wraps PostHog in ANONYMOUS mode.
///
/// Design constraints (per project owner, 2026-05-29):
///   • Never call `identify()`. PostHog uses an auto-generated, device-local
///     anonymous UUID as the distinct_id for the lifetime of the install.
///   • Never pass user_id, email, name, or any PII into event properties.
///   • Person profiles are created only when explicitly identified — and we
///     never identify, so PostHog will never store an identified person.
///   • Session recordings are OFF.
///
/// Configuration:
///   • The PostHog Project API Key is read from Info.plist key `POSTHOG_KEY`.
///   • If the key is empty, every call here is a silent no-op so the rest of
///     the app can call `Analytics.shared.track(...)` freely.
///   • Host defaults to https://us.i.posthog.com (override via `POSTHOG_HOST`).
///
/// SPM dependency (one-time Xcode step):
///   File → Add Package Dependencies → https://github.com/PostHog/posthog-ios
///   Choose "Up to Next Major Version" from 3.0.0.
@MainActor
final class Analytics {

    static let shared = Analytics()

    private var enabled = false

    private init() {}

    /// Call once from SpentyAIApp init. Safe to call before the PostHog SPM
    /// package is added — it just stays disabled.
    func bootstrap() {
        let key = (Bundle.main.object(forInfoDictionaryKey: "POSTHOG_KEY") as? String) ?? ""
        let host = (Bundle.main.object(forInfoDictionaryKey: "POSTHOG_HOST") as? String) ?? "https://us.i.posthog.com"
        guard !key.isEmpty else {
            #if DEBUG
            print("[Analytics] disabled — POSTHOG_KEY missing from Info.plist")
            #endif
            return
        }
        #if canImport(PostHog)
        let config = PostHogConfig(projectToken: key, host: host)
        // Anonymous-only: PostHog will never create an identified person
        // unless `identify()` is called (we never call it).
        config.personProfiles = .identifiedOnly
        // We do our own SwiftUI screen tracking via the navigation layer,
        // and we don't want UIKit autocapture to leak any UI text.
        config.captureScreenViews = false
        config.captureApplicationLifecycleEvents = true
        // Session replay is OFF by default in PostHog iOS — leave it off.
        PostHogSDK.shared.setup(config)
        enabled = true
        #if DEBUG
        print("[Analytics] PostHog active (anonymous, recordings off)")
        #endif
        #else
        // SPM package not yet added — stay disabled gracefully.
        #if DEBUG
        print("[Analytics] disabled — PostHog SPM package not installed")
        #endif
        #endif
    }

    /// **Hard-disabled by design.** Calling this is a no-op.
    /// We want everything anonymous: never link events to a SpentyAI user.
    func identify(userId: String, email: String? = nil, name: String? = nil) {
        // Intentionally empty. See bootstrap() docstring.
    }

    /// Forget the anonymous distinct_id and start a fresh one (e.g., on sign-out).
    func reset() {
        guard enabled else { return }
        #if canImport(PostHog)
        PostHogSDK.shared.reset()
        #endif
    }

    func track(_ event: String, properties: [String: Any] = [:]) {
        guard enabled else {
            #if DEBUG
            print("[Analytics] (disabled) " + event)
            #endif
            return
        }
        #if canImport(PostHog)
        PostHogSDK.shared.capture(event, properties: properties)
        #endif
    }

    // ── Convenience event helpers (anonymous-safe — no PII) ────────────────
    // Note: `signedIn` deliberately omits user identity. We only log the
    // *method* so we can see whether Google vs Apple vs email is more popular.
    func signedIn(method: String)                       { track("signed_in", properties: ["method": method]) }
    func signedOut()                                    { track("signed_out"); reset() }
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
    func buttonTapped(_ name: String)                   { track("button_tapped", properties: ["button": name]) }
}

// MARK: - SwiftUI sugar

/// `.trackScreen("Dashboard")` fires `screen_viewed` exactly once when the
/// view first appears. Safe to attach to any View.
private struct TrackScreenModifier: ViewModifier {
    let name: String
    @State private var fired = false
    func body(content: Content) -> some View {
        content.onAppear {
            guard !fired else { return }
            fired = true
            Analytics.shared.viewedScreen(name)
        }
    }
}

extension View {
    func trackScreen(_ name: String) -> some View {
        modifier(TrackScreenModifier(name: name))
    }
}

