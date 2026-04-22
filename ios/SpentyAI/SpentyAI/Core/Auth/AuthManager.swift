import Foundation
import Observation

@Observable
final class AuthManager {

    var user: User?
    var isAuthenticated = false
    var isLoading = false

    /// Persists login error across LoginView recreation so the user always sees feedback.
    var lastLoginError: String?

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
        lastLoginError = nil
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

        print("[Auth] login() — calling /api/auth/google/mobile …")
        print("[Auth] login() — id_token prefix: \(idToken.prefix(20))…")
        do {
            let response: LoginResponse = try await APIClient.shared.post(
                APIEndpoints.authGoogleMobile,
                body: LoginRequest(idToken: idToken)
            )
            print("[Auth] login() — success, userId=\(response.user.id)")
            KeychainHelper.save(key: KeychainHelper.sessionTokenKey, value: response.sessionToken)
            self.user = response.user
            self.isAuthenticated = true
            print("[Auth] login() — isAuthenticated=\(isAuthenticated), user=\(response.user.email ?? "nil")")
        } catch {
            print("[Auth] login() — FAILED: \(error)")
            lastLoginError = (error as? APIError)?.localizedDescription ?? "Something went wrong. Please try again."
            throw error
        }
    }

    func checkSession() async {
        #if targetEnvironment(simulator)
        let existingToken = KeychainHelper.read(key: KeychainHelper.sessionTokenKey)
        // If no valid token exists, or we have an offline fallback token, auto-login via dev endpoint
        if existingToken == nil || existingToken?.hasPrefix("sim-offline-token-") == true {
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

        guard let token = KeychainHelper.read(key: KeychainHelper.sessionTokenKey) else {
            print("[Auth] checkSession() — no token found, showing login")
            isAuthenticated = false
            return
        }
        print("[Auth] checkSession() — token found (\(token.prefix(8))…), calling /api/auth/me …")
        isLoading = true
        defer { isLoading = false }
        do {
            let fetchedUser: User = try await APIClient.shared.get(APIEndpoints.authMe)
            print("[Auth] checkSession() — success, userId=\(fetchedUser.id)")
            self.user = fetchedUser
            self.isAuthenticated = true
        } catch {
            print("[Auth] checkSession() — FAILED: \(error)")
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
    /// Falls back to a hardcoded offline user if the network call fails (common in simulator).
    private func simulatorAutoLogin() async throws {
        struct SimulatorLoginRequest: Encodable {
            let email: String
            let devSecret: String
        }

        struct SimulatorLoginResponse: Decodable {
            let sessionToken: String
            let user: User
        }

        // Try the real endpoint first
        do {
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
            print("[SimulatorBypass] Auto-login successful via API for \(response.user.email ?? "unknown")")
            return
        } catch {
            print("[SimulatorBypass] API auto-login failed: \(error). Falling back to offline bypass...")
        }

        // Offline fallback: create a hardcoded user and fake session token
        // This lets us test the full UI on the simulator even when the backend is unreachable.
        let offlineToken = "sim-offline-token-\(UUID().uuidString)"
        let offlineUser = User(
            id: "user_simulator_offline",
            email: "akshaychouhan16803@gmail.com",
            name: "Akshay Chouhan",
            picture: nil,
            subscriptionPlan: "lifetime",
            subscriptionStatus: "active",
            subscriptionExpiry: nil,
            subscriptionProvider: "simulator"
        )
        KeychainHelper.save(key: KeychainHelper.sessionTokenKey, value: offlineToken)
        self.user = offlineUser
        self.isAuthenticated = true
        print("[SimulatorBypass] Offline fallback login successful for \(offlineUser.email ?? "unknown")")
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
