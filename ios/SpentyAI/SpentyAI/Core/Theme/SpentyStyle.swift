import SwiftUI

// MARK: - Primary Button

struct PrimaryButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(SpentyFonts.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.spentyPrimary)
            .cornerRadius(12)
    }
}

// MARK: - Secondary Button

struct SecondaryButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(SpentyFonts.headline)
            .foregroundColor(.spentyPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.spentyPrimary.opacity(0.1))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.spentyPrimary, lineWidth: 1)
            )
    }
}

// MARK: - Destructive Button

struct DestructiveButtonStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(SpentyFonts.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.spentyError)
            .cornerRadius(12)
    }
}

// MARK: - Card Style

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(Color.spentyCardBg)
            .cornerRadius(16)
            .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Input Style

struct InputStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(SpentyFonts.body)
            .padding(12)
            .background(Color.spentyBgPrimary)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.spentyBorder, lineWidth: 1)
            )
    }
}

// MARK: - View Extension

extension View {
    func primaryButtonStyle() -> some View {
        modifier(PrimaryButtonStyle())
    }

    func secondaryButtonStyle() -> some View {
        modifier(SecondaryButtonStyle())
    }

    func destructiveButtonStyle() -> some View {
        modifier(DestructiveButtonStyle())
    }

    func cardStyle() -> some View {
        modifier(CardStyle())
    }

    func inputStyle() -> some View {
        modifier(InputStyle())
    }
}
