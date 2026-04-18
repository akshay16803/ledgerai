import SwiftUI

/// A labeled text field with validation support.
/// Shows a label above the input, styled border, and an optional
/// red error message below when validation fails.
struct FormField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    let keyboardType: UIKeyboardType
    let isRequired: Bool
    let errorMessage: String?
    let isSecure: Bool

    /// Creates a FormField.
    /// - Parameters:
    ///   - label: The label displayed above the input.
    ///   - text: Binding to the text value.
    ///   - placeholder: Placeholder text for the input.
    ///   - keyboardType: Keyboard type (default: `.default`).
    ///   - isRequired: Whether to show a required indicator (*).
    ///   - errorMessage: Optional error text shown below the field in red.
    ///   - isSecure: Whether to use a SecureField instead of TextField.
    init(
        _ label: String,
        text: Binding<String>,
        placeholder: String = "",
        keyboardType: UIKeyboardType = .default,
        isRequired: Bool = false,
        errorMessage: String? = nil,
        isSecure: Bool = false
    ) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
        self.keyboardType = keyboardType
        self.isRequired = isRequired
        self.errorMessage = errorMessage
        self.isSecure = isSecure
    }

    private var hasError: Bool {
        errorMessage != nil
    }

    private var borderColor: Color {
        hasError ? SpentyColors.danger : SpentyColors.borderSubtle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.xs) {
            // Label
            HStack(spacing: 2) {
                Text(label)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                if isRequired {
                    Text("*")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.danger)
                }
            }

            // Input
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                }
            }
            .font(SpentyFonts.body)
            .foregroundStyle(SpentyColors.textPrimary)
            .padding(.horizontal, SpentySpacing.md)
            .padding(.vertical, SpentySpacing.sm + 2)
            .background(SpentyColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SpentyRadius.md)
                    .stroke(borderColor, lineWidth: 1)
            )

            // Error message
            if let errorMessage {
                Text(errorMessage)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.danger)
            }
        }
    }
}

#Preview {
    VStack(spacing: SpentySpacing.lg) {
        FormField("Email", text: .constant(""), placeholder: "you@example.com", isRequired: true)
        FormField("Company", text: .constant("Acme Corp"), placeholder: "Company name")
        FormField(
            "Password",
            text: .constant(""),
            placeholder: "Enter password",
            isRequired: true,
            errorMessage: "Password must be at least 8 characters",
            isSecure: true
        )
    }
    .padding()
    .background(SpentyColors.bgPrimary)
}
