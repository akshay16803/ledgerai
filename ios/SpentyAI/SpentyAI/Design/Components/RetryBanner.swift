import SwiftUI

// MARK: - RetryBanner

/// A banner that appears at the top of the screen to communicate errors or
/// connectivity issues, with an optional retry action.
///
/// Usage:
/// ```swift
/// RetryBanner(
///     message: "Failed to load transactions",
///     isVisible: viewModel.hasError,
///     retryAction: { await viewModel.reload() }
/// )
/// ```
struct RetryBanner: View {
    let message: String
    var retryAction: (() async -> Void)?
    var isVisible: Bool

    @State private var isRetrying = false

    var body: some View {
        if isVisible {
            HStack(spacing: SpentySpacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(SpentyColors.danger)

                Text(message)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textPrimary)
                    .lineLimit(2)

                Spacer()

                if let retryAction {
                    Button {
                        Task {
                            isRetrying = true
                            await retryAction()
                            isRetrying = false
                        }
                    } label: {
                        if isRetrying {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Text("Retry")
                                .font(SpentyFonts.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(SpentyColors.brandAccent)
                        }
                    }
                    .disabled(isRetrying)
                }
            }
            .padding(.horizontal, SpentySpacing.lg)
            .padding(.vertical, SpentySpacing.md)
            .background(SpentyColors.danger.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(SpentyColors.danger.opacity(0.25), lineWidth: 1)
            )
            .padding(.horizontal, SpentySpacing.lg)
            .transition(.move(edge: .top).combined(with: .opacity))
            .animation(.easeInOut(duration: 0.3), value: isVisible)
        }
    }
}

// MARK: - OfflineIndicator

/// A compact bar shown when the device has no network connectivity.
///
/// Reads `NetworkMonitor` from the environment and auto-shows/hides.
///
/// Usage:
/// ```swift
/// VStack {
///     OfflineIndicator(networkMonitor: networkMonitor)
///     // ... rest of content
/// }
/// ```
struct OfflineIndicator: View {
    let networkMonitor: NetworkMonitor

    var body: some View {
        if !networkMonitor.isConnected {
            HStack(spacing: SpentySpacing.xs) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 12, weight: .medium))

                Text("You're offline")
                    .font(SpentyFonts.caption)
                    .fontWeight(.medium)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, SpentySpacing.xs)
            .background(SpentyColors.warning)
            .transition(.move(edge: .top).combined(with: .opacity))
            .animation(.easeInOut(duration: 0.3), value: networkMonitor.isConnected)
        }
    }
}

// MARK: - Previews

#Preview("Retry Banner") {
    VStack(spacing: SpentySpacing.lg) {
        RetryBanner(
            message: "Failed to load transactions. Please try again.",
            retryAction: {
                try? await Task.sleep(for: .seconds(1))
            },
            isVisible: true
        )

        RetryBanner(
            message: "Something went wrong",
            isVisible: true
        )

        Spacer()
    }
    .padding(.top, SpentySpacing.lg)
    .background(SpentyColors.bgPrimary)
}

#Preview("Offline Indicator") {
    VStack {
        OfflineIndicator(networkMonitor: {
            let monitor = NetworkMonitor()
            return monitor
        }())

        Spacer()
    }
}
