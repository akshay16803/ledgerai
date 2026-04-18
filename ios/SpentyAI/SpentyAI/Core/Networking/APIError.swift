import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case badRequest(String)
    case notFound
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)
    case unknown(Int, String?)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case .badRequest(let message):
            return message
        case .notFound:
            return "The requested resource was not found."
        case .serverError(let message):
            return "Server error: \(message)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to process server response: \(error.localizedDescription)"
        case .unknown(let code, let message):
            return message ?? "An unexpected error occurred (code \(code))."
        }
    }
}
