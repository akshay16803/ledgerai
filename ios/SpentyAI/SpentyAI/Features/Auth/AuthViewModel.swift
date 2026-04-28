import Foundation
import SwiftUI

@Observable
final class AuthViewModel {

    // MARK: - State

    var isLoading = false
    var errorMessage = ""
    var showError = false

    // MARK: - Dependencies

    private let authManager: AuthManager

    // MARK: - Init

    init(authManager: AuthManager) {
        self.authManager = authManager
    }

    // MARK: - Actions

    /// Initiates the Google Sign-In flow, exchanges the id_token with the
    /// backend via AuthManager, and lets the router react to the
    /// `isAuthenticated` change.
    @MainActor
    func signInWithGoogle() async {
        isLoading = true
        showError = false
        errorMessage = ""

        do {
            print("[AuthVM] Starting Google Sign-In …")
            let idToken = try await GoogleSignInHelper.signIn()
            print("[AuthVM] Got id_token, calling login() …")
            try await authManager.login(idToken: idToken)
            print("[AuthVM] Login succeeded!")
            // AuthManager sets isAuthenticated → AppRouter navigates automatically.
        } catch APIError.cancelled {
            print("[AuthVM] Sign-in cancelled by user")
            // User intentionally cancelled sign-in — no error to show.
        } catch let error as APIError {
            print("[AuthVM] APIError: \(error)")
            errorMessage = error.localizedDescription
            showError = true
        } catch {
            print("[AuthVM] Unknown error: \(error)")
            errorMessage = "Something went wrong. Please try again."
            showError = true
        }

        isLoading = false
    }

    /// Completes Sign in with Apple using the identity token and raw nonce.
    @MainActor
    func signInWithApple(identityToken: String, nonce: String) async {
        isLoading = true
        showError = false
        errorMessage = ""

        do {
            print("[AuthVM] Starting Apple Sign-In …")
            try await authManager.loginWithApple(identityToken: identityToken, nonce: nonce)
            print("[AuthVM] Apple login succeeded!")
        } catch let error as APIError {
            print("[AuthVM] Apple APIError: \(error)")
            errorMessage = error.localizedDescription
            showError = true
        } catch {
            print("[AuthVM] Apple unknown error: \(error)")
            errorMessage = "Apple Sign-In failed. Please try again."
            showError = true
        }

        isLoading = false
    }

    /// Demo login for App Review — logs in with a pre-seeded demo account.
    @MainActor
    func signInWithDemo() async {
        isLoading = true
        showError = false
        errorMessage = ""

        await authManager.demoLogin()

        if let err = authManager.lastLoginError {
            errorMessage = err
            showError = true
        }

        isLoading = false
    }

    /// Clears the current error banner.
    func dismissError() {
        showError = false
        errorMessage = ""
    }
}
