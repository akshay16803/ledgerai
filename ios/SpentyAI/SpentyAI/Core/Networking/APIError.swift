import Foundation

enum APIError: LocalizedError {
    case unauthorized
    /// HTTP 402 — backend's require_active_subscription gate fired. The
    /// associated message is what we surface to the user. The .subscriptionRequired
    /// notification has already been posted from APIClient.validateResponse;
    /// AppRouter will re-route to SubscriptionPaywall once AuthManager refreshes.
    case subscriptionRequired(String)
    case badRequest(String)
    case notFound
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)
    case unknown(Int, String?)
    case cancelled

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case .subscriptionRequired(let message):
            return message
        case .badRequest(let message):
            return message
        case .notFound:
            return "The requested resource was not found."
        case .serverError(let message):
            return "Server error: \(message)"
        case .cancelled:
            return "Sign in was cancelled."
        case .networkError(let error):
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain {
                return "No internet connection. Please check your network and try again."
            }
            return "Something went wrong. Please try again."
        case .decodingError(let error):
            return "Failed to process server response: \(error.localizedDescription)"
        case .unknown(let code, let message):
            return message ?? "An unexpected error occurred (code \(code))."
        }
    }
}
