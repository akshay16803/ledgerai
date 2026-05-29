import AuthenticationServices
import CryptoKit
import SwiftUI

struct LoginView: View {

    // MARK: - State

    @Environment(LocalizationManager.self) var lang
    @State private var viewModel: AuthViewModel
    var authManager: AuthManager

    /// The raw (un-hashed) nonce used for the current Apple Sign-In request.
    /// Must be stored in view state because the `onCompletion` closure fires
    /// asynchronously after the nonce was passed to Apple.
    @State private var currentAppleNonce: String = ""

    // MARK: - Init

    init(authManager: AuthManager) {
        self.authManager = authManager
        _viewModel = State(initialValue: AuthViewModel(authManager: authManager))
    }

    // MARK: - Body

    /// On iPad the login chrome should sit in a centered card rather than
    /// stretch the full screen width. iPhone keeps the original full-width
    /// layout. Apple App Review (May 2026) flagged iPhone-stretched iPad UI.
    private var isPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

    var body: some View {
        ZStack {
            Color.spentyBgPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // ── Logo & Branding ──────────────────────────────
                brandingSection

                Spacer()

                // ── Sign-in area ─────────────────────────────────
                signInSection
                    .padding(.bottom, 48)
            }
            .padding(.horizontal, 32)
            .frame(maxWidth: isPad ? 460 : .infinity)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .alert(lang.s("sign_in_error"), isPresented: $viewModel.showError) {
            Button(lang.s("ok")) { viewModel.dismissError() }
        } message: {
            Text(viewModel.errorMessage)
        }
        .onAppear {
            // If login failed while this view was off-screen (destroyed by AppRouter
            // switching to LoadingView), recover the error from AuthManager.
            if let error = authManager.lastLoginError {
                viewModel.errorMessage = error
                viewModel.showError = true
                authManager.lastLoginError = nil
            }
        }
            .trackScreen("Login")
}

    // MARK: - Sub-views

    private var brandingSection: some View {
        VStack(spacing: 16) {
            // App icon — references the AppLogo image set (a copy of
            // appicon.png in Assets.xcassets). UIImage(named:"AppIcon")
            // returns nil because iOS reserves the AppIcon set for the
            // home-screen / system icon and won't expose it via the
            // image-loading APIs — that's why nothing was rendering
            // before. AppLogo is a regular image set sourced from the
            // exact same 1024×1024 PNG, so the brand mark is identical.
            Image("AppLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

            Text(lang.s("spentyai"))
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(Color.spentyPrimary)

            Text(lang.s("smart_spending"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var signInSection: some View {
        VStack(spacing: 16) {
            // Error inline banner (secondary to the alert)
            if viewModel.showError {
                errorBanner
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            // ── Sign in with Apple ────────────────────────────────
            // Guideline 4.8 — Sign in with Apple must appear AT LEAST as
            // prominently as every other third-party login option.
            // Placing it first satisfies this unambiguously.
            SignInWithAppleButton(.signIn) { request in
                let nonce = randomNonceString()
                currentAppleNonce = nonce
                request.requestedScopes = [.fullName, .email]
                request.nonce = sha256Hash(nonce)
            } onCompletion: { result in
                switch result {
                case .success(let authorization):
                    guard
                        let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                        let tokenData   = credential.identityToken,
                        let idToken     = String(data: tokenData, encoding: .utf8)
                    else {
                        viewModel.errorMessage = "Apple Sign-In returned an invalid credential. Please try again."
                        viewModel.showError    = true
                        return
                    }
                    Task {
                        await viewModel.signInWithApple(
                            identityToken: idToken,
                            nonce: currentAppleNonce
                        )
                    }
                case .failure(let error):
                    // Code 1001 = user cancelled — silently ignore.
                    let nsError = error as NSError
                    if nsError.code != ASAuthorizationError.canceled.rawValue {
                        viewModel.errorMessage = "Apple Sign-In failed. Please try again."
                        viewModel.showError    = true
                    }
                }
            }
            .signInWithAppleButtonStyle(.black)
            .frame(maxWidth: .infinity, minHeight: 52, maxHeight: 52)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .disabled(viewModel.isLoading)
            .opacity(viewModel.isLoading ? 0.6 : 1)

            // ── Google Sign-In ────────────────────────────────────
            Button {
                Task { await viewModel.signInWithGoogle() }
            } label: {
                HStack(spacing: 12) {
                    // Google "G" logo
                    ZStack {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 26, height: 26)
                        Text("G")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color(red: 0.26, green: 0.52, blue: 0.96))
                    }

                    Text(lang.s("sign_in_google"))
                        .font(.body.weight(.semibold))
                }
                .frame(maxWidth: .infinity, minHeight: 52)
                .foregroundStyle(.white)
                .background(Color.spentyPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(color: Color.spentyPrimary.opacity(0.3), radius: 8, y: 4)
            }
            .disabled(viewModel.isLoading)
            .opacity(viewModel.isLoading ? 0.6 : 1)

            // Loading indicator
            if viewModel.isLoading {
                ProgressView()
                    .tint(Color.spentyPrimary)
                    .transition(.opacity)
            }

            // Demo/reviewer entry point removed 2026-05-10 per product
            // request — public users should not see it. App Review can
            // still sign in with the demo account via Google or Apple
            // Sign-In using the credentials provided in App Review
            // Information; the backend /auth/demo-login endpoint and
            // viewModel.signInWithDemo() function are intentionally
            // kept available for that fallback path.

            // Terms / footer
            Text("By continuing you agree to our\n[Terms of Service](https://spentyai.com/terms) & [Privacy Policy](https://spentyai.com/privacy)")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .tint(Color.spentyPrimary)
                .padding(.top, 4)
        }
        .animation(.easeInOut(duration: 0.25), value: viewModel.isLoading)
        .animation(.easeInOut(duration: 0.25), value: viewModel.showError)
    }

    private var errorBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(viewModel.errorMessage)
                .font(.caption)
                .foregroundStyle(.primary)
            Spacer()
            Button {
                viewModel.dismissError()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: - Nonce Helpers (Apple Sign-In)

    /// Generates a cryptographically random alphanumeric nonce (RFC 7636 style).
    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        var randomBytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        let charset: [Character] =
            Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String(randomBytes.map { charset[Int($0) % charset.count] })
    }

    /// Returns the SHA-256 hex string of the input, as required by Apple's
    /// identity token nonce validation.
    private func sha256Hash(_ input: String) -> String {
        let inputData  = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        return hashedData.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - Preview

#Preview {
    LoginView(authManager: AuthManager())
}
