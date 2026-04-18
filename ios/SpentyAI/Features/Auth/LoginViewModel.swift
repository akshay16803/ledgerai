import Foundation
import AuthenticationServices
import os

@Observable
final class LoginViewModel {

    var isSigningIn = false
    var errorMessage: String?

    private let logger = Logger(subsystem: "com.spentyai", category: "auth")
    private let baseURL = "https://accounts.niprasha.com"
    private let callbackScheme = "spentyai"

    // MARK: - Google OAuth

    @MainActor
    func signInWithGoogle(appState: AppState) async {
        isSigningIn = true
        errorMessage = nil

        let oauthURL = "\(baseURL)\(APIEndpoints.Auth.googleMobile)?redirect_scheme=\(callbackScheme)"

        guard let url = URL(string: oauthURL) else {
            errorMessage = "Invalid authentication URL."
            isSigningIn = false
            return
        }

        do {
            let callbackURL = try await startWebAuthSession(url: url)
            try await handleCallback(callbackURL: callbackURL, appState: appState)
        } catch ASWebAuthenticationSessionError.canceledLogin {
            logger.info("User cancelled Google sign-in")
        } catch {
            errorMessage = "Sign in failed. Please try again."
            logger.error("OAuth error: \(error.localizedDescription)")
        }

        isSigningIn = false
    }

    // MARK: - Private

    @MainActor
    private func startWebAuthSession(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(
                        throwing: AuthError.missingCallback
                    )
                }
            }

            session.presentationContextProvider = WebAuthContextProvider.shared
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }

    private func handleCallback(callbackURL: URL, appState: AppState) async throws {
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "session_token" })?.value else {
            throw AuthError.missingToken
        }

        try await TokenManager.shared.save(token: token)
        logger.info("Session token saved successfully")

        await appState.loadCurrentUser()
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case missingCallback
    case missingToken

    var errorDescription: String? {
        switch self {
        case .missingCallback:
            return "No response received from authentication."
        case .missingToken:
            return "Authentication succeeded but no session token was returned."
        }
    }
}

// MARK: - ASWebAuthenticationSession Context

final class WebAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuthContextProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}
