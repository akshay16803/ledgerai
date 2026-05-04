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
    private var subscriptionRequiredObserver: NSObjectProtocol?

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

        // Any 402 from APIClient flips the user back to "needs subscription"
        // by re-fetching /auth/me. The refreshed user record carries
        // subscription_status=inactive, which AppRouter inspects via
        // user.hasActiveSubscription to route to SubscriptionPaywall —
        // mirrors the existing session-expired pattern, no per-screen wiring.
        subscriptionRequiredObserver = NotificationCenter.default.addObserver(
            forName: .subscriptionRequired,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                await self?.checkSession()
            }
        }
    }

    deinit {
        if let observer = sessionExpiredObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = subscriptionRequiredObserver {
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

        #if DEBUG
        print("[Auth] login() — calling /api/auth/google/mobile …")
        print("[Auth] login() — id_token prefix: \(idToken.prefix(20))…")
        #endif
        do {
            let response: LoginResponse = try await APIClient.shared.post(
                APIEndpoints.authGoogleMobile,
                body: LoginRequest(idToken: idToken)
            )
            #if DEBUG
            print("[Auth] login() — success, userId=\(response.user.id)")
            #endif
            KeychainHelper.save(key: KeychainHelper.sessionTokenKey, value: response.sessionToken)
            self.user = response.user
            self.isAuthenticated = true
            #if DEBUG
            print("[Auth] login() — isAuthenticated=\(isAuthenticated), user=\(response.user.email ?? "nil")")
            #endif
        } catch {
            #if DEBUG
            print("[Auth] login() — FAILED: \(error)")
            #endif
            lastLoginError = (error as? APIError)?.localizedDescription ?? "Something went wrong. Please try again."
            throw error
        }
    }

    func checkSession() async {
        #if targetEnvironment(simulator)
        // Simulator auto-login is OPT-IN. Default behaviour matches a real
        // device (new install = no token = LoginView). Devs who still want
        // the auto-login convenience can pass SIMULATOR_AUTOLOGIN=true via
        // Xcode scheme env vars.
        let simAutoLoginOn = ProcessInfo.processInfo.environment["SIMULATOR_AUTOLOGIN"] == "true"
        let existingToken = KeychainHelper.read(key: KeychainHelper.sessionTokenKey)
        if simAutoLoginOn && (existingToken == nil || existingToken?.hasPrefix("sim-offline-token-") == true) {
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
        // Always clean up any leftover offline-fallback tokens so they do not
        // resurrect across launches when SIMULATOR_AUTOLOGIN is off.
        if !simAutoLoginOn, let token = existingToken, token.hasPrefix("sim-offline-token-") {
            KeychainHelper.delete(key: KeychainHelper.sessionTokenKey)
            isAuthenticated = false
            return
        }
        #endif

        guard let token = KeychainHelper.read(key: KeychainHelper.sessionTokenKey) else {
            #if DEBUG
            print("[Auth] checkSession() — no token found, showing login")
            #endif
            isAuthenticated = false
            return
        }
        #if DEBUG
        print("[Auth] checkSession() — token found (\(token.prefix(8))…), calling /api/auth/me …")
        #endif
        isLoading = true
        defer { isLoading = false }
        do {
            let fetchedUser: User = try await APIClient.shared.get(APIEndpoints.authMe)
            #if DEBUG
            print("[Auth] checkSession() — success, userId=\(fetchedUser.id)")
            #endif
            self.user = fetchedUser
            self.isAuthenticated = true
        } catch {
            #if DEBUG
            print("[Auth] checkSession() — FAILED: \(error)")
            #endif
            self.user = nil
            self.isAuthenticated = false
            KeychainHelper.delete(key: KeychainHelper.sessionTokenKey)

            #if targetEnvironment(simulator)
            // Token was stale — try auto-login again ONLY if dev opted in.
            if ProcessInfo.processInfo.environment["SIMULATOR_AUTOLOGIN"] == "true" {
                do {
                    try await simulatorAutoLogin()
                } catch {
                    print("[SimulatorBypass] Re-login failed: \(error)")
                }
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

    // MARK: - Apple Sign-In

    func loginWithApple(identityToken: String, nonce: String) async throws {
        isLoading = true
        lastLoginError = nil
        defer { isLoading = false }

        struct AppleLoginRequest: Encodable {
            let identityToken: String
            let nonce: String
        }

        struct LoginResponse: Decodable {
            let sessionToken: String
            let user: User
        }

        #if DEBUG
        print("[Auth] loginWithApple() — calling /api/auth/apple/mobile …")
        #endif
        do {
            let response: LoginResponse = try await APIClient.shared.post(
                APIEndpoints.authAppleMobile,
                body: AppleLoginRequest(identityToken: identityToken, nonce: nonce)
            )
            #if DEBUG
            print("[Auth] loginWithApple() — success, userId=\(response.user.id)")
            #endif
            KeychainHelper.save(key: KeychainHelper.sessionTokenKey, value: response.sessionToken)
            self.user = response.user
            self.isAuthenticated = true
        } catch {
            #if DEBUG
            print("[Auth] loginWithApple() — FAILED: \(error)")
            #endif
            lastLoginError = (error as? APIError)?.localizedDescription ?? "Apple Sign-In failed. Please try again."
            throw error
        }
    }

    // MARK: - Demo Login (for App Review)

    func demoLogin() async {
        isLoading = true
        lastLoginError = nil
        defer { isLoading = false }

        struct DemoLoginResponse: Decodable {
            let sessionToken: String
            let user: User
        }

        #if DEBUG
        print("[Auth] demoLogin() — calling /api/auth/demo-login …")
        #endif
        do {
            let response: DemoLoginResponse = try await APIClient.shared.post(
                APIEndpoints.authDemoLogin
            )
            #if DEBUG
            print("[Auth] demoLogin() — success, userId=\(response.user.id)")
            #endif
            KeychainHelper.save(key: KeychainHelper.sessionTokenKey, value: response.sessionToken)
            self.user = response.user
            self.isAuthenticated = true
        } catch {
            #if DEBUG
            print("[Auth] demoLogin() — FAILED: \(error)")
            #endif
            lastLoginError = (error as? APIError)?.localizedDescription ?? "Demo login unavailable. Please use Google or Apple sign-in."
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
