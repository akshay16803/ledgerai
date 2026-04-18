import SwiftUI

@Observable
final class Router {
    var path = NavigationPath()

    func navigate<T: Hashable>(to destination: T) {
        path.append(destination)
    }

    func pop() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }

    func popToRoot() {
        path = NavigationPath()
    }
}

// MARK: - Routable Destinations

/// Enum-based destinations for type-safe programmatic navigation.
/// Extend this as feature screens are added.
enum AppDestination: Hashable {
    case transactionDetail(id: String)
    case accountDetail(id: String)
    case invoiceDetail(id: String)
    case billDetail(id: String)
    case customerDetail(id: String)
    case vendorDetail(id: String)
    case settings
    case billing
}
