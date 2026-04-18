import Foundation

/// A reusable response type for API calls that return an empty body
/// or a simple `{"message": "..."}` / `{"detail": "..."}` payload.
struct EmptyResponse: Decodable {}

/// A reusable response type for API calls that return `{"message": "..."}`.
/// Used by delete, approve, reject, and bulk operations.
struct MessageResponse: Codable {
    let message: String?
}
