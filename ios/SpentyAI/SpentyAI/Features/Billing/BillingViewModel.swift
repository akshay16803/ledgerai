import Foundation
import os

@Observable
final class BillingViewModel {

    var promoCode = ""
    var promoValid: Bool?
    var promoError: String?
    var promoMessage: String?
    var isValidating = false
    var isActivating = false

    private let logger = Logger(subsystem: "com.spentyai", category: "billing")

    // MARK: - Promo Code

    @MainActor
    func validatePromo() async {
        let code = promoCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else {
            promoError = "Please enter a promo code."
            promoValid = false
            return
        }

        isValidating = true
        promoError = nil
        promoValid = nil
        promoMessage = nil

        do {
            let response: PromoValidateResponse = try await APIClient.shared.post(
                APIEndpoints.Promo.validate,
                body: PromoRequest(code: code)
            )
            promoValid = response.valid
            if response.valid {
                promoMessage = response.message ?? "Promo code is valid."
            } else {
                promoError = response.message ?? "Invalid promo code."
            }
        } catch {
            promoValid = false
            promoError = "Failed to validate promo code."
            logger.error("Promo validation error: \(error.localizedDescription)")
        }

        isValidating = false
    }

    @MainActor
    func activatePromo(appState: AppState) async {
        let code = promoCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }

        isActivating = true
        promoError = nil

        do {
            let _: PromoActivateResponse = try await APIClient.shared.post(
                APIEndpoints.Promo.activate,
                body: PromoRequest(code: code)
            )
            logger.info("Promo code activated: \(code)")

            // Refresh user to pick up new subscription state
            await appState.refreshSubscription()
        } catch {
            promoError = "Failed to activate promo code."
            logger.error("Promo activation error: \(error.localizedDescription)")
        }

        isActivating = false
    }
}

// MARK: - Request / Response Models

private struct PromoRequest: Codable {
    let code: String
}

struct PromoValidateResponse: Codable {
    let valid: Bool
    let message: String?
    let plan: String?
    let duration: String?
}

struct PromoActivateResponse: Codable {
    let success: Bool
    let message: String?
    let subscriptionPlan: String?
    let subscriptionExpiry: String?

    enum CodingKeys: String, CodingKey {
        case success
        case message
        case subscriptionPlan = "subscription_plan"
        case subscriptionExpiry = "subscription_expiry"
    }
}
