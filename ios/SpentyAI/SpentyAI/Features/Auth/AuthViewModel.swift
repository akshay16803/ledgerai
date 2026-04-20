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

    /// Clears the current error banner.
    func dismissError() {
        showError = false
        errorMessage = ""
    }
}
