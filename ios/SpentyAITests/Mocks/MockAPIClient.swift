import Foundation
@testable import SpentyAI

// MARK: - APIClientProtocol

/// Protocol matching the public interface of APIClient for dependency injection in tests.
/// NOTE: The production APIClient is an actor with a singleton pattern. To enable true unit testing
/// of ViewModels, repositories would need to accept this protocol via dependency injection.
protocol APIClientProtocol: Sendable {
    func get<T: Decodable>(_ path: String, query: [String: String]?) async throws -> T
    func post<T: Decodable>(_ path: String, body: (any Encodable)?) async throws -> T
    func put<T: Decodable>(_ path: String, body: any Encodable) async throws -> T
    func delete(_ path: String) async throws
}

// MARK: - MockAPIClient

/// A mock API client for unit testing that returns pre-configured responses or errors.
///
/// Usage:
/// ```swift
/// let mock = MockAPIClient()
/// mock.setResponse(for: "/api/dashboard/summary", response: MockData.mockDashboardSummary())
/// // Inject mock into the system under test
/// ```
final class MockAPIClient: APIClientProtocol, @unchecked Sendable {

    // MARK: - Recorded Calls

    /// All endpoint paths that were called, in order.
    private(set) var calledEndpoints: [String] = []

    /// All calls with method + path for fine-grained assertions.
    private(set) var calledMethods: [(method: String, path: String)] = []

    // MARK: - Stubbed Responses & Errors

    /// Maps endpoint paths to mock response objects.
    var responses: [String: Any] = [:]

    /// Maps endpoint paths to errors to simulate failures.
    var errors: [String: Error] = [:]

    // MARK: - Configuration

    /// Register a typed response for a given endpoint path.
    func setResponse<T: Codable>(for path: String, response: T) {
        responses[path] = response
    }

    /// Register an error for a given endpoint path.
    func setError(for path: String, error: Error) {
        errors[path] = error
    }

    /// Clear all recorded calls, responses, and errors.
    func reset() {
        calledEndpoints = []
        calledMethods = []
        responses = [:]
        errors = [:]
    }

    // MARK: - APIClientProtocol

    func get<T: Decodable>(_ path: String, query: [String: String]? = nil) async throws -> T {
        record(method: "GET", path: path)
        return try resolve(path: path)
    }

    func post<T: Decodable>(_ path: String, body: (any Encodable)? = nil) async throws -> T {
        record(method: "POST", path: path)
        return try resolve(path: path)
    }

    func put<T: Decodable>(_ path: String, body: any Encodable) async throws -> T {
        record(method: "PUT", path: path)
        return try resolve(path: path)
    }

    func delete(_ path: String) async throws {
        record(method: "DELETE", path: path)
        if let error = errors[path] {
            throw error
        }
    }

    // MARK: - Private Helpers

    private func record(method: String, path: String) {
        calledEndpoints.append(path)
        calledMethods.append((method: method, path: path))
    }

    private func resolve<T: Decodable>(path: String) throws -> T {
        if let error = errors[path] {
            throw error
        }

        guard let response = responses[path] else {
            throw MockAPIError.noResponseConfigured(path: path)
        }

        guard let typed = response as? T else {
            throw MockAPIError.typeMismatch(
                path: path,
                expected: String(describing: T.self),
                actual: String(describing: type(of: response))
            )
        }

        return typed
    }
}

// MARK: - MockAPIError

enum MockAPIError: LocalizedError {
    case noResponseConfigured(path: String)
    case typeMismatch(path: String, expected: String, actual: String)

    var errorDescription: String? {
        switch self {
        case .noResponseConfigured(let path):
            return "MockAPIClient: No response configured for path '\(path)'"
        case .typeMismatch(let path, let expected, let actual):
            return "MockAPIClient: Type mismatch for path '\(path)' — expected \(expected), got \(actual)"
        }
    }
}
