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
            let idToken = try await GoogleSignInHelper.signIn()
            try await authManager.login(idToken: idToken)
            // AuthManager sets isAuthenticated → AppRouter navigates automatically.
        } catch APIError.cancelled {
            // User intentionally cancelled sign-in — no error to show.
        } catch let error as APIError {
            errorMessage = error.localizedDescription
            showError = true
        } catch {
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
