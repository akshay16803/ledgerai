import Foundation

// MARK: - Cache Keys

/// Predefined keys for cached data. Using an enum avoids typo-based bugs
/// and makes it easy to discover what is cacheable.
enum CacheKey: String, CaseIterable {
    case dashboard
    case accounts
    case transactions
    case categories
    case settings
}

// MARK: - CacheManager

/// A simple file-based JSON cache backed by the system Caches directory.
///
/// Each cached value is stored as a separate JSON file alongside a companion
/// metadata file that records the write timestamp, enabling time-based
/// freshness checks via ``isCacheValid(key:maxAge:)``.
final class CacheManager {

    // MARK: - Singleton

    static let shared = CacheManager()

    // MARK: - Private

    private let fileManager = FileManager.default
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    /// Root directory for all SpentyAI cache files.
    private var cacheDirectory: URL {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = caches.appendingPathComponent("SpentyAICache", isDirectory: true)

        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        }

        return dir
    }

    private init() {}

    // MARK: - Public API

    /// Encodes `data` to JSON and writes it to disk under the given key.
    /// A companion metadata file is written to record the timestamp.
    func save<T: Encodable>(_ data: T, key: String) {
        do {
            let jsonData = try encoder.encode(data)
            let fileURL = url(for: key)
            try jsonData.write(to: fileURL, options: .atomic)

            // Write timestamp metadata.
            let meta = CacheMeta(savedAt: Date())
            let metaData = try encoder.encode(meta)
            try metaData.write(to: metaURL(for: key), options: .atomic)
        } catch {
            print("[CacheManager] Failed to save key '\(key)': \(error)")
        }
    }

    /// Convenience overload that accepts a ``CacheKey``.
    func save<T: Encodable>(_ data: T, key: CacheKey) {
        save(data, key: key.rawValue)
    }

    /// Loads and decodes a previously cached value, or returns `nil` if not
    /// found or if decoding fails.
    func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        let fileURL = url(for: key)
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? decoder.decode(type, from: data)
    }

    /// Convenience overload that accepts a ``CacheKey``.
    func load<T: Decodable>(_ type: T.Type, key: CacheKey) -> T? {
        load(type, key: key.rawValue)
    }

    /// Removes the cached file (and its metadata) for the given key.
    func clear(key: String) {
        try? fileManager.removeItem(at: url(for: key))
        try? fileManager.removeItem(at: metaURL(for: key))
    }

    /// Convenience overload that accepts a ``CacheKey``.
    func clear(key: CacheKey) {
        clear(key: key.rawValue)
    }

    /// Removes all cached files managed by SpentyAI.
    func clearAll() {
        try? fileManager.removeItem(at: cacheDirectory)
    }

    /// Returns `true` when a cached value exists for `key` and was written
    /// less than `maxAge` seconds ago.
    func isCacheValid(key: String, maxAge: TimeInterval) -> Bool {
        guard let meta: CacheMeta = loadMeta(for: key) else { return false }
        return Date().timeIntervalSince(meta.savedAt) < maxAge
    }

    /// Convenience overload that accepts a ``CacheKey``.
    func isCacheValid(key: CacheKey, maxAge: TimeInterval) -> Bool {
        isCacheValid(key: key.rawValue, maxAge: maxAge)
    }

    // MARK: - Helpers

    private func url(for key: String) -> URL {
        cacheDirectory.appendingPathComponent("\(key).json")
    }

    private func metaURL(for key: String) -> URL {
        cacheDirectory.appendingPathComponent("\(key)_meta.json")
    }

    private func loadMeta(for key: String) -> CacheMeta? {
        guard let data = try? Data(contentsOf: metaURL(for: key)) else { return nil }
        return try? decoder.decode(CacheMeta.self, from: data)
    }
}

// MARK: - CacheMeta

/// Internal metadata stored alongside each cached value.
private struct CacheMeta: Codable {
    let savedAt: Date
}
