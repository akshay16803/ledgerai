import { StyleSheet, Text, View, Switch, ActivityIndicator } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { palette, spacing, typography } from "@design/theme";

/**
 * Props for SmsSettingsCard component
 */
export type SmsSettingsCardProps = {
  /** Whether SMS scanning is currently enabled */
  smsEnabled: boolean;
  /** Callback when user toggles SMS scanning */
  onToggleSms: (enabled: boolean) => void;
  /** Current SMS permission status on the device */
  permissionStatus: "checking" | "granted" | "denied" | "unavailable";
  /** Callback to request SMS permission from user */
  onRequestPermission: () => void;
  /** ISO timestamp of last SMS scan, or null if never scanned */
  lastScanDate?: string | null;
  /** Number of SMS messages pending analysis */
  pendingCount?: number;
  /** Whether auto-deduplication of SMS and email is enabled */
  autoDedup?: boolean;
  /** Callback when user toggles auto-dedup */
  onDedupToggle?: (enabled: boolean) => void;
  /** Whether any async operation is in progress */
  isLoading?: boolean;
};

/**
 * SMS Settings Card Component
 *
 * Displays SMS scanning controls, permission status, and configuration options.
 * Allows users to enable/disable SMS scanning, manage permissions, and configure
 * deduplication settings. Includes privacy notice about SMS data handling.
 *
 * @example
 * ```tsx
 * <SmsSettingsCard
 *   smsEnabled={true}
 *   onToggleSms={handleToggle}
 *   permissionStatus="granted"
 *   onRequestPermission={handleRequest}
 *   lastScanDate="2025-03-31T10:30:00Z"
 *   pendingCount={5}
 *   autoDedup={true}
 *   onDedupToggle={handleDedupToggle}
 * />
 * ```
 */
export function SmsSettingsCard({
  smsEnabled,
  onToggleSms,
  permissionStatus,
  onRequestPermission,
  lastScanDate,
  pendingCount = 0,
  autoDedup = true,
  onDedupToggle,
  isLoading = false,
}: SmsSettingsCardProps) {
  const isAvailable = permissionStatus !== "unavailable";
  const isGranted = permissionStatus === "granted";

  /**
   * Format ISO timestamp to human-readable relative time
   * @param isoDate - ISO 8601 timestamp string
   * @returns Formatted time string (e.g., "2 hours ago")
   */
  function formatLastScan(isoDate?: string | null): string {
    if (!isoDate) return "Never scanned";

    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  /**
   * Get permission status text for display
   * @returns User-friendly permission status string
   */
  function getPermissionStatusText(): string {
    switch (permissionStatus) {
      case "granted":
        return "Permission: Granted";
      case "denied":
        return "Permission: Denied";
      case "checking":
        return "Permission: Checking...";
      case "unavailable":
        return "SMS not available on iOS";
    }
  }

  return (
    <AppCard style={styles.card}>
      {/* Title and Main Toggle */}
      <View style={styles.titleRow}>
        <View style={styles.titleSection}>
          <Text style={styles.cardTitle}>SMS Scanning</Text>
          <Text style={styles.description}>
            Analyze SMS messages for transactions (Android only)
          </Text>
        </View>
        <Switch
          value={smsEnabled && isAvailable}
          onValueChange={onToggleSms}
          disabled={!isAvailable || isLoading}
          trackColor={{ false: palette.border, true: palette.accentTeal }}
          thumbColor={smsEnabled && isAvailable ? palette.accentBlue : palette.textSecondary}
        />
      </View>

      {/* Permission Status */}
      <View style={styles.statusRow}>
        <Text style={styles.label}>Permission Status</Text>
        <View style={styles.statusContent}>
          {permissionStatus === "checking" ? (
            <ActivityIndicator size="small" color={palette.accentBlue} />
          ) : (
            <Text style={styles.statusValue}>{getPermissionStatusText()}</Text>
          )}
        </View>
      </View>

      {/* Request Permission Button (if denied) */}
      {isAvailable && permissionStatus === "denied" && (
        <PrimaryButton
          title={isLoading ? "Requesting..." : "Request Permission"}
          onPress={onRequestPermission}
          disabled={isLoading}
          style={styles.requestButton}
          size="small"
        />
      )}

      {/* Stats: Pending and Last Scan */}
      {smsEnabled && isAvailable && (
        <View style={styles.statsSection}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Pending analyses</Text>
            <Text style={styles.statValue}>{pendingCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Last scan</Text>
            <Text style={styles.statValue}>{formatLastScan(lastScanDate)}</Text>
          </View>
        </View>
      )}

      {/* Auto-Deduplication Toggle */}
      {smsEnabled && isAvailable && onDedupToggle && (
        <View style={styles.dedupRow}>
          <View style={styles.dedupLabel}>
            <Text style={styles.label}>Auto-match emails & SMS</Text>
            <Text style={styles.description}>
              Automatically mark duplicate email and SMS messages
            </Text>
          </View>
          <Switch
            value={autoDedup}
            onValueChange={onDedupToggle}
            disabled={isLoading}
            trackColor={{ false: palette.border, true: palette.accentTeal }}
            thumbColor={autoDedup ? palette.accentBlue : palette.textSecondary}
          />
        </View>
      )}

      {/* Privacy Notice */}
      <View style={styles.privacyNotice}>
        <Text style={styles.privacyText}>
          <Text style={styles.privacyLabel}>Privacy: </Text>
          SMS messages are not stored. Only extracted transaction data is saved to your LedgerAI account.
        </Text>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  titleSection: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  description: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  statusRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    color: palette.textSecondary,
    flex: 1,
  },
  statusValue: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
    textAlign: "right",
  },
  requestButton: {
    marginTop: spacing.sm,
  },
  statsSection: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  statLabel: {
    ...typography.body,
    color: palette.textSecondary,
  },
  statValue: {
    ...typography.body,
    color: palette.accentSuccess,
    fontWeight: "700",
  },
  dedupRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  dedupLabel: {
    flex: 1,
    gap: spacing.xs,
  },
  privacyNotice: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: palette.surfaceElevated,
    borderRadius: spacing.xs,
    padding: spacing.sm,
  },
  privacyText: {
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  privacyLabel: {
    ...typography.caption,
    color: palette.accentWarn,
    fontWeight: "700",
  },
});
