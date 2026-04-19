import SwiftUI

struct LoginView: View {

    // MARK: - State

    @State private var viewModel: AuthViewModel

    // MARK: - Init

    init(authManager: AuthManager) {
        _viewModel = State(initialValue: AuthViewModel(authManager: authManager))
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.spentyBgPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // ── Logo & Branding ──────────────────────────────
                brandingSection

                Spacer()

                // ── Sign-in area ─────────────────────────────────
                signInSection
                    .padding(.bottom, 48)
            }
            .padding(.horizontal, 32)
        }
        .alert("Sign In Error", isPresented: $viewModel.showError) {
            Button("OK") { viewModel.dismissError() }
        } message: {
            Text(viewModel.errorMessage)
        }
    }

    // MARK: - Sub-views

    private var brandingSection: some View {
        VStack(spacing: 16) {
            // App icon / logo mark
            ZStack {
                Circle()
                    .fill(Color.spentyPrimary.opacity(0.12))
                    .frame(width: 96, height: 96)

                Image(systemName: "dollarsign.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 56, height: 56)
                    .foregroundStyle(Color.spentyPrimary)
            }

            Text("SpentyAI")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(Color.spentyPrimary)

            Text("Smart spending starts here")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var signInSection: some View {
        VStack(spacing: 20) {
            // Error inline banner (secondary to the alert)
            if viewModel.showError {
                errorBanner
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            // Google Sign-In button
            Button {
                Task { await viewModel.signInWithGoogle() }
            } label: {
                HStack(spacing: 12) {
                    // Google "G" placeholder (SF Symbol)
                    Image(systemName: "g.circle.fill")
                        .resizable()
                        .frame(width: 22, height: 22)

                    Text("Sign in with Google")
                        .font(.body.weight(.semibold))
                }
                .frame(maxWidth: .infinity, minHeight: 52)
                .foregroundStyle(.white)
                .background(Color.spentyPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(color: Color.spentyPrimary.opacity(0.3), radius: 8, y: 4)
            }
            .disabled(viewModel.isLoading)
            .opacity(viewModel.isLoading ? 0.6 : 1)

            // Loading indicator
            if viewModel.isLoading {
                ProgressView()
                    .tint(Color.spentyPrimary)
                    .transition(.opacity)
            }

            // Terms / footer
            Text("By continuing you agree to our\n[Terms of Service](https://spentyai.com/terms) & [Privacy Policy](https://spentyai.com/privacy)")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .tint(Color.spentyPrimary)
                .padding(.top, 8)
        }
        .animation(.easeInOut(duration: 0.25), value: viewModel.isLoading)
        .animation(.easeInOut(duration: 0.25), value: viewModel.showError)
    }

    private var errorBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(viewModel.errorMessage)
                .font(.caption)
                .foregroundStyle(.primary)
            Spacer()
            Button {
                viewModel.dismissError()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

// MARK: - Preview

#Preview {
    LoginView(authManager: AuthManager())
}
