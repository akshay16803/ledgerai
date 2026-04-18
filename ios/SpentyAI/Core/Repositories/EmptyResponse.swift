import Foundation

/// A lightweight Decodable type used when an API call returns no meaningful body.
/// APIClient.post/put always require a Decodable return type, so this serves
/// as a discard target for fire-and-forget endpoints.
struct EmptyResponse: Codable {}
