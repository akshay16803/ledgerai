import UIKit
import UserNotifications
import os

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    private let logger = Logger(subsystem: "com.spentyai", category: "notifications")

    // MARK: - App Lifecycle

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        requestNotificationPermission(application: application)
        return true
    }

    // MARK: - Push Token Registration

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        logger.info("Device token registered: \(token.prefix(12))...")

        Task {
            await registerDeviceToken(token)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        logger.error("Push registration failed: \(error.localizedDescription)")
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Handle notification when app is in the foreground.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    /// Handle notification tap.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        logger.info("Notification tapped: \(userInfo.description)")
        handleNotificationPayload(userInfo)
        completionHandler()
    }

    // MARK: - Private Helpers

    private func requestNotificationPermission(application: UIApplication) {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { [weak self] granted, error in
            if let error {
                self?.logger.error("Notification permission error: \(error.localizedDescription)")
                return
            }

            if granted {
                self?.logger.info("Notification permission granted")
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            } else {
                self?.logger.info("Notification permission denied")
            }
        }
    }

    private func registerDeviceToken(_ token: String) async {
        struct DeviceTokenRequest: Codable {
            let deviceToken: String
            let platform: String

            enum CodingKeys: String, CodingKey {
                case deviceToken = "device_token"
                case platform
            }
        }

        do {
            let _: EmptyResponse = try await APIClient.shared.post(
                "/api/devices/register",
                body: DeviceTokenRequest(deviceToken: token, platform: "ios")
            )
            logger.info("Device token sent to backend")
        } catch {
            logger.error("Failed to register device token: \(error.localizedDescription)")
        }
    }

    private func handleNotificationPayload(_ userInfo: [AnyHashable: Any]) {
        // Route to the appropriate screen based on notification type.
        // Deep linking can be expanded here as features are built out.
        guard let type = userInfo["type"] as? String else { return }

        switch type {
        case "transaction":
            logger.info("Navigate to transaction detail")
        case "invoice":
            logger.info("Navigate to invoice detail")
        case "bill":
            logger.info("Navigate to bill detail")
        case "reconciliation":
            logger.info("Navigate to reconciliation")
        default:
            logger.info("Unhandled notification type: \(type)")
        }
    }
}
