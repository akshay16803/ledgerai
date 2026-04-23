import SwiftUI

struct FilterBar: View {
    @Environment(LocalizationManager.self) var lang
    let filters: [String]
    @Binding var selected: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(filters, id: \.self) { filter in
                    Button {
                        selected = filter
                    } label: {
                        Text(lang.s(filter.lowercased()))
                            .font(SpentyFonts.footnote)
                            .fontWeight(selected == filter ? .semibold : .regular)
                            .foregroundColor(selected == filter ? .white : .spentyTextPrimary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(selected == filter ? Color.spentyPrimary : Color.spentyBgPrimary)
                            .cornerRadius(20)
                            .overlay(
                                RoundedRectangle(cornerRadius: 20)
                                    .stroke(selected == filter ? Color.clear : Color.spentyBorder, lineWidth: 1)
                            )
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }
}

#Preview {
    @Previewable @State var selection = "All"
    FilterBar(filters: ["All", "Income", "Expense", "Transfer"], selected: $selection)
}
