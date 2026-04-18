import SwiftUI

/// Trend direction for stat cards.
enum TrendDirection {
    case up, down, neutral
}

/// A reusable metric card that displays a key statistic with an icon,
/// large value, optional subtitle, and optional trend indicator.
struct StatCard: View {
    let title: String
    let value: String
    let subtitle: String?
    let icon: String
    let iconColor: Color
    let trend: (direction: TrendDirection, percentage: Double)?

    /// Creates a StatCard.
    /// - Parameters:
    ///   - title: The metric label (e.g. "Total Revenue").
    ///   - value: The formatted metric value (e.g. "₹12,450").
    ///   - subtitle: Optional secondary text below the value.
    ///   - icon: SF Symbol name for the leading icon.
    ///   - iconColor: Tint color for the icon.
    ///   - trend: Optional trend indicator with direction and percentage.
    init(
        title: String,
        value: String,
        subtitle: String? = nil,
        icon: String,
        iconColor: Color = SpentyColors.brandAccent,
        trend: (direction: TrendDirection, percentage: Double)? = nil
    ) {
        self.title = title
        self.value = value
        self.subtitle = subtitle
        self.icon = icon
        self.iconColor = iconColor
        self.trend = trend
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SpentySpacing.sm) {
            // Top row: icon + title
            HStack(spacing: SpentySpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(iconColor)

                Text(title)
                    .font(SpentyFonts.caption)
                    .foregroundStyle(SpentyColors.textSecondary)

                Spacer()
            }

            // Large value
            Text(value)
                .font(SpentyFonts.stat)
                .foregroundStyle(SpentyColors.textPrimary)

            // Bottom row: subtitle and/or trend
            if subtitle != nil || trend != nil {
                HStack(spacing: SpentySpacing.sm) {
                    if let subtitle {
                        Text(subtitle)
                            .font(SpentyFonts.caption)
                            .foregroundStyle(SpentyColors.textMuted)
                    }

                    Spacer()

                    if let trend {
                        trendView(trend)
                    }
                }
            }
        }
        .padding(SpentySpacing.lg)
        .background(SpentyColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: SpentyRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: SpentyRadius.card)
                .stroke(SpentyColors.borderSubtle, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func trendView(_ trend: (direction: TrendDirection, percentage: Double)) -> some View {
        let color: Color = switch trend.direction {
        case .up: SpentyColors.success
        case .down: SpentyColors.danger
        case .neutral: SpentyColors.textMuted
        }
        let arrow: String = switch trend.direction {
        case .up: "arrow.up.right"
        case .down: "arrow.down.right"
        case .neutral: "arrow.right"
        }

        HStack(spacing: SpentySpacing.xs) {
            Image(systemName: arrow)
                .font(.system(size: 10, weight: .semibold))
            Text(String(format: "%.1f%%", trend.percentage))
                .font(SpentyFonts.caption)
        }
        .foregroundStyle(color)
    }
}

#Preview {
    VStack(spacing: SpentySpacing.lg) {
        StatCard(
            title: "Total Revenue",
            value: "₹1,24,500",
            subtitle: "This month",
            icon: "indianrupeesign.circle.fill",
            iconColor: SpentyColors.success,
            trend: (.up, 12.5)
        )
        StatCard(
            title: "Pending Invoices",
            value: "7",
            subtitle: "₹34,200 outstanding",
            icon: "doc.text.fill",
            iconColor: SpentyColors.warning,
            trend: (.down, 3.2)
        )
    }
    .padding()
    .background(SpentyColors.bgPrimary)
}
