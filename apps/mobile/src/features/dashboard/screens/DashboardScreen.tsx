import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, type AppStateStatus, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { StatCard } from "@design/components/StatCard";
import { palette, spacing, typography } from "@design/theme";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";
import type { DashboardSummary, SettingsSummary, SmsAnalysisStatus } from "@lib/repositories/types";
import { FeatureScaffold } from "@shared/components/FeatureScaffold";
import { useDeviceType } from "@design/responsive";
import { DEFAULT_BASE_CURRENCY, DEFAULT_AI_MODEL } from "@lib/constants";

const DEFAULT_SUMMARY: DashboardSummary = {
  totalIncome: 0,
  totalExpense: 0,
  net: 0,
  todayIncome: 0,
  todayExpense: 0,
  todayCount: 0,
  currency: DEFAULT_BASE_CURRENCY,
};

const EMPTY_SETTINGS: SettingsSummary = {
  baseCurrency: DEFAULT_BASE_CURRENCY,
  emailCount: 0,
  accountCount: 0,
  pendingInboxCount: 0,
  transactionCount: 0,
  aiEndpointConfigured: false,
  aiSharedKeyConfigured: false,
  aiModel: DEFAULT_AI_MODEL,
};

const EMPTY_SMS_STATUS: SmsAnalysisStatus = {
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
};

