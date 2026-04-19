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
        #if targetEnvironment(simulator)
        // If no valid token exists on the simulator, auto-login via the dev endpoint
        // so we can test all screens without Google OAuth.
        if KeychainHelper.read(key: KeychainHelper.sessionTokenKey) == nil {
            isLoading = true
            defer { isLoading = false }
            do {
                try await simulatorAutoLogin()
            } catch {
                print("[SimulatorBypass] Auto-login failed: \(error)")
                isAuthenticated = false
            }
            return
        }
        #endif

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

            #if targetEnvironment(simulator)
            // Token was stale — try auto-login again
            do {
                try await simulatorAutoLogin()
            } catch {
                print("[SimulatorBypass] Re-login failed: \(error)")
            }
            #endif
        }
    }

    // MARK: - Simulator Bypass

    #if targetEnvironment(simulator)
    /// Calls the dev-only backend endpoint to mint a session token without Google OAuth.
    private func simulatorAutoLogin() async throws {
        struct SimulatorLoginRequest: Encodable {
            let email: String
            let devSecret: String
        }

        struct SimulatorLoginResponse: Decodable {
            let sessionToken: String
            let user: User
        }

        let response: SimulatorLoginResponse = try await APIClient.shared.post(
            APIEndpoints.authDevSimulatorLogin,
            body: SimulatorLoginRequest(
                email: "akshaychouhan16803@gmail.com",
                devSecret: "spenty-sim-bypass-2026"
            )
        )

        KeychainHelper.save(key: KeychainHelper.sessionTokenKey, value: response.sessionToken)
        self.user = response.user
        self.isAuthenticated = true
        print("[SimulatorBypass] Auto-login successful for \(response.user.email ?? "unknown")")
    }
    #endif

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
