import { StyleSheet, View, Text } from "react-native";
import { palette, spacing, radius, typography } from "@design/theme";

export type SourceType = "email" | "sms" | "both";
export type DedupStatus = "matched" | "unmatched" | "pending";

type SmsSourceIndicatorProps = {
  /**
   * Source type of the transaction
   * - "email": sourced from email only
   * - "sms": sourced from SMS only
   * - "both": matched email + SMS sources (deduped)
   */
  sourceType: SourceType;

  /**
   * Deduplication status (optional, only relevant for SMS items)
   * - "matched": successfully deduplicated with email item
   * - "unmatched": SMS item with no email match
   * - "pending": awaiting user review for potential match
   */
  dedupStatus?: DedupStatus;

  /**
   * Confidence score for dedup match (0-100)
   * Only used when dedupStatus="matched"
   */
  confidence?: number;

  /**
   * Optional custom style override
   */
  style?: any;
};

/**
 * Badge component showing transaction source type and dedup status
 *
 * Displays source information as a small, inline pill badge:
 * - Email: Blue pill with "Email" label
 * - SMS: Teal pill with "SMS" label
 * - Both: Purple pill with "Email+SMS" label and checkmark (indicates dedup match)
 *
 * For SMS items, optionally shows dedup confidence or status indicator.
 *
 * @example
 * // Email-sourced item
 * <SmsSourceIndicator sourceType="email" />
 *
 * // SMS-sourced item (unmatched)
 * <SmsSourceIndicator sourceType="sms" dedupStatus="unmatched" />
 *
 * // Deduped pair (email + SMS match)
 * <SmsSourceIndicator sourceType="both" dedupStatus="matched" confidence={95} />
 *
 * @example
 * // Pending review
 * <SmsSourceIndicator sourceType="sms" dedupStatus="pending" confidence={92} />
 */
export function SmsSourceIndicator({
  sourceType,
  dedupStatus,
  confidence,
  style,
}: SmsSourceIndicatorProps) {
  const badgeStyle = getBadgeStyle(sourceType);
  const label = getLabel(sourceType);
  const showCheckmark = sourceType === "both" && dedupStatus === "matched";

  return (
    <View style={[badgeStyle.container, style]}>
      <Text style={badgeStyle.text}>{label}</Text>
      {showCheckmark && <Text style={badgeStyle.checkmark}>✓</Text>}
      {confidence !== undefined && dedupStatus !== "matched" && (
        <Text style={badgeStyle.confidence}>{confidence}%</Text>
      )}
    </View>
  );
}

/**
 * Get badge styling based on source type
 */
function getBadgeStyle(sourceType: SourceType) {
  const baseContainer = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4,
  };

  const baseText = {
    ...typography.caption,
    fontWeight: "600" as const,
  };

  switch (sourceType) {
    case "email":
      return StyleSheet.create({
        container: { ...baseContainer, backgroundColor: palette.accentBlue + "20" },
        text: { ...baseText, color: palette.accentBlue },
        checkmark: { fontSize: 12, color: palette.accentBlue, fontWeight: "700" as const },
        confidence: { fontSize: 11, color: palette.accentBlue, fontWeight: "500" as const },
      });

    case "sms":
      return StyleSheet.create({
        container: { ...baseContainer, backgroundColor: palette.accentTeal + "20" },
        text: { ...baseText, color: palette.accentTeal },
        checkmark: { fontSize: 12, color: palette.accentTeal, fontWeight: "700" as const },
        confidence: { fontSize: 11, color: palette.accentTeal, fontWeight: "500" as const },
      });

    case "both":
      // Purple: blend of blue + teal
      const purpleBase = "#9B5DE5";
      return StyleSheet.create({
        container: { ...baseContainer, backgroundColor: purpleBase + "20" },
        text: { ...baseText, color: purpleBase },
        checkmark: { fontSize: 12, color: palette.accentSuccess, fontWeight: "700" as const },
        confidence: { fontSize: 11, color: purpleBase, fontWeight: "500" as const },
      });

    default:
      return StyleSheet.create({
        container: baseContainer,
        text: baseText,
        checkmark: { fontSize: 12, fontWeight: "700" as const },
        confidence: { fontSize: 11, fontWeight: "500" as const },
      });
  }
}

/**
 * Get readable label for source type
 */
function getLabel(sourceType: SourceType): string {
  switch (sourceType) {
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    case "both":
      return "Email + SMS";
    default:
      return "Unknown";
  }
}
