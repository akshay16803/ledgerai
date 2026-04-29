import Foundation

// MARK: - Onboarding Manager
// Tracks whether the user has seen the onboarding feature-highlight slider.
// Once seen, the flag is permanent for the device lifetime (no expiry).
// Follows the LifetimeOfferManager singleton pattern exactly.

final class OnboardingManager {
    static let shared = OnboardingManager()
    private init() {}

    private let seenKey = "spenty_onboarding_slider_seen_v1"

    /// Returns true if the user has already completed the onboarding slider.
    var hasSeenOnboarding: Bool {
        UserDefaults.standard.bool(forKey: seenKey)
    }

    /// Call once when the user taps "Get Started" or "Skip".
    func markSeen() {
        UserDefaults.standard.set(true, forKey: seenKey)
    }

    #if DEBUG
    /// Debug/testing only — resets the seen flag so the slider appears again.
    func reset() {
        UserDefaults.standard.removeObject(forKey: seenKey)
    }
    #endif
}
