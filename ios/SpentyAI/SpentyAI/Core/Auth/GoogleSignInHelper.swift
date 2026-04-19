import AuthenticationServices
import CryptoKit
import Foundation

final class GoogleSignInHelper: NSObject, ASWebAuthenticationPresentationContextProviding {

    /// The iOS OAuth client ID.  Must come from an **iOS-type** OAuth client
    /// in Google Cloud Console (not "Web application").  A Web client ID will
    /// cause `unsupported_response_type` because Google rejects custom-scheme
    /// redirect URIs for Web clients.
    private static let clientID: String = {
        guard let path = Bundle.main.path(forResource: "Config", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path),
              let id = dict["GOOGLE_IOS_CLIENT_ID"] as? String,
              !id.isEmpty else {
            // Fall back to the legacy key so existing setups keep working
            // while the iOS client ID is being provisioned.
            guard let path = Bundle.main.path(forResource: "Config", ofType: "plist"),
                  let dict = NSDictionary(contentsOfFile: path),
                  let id = dict["GOOGLE_CLIENT_ID"] as? String else { return "" }
            return id
        }
        return id
    }()

    /// Google registers the reversed client ID as the custom-scheme redirect
    /// for iOS OAuth clients.  The scheme is:
    ///   com.googleusercontent.apps.<numeric-id-hash>
    private static var callbackScheme: String {
        clientID.components(separatedBy: ".").reversed().joined(separator: ".")
    }

    /// The redirect URI sent in the authorization request.  Google's iOS
    /// OAuth flow expects the path `/oauthredirect` (not `/oauth2callback`).
    private static var redirectURI: String {
        callbackScheme + ":/oauthredirect"
    }

    private static let tokenEndpoint = "https://oauth2.googleapis.com/token"

    // MARK: - Public

    static func signIn() async throws -> String {
        let helper = GoogleSignInHelper()
        return try await helper._signIn()
    }

    // MARK: - Private

    private func _signIn() async throws -> String {
        guard !Self.clientID.isEmpty else {
            throw APIError.badRequest("Google Sign-In is not configured — missing iOS client ID in Config.plist")
        }

        // 1. Generate PKCE code verifier and challenge
        let codeVerifier = Self.generateCodeVerifier()
        let codeChallenge = Self.generateCodeChallenge(from: codeVerifier)
        let nonce = UUID().uuidString

        // 2. Build authorization URL with code flow + PKCE
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: Self.clientID),
            URLQueryItem(name: "redirect_uri", value: Self.redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "nonce", value: nonce),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256")
        ]

        guard let authURL = components.url else {
            throw APIError.badRequest("Failed to construct Google sign-in URL")
        }

        // 3. Present ASWebAuthenticationSession and get the auth code
        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: Self.callbackScheme
            ) { url, error in
                if let error {
                    if let authError = error as? ASWebAuthenticationSessionError,
                       authError.code == .canceledLogin {
                        continuation.resume(throwing: APIError.cancelled)
                    } else {
                        continuation.resume(throwing: APIError.networkError(error))
                    }
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

        // 4. Extract the authorization code from the callback URL
        guard let queryItems = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?.queryItems,
              let code = queryItems.first(where: { $0.name == "code" })?.value else {
            throw APIError.badRequest("No authorization code in Google callback")
        }

        // 5. Exchange the authorization code for tokens
        let idToken = try await exchangeCodeForToken(code: code, codeVerifier: codeVerifier)
        return idToken
    }

    // MARK: - Token Exchange

    private func exchangeCodeForToken(code: String, codeVerifier: String) async throws -> String {
        var request = URLRequest(url: URL(string: Self.tokenEndpoint)!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let params = [
            "client_id": Self.clientID,
            "code": code,
            "code_verifier": codeVerifier,
            "grant_type": "authorization_code",
            "redirect_uri": Self.redirectURI
        ]

        request.httpBody = params
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown(0, "Invalid response from Google token endpoint")
        }

        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? "No response body"
            throw APIError.serverError("Token exchange failed (\(httpResponse.statusCode)): \(body)")
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let idToken = json["id_token"] as? String, !idToken.isEmpty else {
            throw APIError.badRequest("No id_token in Google token response")
        }

        return idToken
    }

    // MARK: - PKCE Helpers

    /// Generates a cryptographically random 43-character code verifier (RFC 7636).
    private static func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Generates a S256 code challenge from the code verifier (RFC 7636).
    private static func generateCodeChallenge(from verifier: String) -> String {
        let data = Data(verifier.utf8)
        let hash = SHA256.hash(data: data)
        return Data(hash)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    // MARK: - ASWebAuthenticationPresentationContextProviding

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        ASPresentationAnchor()
    }
}
