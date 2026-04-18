import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case forbidden
    case notFound
    case badRequest(String)
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)
    case unknown(Int, String?)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Session expired. Please sign in again."
        case .forbidden:
            return "You don't have permission to perform this action."
        case .notFound:
            return "The requested resource was not found."
        case .badRequest(let message):
            return message
        case .serverError(let message):
            return "Server error: \(message)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        case .unknown(let code, let message):
            return "Unexpected error (\(code)): \(message ?? "Unknown")"
        }
    }
}
