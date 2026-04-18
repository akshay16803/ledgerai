import Foundation

struct AuthRepository {

    func getCurrentUser() async throws -> User {
        try await APIClient.shared.get(APIEndpoints.Auth.me)
    }

    func logout() async throws {
        let _: EmptyResponse = try await APIClient.shared.post(APIEndpoints.Auth.logout)
        await TokenManager.shared.deleteToken()
    }

    func signInWithGoogle(idToken: String) async throws -> User {
        let body = ["id_token": idToken]
        return try await APIClient.shared.post(APIEndpoints.Auth.googleMobile, body: body)
    }
}
