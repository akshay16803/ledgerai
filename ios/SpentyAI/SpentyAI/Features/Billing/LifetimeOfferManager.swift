import Foundation

// MARK: - Lifetime Offer Manager
// Tracks whether the 30-minute timed offer window is still active.
// The clock starts the first time the offer sheet is shown to a non-subscriber.
// Existing subscribers bypass this and always see the offer via the upgrade banner.

final class LifetimeOfferManager {
    static let shared = LifetimeOfferManager()
    private init() {}

    private let firstSeenKey   = "spenty_lifetime_offer_first_seen_v1"
    private let offerDuration: TimeInterval = 1800  // 30 minutes

    /// True if the timed offer window is still open (never started or within 30 min).
    var isOfferActive: Bool {
        guard let firstSeen = UserDefaults.standard.object(forKey: firstSeenKey) as? Date else {
            return true  // Never shown yet — offer is open
        }
        return Date().timeIntervalSince(firstSeen) < offerDuration
    }

    /// Remaining seconds in the offer window (0 if expired or never started).
    // Reset to 30 min on offer-window length change so retroactive change doesn't
    // leave existing users with a longer effective window than expected.
    var timeRemaining: TimeInterval {
        guard let firstSeen = UserDefaults.standard.object(forKey: firstSeenKey) as? Date else {
            return offerDuration
        }
        return max(0, offerDuration - Date().timeIntervalSince(firstSeen))
    }

    /// Call once when the offer sheet is first shown to start the 30-min clock.
    func recordFirstShown() {
        guard UserDefaults.standard.object(forKey: firstSeenKey) == nil else { return }
        UserDefaults.standard.set(Date(), forKey: firstSeenKey)
    }

    /// Formats remaining time as "MM:SS".
    func formattedTimeRemaining() -> String {
        let t = Int(timeRemaining)
        return String(format: "%02d:%02d", t / 60, t % 60)
    }
}
