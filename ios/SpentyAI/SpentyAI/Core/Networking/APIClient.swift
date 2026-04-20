import Foundation

extension Notification.Name {
    static let userSessionExpired = Notification.Name("userSessionExpired")
}

final class APIClient: Sendable {

    static let shared = APIClient()

    let baseURL: String

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)

            // Empty / whitespace-only strings cannot be dates
            if string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Empty date string")
            }

            // ISO 8601 with fractional seconds (e.g. backend datetimes with microseconds)
            let isoFrac = ISO8601DateFormatter()
            isoFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = isoFrac.date(from: string) { return date }

            // ISO 8601 without fractional seconds
            let iso = ISO8601DateFormatter()
            if let date = iso.date(from: string) { return date }

            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            for fmt in [
                "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZZZZZ",   // 2024-01-15T10:30:00.123456+00:00
                "yyyy-MM-dd'T'HH:mm:ssZZZZZ",           // 2024-01-15T10:30:00+00:00
                "yyyy-MM-dd'T'HH:mm:ss.SSSZ",           // 2024-01-15T10:30:00.123+0000
                "yyyy-MM-dd'T'HH:mm:ssZ",               // 2024-01-15T10:30:00+0000
                "yyyy-MM-dd",                            // 2024-01-15
            ] {
                formatter.dateFormat = fmt
                if let date = formatter.date(from: string) {
                    return date
                }
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(string)")
        }
        return d
    }()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private init(baseURL: String = "https://api.spentyai.com") {
        self.baseURL = baseURL
    }

    // MARK: - Public Methods

    func get<T: Decodable>(_ path: String) async throws -> T {
        let request = try buildRequest(path: path, method: "GET")
        return try await execute(request)
    }

    func getRaw(_ path: String) async throws -> Data {
        let request = try buildRequest(path: path, method: "GET")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response, data: data)
        return data
    }

    func post<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        var request = try buildRequest(path: path, method: "POST")
        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return try await execute(request)
    }

    func put<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        var request = try buildRequest(path: path, method: "PUT")
        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return try await execute(request)
    }

    func patch<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        var request = try buildRequest(path: path, method: "PATCH")
        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return try await execute(request)
    }

    func delete<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        var request = try buildRequest(path: path, method: "DELETE")
        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return try await execute(request)
    }

    func upload<T: Decodable>(
        _ path: String,
        data: Data,
        filename: String,
        mimeType: String,
        fields: [String: String] = [:]
    ) async throws -> T {
        var request = try buildRequest(path: path, method: "POST")
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        for (key, value) in fields {
            body.appendString("--\(boundary)\r\n")
            body.appendString("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n")
            body.appendString("\(value)\r\n")
        }
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n")
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        body.appendString("\r\n--\(boundary)--\r\n")
        request.httpBody = body

        return try await execute(request)
    }

    // MARK: - Private Helpers

    private func buildRequest(path: String, method: String) throws -> URLRequest {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.badRequest("Invalid URL: \(path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = KeychainHelper.read(key: KeychainHelper.sessionTokenKey) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }
        try validateResponse(response, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch let decodingError as DecodingError {
            #if DEBUG
            let path = request.url?.path ?? "unknown"
            let preview = String(data: data.prefix(500), encoding: .utf8) ?? "<binary>"
            switch decodingError {
            case .typeMismatch(let type, let ctx):
                print("⚠️ DECODE [\(path)] typeMismatch: expected \(type) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))")
            case .valueNotFound(let type, let ctx):
                print("⚠️ DECODE [\(path)] valueNotFound: \(type) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))")
            case .keyNotFound(let key, let ctx):
                print("⚠️ DECODE [\(path)] keyNotFound: \(key.stringValue) at \(ctx.codingPath.map(\.stringValue).joined(separator: "."))")
            case .dataCorrupted(let ctx):
                print("⚠️ DECODE [\(path)] dataCorrupted at \(ctx.codingPath.map(\.stringValue).joined(separator: ".")): \(ctx.debugDescription)")
            @unknown default:
                print("⚠️ DECODE [\(path)] unknown error")
            }
            print("⚠️ DECODE response preview: \(preview)")
            #endif
            throw APIError.decodingError(decodingError)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 {
                // Only fire session-expired if there IS an active session token.
                // A 401 during login (no session yet) is just a normal auth error,
                // not a session expiry.
                if KeychainHelper.read(key: KeychainHelper.sessionTokenKey) != nil {
                    Task { @MainActor in
                        NotificationCenter.default.post(name: .userSessionExpired, object: nil)
                    }
                }
                throw APIError.unauthorized
            }

            let detail = parseDetail(from: data)

            switch http.statusCode {
            case 400:
                throw APIError.badRequest(detail ?? "Bad request")
            case 404:
                throw APIError.notFound
            case 500...599:
                throw APIError.serverError(detail ?? "Internal server error")
            default:
                throw APIError.unknown(http.statusCode, detail)
            }
        }
    }

    private func parseDetail(from data: Data) -> String? {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let detail = json["detail"] as? String {
            return detail
        }
        return nil
    }
}

// MARK: - Helpers

private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        _encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}

private extension Data {
    mutating func appendString(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}
