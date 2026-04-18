import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL = "https://accounts.niprasha.com"
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            let formatters: [DateFormatter] = [
                {
                    let f = DateFormatter()
                    f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZ"
                    f.locale = Locale(identifier: "en_US_POSIX")
                    return f
                }(),
                {
                    let f = DateFormatter()
                    f.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
                    f.locale = Locale(identifier: "en_US_POSIX")
                    return f
                }(),
                {
                    let f = DateFormatter()
                    f.dateFormat = "yyyy-MM-dd"
                    f.locale = Locale(identifier: "en_US_POSIX")
                    return f
                }()
            ]

            for formatter in formatters {
                if let date = formatter.date(from: dateString) {
                    return date
                }
            }

            if let iso = ISO8601DateFormatter().date(from: dateString) {
                return iso
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        self.encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: - Public Methods

    func get<T: Decodable>(_ path: String, query: [String: String]? = nil) async throws -> T {
        let request = try await buildRequest(path: path, method: "GET", query: query)
        return try await execute(request)
    }

    func post<T: Decodable>(_ path: String, body: (any Encodable)? = nil) async throws -> T {
        var request = try await buildRequest(path: path, method: "POST")
        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return try await execute(request)
    }

    func put<T: Decodable>(_ path: String, body: any Encodable) async throws -> T {
        var request = try await buildRequest(path: path, method: "PUT")
        request.httpBody = try encoder.encode(AnyEncodable(body))
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    func delete(_ path: String) async throws {
        let request = try await buildRequest(path: path, method: "DELETE")
        let (data, response) = try await session.data(for: request)
        try mapStatusCodeToError(response: response, data: data)
    }

    func upload<T: Decodable>(
        _ path: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        extraFields: [String: String]? = nil
    ) async throws -> T {
        let (body, boundary) = MultipartUpload.buildBody(
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            extraFields: extraFields
        )
        var request = try await buildRequest(path: path, method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        return try await execute(request)
    }

    // MARK: - Private Helpers

    private func buildRequest(
        path: String,
        method: String,
        query: [String: String]? = nil
    ) async throws -> URLRequest {
        guard var components = URLComponents(string: baseURL + path) else {
            throw APIError.badRequest("Invalid URL path: \(path)")
        }

        if let query, !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        guard let url = components.url else {
            throw APIError.badRequest("Could not construct URL for path: \(path)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = await TokenManager.shared.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }
        try mapStatusCodeToError(response: response, data: data)
        return try handleResponse(data: data)
    }

    private func handleResponse<T: Decodable>(data: Data) throws -> T {
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func mapStatusCodeToError(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else { return }
        let statusCode = httpResponse.statusCode

        guard !(200..<300).contains(statusCode) else { return }

        let message = extractErrorMessage(from: data)

        switch statusCode {
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 400:
            throw APIError.badRequest(message ?? "Bad request")
        case 500...:
            throw APIError.serverError(message ?? "Internal server error")
        default:
            throw APIError.unknown(statusCode, message)
        }
    }

    private func extractErrorMessage(from data: Data) -> String? {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return json["detail"] as? String ?? json["message"] as? String
        }
        return String(data: data, encoding: .utf8)
    }
}

// MARK: - Type Erasure for Encodable

private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ value: any Encodable) {
        _encode = value.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
