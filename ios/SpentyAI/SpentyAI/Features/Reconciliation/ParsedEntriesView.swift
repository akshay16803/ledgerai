import SwiftUI

/// Reusable component that renders a list of ParsedEntry items with search,
/// category badges, and a summary footer.
struct ParsedEntriesView: View {

    let entries: [ParsedEntry]
    let categories: [Category]
    let onEditEntry: (Int) -> Void

    @State private var searchText = ""

    // MARK: - Computed

    private var filteredEntries: [(index: Int, entry: ParsedEntry)] {
        let indexed = entries.enumerated().map { (index: $0.offset, entry: $0.element) }

        guard !searchText.isEmpty else { return indexed }

        return indexed.filter { item in
            guard let description = item.entry.description else { return false }
            return description.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var totalDebits: Double {
        entries.compactMap(\.debit).reduce(0, +)
    }

    private var totalCredits: Double {
        entries.compactMap(\.credit).reduce(0, +)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.md) {
            // Search bar
            SearchBar(text: $searchText)

            // Entries list
            LazyVStack(spacing: SpentySpacing.sm) {
                ForEach(filteredEntries, id: \.index) { item in
                    entryRow(item.entry, index: item.index)
                }
            }

            // Summary footer
            summaryFooter
        }
    }

    // MARK: - Entry Row

    private func entryRow(_ entry: ParsedEntry, index: Int) -> some View {
        SpentyCard {
            VStack(alignment: .leading, spacing: SpentySpacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        // Description
                        Text(entry.description ?? "No description")
                            .font(SpentyFonts.body)
                            .foregroundStyle(SpentyColors.textPrimary)
                            .lineLimit(2)

                        // Date
                        if let date = entry.date {
                            Text(date)
                                .font(SpentyFonts.caption)
                                .foregroundStyle(SpentyColors.textMuted)
                        }
                    }

                    Spacer()

                    // Amount
                    if let debit = entry.debit, debit > 0 {
                        MoneyText(-debit, showSign: true, size: SpentyFonts.subheading)
                    } else if let credit = entry.credit, credit > 0 {
                        MoneyText(credit, showSign: true, size: SpentyFonts.subheading)
                    }
                }

                // Category badge
                if let categoryId = entry.categoryId {
                    categoryBadge(categoryId: categoryId, subcategoryId: entry.subcategoryId)
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            onEditEntry(index)
        }
    }

    // MARK: - Category Badge

    private func categoryBadge(categoryId: String, subcategoryId: String?) -> some View {
        let categoryName = resolveCategoryName(categoryId: categoryId, subcategoryId: subcategoryId)

        return HStack(spacing: SpentySpacing.xs) {
            Image(systemName: "tag.fill")
                .font(.system(size: 10))
                .foregroundStyle(SpentyColors.brandAccent)

            Text(categoryName)
                .font(SpentyFonts.caption)
                .foregroundStyle(SpentyColors.brandAccent)
        }
        .padding(.horizontal, SpentySpacing.sm)
        .padding(.vertical, SpentySpacing.xs)
        .background(SpentyColors.brandAccent.opacity(0.1))
        .clipShape(Capsule())
    }

    // MARK: - Summary Footer

    private var summaryFooter: some View {
        SpentyCard {
            VStack(spacing: SpentySpacing.md) {
                Divider()
                    .overlay(SpentyColors.borderSubtle)

                HStack {
                    VStack(alignment: .leading, spacing: SpentySpacing.xs) {
                        Text("TOTAL DEBITS")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(SpentyColors.textMuted)
                        MoneyText(-totalDebits, showSign: true, size: SpentyFonts.subheading)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: SpentySpacing.xs) {
                        Text("TOTAL CREDITS")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(SpentyColors.textMuted)
                        MoneyText(totalCredits, showSign: true, size: SpentyFonts.subheading)
                    }
                }

                HStack {
                    Text("\(entries.count) entries")
                        .font(SpentyFonts.caption)
                        .foregroundStyle(SpentyColors.textSecondary)

                    Spacer()

                    let net = totalCredits - totalDebits
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("NET")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(SpentyColors.textMuted)
                        MoneyText(net, showSign: true, size: SpentyFonts.mono)
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private func resolveCategoryName(categoryId: String, subcategoryId: String?) -> String {
        // Try to find the subcategory first
        if let subId = subcategoryId,
           let sub = categories.first(where: { $0.categoryId == subId }),
           let parentId = sub.parentId,
           let parent = categories.first(where: { $0.categoryId == parentId }) {
            return "\(parent.name) / \(sub.name)"
        }

        // Fall back to parent category
        if let category = categories.first(where: { $0.categoryId == categoryId }) {
            return category.name
        }

        return categoryId
    }
}

#Preview {
    ScrollView {
        ParsedEntriesView(
            entries: [
                ParsedEntry(date: "2026-03-01", description: "ATM Withdrawal - Branch XYZ", debit: 5000, credit: nil, categoryId: nil),
                ParsedEntry(date: "2026-03-05", description: "Salary Credit", debit: nil, credit: 85000, categoryId: "cat-1"),
                ParsedEntry(date: "2026-03-10", description: "Amazon Purchase", debit: 2499, credit: nil, categoryId: nil),
                ParsedEntry(date: "2026-03-15", description: "UPI Payment - Zomato", debit: 450, credit: nil, categoryId: "cat-2"),
            ],
            categories: [],
            onEditEntry: { _ in }
        )
        .padding()
    }
    .background(SpentyColors.bgPrimary)
}
