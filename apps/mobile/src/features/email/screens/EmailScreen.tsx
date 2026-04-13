import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, spacing, typography } from "@design/theme";
import { useDeviceType, getResponsiveSpacing, getResponsivePadding } from "@design/responsive";
import { getSmsSettings, updateSmsSetting } from "@lib/sms/smsSettingsStore";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";
import type { EmailConnector, EmailWorkspace, SmsAnalysisStatus } from "@lib/repositories/types";
import { FeatureScaffold } from "@shared/components/FeatureScaffold";
import { useSmsMessages } from "@features/sms/hooks/useSmsMessages";

const EMPTY_WORKSPACE: EmailWorkspace = {
  connectors: [],
  connectedCount: 0,
  totalPendingAi: 0,
  aiEndpointConfigured: false,
  aiSharedKeyConfigured: false,
  providerSetup: {
    google: { available: false, blockers: [] },
    microsoft: { available: false, blockers: [] },
  },
  actionBlockedReason: "",
};

const EMPTY_SMS_STATUS: SmsAnalysisStatus = {
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
};

export function EmailScreen() {
  const repo = useMemo(() => createLedgerRepository(), []);
  const device = useDeviceType();
  const smsHook = useSmsMessages();

  const [workspace, setWorkspace] = useState<EmailWorkspace>(EMPTY_WORKSPACE);
  const [smsStatus, setSmsStatus] = useState<SmsAnalysisStatus>(EMPTY_SMS_STATUS);
  const [smsSettings, setSmsSettings] = useState({ smsEnabled: false, autoDedup: true, lastScanDate: null as string | null, lastScanError: null as string | null });
  const [smsLogs, setSmsLogs] = useState<Array<{ timestamp: string; itemsFound: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncDates, setSyncDates] = useState<Record<string, string>>({});
  const aiReady = workspace.aiEndpointConfigured && workspace.aiSharedKeyConfigured;

  const loadSmsStatus = useCallback(async () => {
    try {
      const status = await repo.getSmsAnalysisStatus();
      setSmsStatus(status);

      const settings = await getSmsSettings(repo);
      setSmsSettings(settings);

      // TODO (Phase 2): Populate smsLogs from actual SMS scan history
      // For now, populate from lastScanDate if available
      if (settings.lastScanDate) {
        setSmsLogs([{ timestamp: settings.lastScanDate, itemsFound: status.completed }]);
      }
    } catch (err) {
      console.error("[SMS] Failed to load SMS status:", err);
      // Fail gracefully; don't block email loading
    }
  }, [repo]);

  const load = useCallback(async(isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await repo.getEmailWorkspace();
      setWorkspace(next);
      setSyncDates((prev) => {
        const merged = { ...prev };
        next.connectors.forEach((connector) => {
          if (!merged[connector.id]) {
            merged[connector.id] = connector.syncFromDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          }
        });
        return merged;
      });

      // Load SMS status
      await loadSmsStatus();

      setError("");
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to load email accounts"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repo, loadSmsStatus]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const runAction = async(key: string, work: () => Promise<void>) => {
    setBusyAction(key);
    setError("");
    setNotice("");
    try {
      await work();
      await load(true);
    } catch (err) {
      setError(String((err as Error)?.message || "Email action failed."));
    } finally {
      setBusyAction("");
    }
  };

  const connectProvider = (provider: "google" | "microsoft", existingConnectorId?: string) => {
    runAction(`${provider}:${existingConnectorId || "new"}:connect`, async() => {
      const connector = await repo.connectEmailProvider(provider, existingConnectorId ? { existingConnectorId } : undefined);
      setNotice(`${connector.provider} connected for ${connector.email || connector.label}.`);
    }).catch(() => undefined);
  };

  const disconnectProvider = (connector: EmailConnector) => {
    runAction(`${connector.id}:disconnect`, async() => {
      await repo.disconnectEmailConnector(connector.id);
      setNotice(`${connector.provider} disconnected on this device.`);
    }).catch(() => undefined);
  };

  const syncConnector = (connector: EmailConnector) => {
    runAction(`${connector.id}:sync`, async() => {
      const result = await repo.syncEmailConnector(connector.id, {
        fromDate: syncDates[connector.id] || connector.syncFromDate || "",
      });
      setNotice(
        result.addedToInbox > 0
          ? `${connector.provider} sync queued ${result.addedToInbox} inbox item(s).`
          : result.cloudQueued > 0
            ? `${connector.provider} sync handed ${result.cloudQueued} email(s) to background cloud processing.`
          : result.failed > 0
            ? `${connector.provider} sync queued ${result.failed} email(s) for AI retry.`
            : `${connector.provider} sync completed without new cashflow items.`,
      );
    }).catch(() => undefined);
  };

  const retryPending = (connector?: EmailConnector) => {
    runAction(`${connector?.id || "all"}:retry`, async() => {
      const result = await repo.retryEmailPending(connector?.id ? { connectorId: connector.id, force: true } : { force: true });
      setNotice(
        result.recovered > 0
          ? `AI retry recovered ${result.recovered} inbox item(s). ${result.remaining > 0 ? `${result.remaining} item(s) still pending.` : ""}`
          : result.retried > 0
            ? `AI retry processed ${result.retried} email(s). ${result.remaining} item(s) remain pending.`
            : result.remaining > 0
              ? `${result.remaining} AI-pending email(s) found. Retrying may need a fresh session or reconnected provider.`
              : "No AI-pending email items were available to retry.",
      );
    }).catch(() => undefined);
  };

  const toggleSmsScanning = () => {
    runAction("sms:toggle", async() => {
      const updated = { ...smsSettings, smsEnabled: !smsSettings.smsEnabled };
      await updateSmsSetting(repo, "smsEnabled", updated.smsEnabled);
      setSmsSettings(updated);
      setNotice(`SMS scanning ${updated.smsEnabled ? "enabled" : "disabled"}.`);
    }).catch(() => undefined);
  };

  const scanSmsNow = () => {
    runAction("sms:scan", async() => {
      if (smsHook.permissionState.status !== "granted") {
        throw new Error("SMS permission required. Request permission first.");
      }

      // Refresh SMS messages and trigger analysis
      await smsHook.refreshMessages();

      // Mark last scan time
      const now = new Date().toISOString();
      await updateSmsSetting(repo, "lastScanDate", now);
      setSmsSettings({ ...smsSettings, lastScanDate: now });

      // Reload SMS status
      await loadSmsStatus();

      setNotice("SMS scan completed. Analyzing messages...");
    }).catch(() => undefined);
  };

  const requestSmsPermission = () => {
    runAction("sms:permission", async() => {
      await smsHook.requestPermission();
      if (smsHook.permissionState.status === "granted") {
        setNotice("SMS permission granted. You can now scan SMS messages.");
      }
    }).catch(() => undefined);
  };

  return (
    <FeatureScaffold
      title="Email"
      subtitle="Native Gmail and Outlook connect, manual sync, and AI retry on top of the same cloud-backed LedgerAI inbox."
      rightLabel={`${workspace.connectedCount} connected`}
    >
      <AppCard style={styles.heroCard}>
        <View style={styles.heroRow}>
          <Text style={styles.cardTitle}>Connector Control</Text>
          <PrimaryButton
            title={refreshing ? "Refreshing..." : "Refresh status"}
            onPress={() => load(true)}
            disabled={refreshing || loading || Boolean(busyAction)}
            variant="secondary"
            size="small"
          />
        </View>
        <Text style={styles.note}>{workspace.actionBlockedReason}</Text>
        <View style={styles.actionGrid}>
          <PrimaryButton
            title={busyAction === "google:new:connect" ? "Connecting..." : "Connect Gmail"}
            onPress={() => connectProvider("google")}
            disabled={!workspace.providerSetup.google.available || Boolean(busyAction)}
            size="small"
          />
          <PrimaryButton
            title={busyAction === "microsoft:new:connect" ? "Connecting..." : "Connect Outlook"}
            onPress={() => connectProvider("microsoft")}
            disabled={!workspace.providerSetup.microsoft.available || Boolean(busyAction)}
            size="small"
            variant="secondary"
          />
          <PrimaryButton
            title={busyAction === "all:retry" ? "Retrying..." : "Retry AI Pending"}
            onPress={() => retryPending()}
            disabled={!aiReady || workspace.totalPendingAi === 0 || Boolean(busyAction)}
            size="small"
            variant="ghost"
          />
        </View>
        {!workspace.providerSetup.google.available ? <Text style={styles.blocked}>{workspace.providerSetup.google.blockers.join(". ")}</Text> : null}
        {!workspace.providerSetup.microsoft.available ? <Text style={styles.blocked}>{workspace.providerSetup.microsoft.blockers.join(". ")}</Text> : null}
      </AppCard>

      {!workspace.aiEndpointConfigured || !workspace.aiSharedKeyConfigured ? (
        <AppCard>
          <Text style={styles.warnTitle}>
            {!workspace.aiEndpointConfigured && !workspace.aiSharedKeyConfigured
              ? "AI worker access is not ready yet"
              : !workspace.aiEndpointConfigured
                ? "AI worker endpoint is unavailable"
                : "AI session auth is missing"}
          </Text>
          {!workspace.aiEndpointConfigured ? (
            <Text style={styles.note}>
              LedgerAI could not find its managed AI worker endpoint. Check the app build or deployment config before testing mobile email extraction.
            </Text>
          ) : null}
          {!workspace.aiSharedKeyConfigured ? (
            <Text style={styles.note}>
              Sign in again to refresh your LedgerAI session before syncing email, retrying AI, or importing statements.
            </Text>
          ) : null}
        </AppCard>
      ) : null}

      {smsHook.permissionState.status !== "unavailable" && (
        <AppCard style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>SMS Scanning</Text>
            <Text
              style={[
                styles.status,
                smsHook.permissionState.status === "granted" ? styles.statusGood : styles.statusWarn,
              ]}
            >
              {smsHook.permissionState.status === "granted"
                ? "Granted"
                : smsHook.permissionState.status === "denied"
                  ? "Denied"
                  : "Request"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <MetaPill
              label={`SMS ${smsSettings.smsEnabled ? "ON" : "OFF"}`}
              tone={smsSettings.smsEnabled ? "warn" : "neutral"}
            />
            {smsStatus.pending > 0 && (
              <MetaPill label={`Pending ${smsStatus.pending}`} tone="warn" />
            )}
            {smsSettings.lastScanDate ? (
              <MetaPill
                label={`Last scan ${new Date(smsSettings.lastScanDate).toLocaleDateString()} ${new Date(
                  smsSettings.lastScanDate
                ).toLocaleTimeString()}`}
                tone="neutral"
              />
            ) : (
              <MetaPill label="No scan yet" tone="neutral" />
            )}
          </View>

          {smsSettings.lastScanError ? (
            <Text style={styles.errorInline}>{smsSettings.lastScanError}</Text>
          ) : null}

          <View style={styles.actionGrid}>
            {smsHook.permissionState.status !== "granted" ? (
              <PrimaryButton
                title={busyAction === "sms:permission" ? "Requesting..." : "Request SMS Permission"}
                onPress={() => requestSmsPermission()}
                disabled={Boolean(busyAction)}
                size="small"
              />
            ) : null}

            {smsHook.permissionState.status === "granted" ? (
              <>
                <PrimaryButton
                  title={busyAction === "sms:toggle" ? "Updating..." : `${smsSettings.smsEnabled ? "Disable" : "Enable"} SMS Scanning`}
                  onPress={() => toggleSmsScanning()}
                  disabled={Boolean(busyAction)}
                  size="small"
                  variant={smsSettings.smsEnabled ? "secondary" : "ghost"}
                />
                <PrimaryButton
                  title={busyAction === "sms:scan" ? "Scanning..." : "Scan SMS Now"}
                  onPress={() => scanSmsNow()}
                  disabled={!smsSettings.smsEnabled || Boolean(busyAction) || smsHook.loading}
                  size="small"
                />
              </>
            ) : null}
          </View>

          {smsLogs.length > 0 ? (
            <View style={styles.logSection}>
              <Text style={styles.logTitle}>Recent Scans</Text>
              {smsLogs.slice(0, 5).map((log, idx) => (
                <View key={idx} style={styles.logEntry}>
                  <Text style={styles.logTime}>{new Date(log.timestamp).toLocaleString()}</Text>
                  <Text style={styles.logCount}>{log.itemsFound} items analyzed</Text>
                </View>
              ))}
            </View>
          ) : null}
        </AppCard>
      )}

      {workspace.connectors.map((connector) => {
        const providerKey = connector.provider === "Outlook" ? "microsoft" : "google";
        const needsStartDate = !connector.firstSyncCompleted;
        const connectLabel = connector.connected
          ? connector.reauthRequired || !connector.hasLocalSession
            ? "Reconnect"
            : "Refresh auth"
          : "Connect";

        // Determine sync status color: green=synced, yellow=pending AI, red=failed
        let statusDotColor = palette.accentSuccess;
        let statusTextColor = palette.accentSuccess;
        if (connector.lastError) {
          statusDotColor = palette.accentDanger;
          statusTextColor = palette.accentDanger;
        } else if (connector.pendingAiCount > 0) {
          statusDotColor = palette.accentWarn;
          statusTextColor = palette.accentWarn;
        }

        return (
          <AppCard key={connector.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.provider}>{connector.provider}</Text>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
                <Text style={[styles.status, { color: statusTextColor }]}>
                  {connector.lastError ? "Failed" : connector.pendingAiCount > 0 ? "Pending AI" : "Synced"}
                </Text>
              </View>
            </View>

            <Text style={styles.address}>{connector.label || connector.email}</Text>
            {connector.email ? <Text style={styles.emailMeta}>{connector.email}</Text> : null}

            <View style={styles.metaRow}>
              <MetaPill label={`AI pending ${connector.pendingAiCount}`} tone={connector.pendingAiCount > 0 ? "warn" : "neutral"} />
              {connector.pendingRetryDueCount > 0 ? <MetaPill label={`Due now ${connector.pendingRetryDueCount}`} tone="warn" /> : null}
              <MetaPill label={connector.lastSync ? `Last sync ${connector.lastSync}` : "No sync timestamp yet"} tone="neutral" />
              {!connector.hasLocalSession && connector.connected ? <MetaPill label="Reconnect on this device" tone="warn" /> : null}
            </View>

            <Text style={styles.note}>{connector.note}</Text>
            {connector.lastError ? <Text style={styles.errorInline}>{connector.lastError}</Text> : null}
            {connector.actionBlockedReason ? <Text style={styles.blocked}>{connector.actionBlockedReason}</Text> : null}

            {needsStartDate ? (
              <TextField
                label="First Sync Start Date"
                hint="Use YYYY-MM-DD. This is required only before the first mailbox scan."
                value={syncDates[connector.id] || ""}
                onChangeText={(value) => setSyncDates((prev) => ({ ...prev, [connector.id]: value }))}
                placeholder="2026-03-01"
              />
            ) : null}

            <View style={styles.actionGrid}>
              <PrimaryButton
                title={busyAction === `${connector.id}:sync` ? "Syncing..." : "Sync now"}
                onPress={() => syncConnector(connector)}
                disabled={!connector.canSync || !aiReady || Boolean(busyAction)}
                size="small"
              />
              <PrimaryButton
                title={busyAction === `${connector.id}:retry` ? "Retrying..." : "Retry AI"}
                onPress={() => retryPending(connector)}
                disabled={!connector.canRetryAi || !aiReady || Boolean(busyAction)}
                size="small"
                variant="secondary"
              />
              <PrimaryButton
                title={busyAction === `${providerKey}:${connector.id}:connect` ? "Connecting..." : connectLabel}
                onPress={() => connectProvider(providerKey, connector.id)}
                disabled={(!(connector.canReconnect || connector.canConnect)) || Boolean(busyAction)}
                size="small"
                variant="ghost"
              />
              <PrimaryButton
                title={busyAction === `${connector.id}:disconnect` ? "Disconnecting..." : "Disconnect"}
                onPress={() => disconnectProvider(connector)}
                disabled={!connector.canDisconnect || Boolean(busyAction)}
                size="small"
                variant="danger"
              />
            </View>
          </AppCard>
        );
      })}

      {!loading && !workspace.connectors.length ? (
        <AppCard>
          <Text style={styles.note}>No email connectors are stored for this account yet.</Text>
          <Text style={styles.blocked}>
            Use Connect Gmail or Connect Outlook above after provider client IDs are configured. Sync and AI retry also need the managed LedgerAI AI worker and an active signed-in session.
          </Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.cardTitle}>Queue visibility</Text>
        <Text style={styles.note}>Total AI-pending email items visible from cloud: {workspace.totalPendingAi}</Text>
        <Text style={styles.note}>Provider tokens remain only in secure local storage on this device. Supabase stores connector metadata and the resulting inbox items, not Gmail/Outlook secrets.</Text>
        <Text style={styles.note}>AI requests use your signed-in session by default, with worker-side verification for production safety.</Text>
      </AppCard>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.accentBlue} />
          <Text style={styles.note}>Loading email connectors...</Text>
        </View>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </FeatureScaffold>
  );
}

function MetaPill({ label, tone }: { label: string; tone: "neutral" | "warn" }) {
  return (
    <View style={[styles.metaPill, tone === "warn" && styles.metaPillWarn]}>
      <Text style={[styles.metaText, tone === "warn" && styles.metaTextWarn]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.sm,
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  card: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  provider: {
    ...typography.caption,
    color: palette.accentTeal,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    ...typography.caption,
    fontWeight: "700",
  },
  statusGood: {
    color: palette.accentSuccess,
  },
  statusWarn: {
    color: palette.accentWarn,
  },
  statusDanger: {
    color: palette.accentDanger,
  },
  address: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "600",
  },
  emailMeta: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  actionGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillWarn: {
    borderColor: palette.accentWarn,
    backgroundColor: "rgba(246, 183, 60, 0.14)",
  },
  metaText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "700",
  },
  metaTextWarn: {
    color: palette.accentWarn,
  },
  logSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  logTitle: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  logEntry: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  logTime: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  logCount: {
    ...typography.caption,
    color: palette.accentTeal,
    fontWeight: "600",
  },
  note: {
    ...typography.body,
    color: palette.textSecondary,
  },
  blocked: {
    ...typography.caption,
    color: palette.accentWarn,
  },
  warnTitle: {
    ...typography.h3,
    color: palette.accentWarn,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  notice: {
    ...typography.caption,
    color: palette.accentSuccess,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
  },
  errorInline: {
    ...typography.caption,
    color: palette.accentDanger,
  },
});
