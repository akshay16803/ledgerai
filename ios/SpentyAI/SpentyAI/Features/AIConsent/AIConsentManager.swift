import Foundation

/// Tracks the user's consent to send personal data (chat questions, transaction summaries,
/// email/SMS body text, receipt images) to SpentyAI's third-party AI provider (OpenAI).
///
/// Apple App Review Guideline 5.1.1(i) / 5.1.2(i) requires explicit, informed, opt-in consent
/// before any personal data is transmitted to a third-party AI service. The user must also
/// be able to revoke consent at any time — see Settings → Privacy.
enum AIConsentManager {

    // MARK: - Storage Keys

    private static let grantedKey = "ai_consent_v1_granted"
    private static let dateKey    = "ai_consent_v1_date"

    // MARK: - Consent State

    /// Whether the user has actively opted in to AI processing.
    /// Backed by `UserDefaults` so the value survives relaunches and is read on the main thread.
    static var hasConsented: Bool {
        get { UserDefaults.standard.bool(forKey: grantedKey) }
        set { UserDefaults.standard.set(newValue, forKey: grantedKey) }
    }

    /// The moment the user granted consent (nil if never granted or revoked).
    static var consentDate: Date? {
        get { UserDefaults.standard.object(forKey: dateKey) as? Date }
        set { UserDefaults.standard.set(newValue, forKey: dateKey) }
    }

    // MARK: - Mutators

    /// Record an explicit opt-in. Called from `AIConsentSheet` when the user taps "Allow AI features".
    static func grant() {
        hasConsented = true
        consentDate  = Date()
    }

    /// Revoke consent. Called from Settings → Privacy when the user toggles AI processing off.
    /// Subsequent AI calls must re-prompt before sending data.
    static func revoke() {
        hasConsented = false
        consentDate  = nil
    }
}
