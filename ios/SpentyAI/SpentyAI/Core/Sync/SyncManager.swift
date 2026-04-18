import Foundation
import BackgroundTasks

// MARK: - Sync Scope

/// Defines which data domain should be refreshed after a mutation or sync event.
enum SyncScope: String, CaseIterable {
    case dashboard
    case transactions
    case accounts
    case invoices
    case bills
    case all
}

// MARK: - Notification Names

extension Notification.Name {
    static let spentyDidRefreshDashboard = Notification.Name("spentyDidRefreshDashboard")
    static let spentyDidRefreshTransactions = Notification.Name("spentyDidRefreshTransactions")
    static let spentyDidRefreshAccounts = Notification.Name("spentyDidRefreshAccounts")
    static let spentyDidRefreshInvoices = Notification.Name("spentyDidRefreshInvoices")
    static let spentyDidRefreshBills = Notification.Name("spentyDidRefreshBills")
}

// MARK: - SyncManager

/// Manages background and foreground data refresh for the SpentyAI app.
///
/// Coordinates sync operations and posts `Notification` events so that
/// individual ViewModels can react to data changes without tight coupling.
@Observable
final class SyncManager {

    // MARK: - Properties

    /// Whether a sync operation is currently in progress.
    private(set) var isSyncing = false

    /// The date of the last successful sync, or `nil` if no sync has occurred.
    private(set) var lastSyncDate: Date?

    /// The most recent sync error, cleared on the next successful sync.
    private(set) var syncError: Error?

    /// Background task identifier registered with the system.
    static let backgroundTaskIdentifier = "com.spentyai.app.refresh"

    // MARK: - Background Refresh

    /// Registers the background app refresh task with `BGTaskScheduler`.
    /// Call once during app launch (e.g. in `App.init` or the app delegate).
    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.backgroundTaskIdentifier,
            using: nil
        ) { [weak self] task in
            guard let task = task as? BGAppRefreshTask else { return }
            self?.handleBackgroundRefresh(task: task)
        }
    }

    /// Schedules the next background app refresh request.
    func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.backgroundTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("[SyncManager] Failed to schedule background refresh: \(error)")
        }
    }

    /// Handles an incoming background refresh task.
    private func handleBackgroundRefresh(task: BGAppRefreshTask) {
        // Schedule the next refresh before starting work.
        scheduleBackgroundRefresh()

        let refreshTask = Task {
            await performSync(scope: .dashboard)
        }

        task.expirationHandler = {
            refreshTask.cancel()
        }

        Task {
            _ = await refreshTask.result
            task.setTaskCompleted(success: syncError == nil)
        }
    }

    // MARK: - Foreground Refresh

    /// Called when the app enters the foreground (via `ScenePhase.active`).
    /// Refreshes key data if enough time has elapsed since the last sync.
    @MainActor
    func foregroundRefresh() async {
        // Skip if a sync is already running.
        guard !isSyncing else { return }

        // Only auto-refresh if the last sync was more than 5 minutes ago.
        if let last = lastSyncDate, Date().timeIntervalSince(last) < 300 {
            return
        }

        await performSync(scope: .all)
    }

    // MARK: - Post-Mutation Refresh

    /// After a CRUD operation, selectively refresh the affected data domain.
    /// - Parameter scope: The `SyncScope` indicating which data changed.
    @MainActor
    func postMutationRefresh(scope: SyncScope) async {
        await performSync(scope: scope)
    }

    // MARK: - Core Sync

    /// Performs the actual sync work and posts the appropriate notifications.
    @MainActor
    private func performSync(scope: SyncScope) async {
        isSyncing = true
        syncError = nil

        do {
            // Determine which scopes to refresh.
            let scopes: [SyncScope] = scope == .all ? [.dashboard, .transactions, .accounts, .invoices, .bills] : [scope]

            for s in scopes {
                try Task.checkCancellation()
                postNotification(for: s)
            }

            lastSyncDate = Date()
        } catch {
            syncError = error
        }

        isSyncing = false
    }

    // MARK: - Notifications

    /// Posts the corresponding refresh notification for a given scope.
    private func postNotification(for scope: SyncScope) {
        let name: Notification.Name = switch scope {
        case .dashboard:    .spentyDidRefreshDashboard
        case .transactions: .spentyDidRefreshTransactions
        case .accounts:     .spentyDidRefreshAccounts
        case .invoices:     .spentyDidRefreshInvoices
        case .bills:        .spentyDidRefreshBills
        case .all:          .spentyDidRefreshDashboard // handled by iterating all scopes
        }
        NotificationCenter.default.post(name: name, object: nil)
    }
}
