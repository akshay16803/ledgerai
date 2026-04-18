import SwiftUI
import Combine

struct SearchBar: View {
    let placeholder: String
    @Binding var text: String
    var onCommit: (() -> Void)?

    @State private var debounceTask: Task<Void, Never>?
    var debounceInterval: Duration = .milliseconds(300)
    var onDebounced: ((String) -> Void)?

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.spentyTextSecondary)
                .font(.system(size: 16))

            TextField(placeholder, text: $text)
                .font(SpentyFonts.body)
                .foregroundColor(.spentyTextPrimary)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .onSubmit {
                    onCommit?()
                }
                .onChange(of: text) { _, newValue in
                    guard let onDebounced else { return }
                    debounceTask?.cancel()
                    debounceTask = Task {
                        try? await Task.sleep(for: debounceInterval)
                        guard !Task.isCancelled else { return }
                        onDebounced(newValue)
                    }
                }

            if !text.isEmpty {
                Button {
                    text = ""
                    onDebounced?("")
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.spentyTextSecondary)
                        .font(.system(size: 16))
                }
            }
        }
        .padding(10)
        .background(Color.spentyBgPrimary)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.spentyBorder, lineWidth: 1)
        )
    }
}

#Preview {
    @Previewable @State var query = ""
    SearchBar(placeholder: "Search transactions...", text: $query)
        .padding()
}
