import Foundation
import Observation

@Observable
final class LocalizationManager {
    static let shared = LocalizationManager()

    private let languageKey = "app_language"

    var currentLanguage: String {
        didSet {
            UserDefaults.standard.set(currentLanguage, forKey: languageKey)
        }
    }

    var isHindi: Bool {
        currentLanguage == "hi"
    }

    private init() {
        self.currentLanguage = UserDefaults.standard.string(forKey: languageKey) ?? "en"
    }

    func toggle() {
        currentLanguage = isHindi ? "en" : "hi"
    }

    func s(_ key: String) -> String {
        guard let entry = AppStrings.strings[key],
              let value = entry[currentLanguage] else {
            return key
        }
        return value
    }
}

struct L {
    static func s(_ key: String) -> String {
        LocalizationManager.shared.s(key)
    }
}
