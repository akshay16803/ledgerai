import SwiftUI

/// A styled search input with a magnifying glass icon and a clear button.
struct SearchBar: View {
    @Binding var text: String
    let placeholder: String

    /// Creates a SearchBar.
    /// - Parameters:
    ///   - text: Binding to the search query string.
    ///   - placeholder: Placeholder text shown when the field is empty.
    init(text: Binding<String>, placeholder: String = "Search...") {
        self._text = text
        self.placeholder = placeholder
    }

    var body: some View {
        HStack(spacing: SpentySpacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundStyle(SpentyColors.textMuted)

            TextField(placeholder, text: $text)
                .font(SpentyFonts.body)
                .foregroundStyle(SpentyColors.textPrimary)

            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(SpentyColors.textMuted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, SpentySpacing.md)
        .padding(.vertical, SpentySpacing.sm + 2)
        .background(SpentyColors.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: SpentyRadius.md)
                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
        )
    }
}

#Preview {
    VStack(spacing: SpentySpacing.lg) {
        SearchBar(text: .constant(""), placeholder: "Search invoices...")
        SearchBar(text: .constant("Acme Corp"))
    }
    .padding()
    .background(SpentyColors.bgPrimary)
}