function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardScreen() {
  const repo = useMemo(() => createLedgerRepository(), []);
  const device = useDeviceType();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [summary, setSummary] = useState<DashboardSummary>(DEFAULT_SUMMARY);
  const [settings, setSettings] = useState<SettingsSummary>(EMPTY_SETTINGS);
  const [smsStatus, setSmsStatus] = useState<SmsAnalysisStatus>(EMPTY_SMS_STATUS);

  const loadDashboard = async () => {
    try {
      console.log("[DASHBOARD] Loading dashboard data");
      const [nextSummary, nextSettings, nextSmsStatus] = await Promise.all([
        repo.getDashboardSummary(),
        repo.getSettingsSummary(),
        repo.getSmsAnalysisStatus(),
      ]);
      setSummary(nextSummary);
      setSettings(nextSettings);
      setSmsStatus(nextSmsStatus);
      setError("");
      console.log("[DASHBOARD] Dashboard loaded successfully");
    } catch (err) {
      const message = String((err as Error)?.message || "Unable to load dashboard");
      console.error("[DASHBOARD] Error loading dashboard:", message);
      setError(message);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadDashboard().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [repo]);

  // Subscribe to transaction changes for real-time updates
  useEffect(() => {
    let active = true;
    setSyncStatus("syncing");

    const unsubscribe = repo.subscribeToTransactions((tx) => {
      console.log("[DASHBOARD] Transaction update via subscription:", tx.id);
      if (active) {
        repo
          .getDashboardSummary()
          .then((data) => {
            if (active) {
              setSummary(data);
              setSyncStatus("idle");
            }
          })
          .catch((err) => {
            console.warn("[DASHBOARD] Failed to sync transaction:", err);
            if (active) setSyncStatus("error");
          });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repo]);

  // Handle app focus for delta sync
  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();

    async function handleAppStateChange(state: AppStateStatus) {
      if (state === "active") {
        console.log("[DASHBOARD] App came to foreground; performing delta sync");
        setSyncStatus("syncing");
        try {
          const lastSyncTime = await repo.getLastSyncTime();
          const delta = await repo.getChangesSinceLast(lastSyncTime);
          if (delta.transactions.length > 0 || delta.inboxItems.length > 0) {
            const updatedSummary = await repo.getDashboardSummary();
            setSummary(updatedSummary);
            await repo.recordSyncTime(delta.syncedAt);
          }
          setSyncStatus("idle");
        } catch (err) {
          console.warn("[DASHBOARD] Delta sync failed:", err);
          setSyncStatus("error");
        }
      }
    }
  }, [repo]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  };

  const netToday = summary.todayIncome - summary.todayExpense;
  const hasSmsPending = smsStatus.pending > 0;
  const hasSmsError = smsStatus.failed > 0 || (smsStatus.lastAnalysisAt && !summary.todayCount);

  // Determine column count based on device type
  const numColumns = device === "tablet" ? 4 : 2;
  const statCardFlex = 1 / numColumns;

  return (
    <FeatureScaffold
      title="Dashboard"
      subtitle="Live finance pulse across your authenticated LedgerAI workspace."
      rightLabel="Cloud mode"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={!loading}
        refreshControl={
          !loading ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accentBlue} />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Today's Metrics Grid */}
        <View style={styles.grid}>
          <View style={[styles.statCardWrapper, { flex: statCardFlex }]}>
            <StatCard
              label="Today Income"
              value={formatMoney(summary.todayIncome, summary.currency)}
              tone="success"
            />
          </View>
          <View style={[styles.statCardWrapper, { flex: statCardFlex }]}>
            <StatCard
              label="Today Expense"
              value={formatMoney(summary.todayExpense, summary.currency)}
              tone="danger"
            />
          </View>
          {device === "tablet" && (
            <>
              <View style={[styles.statCardWrapper, { flex: statCardFlex }]}>
                <StatCard
                  label="Net Today"
                  value={formatMoney(netToday, summary.currency)}
                  tone={netToday >= 0 ? "success" : "danger"}
                />
              </View>
              <View style={[styles.statCardWrapper, { flex: statCardFlex }]}>
                <StatCard label="Entries" value={String(summary.todayCount)} tone="warn" />
              </View>
            </>
          )}
        </View>

        {/* Net Today and Entries for phone */}
        {device === "phone" && (
          <View style={styles.grid}>
            <View style={[styles.statCardWrapper, { flex: 0.5 }]}>
              <StatCard
                label="Net Today"
                value={formatMoney(netToday, summary.currency)}
                tone={netToday >= 0 ? "success" : "danger"}
              />
            </View>
            <View style={[styles.statCardWrapper, { flex: 0.5 }]}>
              <StatCard label="Entries" value={String(summary.todayCount)} tone="warn" />
            </View>
          </View>
        )}

        {/* Sync Status Indicator */}
        {syncStatus === "syncing" && (
          <AppCard style={[styles.card, styles.syncingCard]}>
            <View style={styles.syncingContent}>
              <ActivityIndicator size="small" color={palette.accentBlue} />
              <Text style={styles.syncingText}>Syncing real-time updates...</Text>
            </View>
          </AppCard>
        )}
        {syncStatus === "error" && (
          <AppCard style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>Sync error - retrying...</Text>
          </AppCard>
        )}

        {/* Portfolio Totals */}
        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Portfolio Totals</Text>
          <View style={styles.row}>
            <Text style={styles.key}>Total Income</Text>
            <Text style={[styles.value, styles.success]}>
              {formatMoney(summary.totalIncome, summary.currency)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Total Expense</Text>
            <Text style={[styles.value, styles.danger]}>
              {formatMoney(summary.totalExpense, summary.currency)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Net Position</Text>
            <Text style={styles.value}>{formatMoney(summary.net, summary.currency)}</Text>
          </View>
        </AppCard>

        {/* Workspace Health */}
        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Workspace Health</Text>
          <View style={styles.row}>
            <Text style={styles.key}>Base currency</Text>
            <Text style={styles.value}>{settings.baseCurrency}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Accounts</Text>
            <Text style={styles.value}>{settings.accountCount}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Pending inbox</Text>
            <Text style={styles.value}>{settings.pendingInboxCount}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>AI worker endpoint</Text>
            <Text style={[styles.value, settings.aiEndpointConfigured ? styles.success : styles.danger]}>
              {settings.aiEndpointConfigured ? "Configured" : "Missing"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>AI session access</Text>
            <Text style={[styles.value, settings.aiSharedKeyConfigured ? styles.success : styles.danger]}>
              {settings.aiSharedKeyConfigured ? "Active" : "Missing"}
            </Text>
          </View>
        </AppCard>

        {/* SMS Scan Status */}
        {(hasSmsPending || hasSmsError) && (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>SMS Scan Status</Text>
            {hasSmsPending && (
              <View style={styles.row}>
                <Text style={styles.key}>Pending analyses</Text>
                <Text style={[styles.value, styles.warn]}>{smsStatus.pending}</Text>
              </View>
            )}
            {smsStatus.processing > 0 && (
              <View style={styles.row}>
                <Text style={styles.key}>Processing</Text>
                <Text style={[styles.value, styles.warn]}>{smsStatus.processing}</Text>
              </View>
            )}
            {hasSmsError && (
              <View style={styles.row}>
                <Text style={styles.key}>Failed</Text>
                <Text style={[styles.value, styles.danger]}>{smsStatus.failed}</Text>
              </View>
            )}
            {smsStatus.completed > 0 && (
              <View style={styles.row}>
                <Text style={styles.key}>Completed</Text>
                <Text style={[styles.value, styles.success]}>{smsStatus.completed}</Text>
              </View>
            )}
            {smsStatus.nextRetryAt && (
              <View style={styles.row}>
                <Text style={styles.key}>Next retry</Text>
                <Text style={styles.value}>{new Date(smsStatus.nextRetryAt).toLocaleString()}</Text>
              </View>
            )}
          </AppCard>
        )}

        {/* Error State */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.accentBlue} />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        )}
      </ScrollView>
    </FeatureScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCardWrapper: {
    minWidth: 0,
  },
  card: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: palette.textPrimary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  key: {
    ...typography.body,
    color: palette.textSecondary,
    flex: 1,
  },
  value: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
    textAlign: "right",
    marginLeft: spacing.sm,
  },
  success: {
    color: palette.accentSuccess,
  },
  danger: {
    color: palette.accentDanger,
  },
  warn: {
    color: palette.accentWarn,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: palette.textSecondary,
  },
  error: {
    ...typography.body,
    color: palette.accentDanger,
    marginTop: spacing.md,
  },
  syncingCard: {
    backgroundColor: palette.bgSecondary,
    borderColor: palette.accentBlue,
    borderWidth: 1,
  },
  syncingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  syncingText: {
    ...typography.body,
    color: palette.textSecondary,
  },
  errorCard: {
    backgroundColor: palette.bgSecondary,
    borderColor: palette.accentDanger,
    borderWidth: 1,
  },
  errorText: {
    ...typography.body,
    color: palette.accentDanger,
  },
});
