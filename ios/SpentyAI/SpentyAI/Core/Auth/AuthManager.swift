import Foundation
import Observation

@Observable
final class AuthManager {

    var user: User?
    var isAuthenticated = false
    var isLoading = false

    private var sessionExpiredObserver: NSObjectProtocol?

    init() {
        sessionExpiredObserver = NotificationCenter.default.addObserver(
            forName: .userSessionExpired,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                await self?.logout()
            }
        }
    }

    deinit {
        if let observer = sessionExpiredObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Public Methods

    func login(idToken: String) async throws {
        isLoading = true
        defer { isLoading = false }

        struct LoginRequest: Encodable {
            let idToken: String
        }

        struct LoginResponse: Decodable {
            let sessionToken: String
            let user: User

            enum CodingKeys: String, CodingKey {
                case sessionToken
                case user
            }
        }

        let response: LoginResponse = try await APIClient.shared.post(
            APIEndpoints.authGoogleMobile,
            body: LoginRequest(idToken: idToken)
        )

        KeychainHelper.save(key: KeychainHelper.sessionTokenKey, value: response.sessionToken)
        self.user = response.user
        self.isAuthenticated = true
    }

    func checkSession() async {
        guard KeychainHelper.read(key: KeychainHelper.sessionTokenKey) != nil else {
            isAuthenticated = false
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let fetchedUser: User = try await APIClient.shared.get(APIEndpoints.authMe)
            self.user = fetchedUser
            self.isAuthenticated = true
        } catch {
            self.user = nil
            self.isAuthenticated = false
            KeychainHelper.delete(key: KeychainHelper.sessionTokenKey)
        }
    }

    func logout() async {
        do {
            let _: EmptyResponse = try await APIClient.shared.post(APIEndpoints.authLogout)
        } catch {
            // Logout best-effort; clear local state regardless
        }
        KeychainHelper.delete(key: KeychainHelper.sessionTokenKey)
        user = nil
        isAuthenticated = false
    }

    func deleteAccount() async throws {
        let _: EmptyResponse = try await APIClient.shared.delete(APIEndpoints.authDeleteAccount)
        KeychainHelper.delete(key: KeychainHelper.sessionTokenKey)
        user = nil
        isAuthenticated = false
    }
}
