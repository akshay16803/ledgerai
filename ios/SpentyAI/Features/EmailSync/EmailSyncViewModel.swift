import Foundation
import AuthenticationServices
import SwiftUI

@Observable
final class EmailSyncViewModel {

    // MARK: - State

    var gmailStatus: EmailSyncStatus?
    var outlookStatus: EmailSyncStatus?
    var pendingTransactions: [PendingTransaction] = []
    var isLoading = false
    var isSyncing = false
    var error: String?
    var showDisconnectConfirm: String? // provider name or nil

    // MARK: - Private

    private let repository = EmailSyncRepository()

    // MARK: - Load All

    func loadAll() async {
        isLoading = true
        error = nil

        async let gmail: () = loadGmailStatus()
        async let outlook: () = loadOutlookStatus()
        async let pending: () = loadPending()

        _ = await (gmail, outlook, pending)
        isLoading = false
    }

    func loadGmailStatus() async {
        do {
            gmailStatus = try await repository.getGmailStatus()
        } catch {
            gmailStatus = EmailSyncStatus(
                connected: false,
                lastSyncDate: nil,
                totalRecords: nil,
                foundTransactions: nil,
                skippedCount: nil,
                pendingCount: nil,
                failedCount: nil
            )
        }
    }

    func loadOutlookStatus() async {
        do {
            outlookStatus = try await repository.getOutlookStatus()
        } catch {
            outlookStatus = EmailSyncStatus(
                connected: false,
                lastSyncDate: nil,
                totalRecords: nil,
                foundTransactions: nil,
                skippedCount: nil,
                pendingCount: nil,
                failedCount: nil
            )
        }
    }

    func loadPending() async {
        do {
            pendingTransactions = try await repository.getPendingReview()
        } catch {
            pendingTransactions = []
        }
    }

    // MARK: - Connect

    func connectGmail() async {
        do {
            let authResponse = try await repository.getGmailAuthURL()
            guard let url = URL(string: authResponse.url) else {
                self.error = "Invalid Gmail auth URL"
                return
            }
            let callbackCode = try await performOAuth(url: url, callbackScheme: "spentyai")
            let _: AuthURLResponse = try await APIClient.shared.request(
                APIEndpoints.Gmail.callback,
                method: .get,
                queryItems: [URLQueryItem(name: "code", value: callbackCode)]
            )
            await loadGmailStatus()
            await loadPending()
        } catch {
            self.error = "Failed to connect Gmail: \(error.localizedDescription)"
        }
    }

    func connectOutlook() async {
        do {
            let authResponse = try await repository.getOutlookAuthURL()
            guard let url = URL(string: authResponse.url) else {
                self.error = "Invalid Outlook auth URL"
                return
            }
            let callbackCode = try await performOAuth(url: url, callbackScheme: "spentyai")
            let _: AuthURLResponse = try await APIClient.shared.request(
                APIEndpoints.Outlook.callback,
                method: .get,
                queryItems: [URLQueryItem(name: "code", value: callbackCode)]
            )
            await loadOutlookStatus()
            await loadPending()
        } catch {
            self.error = "Failed to connect Outlook: \(error.localizedDescription)"
        }
    }

    // MARK: - Sync

    func syncGmail() async {
        isSyncing = true
        do {
            let result = try await repository.syncGmail()
            if !result.success {
                self.error = result.message ?? "Gmail sync failed"
            }
            await loadGmailStatus()
            await loadPending()
        } catch {
            self.error = "Gmail sync failed: \(error.localizedDescription)"
        }
        isSyncing = false
    }

    func syncOutlook() async {
        isSyncing = true
        do {
            let result = try await repository.syncOutlook()
            if !result.success {
                self.error = result.message ?? "Outlook sync failed"
            }
            await loadOutlookStatus()
            await loadPending()
        } catch {
            self.error = "Outlook sync failed: \(error.localizedDescription)"
        }
        isSyncing = false
    }

    // MARK: - Disconnect

    func disconnectGmail() async {
        do {
            try await repository.disconnectGmail()
            gmailStatus = EmailSyncStatus(
                connected: false,
                lastSyncDate: nil,
                totalRecords: nil,
                foundTransactions: nil,
                skippedCount: nil,
                pendingCount: nil,
                failedCount: nil
            )
            await loadPending()
        } catch {
            self.error = "Failed to disconnect Gmail: \(error.localizedDescription)"
        }
    }

    func disconnectOutlook() async {
        do {
            try await repository.disconnectOutlook()
            outlookStatus = EmailSyncStatus(
                connected: false,
                lastSyncDate: nil,
                totalRecords: nil,
                foundTransactions: nil,
                skippedCount: nil,
                pendingCount: nil,
                failedCount: nil
            )
            await loadPending()
        } catch {
            self.error = "Failed to disconnect Outlook: \(error.localizedDescription)"
        }
    }

    // MARK: - Transaction Actions

    func approveTransaction(_ id: String) async {
        pendingTransactions.removeAll { $0.id == id }
    }

    func rejectTransaction(_ id: String) async {
        pendingTransactions.removeAll { $0.id == id }
    }

    // MARK: - Refresh

    func refresh() async {
        await loadAll()
    }

    // MARK: - OAuth Helper

    @MainActor
    private func performOAuth(url: URL, callbackScheme: String) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL,
                      let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                      let code = components.queryItems?.first(where: { $0.name == "code" })?.value
                else {
                    continuation.resume(throwing: EmailSyncError.oauthFailed)
                    return
                }
                continuation.resume(returning: code)
            }
            session.prefersEphemeralWebBrowserSession = true
            session.presentationContextProvider = OAuthPresentationContext.shared
            session.start()
        }
    }
}

// MARK: - Error

enum EmailSyncError: LocalizedError {
    case oauthFailed

    var errorDescription: String? {
        switch self {
        case .oauthFailed:
            return "OAuth authentication failed. Please try again."
        }
    }
}

// MARK: - OAuth Presentation Context

private final class OAuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = OAuthPresentationContext()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first
        else {
            return ASPresentationAnchor()
        }
        return window
    }
}
