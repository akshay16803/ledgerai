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
            #if DEBUG
            print("[AuthVM] Starting Google Sign-In …")
            #endif
            let idToken = try await GoogleSignInHelper.signIn()
            #if DEBUG
            print("[AuthVM] Got id_token, calling login() …")
            #endif
            try await authManager.login(idToken: idToken)
            #if DEBUG
            print("[AuthVM] Login succeeded!")
            #endif
            // AuthManager sets isAuthenticated → AppRouter navigates automatically.
        } catch APIError.cancelled {
            #if DEBUG
            print("[AuthVM] Sign-in cancelled by user")
            #endif
            // User intentionally cancelled sign-in — no error to show.
        } catch let error as APIError {
            #if DEBUG
            print("[AuthVM] APIError: \(error)")
            #endif
            errorMessage = error.localizedDescription
            showError = true
        } catch {
            #if DEBUG
            print("[AuthVM] Unknown error: \(error)")
            #endif
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
            #if DEBUG
            print("[AuthVM] Starting Apple Sign-In …")
            #endif
            try await authManager.loginWithApple(identityToken: identityToken, nonce: nonce)
            #if DEBUG
            print("[AuthVM] Apple login succeeded!")
            #endif
        } catch let error as APIError {
            #if DEBUG
            print("[AuthVM] Apple APIError: \(error)")
            #endif
            errorMessage = error.localizedDescription
            showError = true
        } catch {
            #if DEBUG
            print("[AuthVM] Apple unknown error: \(error)")
            #endif
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
