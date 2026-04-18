import Foundation
import Network

// MARK: - Connection Type

/// Describes the current network connection type.
enum ConnectionType: String {
    case wifi
    case cellular
    case none
}

// MARK: - NetworkMonitor

/// Observes network reachability using `NWPathMonitor` and exposes
/// connectivity state to SwiftUI views via `@Observable`.
///
/// Inject as an environment object so any view can react to connectivity
/// changes (e.g. showing an offline indicator).
@Observable
final class NetworkMonitor {

    // MARK: - Properties

    /// Whether the device currently has an active network connection.
    private(set) var isConnected = true

    /// The type of the current network connection.
    private(set) var connectionType: ConnectionType = .wifi

    // MARK: - Private

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.spentyai.networkmonitor", qos: .utility)

    // MARK: - Init

    init() {
        startMonitoring()
    }

    deinit {
        monitor.cancel()
    }

    // MARK: - Monitoring

    /// Starts the path monitor and updates published properties on the main actor.
    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }

            let connected = path.status == .satisfied

            let type: ConnectionType
            if path.usesInterfaceType(.wifi) {
                type = .wifi
            } else if path.usesInterfaceType(.cellular) {
                type = .cellular
            } else {
                type = .none
            }

            Task { @MainActor in
                self.isConnected = connected
                self.connectionType = type
            }
        }

        monitor.start(queue: queue)
    }
}
