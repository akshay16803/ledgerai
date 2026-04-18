import AuthenticationServices
import Foundation

final class GoogleSignInHelper: NSObject, ASWebAuthenticationPresentationContextProviding {

    private static let clientID = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_ID") as? String ?? ""
    private static let redirectURI = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_REDIRECT_URI") as? String ?? "com.spentyai.app:/oauth2callback"
    private static let callbackScheme = "com.spentyai.app"

    func signIn() async throws -> String {
        let nonce = UUID().uuidString
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: Self.clientID),
            URLQueryItem(name: "redirect_uri", value: Self.redirectURI),
            URLQueryItem(name: "response_type", value: "id_token"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "nonce", value: nonce),
            URLQueryItem(name: "response_mode", value: "fragment")
        ]

        guard let authURL = components.url else {
            throw APIError.badRequest("Failed to construct Google sign-in URL")
        }

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: Self.callbackScheme
            ) { url, error in
                if let error {
                    continuation.resume(throwing: APIError.networkError(error))
                } else if let url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: APIError.unknown(0, "Google sign-in was cancelled"))
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }

        guard let fragment = callbackURL.fragment else {
            throw APIError.badRequest("No fragment in Google callback URL")
        }

        let params = fragment.split(separator: "&").reduce(into: [String: String]()) { dict, pair in
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2 {
                dict[String(parts[0])] = String(parts[1])
            }
        }

        guard let idToken = params["id_token"], !idToken.isEmpty else {
            throw APIError.badRequest("No id_token in Google callback")
        }

        return idToken
    }

    // MARK: - ASWebAuthenticationPresentationContextProviding

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        ASPresentationAnchor()
    }
}
