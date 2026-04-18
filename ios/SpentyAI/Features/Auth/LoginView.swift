import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = LoginViewModel()

    var body: some View {
        ZStack {
            SpentyColors.brandPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo & tagline
                VStack(spacing: SpentySpacing.md) {
                    Text("SpentyAI")
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(.white)

                    Text("Autonomous Accounting")
                        .font(.system(size: 18, weight: .regular))
                        .foregroundStyle(.white.opacity(0.7))
                }

                Spacer()

                // Sign in section
                VStack(spacing: SpentySpacing.xl) {
                    googleSignInButton

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.danger)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, SpentySpacing.xxl)
                    }
                }

                Spacer()
                    .frame(height: 60)

                // Legal links
                legalLinks
                    .padding(.bottom, SpentySpacing.xxl)
            }
            .padding(.horizontal, SpentySpacing.xl)

            if viewModel.isSigningIn {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()

                ProgressView()
                    .tint(.white)
                    .controlSize(.large)
            }
        }
    }

    // MARK: - Google Sign In Button

    private var googleSignInButton: some View {
        Button {
            Task {
                await viewModel.signInWithGoogle(appState: appState)
            }
        } label: {
            HStack(spacing: SpentySpacing.md) {
                // Google "G" icon placeholder
                ZStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(.white)
                        .frame(width: 24, height: 24)

                    Text("G")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(
                            .linearGradient(
                                colors: [.red, .yellow, .green, .blue],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }

                Text("Sign in with Google")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(SpentyColors.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, SpentySpacing.md + 2)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
        }
        .disabled(viewModel.isSigningIn)
        .padding(.horizontal, SpentySpacing.lg)
    }

    // MARK: - Legal Links

    private var legalLinks: some View {
        HStack(spacing: SpentySpacing.lg) {
            Link("Privacy Policy", destination: URL(string: "https://accounts.niprasha.com/privacy")!)
            Text("·")
            Link("Terms of Service", destination: URL(string: "https://accounts.niprasha.com/terms")!)
        }
        .font(SpentyFonts.caption)
        .foregroundStyle(.white.opacity(0.5))
    }
}

#Preview {
    LoginView()
        .environment(AppState())
}
