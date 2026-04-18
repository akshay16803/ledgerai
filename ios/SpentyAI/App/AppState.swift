import Foundation
import os

@Observable
final class AppState {

    // MARK: - Published State

    var user: User?
    var isAuthenticated = false
    var isLoading = false
    var hasInvoices = false
    var hasBills = false
    var errorMessage: String?

    // MARK: - Computed

    var hasActiveSubscription: Bool {
        guard let user,
              user.subscriptionStatus == "active",
              let expiryString = user.subscriptionExpiry else {
            return false
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        // Try with fractional seconds first, then without
        if let expiry = formatter.date(from: expiryString) {
            return expiry > Date()
        }
        formatter.formatOptions = [.withInternetDateTime]
        if let expiry = formatter.date(from: expiryString) {
            return expiry > Date()
        }

        return false
    }

    // MARK: - Private

    private let logger = Logger(subsystem: "com.spentyai", category: "appstate")

    // MARK: - Methods

    @MainActor
    func loadCurrentUser() async {
        isLoading = true
        errorMessage = nil

        do {
            let fetchedUser: User = try await APIClient.shared.get(APIEndpoints.Auth.me)
            user = fetchedUser
            isAuthenticated = true
            logger.info("Loaded user: \(fetchedUser.email)")
            await checkFeatureVisibility()
        } catch let error as APIError where error is APIError {
            if case .unauthorized = error {
                isAuthenticated = false
                user = nil
                logger.info("User session expired")
            } else {
                errorMessage = error.errorDescription
                logger.error("Failed to load user: \(error.localizedDescription)")
            }
        } catch {
            errorMessage = "Failed to connect to server."
            logger.error("Network error loading user: \(error.localizedDescription)")
        }

        isLoading = false
    }

    @MainActor
    func logout() async {
        do {
            let _: EmptyResponse = try await APIClient.shared.post(APIEndpoints.Auth.logout)
        } catch {
            logger.error("Logout API call failed: \(error.localizedDescription)")
        }

        await TokenManager.shared.deleteToken()
        user = nil
        isAuthenticated = false
        hasInvoices = false
        hasBills = false
        errorMessage = nil
        logger.info("User logged out")
    }

    @MainActor
    func checkFeatureVisibility() async {
        // Check invoices
        do {
            let response: CountResponse = try await APIClient.shared.get(
                APIEndpoints.Invoices.stats
            )
            hasInvoices = response.count > 0
        } catch {
            hasInvoices = false
            logger.error("Failed to check invoices: \(error.localizedDescription)")
        }

        // Check bills
        do {
            let response: CountResponse = try await APIClient.shared.get(
                APIEndpoints.Bills.stats
            )
            hasBills = response.count > 0
        } catch {
            hasBills = false
            logger.error("Failed to check bills: \(error.localizedDescription)")
        }
    }

    @MainActor
    func refreshSubscription() async {
        do {
            let fetchedUser: User = try await APIClient.shared.get(APIEndpoints.Auth.me)
            user = fetchedUser
            logger.info("Refreshed subscription state")
        } catch {
            logger.error("Failed to refresh subscription: \(error.localizedDescription)")
        }
    }
}

// MARK: - Response Helpers

struct EmptyResponse: Codable {}

struct CountResponse: Codable {
    let count: Int

    enum CodingKeys: String, CodingKey {
        case count
        case total
        case totalCount = "total_count"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let count = try? container.decode(Int.self, forKey: .count) {
            self.count = count
        } else if let total = try? container.decode(Int.self, forKey: .total) {
            self.count = total
        } else if let totalCount = try? container.decode(Int.self, forKey: .totalCount) {
            self.count = totalCount
        } else {
            self.count = 0
        }
    }
}
